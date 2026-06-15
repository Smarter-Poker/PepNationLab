import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const grokKey = process.env.GROK_API_KEY;

if (!supabaseUrl || !supabaseKey || !grokKey) {
  console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROK_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function grokGenerate(prompt: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${grokKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Grok API error: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Empty response from Grok');
  return text;
}

async function run() {
  console.log('Fetching compounds...');
  const { data: compounds, error } = await supabase
    .from('compounds')
    .select('id, slug, display_name, mechanism, side_effects, warnings, molecular_target')
    .is('eli5_summary', null);

  if (error || !compounds) {
    console.error('Failed to fetch compounds', error);
    process.exit(1);
  }

  console.log(`Found ${compounds.length} compounds missing ELI5 summaries.`);

  for (const compound of compounds) {
    console.log(`Generating summary for ${compound.display_name}...`);
    const prompt = `
You are an expert scientific communicator tasked with explaining a complex research peptide/compound to a beginner researcher in simple "Explain Like I'm 5" (ELI5) terms.

Compound Name: ${compound.display_name}
Mechanism of Action: ${compound.mechanism || 'Unknown'}
Molecular Target: ${compound.molecular_target || 'Unknown'}
Side Effects/Warnings: ${compound.side_effects || ''} ${compound.warnings || ''}

Please generate exactly 3 bullet points that summarize:
1. What the compound actually does in the body (in plain English, using analogies if helpful).
2. The primary real-world benefit researchers look for.
3. The most important safety warning or side effect to watch out for.

Keep the bullet points concise but highly educational. Format as a clean markdown list. Do not use generic AI disclaimers.
`;

    try {
      const summary = await grokGenerate(prompt);

      await supabase
        .from('compounds')
        .update({ eli5_summary: summary })
        .eq('id', compound.id);
        
      console.log(`Saved summary for ${compound.display_name}`);
    } catch (err) {
      console.error(`Failed to generate/save summary for ${compound.slug}:`, err);
    }
    
    // Slight delay to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Done!');
}

run();

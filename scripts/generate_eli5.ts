import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiKey) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ai = new GoogleGenAI({ apiKey: geminiKey });

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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const summary = response.text;
      if (!summary) throw new Error('Empty response');

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

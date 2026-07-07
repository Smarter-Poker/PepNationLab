import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  // Look up compound by slug
  const { data, error } = await supabase
    .from('compounds')
    .select('name, description, half_life, clinical_dosage, warnings, evidence_tier, categories')
    .eq('slug', slug.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error('Error fetching intelligence:', error);
    return NextResponse.json({ error: 'Failed to fetch intelligence' }, { status: 500 });
  }

  if (!data) {
    // Return dummy/fallback intelligence if not found in db, so UI still works
    return NextResponse.json({ 
      intelligence: {
        name: slug,
        description: 'Research compound data pending review.',
        evidence_tier: 'Emerging',
        half_life: 'Varies',
        clinical_dosage: 'Refer to research protocols',
        warnings: 'For research purposes only. Not for human consumption.'
      }
    });
  }

  return NextResponse.json({ intelligence: data });
}

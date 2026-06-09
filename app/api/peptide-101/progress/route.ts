/**
 * Account-bound progress for the Peptide 101 course.
 *   GET  -> { progress: {...} | null }  current user's progress
 *   POST -> { progress: {...} }         upsert current_screen / completed_modules /
 *                                       quiz_scores / assessment / certified flag
 * Owner-RLS on course_progress enforces that users only read/write their own row.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const COURSE = 'peptide-101';
const COLS =
  'current_screen, completed_modules, quiz_scores, assessment_score, assessment_total, certified_at, updated_at';

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('course_progress')
    .select(COLS)
    .eq('course', COURSE)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ progress: data ?? null });
}

interface ProgressBody {
  current_screen?: unknown;
  completed_modules?: unknown;
  quiz_scores?: unknown;
  assessment_score?: unknown;
  assessment_total?: unknown;
  certified?: unknown;
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: ProgressBody;
  try {
    body = (await req.json()) as ProgressBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const row: Record<string, unknown> = { user_id: user.id, course: COURSE };
  if (typeof body.current_screen === 'string') row.current_screen = body.current_screen.slice(0, 16);
  if (Array.isArray(body.completed_modules)) {
    row.completed_modules = body.completed_modules
      .filter((x): x is string => typeof x === 'string')
      .slice(0, 64);
  }
  if (body.quiz_scores && typeof body.quiz_scores === 'object' && !Array.isArray(body.quiz_scores)) {
    row.quiz_scores = body.quiz_scores;
  }
  if (Number.isInteger(body.assessment_score)) row.assessment_score = body.assessment_score as number;
  if (Number.isInteger(body.assessment_total)) row.assessment_total = body.assessment_total as number;
  if (body.certified === true) row.certified_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('course_progress')
    .upsert(row, { onConflict: 'user_id,course' })
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ progress: data });
}

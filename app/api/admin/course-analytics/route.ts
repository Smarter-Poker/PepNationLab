/**
 * Admin-only completion analytics for the Peptide 101 course.
 * Aggregates course_progress into a per-module completion funnel +
 * certification rate. Gated by requireAdmin(); reads via the service client.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MODULES: [string, string][] = [
  ['s1', 'What Is A Peptide?'],
  ['s2', 'Building A Peptide'],
  ['s3', 'The Lock And Key'],
  ['s4', 'What Peptides Are Studied For'],
  ['s5', 'Handling And Storage'],
  ['s6', 'Peptide Families'],
  ['s7', 'Stacking And Protocols'],
  ['s8', 'Reconstitution Calculator'],
  ['s9', 'Dosing Reference'],
  ['s11', 'What Peptides Are NOT'],
  ['s12', 'Why Peptides Are Injected'],
  ['s13', 'Safety, Purity And Sourcing'],
  ['s14', 'Legality And Research Use'],
];

interface Row {
  completed_modules: unknown;
  assessment_score: number | null;
  certified_at: string | null;
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('course_progress')
    .select('completed_modules, assessment_score, certified_at')
    .eq('course', 'peptide-101');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Row[];
  const has = (r: Row, id: string) =>
    Array.isArray(r.completed_modules) && (r.completed_modules as string[]).includes(id);
  const enrolled = rows.length;
  const certified = rows.filter((r) => !!r.certified_at).length;
  const funnel = MODULES.map(([id, title]) => ({
    id,
    title,
    completed: rows.filter((r) => has(r, id)).length,
  }));
  const avgModules =
    enrolled === 0
      ? 0
      : rows.reduce(
          (a, r) => a + (Array.isArray(r.completed_modules) ? (r.completed_modules as string[]).length : 0),
          0
        ) / enrolled;
  const scores = rows
    .map((r) => r.assessment_score)
    .filter((s): s is number => typeof s === 'number' && s > 0);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return NextResponse.json({
    enrolled,
    certified,
    completionRate: enrolled ? Math.round((certified / enrolled) * 100) : 0,
    avgModules: Math.round(avgModules * 10) / 10,
    avgScore: Math.round(avgScore),
    totalModules: MODULES.length,
    funnel,
  });
}

/**
 * StacksSeoContent - SERVER component (no 'use client').
 *
 * /research/stacks renders its entire body through StacksClient ('use client'),
 * so before hydration the initial HTML carried only the hero H1 and intro - AI
 * crawlers (GPTBot, ClaudeBot, PerplexityBot, CCBot) and non-JS Googlebot saw
 * no actual stack content. This block renders the real semantic content of the
 * page - every curated research stack, its purpose, and its component compounds
 * linked to their monographs - into the initial HTML, visually hidden via the
 * site-wide clip-rect pattern (crawler- and screen-reader-accessible; mirrors
 * the interactive content, NOT keyword stuffing). Title Case on headings/labels.
 * No emojis. Do not remove.
 */

import type { Compound } from '@/lib/compounds';

export default function StacksSeoContent({
  stacks,
  compounds,
}: {
  stacks: Compound[];
  compounds: Compound[];
}) {
  // Resolve a stack component slug/name to a linkable monograph.
  const bySlug = new Map(compounds.map((c) => [c.slug.toLowerCase(), c]));
  const byName = new Map(compounds.map((c) => [c.display_name.toLowerCase(), c]));
  const resolve = (ref: string): Compound | undefined =>
    bySlug.get(ref.toLowerCase()) ?? byName.get(ref.toLowerCase());

  const sorted = [...stacks]
    .filter((s) => s.slug && s.display_name)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <section
      aria-label="Peptide Research Stacks Overview"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      <h2>Curated Peptide Research Stacks</h2>
      <p>
        A Research Stack Is A Combination Of Two Or More Peptides Studied Together For A Shared
        Research Goal. Each Stack Below Lists Its Purpose And The Individual Compounds It Combines,
        Every One Linked To Its Full Research Monograph. All Combinations Are Documented For In
        Vitro Laboratory Research Use Only - Not For Human Or Animal Use.
      </p>

      {sorted.length === 0 ? (
        <p>Curated Research Stacks Are Being Compiled. Browse The Full Compound Library In The Meantime.</p>
      ) : (
        <ul>
          {sorted.map((stack) => {
            const components = (stack.stack_components ?? []).filter(Boolean);
            return (
              <li key={stack.slug}>
                <h3>
                  <a href={`/research/${stack.slug}`}>{stack.display_name}</a>
                </h3>
                {stack.plain_summary && <p>{stack.plain_summary}</p>}
                {stack.category && <p>Research Area: {stack.category}</p>}
                {components.length > 0 && (
                  <>
                    <p>Compounds In This Stack:</p>
                    <ul>
                      {components.map((ref) => {
                        const c = resolve(ref);
                        return (
                          <li key={ref}>
                            {c ? (
                              <a href={`/research/${c.slug}`}>{c.display_name}</a>
                            ) : (
                              ref
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p>
        Explore Related Tools: The{' '}
        <a href="/research/compare">Compound Comparison Engine</a>, The{' '}
        <a href="/research/calculators">Reconstitution Calculators</a>, And The{' '}
        <a href="/research/match">Peptide Match Engine</a>.
      </p>
    </section>
  );
}

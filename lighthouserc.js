/**
 * Lighthouse CI budget. READ BEFORE DELETING.
 *
 * `.github/workflows/lighthouse.yml` runs `lhci autorun --config=./lighthouserc.js`
 * daily at 08:00 UTC. This file IS that config; without it the job dies with
 * `ENOENT: no such file or directory, open '.../lighthouserc.js'` before it
 * audits anything.
 *
 * RESTORED 2026-09-06, byte-for-byte as it stood at 8a6f2c55^. It was deleted
 * on 2026-08-20 by 8a6f2c55 ("fix: comprehensive admin true cog, missing
 * orders, and ui enhancements") - a bulk sweep of one-off root scripts
 * (apply_rpc.js, budget_5k.js, db_audit3.js and about twenty more). This file
 * also sat at the root and also ended in .js, so it went with them. Nothing
 * noticed for seventeen days: the workflow is on a schedule, is in no ruleset,
 * and a red scheduled run blocks no merge and colours nothing anyone reads.
 *
 * It is not a stray script. It is the only thing standing between a Core Web
 * Vitals regression and production - which is the exact failure the comment
 * below was written about.
 */
module.exports = {
  ci: {
    collect: {
      url: [
        'https://pepnationlab.com/peptides/illinois/oak-lawn',
        'https://pepnationlab.com/researchstore',
        'https://pepnationlab.com/',
        'https://pepnationlab.com/research',
        'https://pepnationlab.com/peptide-101'
      ],
      numberOfRuns: 3
    },
    // Regression budget. The home mobile LCP was measured at ~7.8s and once
    // spiked to 16s unnoticed because this config was never actually run.
    // Ceilings are set just above the current measured baseline so a genuine
    // regression fails fast without flaking on normal variance. Tighten the
    // LCP ceiling as real improvements land (target: 4000ms = Google "poor"
    // threshold).
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.6 }],
        'categories:accessibility': ['warn', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 9000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-byte-weight': ['warn', { maxNumericValue: 4000000 }],
        'unused-javascript': ['warn', { maxNumericValue: 1000000 }]
      }
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

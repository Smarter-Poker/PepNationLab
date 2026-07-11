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

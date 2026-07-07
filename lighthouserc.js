module.exports = {
  ci: {
    collect: {
      url: [
        'https://pepnationlab.com/peptides/illinois/oak-lawn',
        'https://pepnationlab.com/researchstore',
        'https://pepnationlab.com/'
      ],
      numberOfRuns: 1
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

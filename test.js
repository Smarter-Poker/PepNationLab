fetch("https://pubmed.ncbi.nlm.nih.gov/33068773/", {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
})
  .then(res => res.text().then(text => console.log(res.status, text.slice(0, 100))))
  .catch(console.error);

async function go() {
  const res = await fetch('https://raw.githubusercontent.com/cporter202/scraping-apis-for-devs/main/README.md');
  const text = await res.text();
  const searchTerms = ['youtube', 'pdf', 'ocr', 'math', 'transcript', 'document', 'video'];
  
  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const term of searchTerms) {
      if (lower.includes(term)) {
        console.log(`Found [${term}]: ${line.substring(0, 150)}`);
      }
    }
  }
}
go();

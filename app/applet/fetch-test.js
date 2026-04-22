const fetch = require('node-fetch');

async function go() {
  const res = await fetch('https://raw.githubusercontent.com/cporter202/scraping-apis-for-devs/main/README.md');
  const text = await res.text();
  console.log(text.substring(0, 4000)); // First 4000 characters
}
go();

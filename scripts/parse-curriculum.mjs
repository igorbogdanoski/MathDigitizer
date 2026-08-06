// Parse curriculum text extracted from DOCX into structured JSON
// Usage: node scripts/parse-curriculum.mjs <input.txt> <grade> <output.json>
import { readFileSync, writeFileSync } from 'fs';

const [inputFile, grade, outputFile] = process.argv.slice(2);
if (!inputFile || !grade || !outputFile) {
  console.error('Usage: node parse-curriculum.mjs <input.txt> <grade> <output.json>');
  process.exit(1);
}

const text = readFileSync(inputFile, 'utf-8');
const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Find the start of the annual index table (after "Годишен индекс")
const startIdx = lines.findIndex(l => l.includes('Годишен индекс'));
if (startIdx === -1) {
  console.error('Could not find "Годишен индекс" marker');
  process.exit(1);
}

// Skip header lines (annualOrder, Недела, Полугодие, ID, Тема, Наставна единица)
let idx = startIdx + 1;
while (idx < lines.length && !/^\d+$/.test(lines[idx])) {
  idx++;
}

const units = [];
const ID_PATTERN = /^G\d{2}-T\d{2}-L\d{3}$/;

while (idx < lines.length) {
  // Expect: annualOrder (number)
  if (!/^\d+$/.test(lines[idx])) { idx++; continue; }
  const annualOrder = parseInt(lines[idx]);
  
  // Next: week (number)
  if (idx + 1 >= lines.length || !/^\d+$/.test(lines[idx + 1])) { idx++; continue; }
  const week = parseInt(lines[idx + 1]);
  
  // Next: semester (I or II)
  if (idx + 2 >= lines.length || !/^(I|II)$/.test(lines[idx + 2])) { idx++; continue; }
  const semester = lines[idx + 2];
  
  // Next: ID (G07-T01-L001)
  if (idx + 3 >= lines.length || !ID_PATTERN.test(lines[idx + 3])) { idx++; continue; }
  const id = lines[idx + 3];
  
  // Next: topic name
  if (idx + 4 >= lines.length) break;
  const topic = lines[idx + 4];
  
  // Next: unit name
  if (idx + 5 >= lines.length) break;
  const unitName = lines[idx + 5];
  
  units.push({
    annualOrder,
    week,
    semester,
    id,
    topic,
    unit: unitName,
    grade,
  });
  
  idx += 6;
}

// Group by topic
const topics = {};
for (const u of units) {
  if (!topics[u.topic]) {
    topics[u.topic] = { name: u.topic, units: [], hours: 0 };
  }
  topics[u.topic].units.push(u);
  topics[u.topic].hours++;
}

const result = {
  grade,
  totalUnits: units.length,
  totalHours: units.length,
  topics: Object.values(topics).map(t => ({
    name: t.name,
    hours: t.hours,
    unitIds: t.units.map(u => u.id),
  })),
  units,
};

writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');
console.log(`Parsed ${units.length} units, ${Object.keys(topics).length} topics for grade ${grade}`);
console.log(`Topics: ${Object.keys(topics).map(t => `${t}(${topics[t].hours}h)`).join(', ')}`);

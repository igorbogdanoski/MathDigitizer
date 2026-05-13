import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const REQUIRED_FILES = [
  'docs/ADR-0001-pedagogy-first-saas-governance.md',
  'src/lib/pedagogyPolicy.ts',
  'src/lib/promptEngineering.ts',
  'src/lib/seo.ts',
  'src/components/Layout.tsx',
];

async function exists(relPath) {
  try {
    await access(path.join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

async function read(relPath) {
  return readFile(path.join(ROOT, relPath), 'utf8');
}

async function main() {
  const errors = [];

  for (const relPath of REQUIRED_FILES) {
    if (!(await exists(relPath))) {
      errors.push(`Missing required governance file: ${relPath}`);
    }
  }

  if (errors.length) {
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }

  const adr = await read('docs/ADR-0001-pedagogy-first-saas-governance.md');
  const promptEngineering = await read('src/lib/promptEngineering.ts');
  const seo = await read('src/lib/seo.ts');
  const layout = await read('src/components/Layout.tsx');

  const adrChecks = [
    '## Enforcement Checklist',
    'Pedagogy:',
    'SEO:',
    'Security:',
    '## Related Files',
  ];

  adrChecks.forEach((token) => {
    if (!adr.includes(token)) {
      errors.push(`ADR missing token: ${token}`);
    }
  });

  const promptChecks = [
    "getPedagogyHardRules",
    "getPedagogyProtocol",
    "pedagogyPriority",
    "ПЕДАГОШКИ ПРОТОКОЛ",
  ];

  promptChecks.forEach((token) => {
    if (!promptEngineering.includes(token)) {
      errors.push(`Prompt engineering missing governance token: ${token}`);
    }
  });

  const seoChecks = [
    'structuredData',
    'OfferCatalog',
    'SoftwareApplication',
  ];

  seoChecks.forEach((token) => {
    if (!seo.includes(token)) {
      errors.push(`SEO module missing governance token: ${token}`);
    }
  });

  if (!layout.includes('structuredData={routeSeo.structuredData}')) {
    errors.push('Layout is not wiring route-level structured data into SEO component.');
  }

  if (errors.length > 0) {
    console.error('Governance gate failed:');
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }

  console.log('Governance gate passed. Pedagogy-first SEO/SaaS standards are enforced.');
}

main().catch((error) => {
  console.error('Governance check failed unexpectedly:', error);
  process.exit(1);
});

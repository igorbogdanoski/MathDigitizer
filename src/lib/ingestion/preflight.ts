export type DependencyStatus = 'available' | 'missing';

export interface DependencyCheck {
  name: string;
  status: DependencyStatus;
  details: string;
}

export interface ParserPlan {
  sourceType: 'url' | 'text' | 'file-image' | 'file-pdf';
  primary: string;
  fallback: string[];
}

export interface IngestionPreflightReport {
  ok: boolean;
  generatedAt: string;
  dependencyChecks: DependencyCheck[];
  parserPlans: ParserPlan[];
}

async function checkDependency(name: string): Promise<DependencyCheck> {
  try {
    await import(name);
    return { name, status: 'available', details: 'Module resolved successfully.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name, status: 'missing', details: message.slice(0, 220) };
  }
}

export async function buildIngestionPreflightReport(): Promise<IngestionPreflightReport> {
  const dependencyChecks = await Promise.all([
    checkDependency('@google/genai'),
    checkDependency('cheerio'),
  ]);

  const parserPlans: ParserPlan[] = [
    {
      sourceType: 'url',
      primary: 'direct transcript or scrape route',
      fallback: ['googleSearch enrichment'],
    },
    {
      sourceType: 'text',
      primary: 'direct model extraction from text payload',
      fallback: ['manual review needed if payload is empty'],
    },
    {
      sourceType: 'file-image',
      primary: 'gemini multimodal image extraction',
      fallback: ['advanced OCR reconstruction prompt'],
    },
    {
      sourceType: 'file-pdf',
      primary: 'gemini multimodal pdf extraction',
      fallback: ['advanced OCR reconstruction prompt'],
    },
  ];

  const ok = dependencyChecks.every((d) => d.status === 'available');

  return {
    ok,
    generatedAt: new Date().toISOString(),
    dependencyChecks,
    parserPlans,
  };
}

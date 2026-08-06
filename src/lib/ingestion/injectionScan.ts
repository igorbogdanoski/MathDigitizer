/**
 * Advisory scanner for prompt-injection style payloads inside ingested text.
 * This is deterministic and does not block by itself; callers decide policy.
 */

export type InjectionSeverity = 'low' | 'medium' | 'high';

export interface InjectionFinding {
  id: string;
  severity: InjectionSeverity;
  message: string;
  match: string;
}

export interface InjectionScanResult {
  findings: InjectionFinding[];
  highestSeverity: InjectionSeverity | null;
}

interface Rule {
  id: string;
  severity: InjectionSeverity;
  message: string;
  regex: RegExp;
}

const RULES: Rule[] = [
  {
    id: 'prompt.ignore_previous',
    severity: 'high',
    message: 'Found directive to ignore prior instructions.',
    regex: /ignore\s+(all\s+)?(previous|prior|earlier)\s+instructions?/i,
  },
  {
    id: 'prompt.reveal_system',
    severity: 'high',
    message: 'Found attempt to reveal system/developer prompt.',
    regex: /(reveal|show|print|leak)\s+(the\s+)?(system|developer)\s+(prompt|instructions?)/i,
  },
  {
    id: 'prompt.role_override',
    severity: 'medium',
    message: 'Found role-override style instruction.',
    regex: /(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\b/i,
  },
  {
    id: 'prompt.tool_exfiltration',
    severity: 'high',
    message: 'Found instruction to exfiltrate secrets or environment.',
    regex: /(api\s*key|secret|token|password|env(?:ironment)?\s+variables?)\s*(dump|print|show|reveal|exfiltrate)/i,
  },
  {
    id: 'prompt.bypass_safety',
    severity: 'high',
    message: 'Found direct request to bypass safety constraints.',
    regex: /(bypass|disable|ignore)\s+(safety|guardrails?|polic(?:y|ies)|restrictions?)/i,
  },
  {
    id: 'prompt.instruction_delimiters',
    severity: 'low',
    message: 'Found pseudo-prompt delimiters often used in injection payloads.',
    regex: /(<\|im_start\|>|<\|system\|>|BEGIN\s+SYSTEM\s+PROMPT|END\s+SYSTEM\s+PROMPT)/i,
  },
];

const RANK: Record<InjectionSeverity, number> = { low: 1, medium: 2, high: 3 };

export function scanPromptInjectionSignals(input: string): InjectionScanResult {
  const findings: InjectionFinding[] = [];

  for (const rule of RULES) {
    const match = input.match(rule.regex);
    if (!match) continue;
    findings.push({
      id: rule.id,
      severity: rule.severity,
      message: rule.message,
      match: match[0],
    });
  }

  let highestSeverity: InjectionSeverity | null = null;
  for (const finding of findings) {
    if (!highestSeverity || RANK[finding.severity] > RANK[highestSeverity]) {
      highestSeverity = finding.severity;
    }
  }

  return { findings, highestSeverity };
}

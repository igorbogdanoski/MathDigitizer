/**
 * LaTeX → Word math (OMML) conversion
 * (EXPERT_LEVEL_MASTER_PLAN, 6.4).
 *
 * DOCX export used to dump `$\frac{1}{2}$` into the document as literal text,
 * so a teacher opening the file in Word saw LaTeX source instead of maths.
 * This module parses a practical subset of LaTeX into an AST and maps it onto
 * the `docx` math elements, which serialise as real OMML equations Word can
 * render, edit and reflow.
 *
 * The parser is deliberately a subset: anything it does not recognise falls
 * back to a literal run, so an exotic macro degrades to visible text rather
 * than breaking the export.
 */

export type MathNode =
  | { kind: 'run'; text: string }
  | { kind: 'fraction'; numerator: MathNode[]; denominator: MathNode[] }
  | { kind: 'radical'; degree: MathNode[] | null; radicand: MathNode[] }
  | { kind: 'superscript'; base: MathNode[]; exponent: MathNode[] }
  | { kind: 'subscript'; base: MathNode[]; subscript: MathNode[] }
  | { kind: 'subsuperscript'; base: MathNode[]; subscript: MathNode[]; exponent: MathNode[] }
  | { kind: 'nary'; operator: 'sum' | 'integral'; lower: MathNode[]; upper: MathNode[]; body: MathNode[] }
  | { kind: 'brackets'; style: 'round' | 'square' | 'curly'; children: MathNode[] };

/** LaTeX commands that map to a single printable character. */
const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
  nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ',
  phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡',
  infty: '∞', partial: '∂', nabla: '∇', forall: '∀', exists: '∃', in: '∈', notin: '∉',
  subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅',
  rightarrow: '→', to: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒',
  angle: '∠', triangle: '△', perp: '⊥', parallel: '∥', degree: '°', circ: '∘',
  ldots: '…', cdots: '⋯', quad: ' ', qquad: '  ',
};

/** Function names that should stay upright, as Word expects. */
const FUNCTIONS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'lim', 'exp', 'max', 'min'];

interface Cursor {
  src: string;
  pos: number;
}

function peek(c: Cursor): string {
  return c.src[c.pos] ?? '';
}

function skipWhitespace(c: Cursor): void {
  while (c.pos < c.src.length && /\s/.test(c.src[c.pos])) c.pos++;
}

/** Reads a `{...}` group, or a single token if no brace follows. */
function readGroup(c: Cursor): MathNode[] {
  skipWhitespace(c);
  if (peek(c) === '{') {
    c.pos++; // consume {
    const nodes = parseNodes(c, '}');
    if (peek(c) === '}') c.pos++;
    return nodes;
  }

  // A bare token: one command, or one character.
  if (peek(c) === '\\') {
    const node = parseCommand(c);
    return node ? [node] : [];
  }
  const ch = c.src[c.pos];
  if (ch === undefined) return [];
  c.pos++;
  return [{ kind: 'run', text: ch }];
}

/** Reads the optional `[...]` argument of `\sqrt[n]{}`. */
function readOptional(c: Cursor): MathNode[] | null {
  skipWhitespace(c);
  if (peek(c) !== '[') return null;
  c.pos++;
  const nodes = parseNodes(c, ']');
  if (peek(c) === ']') c.pos++;
  return nodes;
}

function parseCommand(c: Cursor): MathNode | null {
  c.pos++; // consume backslash
  const match = /^[a-zA-Z]+/.exec(c.src.slice(c.pos));

  if (!match) {
    // Escaped punctuation such as \{ or \%
    const ch = c.src[c.pos];
    if (ch === undefined) return null;
    c.pos++;
    return { kind: 'run', text: ch };
  }

  const name = match[0];
  c.pos += name.length;

  switch (name) {
    case 'frac':
    case 'dfrac':
    case 'tfrac':
      return { kind: 'fraction', numerator: readGroup(c), denominator: readGroup(c) };

    case 'sqrt': {
      const degree = readOptional(c);
      return { kind: 'radical', degree, radicand: readGroup(c) };
    }

    case 'sum':
    case 'int': {
      const { lower, upper } = readNaryLimits(c);
      return {
        kind: 'nary',
        operator: name === 'sum' ? 'sum' : 'integral',
        lower,
        upper,
        // The body is whatever follows up to the next relation or the end.
        body: parseNodes(c, null, true),
      };
    }

    case 'left': {
      const opener = c.src[c.pos];
      c.pos++;
      const style = opener === '[' ? 'square' : opener === '\\' ? 'curly' : 'round';
      if (style === 'curly') c.pos++; // consume the { after \left\
      const children = parseNodes(c, null, false, true);
      return { kind: 'brackets', style, children };
    }

    case 'right': {
      // Consumed by the matching \left; skip its delimiter.
      if (c.src[c.pos] === '\\') c.pos++;
      c.pos++;
      return null;
    }

    case 'text':
    case 'mathrm':
    case 'operatorname': {
      const group = readGroup(c);
      return { kind: 'run', text: flattenText(group) };
    }

    default:
      if (SYMBOLS[name] !== undefined) return { kind: 'run', text: SYMBOLS[name] };
      if (FUNCTIONS.includes(name)) return { kind: 'run', text: name };
      // Unknown macro: keep it visible rather than dropping content silently.
      return { kind: 'run', text: name };
  }
}

function readNaryLimits(c: Cursor): { lower: MathNode[]; upper: MathNode[] } {
  let lower: MathNode[] = [];
  let upper: MathNode[] = [];

  for (let i = 0; i < 2; i++) {
    skipWhitespace(c);
    if (peek(c) === '_') { c.pos++; lower = readGroup(c); }
    else if (peek(c) === '^') { c.pos++; upper = readGroup(c); }
    else break;
  }

  return { lower, upper };
}

/**
 * Parses nodes until `stopChar` (or the end).
 * `stopAtRelation` ends an n-ary body at the first relational operator, so
 * `\sum_{i=1}^{n} i = x` puts only `i` under the sigma.
 */
function parseNodes(c: Cursor, stopChar: string | null, stopAtRelation = false, stopAtRight = false): MathNode[] {
  const nodes: MathNode[] = [];

  while (c.pos < c.src.length) {
    const ch = c.src[c.pos];

    if (stopChar && ch === stopChar) break;
    if (stopAtRelation && /[=<>+\-]/.test(ch) && nodes.length > 0) break;

    if (stopAtRight && ch === '\\' && /^\\right/.test(c.src.slice(c.pos))) {
      c.pos += '\\right'.length;
      if (c.src[c.pos] === '\\') c.pos++;
      c.pos++; // the delimiter itself
      break;
    }

    if (ch === '\\') {
      const node = parseCommand(c);
      if (node) nodes.push(node);
      continue;
    }

    if (ch === '^' || ch === '_') {
      c.pos++;
      const script = readGroup(c);
      const base = nodes.pop();
      const baseNodes = base ? [base] : [];

      const previous = nodes[nodes.length - 1];
      if (
        base &&
        ((ch === '^' && isSubscript(base)) || (ch === '_' && isSuperscript(base)))
      ) {
        // x_i^2 — combine into a single sub-superscript
        const combined: MathNode = ch === '^'
          ? { kind: 'subsuperscript', base: (base as any).base, subscript: (base as any).subscript, exponent: script }
          : { kind: 'subsuperscript', base: (base as any).base, subscript: script, exponent: (base as any).exponent };
        nodes.push(combined);
        continue;
      }
      void previous;

      nodes.push(ch === '^'
        ? { kind: 'superscript', base: baseNodes, exponent: script }
        : { kind: 'subscript', base: baseNodes, subscript: script });
      continue;
    }

    if (ch === '{') {
      c.pos++;
      nodes.push(...parseNodes(c, '}'));
      if (peek(c) === '}') c.pos++;
      continue;
    }

    if (ch === '}') break;

    // Coalesce a run of plain characters into one run node.
    let text = '';
    while (c.pos < c.src.length && !'\\^_{}'.includes(c.src[c.pos])) {
      if (stopChar && c.src[c.pos] === stopChar) break;
      if (stopAtRelation && /[=<>+\-]/.test(c.src[c.pos]) && (text || nodes.length)) break;
      text += c.src[c.pos];
      c.pos++;
    }
    if (text) nodes.push({ kind: 'run', text });
    else if (c.pos < c.src.length && !'\\^_{}'.includes(c.src[c.pos])) c.pos++; // safety
    else if (!text) break;
  }

  return nodes;
}

const isSubscript = (n: MathNode): boolean => n.kind === 'subscript';
const isSuperscript = (n: MathNode): boolean => n.kind === 'superscript';

function flattenText(nodes: MathNode[]): string {
  return nodes.map(n => (n.kind === 'run' ? n.text : '')).join('');
}

/** Parses a LaTeX expression (without `$` delimiters) into a math AST. */
export function parseLatex(source: string): MathNode[] {
  return parseNodes({ src: source ?? '', pos: 0 }, null);
}

export type Segment =
  | { type: 'text'; content: string }
  | { type: 'math'; content: string; display: boolean };

/**
 * Splits mixed prose into text and math segments.
 * `$$…$$` becomes display math, `$…$` inline math.
 */
export function splitMathSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text ?? '')) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    const display = match[1] !== undefined;
    segments.push({ type: 'math', content: (display ? match[1] : match[2]).trim(), display });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < (text ?? '').length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments.filter(s => s.type === 'math' || s.content.length > 0);
}

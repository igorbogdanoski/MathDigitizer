/**
 * Maps the LaTeX AST onto `docx` math elements, which serialise as OMML —
 * real Word equations rather than literal LaTeX source
 * (EXPERT_LEVEL_MASTER_PLAN, 6.4).
 *
 * Kept separate from the parser so the parser stays dependency-free and easy to
 * test; this file is the only place that knows about `docx`.
 */
import {
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathRadical,
  MathSuperScript,
  MathSubScript,
  MathSubSuperScript,
  MathSum,
  MathIntegral,
  MathRoundBrackets,
  MathSquareBrackets,
  MathCurlyBrackets,
  TextRun,
  Paragraph,
} from 'docx';
import { MathNode, parseLatex, splitMathSegments } from './latexToMath';

type MathComponent = ReturnType<typeof buildNode>;

function buildNode(node: MathNode): any {
  switch (node.kind) {
    case 'run':
      return new MathRun(node.text);

    case 'fraction':
      return new MathFraction({
        numerator: buildChildren(node.numerator),
        denominator: buildChildren(node.denominator),
      });

    case 'radical':
      return new MathRadical({
        children: buildChildren(node.radicand),
        ...(node.degree ? { degree: buildChildren(node.degree) } : {}),
      });

    case 'superscript':
      return new MathSuperScript({
        children: buildChildren(node.base),
        superScript: buildChildren(node.exponent),
      });

    case 'subscript':
      return new MathSubScript({
        children: buildChildren(node.base),
        subScript: buildChildren(node.subscript),
      });

    case 'subsuperscript':
      return new MathSubSuperScript({
        children: buildChildren(node.base),
        subScript: buildChildren(node.subscript),
        superScript: buildChildren(node.exponent),
      });

    case 'nary': {
      const config = {
        children: buildChildren(node.body),
        subScript: buildChildren(node.lower),
        superScript: buildChildren(node.upper),
      };
      return node.operator === 'sum' ? new MathSum(config) : new MathIntegral(config);
    }

    case 'brackets': {
      const children = buildChildren(node.children);
      if (node.style === 'square') return new MathSquareBrackets({ children });
      if (node.style === 'curly') return new MathCurlyBrackets({ children });
      return new MathRoundBrackets({ children });
    }

    default:
      return new MathRun('');
  }
}

function buildChildren(nodes: readonly MathNode[]): any[] {
  // An empty group would produce invalid OMML; give it an empty run instead.
  if (nodes.length === 0) return [new MathRun('')];
  return nodes.map(buildNode);
}

/** Builds one Word equation from a LaTeX expression (no `$` delimiters). */
export function latexToDocxMath(latex: string): MathComponent {
  return new DocxMath({ children: buildChildren(parseLatex(latex)) });
}

/**
 * Converts mixed prose into paragraph children: plain text stays TextRun,
 * `$…$` / `$$…$$` become real equations.
 */
export function buildRichChildren(text: string, options: { bold?: boolean } = {}): any[] {
  return splitMathSegments(text).map(segment =>
    segment.type === 'text'
      ? new TextRun({ text: segment.content, bold: options.bold })
      : latexToDocxMath(segment.content)
  );
}

/** Convenience wrapper: a paragraph whose maths is rendered rather than quoted. */
export function mathParagraph(text: string, paragraphOptions: Record<string, unknown> = {}): Paragraph {
  return new Paragraph({ ...paragraphOptions, children: buildRichChildren(text) });
}

/**
 * Renders a concept map to a standalone SVG string
 * (EXPERT_LEVEL_MASTER_PLAN, 11.1).
 *
 * Export goes through a built string rather than scraping the rendered DOM, for
 * two reasons. The on-screen graph is mid-simulation and carries drag handles
 * and hover state that do not belong in a printed map; and a string is testable,
 * while a screenshot of a canvas is not.
 *
 * Labels are whatever a teacher typed, so every one of them is escaped. An
 * unescaped `&` produces a file no viewer will open, and an unescaped `<`
 * produces a file that is no longer only a picture — the PNG conversion runs
 * the SVG through an image element, and markup that survives into it is markup
 * the browser parses.
 */
import { ConceptEdge, ConceptMap, ConceptNode } from './graph';

export interface SvgExportOptions {
  width?: number;
  height?: number;
  /** Drawn behind everything; a transparent PNG prints as nothing on paper. */
  background?: string;
  padding?: number;
}

const NODE_RADIUS = 26;
const FONT_SIZE = 13;

/** XML entity escaping. Applied to every value that came from a person. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Bounds that contain every node, with room for its circle and label.
 *
 * Computed rather than assumed: a teacher drags nodes wherever they like,
 * including into negative coordinates, and a fixed viewBox would crop the map
 * without saying so.
 */
function computeBounds(nodes: readonly ConceptNode[], padding: number) {
  if (nodes.length === 0) return { minX: 0, minY: 0, width: 400, height: 300 };

  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - NODE_RADIUS - padding;
  const minY = Math.min(...ys) - NODE_RADIUS - padding;
  const maxX = Math.max(...xs) + NODE_RADIUS + padding;
  const maxY = Math.max(...ys) + NODE_RADIUS + padding;

  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function renderEdge(edge: ConceptEdge, byId: Map<string, ConceptNode>): string {
  const from = byId.get(edge.source);
  const to = byId.get(edge.target);
  // Defensive: repairMap drops dangling edges, but export must not be the place
  // a stale map becomes a broken file.
  if (!from || !to) return '';

  const dashed = edge.kind === 'requires' ? ' stroke-dasharray="6,4"' : '';
  const marker = edge.kind === 'requires' ? ' marker-end="url(#arrow)"' : '';

  const line =
    `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" ` +
    `stroke="#64748b" stroke-width="2"${dashed}${marker} />`;

  if (!edge.label) return line;

  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  return (
    line +
    `<text x="${midX}" y="${midY - 6}" text-anchor="middle" ` +
    `font-family="sans-serif" font-size="${FONT_SIZE - 2}" fill="#64748b">` +
    `${escapeXml(edge.label)}</text>`
  );
}

/**
 * Characters a label may reach before it is worth wrapping.
 *
 * Below this it fits under the node comfortably, and splitting `a & b` across
 * two lines makes a short name look like two concepts.
 */
const WRAP_ABOVE_CHARS = 18;

/**
 * Wraps a label onto at most two lines.
 *
 * A long concept name rendered on one line runs off the picture. Two lines is
 * the limit because a third makes the node taller than the spacing the layout
 * gives it, and overlapping text is worse than a truncated name.
 */
function labelLines(label: string): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length <= 1 || label.length <= WRAP_ABOVE_CHARS) return [label];

  const half = Math.ceil(label.length / 2);
  const lines: string[] = ['', ''];
  for (const word of words) {
    const target = lines[0].length < half ? 0 : 1;
    lines[target] = lines[target] ? `${lines[target]} ${word}` : word;
  }
  return lines.filter(Boolean);
}

function renderNode(node: ConceptNode): string {
  const circle =
    `<circle cx="${node.x}" cy="${node.y}" r="${NODE_RADIUS}" ` +
    `fill="#eef2ff" stroke="#6366f1" stroke-width="2" />`;

  const lines = labelLines(node.label);
  const firstY = node.y + NODE_RADIUS + FONT_SIZE + 2;

  const text = lines
    .map(
      (line, i) =>
        `<text x="${node.x}" y="${firstY + i * (FONT_SIZE + 2)}" text-anchor="middle" ` +
        `font-family="sans-serif" font-size="${FONT_SIZE}" fill="#1e293b">${escapeXml(line)}</text>`,
    )
    .join('');

  // Codes the teacher attached, inside the circle: they are why the concept is
  // on the map, and a printed map without them is just a diagram.
  const codes = node.outcomeCodes.length
    ? `<text x="${node.x}" y="${node.y + 4}" text-anchor="middle" ` +
      `font-family="monospace" font-size="9" fill="#4338ca">` +
      `${escapeXml(node.outcomeCodes[0])}${node.outcomeCodes.length > 1 ? ` +${node.outcomeCodes.length - 1}` : ''}` +
      `</text>`
    : '';

  return circle + codes + text;
}

/** A complete, standalone SVG document for the map. */
export function buildExportSvg(map: ConceptMap, options: SvgExportOptions = {}): string {
  const padding = options.padding ?? 40;
  const bounds = computeBounds(map.nodes, padding);
  const width = options.width ?? Math.round(bounds.width);
  const height = options.height ?? Math.round(bounds.height);
  const background = options.background ?? '#ffffff';

  const byId = new Map(map.nodes.map(node => [node.id, node]));

  const defs =
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" ` +
    `markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker></defs>`;

  const title =
    `<text x="${bounds.minX + padding / 2}" y="${bounds.minY + padding / 2}" ` +
    `font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">` +
    `${escapeXml(map.title)}</text>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}">` +
    defs +
    `<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${background}" />` +
    title +
    map.edges.map(edge => renderEdge(edge, byId)).join('') +
    map.nodes.map(renderNode).join('') +
    `</svg>`
  );
}

/**
 * Rasterizes the export SVG to a PNG blob.
 *
 * Browser-only, so it is kept apart from `buildExportSvg`, which is the part
 * worth testing. The SVG is passed as a data URL rather than a blob URL because
 * an image loaded from a blob URL taints the canvas in some browsers, and a
 * tainted canvas cannot be exported at all.
 */
export async function exportMapToPng(map: ConceptMap, scale = 2): Promise<Blob> {
  const svg = buildExportSvg(map);
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Не може да се прочита сликата за извоз.'));
    image.src = source;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Извозот бара canvas поддршка.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Извозот не успеа.'))), 'image/png');
  });
}

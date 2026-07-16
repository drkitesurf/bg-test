import { classifyHeading } from './heuristics.mjs';

/**
 * Pure outline parse: markdown heading depth decides tree SHAPE only.
 * `#`=1, `##`=2, `###`=3. A heading pops the stack back to the first
 * entry with level < its own, then attaches under whatever remains (or
 * root). Blank headings (e.g. a stray "##" with nothing after it) are
 * skipped entirely — they carry no information, so dropping them isn't
 * "losing" content, and they're excluded from the parse-rate denominator.
 *
 * This function does NOT decide Property vs Space vs Container placement
 * across sections — that's a document-order, cross-heading concern
 * (`resolveProperties` in emit.mjs). It only builds the honest, literal
 * nesting the source file's own heading depth encodes.
 */
export function parseDocument(text) {
  const lines = text.split(/\r?\n/);
  const root = { kind: 'root', level: 0, children: [] };
  const stack = [root];
  let totalContentLines = 0; // non-blank lines that aren't skipped headings
  let itemLines = 0;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim().length === 0) continue;

    const headingMatch = line.match(/^(#{1,3})\s*(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      if (text.length === 0) continue; // blank heading, e.g. line 434 "##"

      totalContentLines++;
      const { type, propertyHint } = classifyHeading(text);
      const node = {
        kind: 'heading',
        headingType: type, // 'property' | 'space' | 'container'
        text,
        level,
        propertyHint,
        children: [],
      };

      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack[stack.length - 1];
      node.outlineParent = parent === root ? null : parent;
      parent.children.push(node);
      stack.push(node);
      continue;
    }

    // Plain content line -> an item under whatever heading is currently open.
    totalContentLines++;
    itemLines++;
    const parent = stack[stack.length - 1];
    const node = { kind: 'item', line: line.trim(), parent };
    parent.children.push(node);
  }

  return { root, stats: { totalContentLines, itemLines } };
}

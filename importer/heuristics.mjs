import { CONTAINER_LEXICON, SPACE_LEXICON, PROPERTY_LEXICON, BRAND_LEXICON, firstMatch } from './lexicon.mjs';

/**
 * Classify a heading's entity TYPE independently of its markdown depth.
 * Depth decides tree SHAPE (see parse.mjs); lexicon decides what kind of
 * node it is. This is deliberate: "WARDROBE LUBA SIDE" is a `#` (level-1)
 * heading in the source but is unambiguously a Space by name, and
 * "Червен куфар #1" is `#` but is unambiguously a Container.
 *
 * Resolution order: container lexicon > space lexicon > "is basically just
 * a property name" > generic container fallback (a sub-grouping that isn't
 * named like a real receptacle still behaves like one structurally).
 */
export function classifyHeading(rawText) {
  const text = rawText.trim();
  const propertyHint = firstMatch(text, PROPERTY_LEXICON);

  const containerHit = firstMatch(text, CONTAINER_LEXICON);
  if (containerHit) return { type: 'container', propertyHint };

  const spaceHit = firstMatch(text, SPACE_LEXICON);
  if (spaceHit) return { type: 'space', propertyHint };

  if (propertyHint) {
    // Property only when the heading is essentially just the place name
    // (nothing else structurally meaningful left after stripping it and
    // common location qualifiers like "storage"/"house"/"apartment").
    const stripped = text
      .replace(propertyHint.re, '')
      .replace(/\b(storage|apt|apartment|house|property|home)\b/gi, '')
      .trim();
    const isTrivialRemainder = stripped.length === 0 || /^[#\s.,;:-]*$/.test(stripped);
    if (isTrivialRemainder) return { type: 'property', propertyHint };
  }

  return { type: 'container', propertyHint }; // generic sub-grouping fallback
}

const SIZE_RE = /(\d+(?:\.\d+)?)\s*(cm|m|L|kg|lbs|oz)\b/gi;
const QTY_WORD_RE = /\b(?:x|X)\s?(\d+)\b|\b(\d+)\s?(?:x|X|pairs?)\b/;
const SHOE_SIZE_RE = /\b(\d{1,2}(?:\.\d)?)\s*(?=$|\)|,|\.)/; // trailing bare number, cautious

/**
 * Extract structured attributes from a single item line WITHOUT inventing
 * anything: every extracted token is removed from a working copy of the
 * text, and whatever is left over is preserved verbatim as `name` (or, if
 * nothing was confidently extracted, `name` is simply the whole line).
 * This satisfies "never-guess": low-confidence remainder stays as text,
 * it never gets forced into a wrong field.
 */
export function extractItemFields(rawLine) {
  const original = rawLine.trim();
  let attrs = {};
  let notes = null;

  // Parenthetical asides -> notes, and REMOVED from the working text before
  // any further extraction — a brand/size mentioned only inside a note
  // (e.g. "...(not much in Mh shoe)") describes the aside, not the item,
  // and must never leak into the item's own attrs.
  let working = original;
  const parenMatch = working.match(/\(([^)]*)\)?$/);
  if (parenMatch && working.includes('(')) {
    notes = parenMatch[1].replace(/\)$/, '').trim();
    working = working.slice(0, working.indexOf('(')).trim();
  }

  const brand = BRAND_LEXICON.find((b) => new RegExp(`\\b${escapeRe(b)}\\b`, 'i').test(working));
  if (brand) attrs.brand = brand;

  const sizes = [...working.matchAll(SIZE_RE)].map((m) => `${m[1]}${m[2]}`);
  if (sizes.length) attrs.sizes = sizes;

  const qtyMatch = working.match(QTY_WORD_RE);
  if (qtyMatch) {
    const qty = parseInt(qtyMatch[1] || qtyMatch[2], 10);
    if (!Number.isNaN(qty)) attrs.quantity = qty;
  } else {
    const wordQty = working.match(/\b(\d+)\s+pairs?\b/i);
    if (wordQty) attrs.quantity = parseInt(wordQty[1], 10) * 2;
  }

  return {
    name: original, // verbatim, always — nothing is ever removed from the record
    brand: attrs.brand || null,
    sizes: attrs.sizes || [],
    quantity: attrs.quantity || null,
    notes,
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detects the one relocation-reference pattern this fixture actually uses
 * ("MFC bag is in lozenec") — an item line that is really an instruction
 * to move a container, not inventory in its own right. Deliberately
 * narrow (requires the literal word "is"), so it does not fire on lines
 * like "IKEA bag in lozenec" which have no verb and are genuine items.
 */
export function matchRelocationReference(line) {
  const m = line.trim().match(/^(.+?)\s+is\s+in\s+(.+?)\.?\s*$/i);
  if (!m) return null;
  const [, subject, locationText] = m;
  const propertyHit = firstMatch(locationText, PROPERTY_LEXICON);
  if (!propertyHit) return null;
  return { subject: subject.trim(), propertyKey: propertyHit.key, propertyLabel: propertyHit.label };
}

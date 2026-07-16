import { createHash } from 'node:crypto';
import { extractItemFields, matchRelocationReference } from './heuristics.mjs';

const UNSPECIFIED_LABEL = 'Unspecified';

function stableId(prefix, pathParts) {
  const h = createHash('sha1').update(pathParts.join(''), 'utf8').digest('hex');
  return `${prefix}_${h.slice(0, 12)}`;
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9а-я]/gi, '');
}

/**
 * Resolve which Property every OUTLINE-ROOT heading ultimately belongs to.
 * Deeper headings never need this — they already have a real structural
 * parent from parse.mjs's stack nesting. Only `#`-level headings (whose
 * outlineParent is null / root) are ambiguous, because this document mixes
 * Property, Space, and Container headings at the same markdown depth.
 *
 * Four tiers, most-confident first, and every node records which tier fired
 * (`propertySource`) so a human reviewing the golden fixture can see exactly
 * how much to trust each placement:
 *   1. 'self'         — the node IS a property.
 *   2. 'hint'          — the heading's own text names a real, declared property
 *                        anywhere in the document (e.g. "Wardrobe Bansko" ->
 *                        Bansko — even if that property heading appears later
 *                        in the text, like "Bg Bansko upstairs" at line 51
 *                        vs. "# Bansko" declared at line 216).
 *   3. 'last-seen'     — no textual hint; falls back to the most recent
 *                        property heading in document order (a defensible
 *                        inference from how this list was actually written,
 *                        but explicitly the least-confident tier).
 *   4. 'unspecified'   — no hint and no property has been declared yet;
 *                        parked under a real, honestly-labeled "Unspecified"
 *                        bucket rather than guessed.
 */
function resolveRootProperties(rootChildren) {
  const declared = new Map(); // propertyLexiconKey -> heading node
  for (const child of rootChildren) {
    if (child.headingType === 'property') declared.set(child.propertyHint.key, child);
  }

  let lastSeen = null;
  for (const child of rootChildren) {
    if (child.headingType === 'property') {
      child.resolvedProperty = child;
      child.propertySource = 'self';
      lastSeen = child;
      continue;
    }
    if (child.propertyHint && declared.has(child.propertyHint.key)) {
      child.resolvedProperty = declared.get(child.propertyHint.key);
      child.propertySource = 'hint';
    } else if (lastSeen) {
      child.resolvedProperty = lastSeen;
      child.propertySource = 'last-seen';
      if (child.propertyHint) child.unresolvedHint = child.propertyHint.label;
    } else {
      child.resolvedProperty = 'UNSPECIFIED';
      child.propertySource = 'unspecified';
      if (child.propertyHint) child.unresolvedHint = child.propertyHint.label;
    }
  }
  return declared;
}

function findRelocationTarget(rootChildren, subject) {
  const subjectNorm = normalize(subject);
  let best = null;
  for (const child of rootChildren) {
    if (child.headingType === 'property') continue;
    const candNorm = normalize(child.text);
    if (candNorm.includes(subjectNorm) || subjectNorm.includes(candNorm)) {
      if (!best || child.text.length > best.text.length) best = child;
    }
  }
  return best;
}

export function buildEvents(root) {
  const events = [];
  const declaredProperties = resolveRootProperties(root.children);

  let unspecifiedNode = null;
  function ensureUnspecified() {
    if (!unspecifiedNode) {
      unspecifiedNode = { id: stableId('prop', ['__unspecified__']), text: UNSPECIFIED_LABEL };
      events.push({
        verb: 'create_property',
        entity_id: unspecifiedNode.id,
        payload: {
          name: UNSPECIFIED_LABEL,
          synthetic: true,
          reason: 'no property could be determined from source text or document order',
        },
      });
    }
    return unspecifiedNode;
  }

  // Relocation references (e.g. "MFC bag is in lozenec") are resolved
  // before id assignment / emission so the referenced container's final
  // property is correct from the moment it's first emitted.
  const relocations = [];
  (function scanForRelocations(node) {
    if (node.kind === 'item') {
      const m = matchRelocationReference(node.line);
      if (m) {
        const target = findRelocationTarget(root.children, m.subject);
        if (target) relocations.push({ node, target, propertyKey: m.propertyKey, propertyLabel: m.propertyLabel });
      }
    }
    (node.children || []).forEach(scanForRelocations);
  })(root);

  for (const reloc of relocations) {
    const propertyNode = declaredProperties.get(reloc.propertyKey);
    if (propertyNode) {
      reloc.target.resolvedProperty = propertyNode;
      reloc.target.propertySource = 'relocation-reference';
      reloc.target.relocationSourceLine = reloc.node.line;
    }
    reloc.node.__consumedByRelocation = true;
  }

  let structuralRelocationCount = 0;
  let itemCount = 0;
  let headingCount = 0;
  const dupCounters = new Map(); // per-parent-path text -> occurrence count, for stable dedup ids

  function idFor(node, ancestryPath) {
    if (node.kind === 'item') {
      const parts = [...ancestryPath, `item:${node.line}`];
      const key = parts.join('');
      const n = (dupCounters.get(key) || 0) + 1;
      dupCounters.set(key, n);
      return stableId('item', [...parts, String(n)]);
    }
    return stableId(node.headingType[0], ancestryPath);
  }

  // Pass 1: assign every node a stable id, structurally, top-down, BEFORE
  // any event is emitted. This must be a separate pass because a
  // root-level heading's resolved property can point FORWARD in document
  // order (e.g. "Bg Bansko upstairs" at line 51 resolves via hint to
  // "Bansko", not declared until line 216) — computing+emitting inline in
  // document order would reference an id that doesn't exist yet.
  function assignIds(node, ancestryPath) {
    for (const child of node.children) {
      if (child.kind === 'item') {
        child.__emittedId = idFor(child, ancestryPath);
        continue;
      }
      const path = [...ancestryPath, child.text];
      child.__emittedId = idFor(child, path);
      assignIds(child, path);
    }
  }
  assignIds(root, []);

  function parentIdOf(node) {
    if (node.outlineParent) return node.outlineParent.__emittedId;
    if (node.resolvedProperty === 'UNSPECIFIED') return ensureUnspecified().id;
    return node.resolvedProperty.__emittedId;
  }

  // Pass 2: emit, now that every id (including forward references) exists.
  function emitWalk(node) {
    for (const child of node.children) {
      if (child.kind === 'item') {
        if (child.__consumedByRelocation) {
          structuralRelocationCount++;
          const reloc = relocations.find((r) => r.node === child);
          events.push({
            verb: 'relocate_container',
            entity_id: reloc.target.__emittedId,
            payload: {
              source_line: child.line,
              new_parent_property_key: reloc.propertyKey,
              new_parent_property_label: reloc.propertyLabel,
            },
          });
          continue;
        }
        itemCount++;
        const fields = extractItemFields(child.line);
        const parentId = node === root ? ensureUnspecified().id : node.__emittedId;
        events.push({
          verb: 'create_item',
          entity_id: child.__emittedId,
          payload: { parent_id: parentId, ...fields },
        });
        continue;
      }

      headingCount++;
      const verb =
        child.headingType === 'property' ? 'create_property' :
        child.headingType === 'space' ? 'create_space' : 'create_container';
      events.push({
        verb,
        entity_id: child.__emittedId,
        payload: {
          name: child.text,
          parent_id: child.headingType === 'property' ? null : parentIdOf(child),
          property_source: child.propertySource || null,
          unresolved_hint: child.unresolvedHint || null,
        },
      });
      emitWalk(child);
    }
  }

  emitWalk(root);

  return {
    events,
    stats: { itemCount, headingCount, structuralRelocationCount },
  };
}

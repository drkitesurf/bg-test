// @sare/assumptions — dimensionality-padding / assumptions contract (M5-PAD).
//
// Domain-free. When a workflow or interceptor fills a missing input with a
// probable default, it MUST surface that choice as an explicit, checkable
// assumption so a human can one-click confirm (HITL) instead of silently
// trusting the pad. Shape (vision §2.4 / README-M5):
//
//   meta.assumptions[] = { field, assumed_value, basis, confirmed:false }
//
// Pure helpers — no DB, no network, no vertical vocabulary. Adapters supply
// default maps + basis strings; the engine only normalizes, pads, and checks.

/** Required keys on every assumption row. */
export const ASSUMPTION_FIELDS = Object.freeze(['field', 'assumed_value', 'basis', 'confirmed']);

/**
 * Normalize one assumption into the canonical row.
 * Invalid / empty field name → null (caller drops it).
 */
export function normalizeAssumption(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const field = String(raw.field ?? raw.key ?? '').trim();
  if (!field) return null;
  const basis = String(raw.basis ?? raw.reason ?? 'default').trim() || 'default';
  return {
    field,
    assumed_value: raw.assumed_value !== undefined ? raw.assumed_value
      : raw.value !== undefined ? raw.value
        : raw.assumedValue !== undefined ? raw.assumedValue
          : null,
    basis,
    confirmed: Boolean(raw.confirmed),
  };
}

/** Normalize + dedupe by field (last write wins); stable order by field name. */
export function normalizeAssumptions(list) {
  const byField = new Map();
  for (const item of list || []) {
    const row = normalizeAssumption(item);
    if (row) byField.set(row.field, row);
  }
  return [...byField.values()].sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : 0));
}

/**
 * Dimensionality padding: for each key in `defaults`, if `observed` lacks a
 * usable value, fill it and record an unconfirmed assumption.
 *
 * @param {object} observed  partial input object
 * @param {object} defaults  map of field → { value, basis? } | bare default value
 * @param {object} [opts]
 *   opts.isMissing(value, field) → bool  (default: null/undefined/'')
 * @returns {{ values: object, assumptions: Array, padded: string[] }}
 */
export function padAssumptions(observed, defaults, opts = {}) {
  const src = observed && typeof observed === 'object' ? { ...observed } : {};
  const def = defaults && typeof defaults === 'object' ? defaults : {};
  const isMissing = typeof opts.isMissing === 'function'
    ? opts.isMissing
    : (v) => v == null || v === '';

  const assumptions = [];
  const padded = [];
  const values = { ...src };

  for (const field of Object.keys(def).sort()) {
    if (!isMissing(values[field], field)) continue;
    const entry = def[field];
    const assumed_value = entry && typeof entry === 'object' && 'value' in entry
      ? entry.value
      : entry;
    const basis = entry && typeof entry === 'object' && entry.basis
      ? String(entry.basis)
      : 'statistical_default';
    values[field] = assumed_value;
    padded.push(field);
    assumptions.push(normalizeAssumption({
      field,
      assumed_value,
      basis,
      confirmed: false,
    }));
  }

  return { values, assumptions: normalizeAssumptions(assumptions), padded };
}

/** Merge multiple assumption lists (later lists override same field). */
export function mergeAssumptions(...lists) {
  return normalizeAssumptions(lists.flatMap((l) => (Array.isArray(l) ? l : [])));
}

/**
 * Attach assumptions onto an interceptor/DAG meta object (non-destructive).
 * Always writes `meta.assumptions` as a fresh normalized array.
 */
export function attachAssumptions(meta, assumptions) {
  const base = meta && typeof meta === 'object' ? { ...meta } : {};
  const existing = Array.isArray(base.assumptions) ? base.assumptions : [];
  base.assumptions = mergeAssumptions(existing, assumptions);
  return base;
}

/**
 * Checkability gate: every row must normalize; unconfirmed rows are listed
 * for HITL one-click confirm (never auto-flips confirmed).
 *
 * @returns {{ ok: boolean, assumptions: Array, unconfirmed: Array, invalid: number }}
 */
export function checkAssumptions(list) {
  const assumptions = [];
  let invalid = 0;
  for (const item of list || []) {
    const row = normalizeAssumption(item);
    if (!row) { invalid += 1; continue; }
    assumptions.push(row);
  }
  const normalized = normalizeAssumptions(assumptions);
  const unconfirmed = normalized.filter((a) => !a.confirmed);
  return {
    ok: invalid === 0,
    assumptions: normalized,
    unconfirmed,
    invalid,
  };
}

/**
 * Collect `node.assumptions` from a DAG node list into one meta.assumptions
 * array (M5-PAD layers onto the DAG node schema without the executor caring).
 */
export function collectNodeAssumptions(nodes) {
  const lists = [];
  for (const n of nodes || []) {
    if (n && Array.isArray(n.assumptions) && n.assumptions.length) {
      lists.push(n.assumptions.map((a) => ({
        ...a,
        basis: a.basis || (n.id != null ? `node:${n.id}` : 'node'),
      })));
    }
  }
  return mergeAssumptions(...lists);
}

/**
 * Confirm selected fields (HITL). Never invents confirmations for omitted fields.
 * Returns a new list; original is untouched.
 */
export function confirmAssumptions(list, fields) {
  const want = new Set((fields || []).map(String));
  return normalizeAssumptions(list).map((a) => (
    want.has(a.field) ? { ...a, confirmed: true } : a
  ));
}

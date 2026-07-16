// engine/verification — domain-free evidence-normalization core (SARE spine).
//
// Turns multi-source, possibly-conflicting evidence into ONE deterministic
// record with per-field provenance and a hard "never-guess" gate. The engine
// names no field, no source, no acquisition method, no vertical: the adapter
// supplies the field schema (which keys exist, which may never be guessed) and
// the source-reliability ranking. Pure functions only — no imports, no env, no
// I/O; every dependency is passed in.
//
// The prime directive this enforces: a value the evidence does not actually
// carry must surface as `needs-call`, never as an inferred/placeholder value
// masquerading as source-returned data. A field flagged un-guessable can never
// be marked `resolved` from an inferred source.

/**
 * @typedef {Object} Evidence
 * @property {string} field   - schema key this datum answers
 * @property {*}      value    - the observed value
 * @property {string} source   - opaque source id (adapter-defined; e.g. a
 *                               clearinghouse response, a voice call, a portal)
 * @property {number} [confidence] - 0..1 (default 1)
 * @property {string} [method]     - opaque acquisition-method tag (adapter-defined)
 * @property {boolean} [inferred]  - true if this datum was derived/guessed, not
 *                                   directly observed from the source payload
 */

/**
 * @typedef {Object} FieldSpec
 * @property {string}  key        - field name
 * @property {boolean} [required] - counts toward coverage (default false)
 * @property {boolean} [guessable]- if false, a missing or inferred-only value
 *                                  MUST become `needs-call` (default false —
 *                                  i.e. never-guess is the safe default)
 */

const STATUS = Object.freeze({
  RESOLVED: 'resolved',
  NEEDS_CALL: 'needs-call',
  CONFLICT: 'conflict',
});

const PROV_UNAVAILABLE = Object.freeze({ kind: 'unavailable' });

function asSpecMap(schema) {
  const map = new Map();
  for (const spec of schema || []) {
    if (!spec || typeof spec.key !== 'string') continue;
    map.set(spec.key, {
      key: spec.key,
      required: !!spec.required,
      // never-guess is the SAFE DEFAULT: a field is only guessable if the
      // adapter explicitly opts in.
      guessable: spec.guessable === true,
    });
  }
  return map;
}

function distinctValues(items) {
  const seen = [];
  for (const it of items) {
    const key = JSON.stringify(it.value);
    if (!seen.some((s) => s.key === key)) seen.push({ key, value: it.value });
  }
  return seen;
}

/**
 * Rank the candidate evidence for a single field, best-first, using the
 * injected source-reliability ranking. Higher rank wins; ties break on
 * confidence, then on non-inferred over inferred.
 * @param {Evidence[]} items
 * @param {(source:string)=>number} reliabilityOf - adapter-supplied; higher = better
 */
function rankCandidates(items, reliabilityOf) {
  return [...items].sort((a, b) => {
    const ra = reliabilityOf(a.source);
    const rb = reliabilityOf(b.source);
    if (rb !== ra) return rb - ra;
    const ca = a.confidence == null ? 1 : a.confidence;
    const cb = b.confidence == null ? 1 : b.confidence;
    if (cb !== ca) return cb - ca;
    // prefer directly-observed over inferred
    return (a.inferred ? 1 : 0) - (b.inferred ? 1 : 0);
  });
}

/**
 * Normalize evidence into a deterministic record.
 *
 * @param {Evidence[]} evidence
 * @param {Object} opts
 * @param {FieldSpec[]} opts.schema - adapter-supplied field taxonomy
 * @param {(source:string)=>number} [opts.reliabilityOf] - source ranking
 *   (higher = more authoritative). Default: all sources equal.
 * @param {number} [opts.conflictConfidenceFloor] - two DISTINCT values from
 *   sources of equal top rank → `conflict` (default: always flag on distinct)
 * @returns {{ fields: Object<string,{status:string,value:*,provenance:Object,candidates:Object[]}>,
 *             coverage: {required:number, resolved:number, ratio:number},
 *             needsCall: string[], conflicts: string[] }}
 */
export function normalizeRecord(evidence, opts) {
  const { schema } = opts || {};
  const specs = asSpecMap(schema);
  const reliabilityOf =
    (opts && typeof opts.reliabilityOf === 'function' && opts.reliabilityOf) ||
    (() => 0);

  // bucket evidence by field
  const byField = new Map();
  for (const e of evidence || []) {
    if (!e || typeof e.field !== 'string') continue;
    if (!byField.has(e.field)) byField.set(e.field, []);
    byField.get(e.field).push(e);
  }

  const fields = {};
  const needsCall = [];
  const conflicts = [];

  for (const [, spec] of specs) {
    const items = byField.get(spec.key) || [];
    // Only directly-observed evidence can ever RESOLVE an un-guessable field.
    const usable = spec.guessable ? items : items.filter((it) => !it.inferred);

    const candidates = items.map((it) => ({
      value: it.value,
      source: it.source,
      confidence: it.confidence == null ? 1 : it.confidence,
      method: it.method,
      inferred: !!it.inferred,
    }));

    if (usable.length === 0) {
      // No usable evidence → never guess. Surface as needs-call.
      fields[spec.key] = {
        status: STATUS.NEEDS_CALL,
        value: null,
        provenance: PROV_UNAVAILABLE,
        candidates,
      };
      needsCall.push(spec.key);
      continue;
    }

    const ranked = rankCandidates(usable, reliabilityOf);
    const top = ranked[0];
    const topRel = reliabilityOf(top.source);

    // conflict = >1 distinct value among the co-top-ranked sources
    const coTop = ranked.filter((r) => reliabilityOf(r.source) === topRel);
    const distinct = distinctValues(coTop);
    if (distinct.length > 1) {
      fields[spec.key] = {
        status: STATUS.CONFLICT,
        value: null,
        provenance: {
          kind: 'conflict',
          values: distinct.map((d) => d.value),
          sources: coTop.map((c) => c.source),
        },
        candidates,
      };
      conflicts.push(spec.key);
      continue;
    }

    fields[spec.key] = {
      status: STATUS.RESOLVED,
      value: top.value,
      provenance: {
        kind: 'observed',
        source: top.source,
        confidence: top.confidence == null ? 1 : top.confidence,
        method: top.method,
      },
      candidates,
    };
  }

  const required = [...specs.values()].filter((s) => s.required);
  const resolved = required.filter(
    (s) => fields[s.key] && fields[s.key].status === STATUS.RESOLVED,
  );

  return {
    fields,
    coverage: {
      required: required.length,
      resolved: resolved.length,
      ratio: required.length ? resolved.length / required.length : 1,
    },
    needsCall,
    conflicts,
  };
}

/**
 * Assert a record never let an un-guessable field resolve from an inferred
 * source. Returns the list of violations (empty = clean). This is the
 * belt-and-suspenders check a caller/gate runs to prove the never-guess
 * invariant held end-to-end.
 * @param {ReturnType<typeof normalizeRecord>} record
 * @param {FieldSpec[]} schema
 */
export function auditNeverGuess(record, schema) {
  const specs = asSpecMap(schema);
  const violations = [];
  for (const [key, field] of Object.entries(record.fields || {})) {
    const spec = specs.get(key);
    if (!spec || spec.guessable) continue;
    if (field.status === STATUS.RESOLVED && field.provenance) {
      if (field.provenance.kind !== 'observed') {
        violations.push(`${key}: un-guessable field resolved from non-observed provenance`);
      }
    }
  }
  return violations;
}

/**
 * Compare a primary and a shadow normalization of the SAME evidence, for the
 * dual-normalizer harness. Domain-free: per-field agreement + coverage delta.
 * @param {ReturnType<typeof normalizeRecord>} primary
 * @param {ReturnType<typeof normalizeRecord>} shadow
 * @returns {{ agreement:number, agreeCount:number, total:number,
 *             disagreements:Object[], coverageDelta:number }}
 */
export function compareNormalized(primary, shadow) {
  const keys = new Set([
    ...Object.keys(primary.fields || {}),
    ...Object.keys(shadow.fields || {}),
  ]);
  let agree = 0;
  const disagreements = [];
  for (const key of keys) {
    const a = primary.fields[key];
    const b = shadow.fields[key];
    const sameStatus = a && b && a.status === b.status;
    const sameValue = a && b && JSON.stringify(a.value) === JSON.stringify(b.value);
    if (sameStatus && sameValue) {
      agree += 1;
    } else {
      disagreements.push({
        field: key,
        primary: a ? { status: a.status, value: a.value } : null,
        shadow: b ? { status: b.status, value: b.value } : null,
      });
    }
  }
  const total = keys.size;
  return {
    agreement: total ? agree / total : 1,
    agreeCount: agree,
    total,
    disagreements,
    coverageDelta:
      (shadow.coverage ? shadow.coverage.ratio : 0) -
      (primary.coverage ? primary.coverage.ratio : 0),
  };
}

export const VerificationStatus = STATUS;

// engine/verification/shadow — read-only dual-normalizer evaluation (SARE
// spine, IV-007 core). Runs a SECOND normalization of the SAME evidence
// alongside the primary and records comparison metrics WITHOUT ever touching
// the user-facing output. This is how a candidate normalizer is proven safe
// before it can be promoted (promotion stays consensus/HITL-gated — never here).
//
// Pure logic: no DB, no env, no I/O, no timers. The recorder (where the sample
// lands) and any timing values are injected. Domain-free — the engine names no
// field or vertical.

import { compareNormalized } from './index.js';

/**
 * Per-record quality metrics derived from a single normalized record.
 * @param {ReturnType<import('./index.js').normalizeRecord>} record
 * @returns {{ coverage:number, needsCallRate:number, conflictRate:number, hitlRate:number, fields:number }}
 */
export function shadowMetrics(record) {
  const fields = Object.keys(record.fields || {});
  const total = fields.length || 1;
  const needsCall = (record.needsCall || []).length;
  const conflicts = (record.conflicts || []).length;
  return {
    coverage: record.coverage ? record.coverage.ratio : 0,
    needsCallRate: needsCall / total,
    conflictRate: conflicts / total,
    // HITL is triggered by anything not cleanly resolved: a needs-call OR a
    // conflict both require a human/second source.
    hitlRate: (needsCall + conflicts) / total,
    fields: fields.length,
  };
}

/**
 * Compare one primary vs one shadow normalization of the same evidence.
 * Timing (ms) is injected — the engine never reads a clock.
 *
 * @param {ReturnType<import('./index.js').normalizeRecord>} primary
 * @param {ReturnType<import('./index.js').normalizeRecord>} shadow
 * @param {Object} [timing] - `{ primaryMs, shadowMs }` (optional)
 * @returns {Object} a comparison sample row (never references the caller's output)
 */
export function compareShadow(primary, shadow, timing = {}) {
  const cmp = compareNormalized(primary, shadow);
  const pm = shadowMetrics(primary);
  const sm = shadowMetrics(shadow);
  const primaryMs = Number.isFinite(timing.primaryMs) ? timing.primaryMs : null;
  const shadowMs = Number.isFinite(timing.shadowMs) ? timing.shadowMs : null;
  return {
    // accuracy proxy: how often the shadow agreed with the primary
    agreement: cmp.agreement,
    disagreements: cmp.disagreements,
    // evidence-coverage on each side + the delta
    coveragePrimary: pm.coverage,
    coverageShadow: sm.coverage,
    coverageDelta: sm.coverage - pm.coverage,
    // HITL-rate on each side
    hitlRatePrimary: pm.hitlRate,
    hitlRateShadow: sm.hitlRate,
    // completion-time (injected; null if not measured)
    primaryMs,
    shadowMs,
    timeDelta: primaryMs != null && shadowMs != null ? shadowMs - primaryMs : null,
  };
}

/**
 * Create a read-only shadow evaluator that accumulates comparison samples and
 * reports aggregate metrics. The recorder is injected (an in-memory sink by
 * default); a live adapter passes a recorder that writes to the shadow-sample
 * store. `observe()` NEVER returns or mutates the user-facing output — it takes
 * already-computed primary + shadow records and only records the comparison.
 *
 * @param {Object} [opts]
 * @param {(row:Object)=>any} [opts.record] - injected recorder (default: push to sink)
 * @returns {{ observe:Function, aggregate:Function, samples:Object[] }}
 */
export function createShadowEvaluator(opts = {}) {
  const samples = [];
  const record =
    typeof opts.record === 'function'
      ? opts.record
      : (row) => { samples.push(row); return row; };

  async function observe(primary, shadow, ctx = {}) {
    const row = compareShadow(primary, shadow, {
      primaryMs: ctx.primaryMs,
      shadowMs: ctx.shadowMs,
    });
    row.caseRef = ctx.caseRef || null; // de-identified reference only
    await record(row);
    return row; // the comparison sample — NOT the verification output
  }

  function aggregate() {
    const rows = samples.length ? samples : [];
    const n = rows.length;
    if (n === 0) {
      return { n: 0, meanAgreement: null, meanCoverageDelta: null, meanHitlDelta: null, meanTimeDelta: null };
    }
    const mean = (sel) => {
      const vals = rows.map(sel).filter((v) => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      n,
      meanAgreement: mean((r) => r.agreement),
      meanCoverageDelta: mean((r) => r.coverageDelta),
      meanHitlDelta: mean((r) => r.hitlRateShadow - r.hitlRatePrimary),
      meanTimeDelta: mean((r) => r.timeDelta),
    };
  }

  return { observe, aggregate, samples };
}

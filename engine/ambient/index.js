// @sare/ambient — Ambient BI / invisible-overhead interpolation (M5-AMBI).
//
// Domain-free. Converts an injected run-tape (observed timings / volumes) plus a
// practice cost model into an overhead estimate envelope that ALWAYS carries
// explicit assumptions (via engine/assumptions) so padded defaults never look
// like measured facts. PMS bridge rows and vertical material catalogs stay in
// the adapter; the engine only reshapes numbers.
//
// Pure — no DB, no network, no vertical vocabulary. Adapters inject:
//   - tapes (array of ambient events)
//   - costEvaluate(procedureKey, model, overrides) → { total, ... } | null
//   - defaults for padAssumptions when observed fields are missing

import {
  attachAssumptions,
  padAssumptions,
  normalizeAssumptions,
} from '../assumptions/index.js';

/** Structural ambient event keys (no free-text / no PHI by contract). */
export const AMBIENT_EVENT_FIELDS = Object.freeze([
  'path_key',
  'duration_ms',
  'volume',
  'at',
  'source',
]);

/**
 * Normalize one ambient event. Invalid path_key → null.
 * @param {object} raw
 */
export function normalizeAmbientEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const path_key = String(raw.path_key ?? raw.pathKey ?? raw.key ?? '').trim();
  if (!path_key) return null;
  const duration_ms = Number(raw.duration_ms ?? raw.durationMs ?? raw.ms);
  const volume = Number(raw.volume ?? raw.count ?? 1);
  return {
    path_key,
    duration_ms: Number.isFinite(duration_ms) && duration_ms >= 0 ? duration_ms : null,
    volume: Number.isFinite(volume) && volume > 0 ? volume : 1,
    at: raw.at != null ? String(raw.at) : null,
    source: String(raw.source ?? 'ambient').trim() || 'ambient',
  };
}

/** Append-normalize a batch; drops invalid rows; never mutates input. */
export function captureAmbientEvents(existing, incoming) {
  const out = [];
  for (const row of existing || []) {
    const n = normalizeAmbientEvent(row);
    if (n) out.push(n);
  }
  for (const row of incoming || []) {
    const n = normalizeAmbientEvent(row);
    if (n) out.push(n);
  }
  return out;
}

/**
 * Aggregate a run tape into per-path summaries (mean duration, total volume).
 * @param {object[]} events
 * @returns {{ byPath: Record<string, { mean_duration_ms: number|null, total_volume: number, n: number }>, event_count: number }}
 */
export function summarizeRunTape(events) {
  /** @type {Map<string, { sumMs: number, nMs: number, volume: number, n: number }>} */
  const map = new Map();
  let event_count = 0;
  for (const raw of events || []) {
    const e = normalizeAmbientEvent(raw);
    if (!e) continue;
    event_count += 1;
    let bucket = map.get(e.path_key);
    if (!bucket) {
      bucket = { sumMs: 0, nMs: 0, volume: 0, n: 0 };
      map.set(e.path_key, bucket);
    }
    bucket.n += 1;
    bucket.volume += e.volume;
    if (e.duration_ms != null) {
      bucket.sumMs += e.duration_ms;
      bucket.nMs += 1;
    }
  }
  /** @type {Record<string, { mean_duration_ms: number|null, total_volume: number, n: number }>} */
  const byPath = {};
  for (const [key, b] of [...map.entries()].sort((a, c) => (a[0] < c[0] ? -1 : 1))) {
    byPath[key] = {
      mean_duration_ms: b.nMs > 0 ? Math.round((b.sumMs / b.nMs) * 100) / 100 : null,
      total_volume: Math.round(b.volume * 1000) / 1000,
      n: b.n,
    };
  }
  return { byPath, event_count };
}

/**
 * Interpolate office overhead from observed + padded drivers.
 *
 * Convention: overhead_pct is 0–1 (fraction of fee). If callers pass 0–100,
 * opts.pctScale='percent' divides by 100.
 *
 * @param {object} observed  partial { overhead_pct, rent_per_hour, wage_burden, hours_open }
 * @param {object} [defaults] padAssumptions defaults map
 * @param {object} [opts]
 * @returns {{ overhead_pct: number, drivers: object, assumptions: Array, padded: string[], sources: object }}
 */
export function interpolateOverhead(observed, defaults = {}, opts = {}) {
  const baseDefaults = {
    overhead_pct: { value: 0.6, basis: 'industry_band_default' },
    rent_per_hour: { value: 0, basis: 'unmeasured_zero' },
    wage_burden: { value: 1, basis: 'fully_loaded_identity' },
    hours_open: { value: 40, basis: 'full_time_week_default' },
    ...defaults,
  };
  const { values, assumptions, padded } = padAssumptions(observed || {}, baseDefaults, opts);
  const scale = opts.pctScale === 'percent' ? 100 : 1;
  let overhead_pct = Number(values.overhead_pct);
  if (!Number.isFinite(overhead_pct)) overhead_pct = 0.6 * (scale === 100 ? 100 : 1);
  if (scale === 100) overhead_pct = overhead_pct / 100;
  overhead_pct = Math.min(1, Math.max(0, overhead_pct));

  const rent = Number(values.rent_per_hour) || 0;
  const burden = Number(values.wage_burden);
  const hours = Number(values.hours_open);
  const drivers = {
    overhead_pct,
    rent_per_hour: Number.isFinite(rent) ? rent : 0,
    wage_burden: Number.isFinite(burden) && burden > 0 ? burden : 1,
    hours_open: Number.isFinite(hours) && hours > 0 ? hours : 40,
  };

  return {
    overhead_pct: drivers.overhead_pct,
    drivers,
    assumptions: normalizeAssumptions(assumptions),
    padded: [...padded].sort(),
    sources: {
      observed_keys: Object.keys(observed || {}).filter((k) => observed[k] != null && observed[k] !== ''),
      tape: Boolean(opts.fromTape),
      padded,
    },
  };
}

/**
 * Ambient cost estimate for one procedure key.
 * `evaluateDirect` is INJECTED (adapter wires the vertical roi kernel).
 *
 * @param {object} args
 * @returns {object} estimate envelope with meta.assumptions
 */
export function composeAmbientEstimate(args = {}) {
  const {
    procedureKey,
    model = {},
    observed = {},
    defaults = {},
    tapeSummary = null,
    durationPathKey = null,
    evaluateDirect,
    fee = null,
  } = args;

  if (typeof evaluateDirect !== 'function') {
    throw new Error('composeAmbientEstimate requires injected evaluateDirect');
  }
  const key = String(procedureKey || '').trim();
  if (!key) {
    return {
      ok: false,
      error: 'procedure_key_required',
      meta: attachAssumptions({}, []),
    };
  }

  const overhead = interpolateOverhead(observed, defaults, {
    fromTape: Boolean(tapeSummary && tapeSummary.event_count > 0),
  });

  /** @type {object} */
  const overrides = {};
  const path = durationPathKey || key;
  const pathRow = tapeSummary?.byPath?.[path];
  if (pathRow?.mean_duration_ms != null) {
    overrides.chair_minutes = Math.round((pathRow.mean_duration_ms / 60000) * 100) / 100;
  }

  const direct = evaluateDirect(key, model, overrides);
  if (!direct || !Number.isFinite(Number(direct.total))) {
    return {
      ok: false,
      procedure_key: key,
      error: 'direct_cost_unavailable',
      overhead: overhead.overhead_pct,
      assumptions: overhead.assumptions,
      meta: attachAssumptions({ source: 'ambient' }, overhead.assumptions),
    };
  }

  const directTotal = Math.round(Number(direct.total) * 100) / 100;
  const feeNum = fee != null ? Number(fee) : null;
  let margin_pct = null;
  let profit = null;
  let fee_status = 'fee_missing';
  if (feeNum != null && Number.isFinite(feeNum) && feeNum > 0) {
    fee_status = 'cited';
    profit = Math.round((feeNum - directTotal) * 100) / 100;
    margin_pct = Math.round(((profit / feeNum) * 100) * 100) / 100;
  }

  const fullyLoaded = Math.round((directTotal * (1 + overhead.overhead_pct)) * 100) / 100;
  const envelope = {
    ok: true,
    procedure_key: key,
    direct_cost: directTotal,
    labor_cost: direct.labor != null ? Number(direct.labor) : null,
    supplies_cost: direct.supplies != null ? Number(direct.supplies) : null,
    lab_cost: direct.lab != null ? Number(direct.lab) : null,
    chair_minutes: overrides.chair_minutes ?? direct.chair_minutes ?? null,
    overhead_pct: overhead.overhead_pct,
    fully_loaded_cost: fullyLoaded,
    fee: feeNum,
    fee_status,
    profit,
    margin_pct,
    estimate_kind: 'ambient_interpolation',
    disclaimer:
      'Estimate from ambient run-tape + cost model — confirm with practice books. Analysis, not advice.',
    assumptions: overhead.assumptions,
    sources: overhead.sources,
  };

  envelope.meta = attachAssumptions(
    { source: 'ambient', estimate_kind: envelope.estimate_kind },
    overhead.assumptions,
  );
  return envelope;
}

/**
 * Ghost-Run friendly evaluator factory: wraps composeAmbientEstimate so a DAG
 * node can call evaluate during Monte-Carlo what-ifs.
 *
 * @param {object} baseArgs same as composeAmbientEstimate
 * @returns {(ctx?: object) => object}
 */
export function createAmbientDagEvaluator(baseArgs = {}) {
  return (ctx = {}) => composeAmbientEstimate({
    ...baseArgs,
    procedureKey: ctx.procedureKey ?? baseArgs.procedureKey,
    fee: ctx.fee ?? baseArgs.fee,
    observed: { ...(baseArgs.observed || {}), ...(ctx.observed || {}) },
  });
}

// @sare/calcification — the harden-on-N-validations + shadow-decay machinery.
//
// Domain-free (sare_boundary_lint): no vertical facts, no direct DB, no env, no
// wall-clock. Persistence and time are INJECTED. This packet (SARE-015/016)
// builds the COUNTER and the SHADOW-SAMPLE hooks only; the harden-trigger and
// divergence→melt logic land in M4 (SARE-045) on top of these primitives.

/** Build a stable per-path key from (surface, node, decision). De-identified —
 *  it names a workflow location, never a patient. */
export function calcifyPathKey(parts = {}) {
  const surface = String(parts.surface || 'unknown');
  const node = String(parts.node || parts.graph || 'root');
  const decision = String(parts.decision || parts.choice || 'default');
  return `${surface}::${node}::${decision}`;
}

/** In-memory counter store — the default when no durable store is injected
 *  (tests / offline). Production injects a Supabase-backed store with the same
 *  shape: { increment(key)→Promise<number>, get(key)→Promise<number> }. */
export function createMemoryCounterStore() {
  const map = new Map();
  return {
    async increment(key) { const n = (map.get(key) || 0) + 1; map.set(key, n); return n; },
    async get(key) { return map.get(key) || 0; },
  };
}

/**
 * SARE-015 — the calcification counter hook.
 * Returns a function shaped for interceptor.useCalcifyCounter(pathKey, result, ctx).
 * Only HITL-confirmed responses increment the per-path counter (the "N validations
 * → harden" foundation). Reads are exposed for a future promotion gate. NO
 * auto-hardening happens here.
 *
 *   opts.store       injected counter store (default in-memory)
 *   opts.isConfirmed (result, ctx) → bool; default ctx.confirmed === true
 */
export function createCalcifyCounter(opts = {}) {
  const store = opts.store || createMemoryCounterStore();
  const isConfirmed = typeof opts.isConfirmed === 'function'
    ? opts.isConfirmed
    : (_result, ctx) => Boolean(ctx && ctx.confirmed === true);

  return async function calcifyCount(pathKey, result, ctx = {}) {
    const key = pathKey || calcifyPathKey(ctx.path || {});
    if (!isConfirmed(result, ctx)) {
      const count = await store.get(key);
      return { key, count, incremented: false };
    }
    const count = await store.increment(key);
    return { key, count, incremented: true };
  };
}

/**
 * SARE-016 — the shadow-sample hook.
 * Returns a function shaped for interceptor.useShadowSampler(result, produce, ctx).
 * On a sampled fraction of hardened-path executions it re-runs produce() to get a
 * "live" comparison and records a shadow row via the injected recorder. It must
 * NEVER change the user-facing response (the interceptor already returned it);
 * divergence→melt analysis is M4.
 *
 *   opts.rate     sample rate 0..1 (default 0 — off until configured)
 *   opts.rng      () → [0,1) sampler (injected for determinism; default counter)
 *   opts.record   async (shadowRow) → any; default in-memory sink (opts.sink[])
 *   opts.isHardened (result, ctx) → bool; default ctx.hardened === true
 *   opts.now      () → timestamp (injected; default 0)
 */
export function createShadowSampler(opts = {}) {
  const rate = Number.isFinite(opts.rate) ? Math.min(1, Math.max(0, opts.rate)) : 0;
  const now = typeof opts.now === 'function' ? opts.now : () => 0;
  const isHardened = typeof opts.isHardened === 'function'
    ? opts.isHardened
    : (_result, ctx) => Boolean(ctx && ctx.hardened === true);
  const sink = Array.isArray(opts.sink) ? opts.sink : [];
  const record = typeof opts.record === 'function'
    ? opts.record
    : async (row) => { sink.push(row); return row; };
  // Deterministic default sampler: fire every 1/rate-th sampled call.
  let tick = 0;
  const rng = typeof opts.rng === 'function' ? opts.rng : () => {
    if (rate <= 0) return 1; // never fires
    tick += 1;
    return ((tick * rate) % 1);
  };

  return async function shadowSample(result, produce, ctx = {}) {
    if (rate <= 0 || !isHardened(result, ctx)) return null;
    // sample when rng() lands in the [0, rate) window
    if (rng() >= rate) return null;
    let live;
    try {
      live = typeof produce === 'function' ? await produce(ctx.request, ctx) : undefined;
    } catch (e) {
      live = { error: String((e && e.message) || e) };
    }
    const row = {
      pathKey: ctx.pathKey || null,
      hardened: result && result.output,
      live: live && (live.output !== undefined ? live.output : live),
      sampledAt: now(),
    };
    await record(row);
    return row; // returned into meta.shadow; the interceptor never sends it to the user
  };
}

export {
  createMemoryHardenedStore,
  defaultDiverged,
  createCalcificationLoop,
} from './loop.js';

export default {
  calcifyPathKey,
  createMemoryCounterStore,
  createCalcifyCounter,
  createShadowSampler,
};

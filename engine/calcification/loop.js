// @sare/calcification/loop — harden-on-N + shadow-decay melt (SARE-045).
//
// Domain-free. Closes the probabilistic→deterministic compiler: when a path is
// consensus-promoted AND its confirmation counter ≥ N, the output HARDENS into
// a deterministic serve (produce() is skipped). Shadow samples that diverge
// MELTED it back to dynamic. Persistence + time + divergence comparer are
// INJECTED. Clinical paths never auto-harden without an explicit
// councilRatified=true (SB 1120 — the gate lives in the injected policy flag).

/** In-memory hardened-path store. Shape:
 *   get(key) → record | null
 *   set(key, record) → void
 *   delete(key) → void
 * record = { output, pathKind, status, hardenedAt, counterAtHarden, provenance, meltStreak }
 */
export function createMemoryHardenedStore() {
  const map = new Map();
  return {
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async set(key, record) { map.set(String(key), record); },
    async delete(key) { map.delete(String(key)); },
  };
}

/** Default divergence: deep-JSON equality → score 0 (same) or 1 (different). */
export function defaultDiverged(hardened, live) {
  try {
    const a = JSON.stringify(hardened);
    const b = JSON.stringify(live);
    if (a === b) return { diverged: false, score: 0 };
    return { diverged: true, score: 1 };
  } catch {
    return { diverged: true, score: 1 };
  }
}

/**
 * SARE-045 — the calcification harden/melt loop.
 *
 *   opts.store       hardened-path store (default in-memory)
 *   opts.policy      calcification policy (required for thresholds)
 *   opts.now         () → timestamp (injected; default 0)
 *   opts.diverged    (hardened, live) → { diverged, score } (default JSON equality)
 *   opts.events      optional sink array for provenance audit events
 *
 * Returns an API:
 *   tryHarden({ pathKey, counter, consensus, pathKind, output, councilRatified, actor })
 *   resolveServe({ pathKey, produce, request, ctx })
 *   observeShadow({ pathKey, shadowRow })
 *   isHardened(pathKey) / get(pathKey) / events()
 */
export function createCalcificationLoop(opts = {}) {
  const store = opts.store || createMemoryHardenedStore();
  const policy = opts.policy;
  if (!policy || typeof policy !== 'object') {
    throw new Error('createCalcificationLoop requires an injected policy');
  }
  const now = typeof opts.now === 'function' ? opts.now : () => 0;
  const divergedFn = typeof opts.diverged === 'function' ? opts.diverged : defaultDiverged;
  const events = Array.isArray(opts.events) ? opts.events : [];

  function emit(event) {
    events.push(event);
    return event;
  }

  async function get(pathKey) {
    if (!pathKey) return null;
    return store.get(String(pathKey));
  }

  async function isHardened(pathKey) {
    const rec = await get(pathKey);
    return Boolean(rec && rec.status === 'hardened');
  }

  /**
   * Attempt to harden a path. Requires:
   *   - consensus.promotable (business) OR (clinical + councilRatified)
   *   - counter >= policy.harden_threshold
   * Clinical without councilRatified → pending_council (never auto).
   */
  async function tryHarden(input = {}) {
    const pathKey = input.pathKey ? String(input.pathKey) : null;
    if (!pathKey) return { action: 'skipped', reason: 'no_path_key' };

    const existing = await get(pathKey);
    if (existing && existing.status === 'hardened') {
      return { action: 'already_hardened', record: existing };
    }

    const pathKind = input.pathKind === 'clinical' ? 'clinical' : 'business';
    const counter = Number(input.counter) || 0;
    const threshold = Number(policy.harden_threshold) || 0;
    const consensus = input.consensus || {};
    const councilRatified = Boolean(input.councilRatified);

    if (counter < threshold) {
      return {
        action: 'held',
        reason: `counter ${counter} < harden_threshold ${threshold}`,
        counter,
        threshold,
      };
    }

    // Clinical never auto-hardens without council ratification (SB 1120).
    if (pathKind === 'clinical' && policy.clinical_never_auto_harden !== false && !councilRatified) {
      const event = emit({
        type: 'pending_council',
        pathKey,
        at: now(),
        counter,
        threshold,
        pathKind,
        consensus: {
          promotable: Boolean(consensus.promotable),
          eligibleForCouncil: Boolean(consensus.eligibleForCouncil),
        },
        actor: input.actor || null,
      });
      return { action: 'pending_council', event };
    }

    const mayHarden = pathKind === 'clinical'
      ? councilRatified
      : Boolean(consensus.promotable);

    if (!mayHarden) {
      return {
        action: 'held',
        reason: pathKind === 'clinical'
          ? 'clinical requires councilRatified'
          : 'consensus not promotable',
        consensus,
      };
    }

    if (input.output === undefined) {
      return { action: 'skipped', reason: 'no_output' };
    }

    const provenance = {
      counterAtHarden: counter,
      threshold,
      pathKind,
      consensus: {
        promotable: Boolean(consensus.promotable),
        eligibleForCouncil: Boolean(consensus.eligibleForCouncil),
        effectiveN: consensus.effectiveN,
        threshold: consensus.threshold,
      },
      councilRatified,
      actor: input.actor || null,
      hardenedAt: now(),
    };

    const record = {
      output: input.output,
      pathKind,
      status: 'hardened',
      hardenedAt: provenance.hardenedAt,
      counterAtHarden: counter,
      provenance,
      meltStreak: 0,
    };
    await store.set(pathKey, record);

    const event = emit({
      type: 'harden',
      pathKey,
      at: provenance.hardenedAt,
      provenance,
    });

    return { action: 'hardened', record, event };
  }

  /**
   * Serve a path: if hardened, return the frozen output WITHOUT calling produce().
   * Otherwise call produce and return its result.
   */
  async function resolveServe({ pathKey, produce, request, ctx } = {}) {
    const key = pathKey ? String(pathKey) : null;
    const rec = key ? await get(key) : null;
    if (rec && rec.status === 'hardened') {
      return {
        served: 'hardened',
        output: rec.output,
        produceCalled: false,
        record: rec,
      };
    }
    if (typeof produce !== 'function') {
      return { served: 'dynamic', output: undefined, produceCalled: false, reason: 'no_produce' };
    }
    const live = await produce(request, ctx || {});
    const output = live && live.output !== undefined ? live.output : live;
    return { served: 'dynamic', output, produceCalled: true, live };
  }

  /**
   * Observe a shadow sample. If divergence score ≥ policy.divergence_threshold
   * for melt_streak consecutive hits, melt (or mark pending_review).
   * shadowRow shape matches createShadowSampler: { pathKey, hardened, live, … }
   */
  async function observeShadow({ pathKey, shadowRow } = {}) {
    const key = String(pathKey || (shadowRow && shadowRow.pathKey) || '');
    if (!key) return { action: 'skipped', reason: 'no_path_key' };

    const rec = await get(key);
    if (!rec || rec.status !== 'hardened') {
      return { action: 'skipped', reason: 'not_hardened' };
    }

    const hardened = shadowRow && shadowRow.hardened !== undefined
      ? shadowRow.hardened
      : rec.output;
    const live = shadowRow ? shadowRow.live : undefined;
    const cmp = divergedFn(hardened, live);
    const score = Number(cmp && cmp.score) || 0;
    const thresh = Number(policy.divergence_threshold) || 0;
    const streakNeed = Math.max(1, Number(policy.melt_streak) || 1);

    if (!(cmp && cmp.diverged) || score < thresh) {
      rec.meltStreak = 0;
      await store.set(key, rec);
      return { action: 'ok', score, threshold: thresh, meltStreak: 0 };
    }

    rec.meltStreak = (rec.meltStreak || 0) + 1;
    await store.set(key, rec);

    if (rec.meltStreak < streakNeed) {
      return {
        action: 'diverged_hold',
        score,
        threshold: thresh,
        meltStreak: rec.meltStreak,
        streakNeed,
      };
    }

    const provenance = {
      pathKey: key,
      score,
      threshold: thresh,
      meltStreak: rec.meltStreak,
      prior: rec.provenance || null,
      meltedAt: now(),
      shadowSampledAt: shadowRow && shadowRow.sampledAt,
    };

    if (policy.auto_melt_on_divergence === false) {
      rec.status = 'pending_review';
      await store.set(key, rec);
      const event = emit({
        type: 'pending_review',
        pathKey: key,
        at: provenance.meltedAt,
        provenance,
      });
      return { action: 'pending_review', event, score };
    }

    await store.delete(key);
    const event = emit({
      type: 'melt',
      pathKey: key,
      at: provenance.meltedAt,
      provenance,
    });
    return { action: 'melted', event, score };
  }

  return {
    tryHarden,
    resolveServe,
    observeShadow,
    isHardened,
    get,
    events: () => events.slice(),
  };
}

export default {
  createMemoryHardenedStore,
  defaultDiverged,
  createCalcificationLoop,
};

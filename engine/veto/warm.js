// @sare/veto/warm — in-memory veto-vector pre-warm cache (Spine C, SARE-034).
//
// Domain-free. Keeps the hot subset of the veto store (top-hit clusters +
// severity-max / critical vectors) resident so first-hit latency matches
// steady-state. Loader + similarity are INJECTED; the engine never touches a
// DB/provider.
//
// Cold-start budget: warm() races the loader against budgetMs — overflow keys
// stay deferred (lazy). Partial warms surface veto_degraded:'warm_partial' so
// a bypass is visible, never silent. The path-key hook warmKeys(keys[]) matches
// the vision packet's warm() interface (scheduler no-ops until a PMS bridge).

import { cosineArray } from './dedup.js';

const DEFAULT_BUDGET_MS = 25;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TOP_N = 50;
/** Severity at/above this counts as critical (higher = more severe). */
const DEFAULT_CRITICAL_MIN = 5;

/**
 * Build a warm manifest from hit-telemetry / severity-tagged corpus rows.
 * Pure — no I/O. Prefer critical-severity entries, then fill by hit count.
 *
 * @param {Array<{key:string, hits?:number, severity?:number, vec?:number[]}>} entries
 * @param {object} [opts]
 *   opts.topN            max non-critical keys by hit count (default 50)
 *   opts.criticalMin     severity at/above which always included (default 5)
 * @returns {Array<{key:string, hits:number, severity:number|null, vec?:number[]}>}
 */
export function buildWarmManifest(entries, opts = {}) {
  const topN = Number.isFinite(opts.topN) ? opts.topN : DEFAULT_TOP_N;
  const criticalMin = Number.isFinite(opts.criticalMin) ? opts.criticalMin : DEFAULT_CRITICAL_MIN;
  const rows = (entries || []).filter((e) => e && e.key != null);
  const critical = [];
  const rest = [];
  for (const e of rows) {
    const item = {
      key: String(e.key),
      hits: Number(e.hits) || 0,
      severity: e.severity == null ? null : Number(e.severity),
    };
    if (Array.isArray(e.vec)) item.vec = e.vec;
    if (item.severity != null && item.severity >= criticalMin) critical.push(item);
    else rest.push(item);
  }
  rest.sort((a, b) => b.hits - a.hits || a.key.localeCompare(b.key));
  const seen = new Set(critical.map((c) => c.key));
  const out = [...critical];
  let added = 0;
  for (const r of rest) {
    if (added >= topN) break;
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    out.push(r);
    added += 1;
  }
  return out;
}

function delay(ms, clock) {
  return new Promise((resolve) => {
    const start = clock();
    const tick = () => {
      if (clock() - start >= ms) resolve();
      else setTimeout(tick, Math.min(5, Math.max(0, ms - (clock() - start))));
    };
    setTimeout(tick, Math.min(ms, 5));
  });
}

/**
 * @param {object} [opts]
 *   opts.loadVectors  async (keys:string[]) => Array<{key, vec, meta?}>  (injected)
 *   opts.similarity   (a,b) => number  (default cosineArray)
 *   opts.budgetMs     warm() wall-clock budget (default 25)
 *   opts.ttlMs        entry TTL; 0 = never expire (default 5min)
 *   opts.now          () => number  (injectable clock)
 */
export function createVetoWarmCache(opts = {}) {
  const loadVectors = typeof opts.loadVectors === 'function' ? opts.loadVectors : null;
  const similarity = typeof opts.similarity === 'function' ? opts.similarity : cosineArray;
  const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : DEFAULT_BUDGET_MS;
  const ttlMs = Number.isFinite(opts.ttlMs) ? opts.ttlMs : DEFAULT_TTL_MS;
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();

  /** @type {Map<string, {vec:number[], meta:object, expiresAt:number|null}>} */
  const store = new Map();
  let lastWarm = null;

  function alive(entry) {
    if (!entry) return false;
    if (entry.expiresAt == null) return true;
    return entry.expiresAt > now();
  }

  function put(key, vec, meta = {}) {
    if (!key || !Array.isArray(vec)) return;
    store.set(String(key), {
      vec,
      meta: meta || {},
      expiresAt: ttlMs > 0 ? now() + ttlMs : null,
    });
  }

  function get(key) {
    const e = store.get(String(key));
    if (!alive(e)) {
      if (e) store.delete(String(key));
      return null;
    }
    return { key: String(key), vec: e.vec, meta: e.meta };
  }

  function size() {
    let n = 0;
    for (const [k, e] of store) {
      if (alive(e)) n += 1;
      else store.delete(k);
    }
    return n;
  }

  /**
   * Local ANN over the warm set only — no remote round-trip.
   * @returns {Array<{key:string, similarity:number, meta:object, source:'warm'}>}
   */
  function searchLocal(vector, { topK = 5 } = {}) {
    if (!Array.isArray(vector)) return [];
    const scored = [];
    for (const [key, e] of store) {
      if (!alive(e)) {
        store.delete(key);
        continue;
      }
      scored.push({
        key,
        similarity: similarity(vector, e.vec),
        meta: e.meta,
        source: 'warm',
      });
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, Math.max(0, topK | 0));
  }

  /**
   * Pre-warm from a manifest. Respects budgetMs via a race against the loader.
   * Entries that already carry `vec` are free (no loader call).
   *
   * @param {Array<{key:string, vec?:number[], meta?:object, severity?:number, hits?:number}>} manifest
   * @param {object} [warmOpts]  warmOpts.budgetMs overrides instance default
   */
  async function warm(manifest, warmOpts = {}) {
    const budget = Number.isFinite(warmOpts.budgetMs) ? warmOpts.budgetMs : budgetMs;
    const started = now();
    const needLoad = [];
    const warmed = [];
    const deferred = [];

    for (const row of manifest || []) {
      if (!row || row.key == null) continue;
      if (Array.isArray(row.vec)) {
        put(row.key, row.vec, {
          ...(row.meta || {}),
          severity: row.severity,
          hits: row.hits,
        });
        warmed.push(String(row.key));
      } else {
        needLoad.push(row);
      }
    }

    if (needLoad.length && loadVectors) {
      const remaining = Math.max(0, budget - (now() - started));
      const TIMEOUT = Symbol('warm-timeout');
      let result;
      try {
        result = await Promise.race([
          loadVectors(needLoad.map((k) => String(k.key))).then((rows) => ({ ok: true, rows })),
          delay(remaining, now).then(() => TIMEOUT),
        ]);
      } catch (e) {
        lastWarm = {
          warmed,
          deferred: needLoad.map((k) => String(k.key)),
          degraded: String((e && e.message) || e),
          elapsedMs: now() - started,
          budgetMs: budget,
          at: now(),
        };
        return lastWarm;
      }

      if (result === TIMEOUT) {
        for (const row of needLoad) deferred.push(String(row.key));
      } else {
        const byKey = new Map((result.rows || []).map((r) => [String(r.key), r]));
        for (const row of needLoad) {
          const hit = byKey.get(String(row.key));
          if (hit && Array.isArray(hit.vec)) {
            put(row.key, hit.vec, {
              ...(hit.meta || {}),
              ...(row.meta || {}),
              severity: row.severity,
              hits: row.hits,
            });
            warmed.push(String(row.key));
          } else {
            deferred.push(String(row.key));
          }
        }
      }
    } else if (needLoad.length) {
      for (const row of needLoad) deferred.push(String(row.key));
    }

    const elapsedMs = now() - started;
    lastWarm = {
      warmed,
      deferred,
      degraded: deferred.length ? 'warm_partial' : null,
      elapsedMs,
      budgetMs: budget,
      at: now(),
    };
    return lastWarm;
  }

  /**
   * Wrap a remote ANN searcher: warm hit first; fall through on miss.
   * When the last warm left deferred keys, tag meta.veto_degraded.
   */
  function wrapSearch(remoteSearch) {
    const remote = typeof remoteSearch === 'function' ? remoteSearch : null;
    return async (vector, searchOpts = {}) => {
      const local = searchLocal(vector, searchOpts);
      if (local.length) {
        const tag = lastWarm && lastWarm.degraded ? { veto_degraded: lastWarm.degraded } : {};
        return local.map((h) => ({ ...h, meta: { ...h.meta, ...tag } }));
      }
      if (!remote) return [];
      const remoteHits = await remote(vector, searchOpts);
      return (remoteHits || []).map((h) => ({ ...h, source: h.source || 'remote' }));
    };
  }

  return {
    warm,
    get,
    put,
    searchLocal,
    wrapSearch,
    size,
    stats: () => ({
      size: size(),
      lastWarm,
      budgetMs,
      ttlMs,
    }),
    /** Vision packet interface: warm(pathKeys[]). */
    warmKeys(keys) {
      return warm((keys || []).map((k) => (typeof k === 'string' ? { key: k } : k)));
    },
  };
}

export default createVetoWarmCache;

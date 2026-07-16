// @sare/veto — the negative-vector "known-bad-paths" veto store (Spine C, SARE-032).
//
// Domain-free. The store turns "is this proposed output semantically close to
// something we've already rejected?" into a millisecond ANN lookup instead of a
// second synchronous LLM. Both the embedder and the nearest-neighbour search are
// INJECTED (the pgvector query + the embedding provider live in the adapter), so
// the engine stays pure and vendor-neutral.
//
// Shaped to plug into the interceptor's vetoCheck() stage: a candidate output
// whose nearest known-bad vector is within `threshold` cosine similarity is
// vetoed, with the matches surfaced as blockers.
//
// Fails OPEN only on INFRASTRUCTURE error (embed/search throws or is unconfigured),
// and always records a `veto_degraded` marker so a silent bypass is impossible —
// a degraded veto is visible, never invisible.

const DEFAULT_THRESHOLD = 0.85;
const DEFAULT_TOPK = 5;

/** Pull the text to vet out of a produced output (string, {text}, or {card:{...}}). */
export function extractCandidateText(output) {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof output.text === 'string') return output.text;
  const c = output.card || output.output || output;
  if (c && typeof c === 'object') {
    return [c.prompt, c.sub, c.description, c.text, c.next_step]
      .filter((s) => typeof s === 'string').join(' ').trim();
  }
  return '';
}

/**
 * @param {object} opts
 *   opts.embed     async (text) => number[]      (injected embedding provider)
 *   opts.search    async (vector, {topK}) => [{key, similarity, meta}]  (injected ANN query)
 *   opts.threshold cosine similarity at/above which a candidate is vetoed (default 0.85)
 *   opts.topK      neighbours to fetch (default 5)
 */
export function createVetoStore(opts = {}) {
  const embed = typeof opts.embed === 'function' ? opts.embed : null;
  const search = typeof opts.search === 'function' ? opts.search : null;
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : DEFAULT_THRESHOLD;
  const topK = Number.isFinite(opts.topK) ? opts.topK : DEFAULT_TOPK;

  async function check(text, _ctx = {}) {
    const candidate = String(text || '').trim();
    if (!candidate) return { vetoed: false, blockers: [], meta: { skipped: 'empty' } };
    if (!embed || !search) {
      // not configured → fail OPEN but VISIBLY (never a silent bypass)
      return { vetoed: false, blockers: [], meta: { veto_degraded: 'unconfigured' } };
    }
    let matches;
    try {
      const vector = await embed(candidate);
      matches = await search(vector, { topK });
    } catch (e) {
      return { vetoed: false, blockers: [], meta: { veto_degraded: String((e && e.message) || e) } };
    }
    const hits = (matches || [])
      .filter((m) => m && Number(m.similarity) >= threshold)
      .sort((a, b) => Number(b.similarity) - Number(a.similarity));
    if (!hits.length) return { vetoed: false, blockers: [], meta: { checked: (matches || []).length } };
    return {
      vetoed: true,
      blockers: hits.map((h) => ({
        code: 'known_bad_path',
        severity: 'blocker',
        key: h.key,
        similarity: h.similarity,
        message: `semantically matches a known-bad path (${(h.similarity * 100).toFixed(0)}%)`,
        meta: h.meta,
      })),
      meta: { top_similarity: hits[0].similarity, threshold },
    };
  }

  return {
    check,
    /** An interceptor vetoCheck() stage: (output, request, ctx) => {vetoed, blockers, meta}. */
    vetoStage() {
      return async (output, _request, ctx = {}) => check(extractCandidateText(output), ctx);
    },
  };
}

export default createVetoStore;

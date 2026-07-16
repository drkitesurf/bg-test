// @sare/gateway/providers/ollama — local Ollama executor (SARE-022).
//
// Domain-free: an Ollama chat/embeddings client that knows nothing about any
// vertical. Shaped as a gateway executor: (target, request, ctx) => result.
// Network I/O and env are INJECTED (opts.fetch, opts.baseUrl / env) so it stays
// fixture-testable and the engine never reads env at module scope. Local compute
// has no metered cost, so `cost` is always 0.
//
// Fails CLOSED: on timeout / unreachable / non-2xx it returns { ok:false,
// reason } so the gateway falls through to the next target in the chain — it
// never throws a route off the rails and never fabricates an answer.

const DEFAULT_BASE = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * @param {object} opts
 *   opts.baseUrl    Ollama base URL (default from opts.env.OLLAMA_BASE_URL or localhost)
 *   opts.env        env bag (OLLAMA_BASE_URL)
 *   opts.fetch      injected fetch (default global fetch)
 *   opts.timeoutMs  request timeout
 * @returns {(target, request, ctx) => Promise<{ok, output?, cost, tokens?, meta?, reason?}>}
 */
export function createOllamaExecutor(opts = {}) {
  const env = opts.env || {};
  const baseUrl = String(opts.baseUrl || env.OLLAMA_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const doFetch = typeof opts.fetch === 'function' ? opts.fetch
    : (typeof fetch === 'function' ? fetch : null);

  return async function ollamaExecutor(target, request = {}, _ctx = {}) {
    if (!doFetch) return { ok: false, reason: 'no_fetch', cost: 0 };
    const model = (target && target.model) || request.model;
    if (!model) return { ok: false, reason: 'no_model', cost: 0 };

    // Build an OpenAI-compatible chat body (Ollama serves /v1/chat/completions).
    const messages = Array.isArray(request.messages) && request.messages.length
      ? request.messages
      : [
        ...(request.system ? [{ role: 'system', content: String(request.system) }] : []),
        { role: 'user', content: String(request.prompt || request.input || '') },
      ];
    const body = { model, messages, stream: false };
    if (request.max_tokens || request.maxTokens) body.max_tokens = request.max_tokens || request.maxTokens;
    if (request.temperature != null) body.temperature = request.temperature;

    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl && typeof setTimeout === 'function'
      ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    let res;
    try {
      res = await doFetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (e) {
      return { ok: false, reason: String((e && e.name === 'AbortError') ? 'timeout' : 'unreachable'), cost: 0 };
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res || !res.ok) return { ok: false, reason: `http_${(res && res.status) || 0}`, cost: 0 };

    let data;
    try { data = await res.json(); } catch { return { ok: false, reason: 'bad_json', cost: 0 }; }
    const output = data?.choices?.[0]?.message?.content ?? data?.message?.content ?? data?.response ?? null;
    if (output == null) return { ok: false, reason: 'no_content', cost: 0 };
    return {
      ok: true,
      output,
      cost: 0, // local compute — no metered cost
      tokens: data?.usage?.total_tokens ?? null,
      meta: { provider: 'ollama', model },
    };
  };
}

export default createOllamaExecutor;

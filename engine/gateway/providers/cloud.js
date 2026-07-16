// @sare/gateway/providers/cloud — cloud LLM executor (SARE-023).
//
// Domain-free. A generic OpenAI-compatible chat executor that covers any
// OpenAI-shaped endpoint (xAI, Groq, OpenAI, Ollama-cloud, or a compat gateway
// in front of Anthropic). Provider specifics — base URL, api-key env, auth
// header — are INJECTED via a small per-provider profile, so no vendor SDK and
// no secrets live in the engine. Fixture-testable via injected fetch.
//
// COST (founder decision Q2 = internal-only for v1): cost is COMPUTED and
// returned on every result. Whether it is shown to a practice is a downstream
// display choice — computing it internally is forward-compatible with either
// answer, so this needs no rework if Q2 later flips to "visible".
//
// Fails CLOSED (ok:false, no throw) on timeout / unreachable / non-2xx / missing
// key, so the gateway falls through to the next target.

const DEFAULT_TIMEOUT_MS = 30000;

/** Built-in profiles for common OpenAI-compatible providers. Injectable/extendable. */
export const DEFAULT_CLOUD_PROFILES = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY' },
  xai: { baseUrl: 'https://api.x.ai/v1', keyEnv: 'XAI_API_KEY' },
  openai: { baseUrl: 'https://api.openai.com/v1', keyEnv: 'OPENAI_API_KEY' },
  // Anthropic has a native (non-OpenAI) API; point this at an OpenAI-compat shim
  // or override baseUrl/keyEnv per deployment. Kept here so route targets resolve.
  anthropic: { baseUrl: null, keyEnv: 'ANTHROPIC_API_KEY' },
};

/**
 * @param {object} opts
 *   opts.profiles   provider → { baseUrl, keyEnv, authHeader? } (merged over defaults)
 *   opts.env        env bag (api keys, base-url overrides)
 *   opts.fetch      injected fetch
 *   opts.timeoutMs  request timeout
 *   opts.rates      { [model]: usdPer1kTokens } for internal cost; unknown → 0
 * @returns {(target, request, ctx) => Promise<{ok, output?, cost, tokens?, meta?, reason?}>}
 */
export function createCloudExecutor(opts = {}) {
  const env = opts.env || {};
  const profiles = { ...DEFAULT_CLOUD_PROFILES, ...(opts.profiles || {}) };
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const rates = opts.rates || {};
  const doFetch = typeof opts.fetch === 'function' ? opts.fetch
    : (typeof fetch === 'function' ? fetch : null);

  function costFor(model, tokens) {
    const rate = Number(rates[model]);
    if (!Number.isFinite(rate) || !Number.isFinite(tokens)) return 0;
    return (tokens / 1000) * rate;
  }

  return async function cloudExecutor(target, request = {}, _ctx = {}) {
    if (!doFetch) return { ok: false, reason: 'no_fetch', cost: 0 };
    const provider = target && target.provider;
    const model = (target && target.model) || request.model;
    const profile = profiles[provider];
    if (!profile) return { ok: false, reason: 'unknown_provider', cost: 0 };
    if (!model) return { ok: false, reason: 'no_model', cost: 0 };

    const baseUrl = String(env[`${String(provider).toUpperCase()}_BASE_URL`] || profile.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) return { ok: false, reason: 'no_base_url', cost: 0 };
    const apiKey = String(env[profile.keyEnv] || '').trim();
    if (!apiKey) return { ok: false, reason: 'no_api_key', cost: 0 };

    const messages = Array.isArray(request.messages) && request.messages.length
      ? request.messages
      : [
        ...(request.system ? [{ role: 'system', content: String(request.system) }] : []),
        { role: 'user', content: String(request.prompt || request.input || '') },
      ];
    const body = { model, messages };
    if (request.max_tokens || request.maxTokens) body.max_tokens = request.max_tokens || request.maxTokens;
    if (request.temperature != null) body.temperature = request.temperature;

    const headers = { 'Content-Type': 'application/json' };
    if (profile.authHeader) headers[profile.authHeader] = apiKey;
    else headers.Authorization = `Bearer ${apiKey}`;

    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl && typeof setTimeout === 'function' ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    let res;
    try {
      res = await doFetch(`${baseUrl}/chat/completions`, {
        method: 'POST', headers, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (e) {
      return { ok: false, reason: (e && e.name === 'AbortError') ? 'timeout' : 'unreachable', cost: 0 };
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res || !res.ok) return { ok: false, reason: `http_${(res && res.status) || 0}`, cost: 0 };

    let data;
    try { data = await res.json(); } catch { return { ok: false, reason: 'bad_json', cost: 0 }; }
    const output = data?.choices?.[0]?.message?.content ?? null;
    if (output == null) return { ok: false, reason: 'no_content', cost: 0 };
    const tokens = data?.usage?.total_tokens ?? null;
    return {
      ok: true,
      output,
      cost: costFor(model, tokens),
      tokens,
      meta: { provider, model, cost_visibility: 'internal' },
    };
  };
}

export default createCloudExecutor;

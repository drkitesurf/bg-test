// @sare/gateway — the model-agnostic execution layer (Spine B, SARE-021).
//
// Domain-free (sare_boundary_lint) and dependency-free: this core takes an
// ALREADY-PARSED route manifest (a thin adapter parses route_config.yaml → object
// so no YAML lib leaks into engine/) and a set of INJECTED per-provider executors.
// It resolves a route name → a `provider:model` target, walks the fallback chain
// on failure, and returns { output, source, cost, route, attempts }. It makes NO
// network calls itself and knows no provider SDK — executors are injected.
//
// A route's target is a "provider:model" string (e.g. "ollama:llama3.2:3b",
// "anthropic:claude-haiku-4-5"). The gateway selects the executor by provider
// name; a provider with no registered executor is treated as unavailable and the
// chain falls through — so an offline/stub deployment degrades instead of throwing.

/** Split "provider:model" → { provider, model }. Model may itself contain ':'. */
export function parseTarget(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  const i = s.indexOf(':');
  if (i < 1) return { provider: s, model: '' };
  return { provider: s.slice(0, i), model: s.slice(i + 1) };
}

/** Validate a parsed route manifest. Returns { ok, errors[] }. Pure. */
export function validateRouteConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return { ok: false, errors: ['config must be an object'] };
  const routes = config.routes || {};
  if (!Object.keys(routes).length) errors.push('no routes defined');
  for (const [name, r] of Object.entries(routes)) {
    if (!r || typeof r !== 'object') { errors.push(`route ${name}: not an object`); continue; }
    if (!r.primary) { errors.push(`route ${name}: missing primary`); continue; }
    if (!parseTarget(r.primary)) errors.push(`route ${name}: unparseable primary "${r.primary}"`);
    for (const f of [].concat(r.fallback || [])) {
      if (f && !parseTarget(f)) errors.push(`route ${name}: unparseable fallback "${f}"`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function createGateway(config, opts = {}) {
  const routes = (config && config.routes) || {};
  // executors: { [providerName]: async (target, request, ctx) => ({ output, cost?, tokens?, meta? }) }
  const executors = opts.executors || {};
  const now = typeof opts.now === 'function' ? opts.now : () => 0;

  /** The ordered target chain for a route: primary then any fallbacks. */
  function resolveRoute(name) {
    const r = routes[name];
    if (!r) return null;
    const chain = [r.primary, ...[].concat(r.fallback || [])].filter(Boolean);
    return {
      name,
      chain: chain.map(parseTarget).filter(Boolean),
      requires_hitl: r.requires_hitl === true,
      latency_target_ms: r.latency_target_ms || null,
    };
  }

  const api = {
    parseTarget,
    resolveRoute,
    hasExecutor(provider) { return typeof executors[provider] === 'function'; },

    /**
     * Execute a route. Tries each target in the chain until one succeeds.
     * @returns { ok, output, source, cost, route, requires_hitl, attempts, meta }
     *          or { ok:false, error, route, attempts } when nothing could serve.
     */
    async route(name, request, ctx = {}) {
      const resolved = resolveRoute(name);
      if (!resolved) return { ok: false, error: 'unknown_route', route: name, attempts: [] };
      const attempts = [];
      const startedAt = now();
      for (const target of resolved.chain) {
        const exec = executors[target.provider];
        const source = `${target.provider}:${target.model}`;
        if (typeof exec !== 'function') {
          attempts.push({ source, status: 'no_executor' });
          continue;
        }
        try {
          const res = await exec(target, request, ctx);
          if (res && res.ok !== false) {
            attempts.push({ source, status: 'ok' });
            return {
              ok: true,
              output: res.output,
              source,
              cost: typeof res.cost === 'number' ? res.cost : 0,
              route: name,
              requires_hitl: resolved.requires_hitl,
              attempts,
              meta: Object.assign({ durationMs: now() - startedAt, tokens: res.tokens }, res.meta || {}),
            };
          }
          attempts.push({ source, status: res && res.reason ? res.reason : 'declined' });
        } catch (e) {
          attempts.push({ source, status: 'error', error: String((e && e.message) || e) });
        }
      }
      return { ok: false, error: 'all_targets_unavailable', route: name, attempts };
    },
  };

  return api;
}

export default createGateway;

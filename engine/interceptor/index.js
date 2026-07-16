// @sare/interceptor — the one seam every dynamic AI response passes through.
//
// Domain-free (enforced by gates/tests/sare-boundary-lint.test.mjs): this file
// knows nothing about any vertical. All specifics — emergency rules, critics,
// veto lookups — are supplied by an adapter at registration time and injected.
//
// Pipeline order (SARE-011, blueprint §4 Spine A):
//   preGates[]  → produce() → critics[] → vetoCheck() → calcifyCount() → shadowSample()
// A preGate may SHORT-CIRCUIT before produce() is ever called (this is where the
// deterministic emergency guard lives). Every stage is registerable and every
// default is a safe no-op/pass, so an interceptor with nothing registered simply
// returns produce()'s output unchanged.
//
// Result shape:
//   { output, source, findings[], vetoed, blockers[], meta }

/** Severity ranking so a critic finding can be classified without the engine
 *  knowing any domain vocabulary. 'blocker'/'error' are veto-worthy. */
const BLOCKER_SEVERITIES = new Set(['blocker', 'error', 'critical']);

function asArray(v) {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

export function createInterceptor(opts = {}) {
  const preGates = [];
  const critics = [];
  let vetoCheck = null;
  let calcifyCounter = null;
  let shadowSampler = null;

  // Optional injected clock/logger; never reads env or wall-clock directly.
  const now = typeof opts.now === 'function' ? opts.now : () => 0;

  const api = {
    /** A preGate runs BEFORE produce() and may short-circuit.
     *  fn(request, ctx) → null|undefined (continue)
     *                   | { shortCircuit:true, output, source?, findings?, meta? } */
    usePreGate(fn) { if (typeof fn === 'function') preGates.push(fn); return api; },

    /** A critic vets the PRODUCED output. fn(output, request, ctx) → finding|finding[]|null.
     *  Each finding: { code?, severity?, message?, ... }. severity in
     *  {blocker,error,critical} sets vetoed=true. */
    useCritic(fn) { if (typeof fn === 'function') critics.push(fn); return api; },

    /** Semantic veto lookup (Spine C). fn(output, request, ctx) →
     *  { vetoed:bool, blockers?:[], meta? } | null. */
    useVetoCheck(fn) { vetoCheck = typeof fn === 'function' ? fn : null; return api; },

    /** Calcification counter hook (SARE-015). fn(pathKey, result, ctx) → any.
     *  Non-fatal: errors are captured in meta, never thrown. */
    useCalcifyCounter(fn) { calcifyCounter = typeof fn === 'function' ? fn : null; return api; },

    /** Shadow sampler hook (SARE-016). fn(result, produce, ctx) → any.
     *  Non-fatal and must never affect the returned output. */
    useShadowSampler(fn) { shadowSampler = typeof fn === 'function' ? fn : null; return api; },

    /** Generic registration if a caller prefers a stage name. */
    register(stage, fn) {
      switch (stage) {
        case 'preGate': return api.usePreGate(fn);
        case 'critic': return api.useCritic(fn);
        case 'vetoCheck': return api.useVetoCheck(fn);
        case 'calcifyCounter': return api.useCalcifyCounter(fn);
        case 'shadowSampler': return api.useShadowSampler(fn);
        default: throw new Error(`unknown interceptor stage: ${stage}`);
      }
    },

    /** Run the pipeline. produce(request, ctx) is the injected model/gateway call. */
    async intercept(request, produce, ctx = {}) {
      const meta = { stages: [], errors: [], startedAt: now() };
      const findings = [];

      // 1. pre-gates (may short-circuit before produce)
      for (let i = 0; i < preGates.length; i += 1) {
        let out;
        try {
          out = await preGates[i](request, ctx);
        } catch (e) {
          meta.errors.push({ stage: 'preGate', index: i, error: String(e && e.message || e) });
          continue;
        }
        meta.stages.push('preGate');
        if (out && out.shortCircuit) {
          return {
            output: out.output,
            source: out.source || 'pre_gate',
            findings: asArray(out.findings),
            vetoed: false,
            blockers: [],
            meta: Object.assign(meta, out.meta || {}, { shortCircuited: true, finishedAt: now() }),
          };
        }
      }

      // 2. produce (the model / gateway call)
      if (typeof produce !== 'function') {
        throw new Error('intercept(request, produce): produce must be a function');
      }
      let output = await produce(request, ctx);
      meta.stages.push('produce');
      let source = (output && typeof output === 'object' && output.source) || 'produce';

      // 3. critics vet the produced output
      const blockers = [];
      for (let i = 0; i < critics.length; i += 1) {
        let rows;
        try {
          rows = critics[i](output, request, ctx);
        } catch (e) {
          meta.errors.push({ stage: 'critic', index: i, error: String(e && e.message || e) });
          continue;
        }
        meta.stages.push('critic');
        for (const f of asArray(rows)) {
          if (!f) continue;
          findings.push(f);
          if (BLOCKER_SEVERITIES.has(String(f.severity))) blockers.push(f);
        }
      }

      // 4. veto check (semantic / known-bad-path lookup)
      let vetoed = blockers.length > 0;
      if (vetoCheck) {
        let v;
        try {
          v = await vetoCheck(output, request, ctx);
        } catch (e) {
          meta.errors.push({ stage: 'vetoCheck', error: String(e && e.message || e) });
          v = null;
        }
        meta.stages.push('vetoCheck');
        if (v && v.vetoed) {
          vetoed = true;
          for (const b of asArray(v.blockers)) { blockers.push(b); findings.push(b); }
          if (v.meta) meta.veto = v.meta;
        }
      }

      const result = { output, source, findings, vetoed, blockers, meta };

      // 5. calcification counter (non-fatal, no effect on output)
      if (calcifyCounter) {
        try {
          meta.calcify = await calcifyCounter(ctx.pathKey ?? null, result, ctx);
          meta.stages.push('calcifyCount');
        } catch (e) {
          meta.errors.push({ stage: 'calcifyCount', error: String(e && e.message || e) });
        }
      }

      // 6. shadow sampler (non-fatal, must NOT change the returned output)
      if (shadowSampler) {
        try {
          meta.shadow = await shadowSampler(result, produce, ctx);
          meta.stages.push('shadowSample');
        } catch (e) {
          meta.errors.push({ stage: 'shadowSample', error: String(e && e.message || e) });
        }
      }

      meta.finishedAt = now();
      return result;
    },
  };

  return api;
}

export default createInterceptor;

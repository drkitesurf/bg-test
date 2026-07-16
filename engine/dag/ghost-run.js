// @sare/dag/ghost-run — counterfactual "what-if" simulator (M5, GHOST).
//
// Domain-free. Given a workflow DAG and a scenario (parameter overrides), it runs
// the DAG many times with an INJECTED sampler to estimate the OUTCOME DISTRIBUTION
// under uncertainty — "if we changed X, what happens to the outcome, and how
// confident are we?" Pure: the node evaluation + randomness are injected, so it is
// deterministic under a seeded rng and never touches a domain fact or the network.
//
// This is the Monte-Carlo counterfactual engine; a vertical adapter supplies the
// node evaluator (what each node computes) and the scenario semantics.

import { executeDag } from './index.js';

/** Summary statistics for a numeric sample. */
export function summarize(samples) {
  const xs = (samples || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = xs.length;
  if (!n) return { n: 0, mean: null, p10: null, p50: null, p90: null, min: null, max: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const q = (p) => xs[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
  return { n, mean: round(mean), p10: q(0.1), p50: q(0.5), p90: q(0.9), min: xs[0], max: xs[n - 1] };
}
function round(x) { return Math.round(x * 1000) / 1000; }

/**
 * Run one scenario `iterations` times, collecting the outcome each iteration.
 * @param {Array} nodes  the DAG
 * @param {object} opts
 *   opts.evaluate  async (node, inputs, sample) => output   (injected node work; `sample` is the per-iteration draw)
 *   opts.outcome   (results) => number                      (extract the outcome to distribute; default results.outcome.output)
 *   opts.sample    (iterationIndex, rng) => any             (draw the iteration's random inputs; injected)
 *   opts.iterations  default 1000
 *   opts.rng       () => [0,1)  injected for determinism (default a seeded LCG on opts.seed)
 *   opts.scenario  arbitrary override object passed to sample/evaluate
 * @returns {{ scenario, iterations, distribution, samples }}
 */
export async function ghostRun(nodes, opts = {}) {
  const iterations = Number.isInteger(opts.iterations) && opts.iterations > 0 ? opts.iterations : 1000;
  const rng = typeof opts.rng === 'function' ? opts.rng : lcg(opts.seed ?? 1);
  const sample = typeof opts.sample === 'function' ? opts.sample : () => ({});
  const evaluate = typeof opts.evaluate === 'function' ? opts.evaluate : async () => 0;
  const outcome = typeof opts.outcome === 'function'
    ? opts.outcome
    : (results) => (results.outcome && results.outcome.output);

  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const draw = sample(i, rng, opts.scenario);
    const { results } = await executeDag(nodes, {
      run: (node, inputs) => evaluate(node, inputs, draw, opts.scenario),
    });
    const value = outcome(results);
    if (Number.isFinite(value)) samples.push(value);
  }

  return {
    scenario: opts.scenario ?? null,
    iterations,
    distribution: summarize(samples),
    samples,
  };
}

/**
 * Compare a baseline scenario against one or more alternatives — the core
 * "what-if" answer: the outcome delta (and its spread) for each change.
 * @returns {{ baseline, alternatives: Array<{scenario, distribution, deltaMean}> }}
 */
export async function ghostCompare(nodes, baseOpts, alternatives = []) {
  const baseline = await ghostRun(nodes, baseOpts);
  const alts = [];
  for (const alt of alternatives) {
    const r = await ghostRun(nodes, { ...baseOpts, ...alt });
    alts.push({
      scenario: r.scenario,
      distribution: r.distribution,
      deltaMean: baseline.distribution.mean != null && r.distribution.mean != null
        ? round(r.distribution.mean - baseline.distribution.mean) : null,
    });
  }
  return { baseline, alternatives: alts };
}

/** Deterministic seeded PRNG (LCG) — injected so Ghost-Run is reproducible in tests. */
export function lcg(seed) {
  let s = (Number(seed) || 1) >>> 0;
  return function next() { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

export default { ghostRun, ghostCompare, summarize, lcg };

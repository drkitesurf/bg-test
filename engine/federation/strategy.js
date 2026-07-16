// @sare/federation/strategy — the FederationStrategy seam (Spine D, SARE-043).
//
// Domain-free. ALL "how does one practice's correction become a network-wide
// improvement" logic sits behind this ONE swappable interface, so true edge
// federation (Pole B: compute-local, encrypt-the-math, pool-on-consensus) is a
// STRATEGY SWAP, not a platform rewrite (blueprint §2.3–2.4, the locked promise).
//
// The interface (every strategy implements it):
//   recordSignal(signal)                       -> record one confirmation
//   aggregate(pathKey)                         -> the confirmations for a path
//   promoteOnConsensus(pathKey, policy, ctx)   -> run the consensus gate → verdict
//
// Today the CentralStrategy runs everything in the one shared brain. The future
// EdgeFederatedStrategy implements the SAME three methods with local computation +
// homomorphic aggregation inside — call sites never change.

import { evaluateConsensus } from './consensus.js';

/** The methods every FederationStrategy must implement (for conformance checks). */
export const FEDERATION_STRATEGY_METHODS = ['recordSignal', 'aggregate', 'promoteOnConsensus'];

/** True iff `s` implements the full FederationStrategy interface. */
export function conformsToStrategy(s) {
  return Boolean(s) && FEDERATION_STRATEGY_METHODS.every((m) => typeof s[m] === 'function');
}

/**
 * CentralStrategy — today's behaviour: confirmations flow into one shared store,
 * and promotion is the consensus gate. The store is INJECTED (in-memory default;
 * production injects a Supabase-backed store with the same shape).
 * @param {object} opts { store?, consensusPolicy }
 */
export function createCentralStrategy(opts = {}) {
  const policy = opts.consensusPolicy;
  // store: Map<pathKey, confirmation[]>  (injected in production)
  const store = opts.store || new Map();

  return {
    kind: 'central',

    /** signal = { pathKey, cohort_id, tier, reliability } */
    recordSignal(signal) {
      if (!signal || !signal.pathKey) return { ok: false, reason: 'no_path_key' };
      const key = String(signal.pathKey);
      const list = store.get(key) || [];
      list.push({
        cohort_id: signal.cohort_id,
        tier: signal.tier,
        reliability: signal.reliability,
      });
      store.set(key, list);
      return { ok: true, count: list.length };
    },

    aggregate(pathKey) {
      return store.get(String(pathKey)) || [];
    },

    /** Run the consensus gate over a path's confirmations. */
    promoteOnConsensus(pathKey, policyOverride, ctx = {}) {
      const confs = this.aggregate(pathKey);
      return evaluateConsensus(confs, policyOverride || policy, ctx);
    },
  };
}

/**
 * EdgeFederatedStrategy — the future Pole B swap. Interface-conformant STUB so the
 * seam is proven swappable by test, not by promise. Its insides (local delta
 * computation, homomorphic encryption, consensus-gated pooling) are a v2 build;
 * until then every method throws not-implemented rather than silently degrading.
 */
export function createEdgeFederatedStrategy() {
  const notImpl = (m) => () => { throw new Error(`EdgeFederatedStrategy.${m} not implemented (Pole B is a future swap)`); };
  return {
    kind: 'edge_federated',
    recordSignal: notImpl('recordSignal'),
    aggregate: notImpl('aggregate'),
    promoteOnConsensus: notImpl('promoteOnConsensus'),
  };
}

export default createCentralStrategy;

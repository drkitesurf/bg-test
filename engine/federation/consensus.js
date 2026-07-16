// @sare/federation/consensus — the consensus gate (Spine D, SARE-042 core).
//
// Domain-free. The ONLY road into the shared brain: a change is promotable only
// when enough INDEPENDENT, ELIGIBLE, RELIABLE practices confirm it. Policy is
// INJECTED (platform/sare/consensus_policy.js) so N and validator eligibility are
// adjustable without touching this logic. Deep analysis: DOCS/SARE/CONSENSUS_POLICY.md.
//
// This function is pure — no DB, no domain facts. It turns a list of confirmations
// + a policy + a path context into a verdict, and it is the SAME math the command
// console (/command/sare-consensus/) mirrors for its visual (gate-verified parity).

/** Reliability → weight multiplier per the policy's soft/hard floors. */
function reliabilityMultiplier(reliability, rel) {
  const r = Number.isFinite(reliability) ? reliability : 0.5; // Beta-Bernoulli prior
  if (r < rel.hard_floor) return 0;
  if (r < rel.soft_floor) return rel.soft_penalty;
  return 1;
}

/**
 * @param {Array<{cohort_id, tier, reliability?}>} confirmations
 * @param {object} policy   the consensus policy (CONSENSUS_POLICY)
 * @param {object} ctx      { pathKind: 'business'|'clinical', activePractices?: number }
 * @returns {{
 *   promotable, eligibleForCouncil, shadowOnly, effectiveN, threshold,
 *   distinctCohorts, counted, dropped, reasons
 * }}
 */
export function evaluateConsensus(confirmations, policy, ctx = {}) {
  const pathKind = ctx.pathKind === 'clinical' ? 'clinical' : 'business';
  const threshold = pathKind === 'clinical'
    ? policy.thresholds.clinical_eligibility
    : policy.thresholds.business;
  const rel = policy.reliability;
  const requireDistinct = policy.independence?.require_distinct_cohort !== false;

  const reasons = [];
  const dropped = [];
  // 1. eligible tiers only
  let pool = [];
  for (const c of confirmations || []) {
    const tierCfg = policy.eligibility[c.tier];
    if (!tierCfg || !tierCfg.eligible) { dropped.push({ ...c, why: `tier_ineligible:${c.tier}` }); continue; }
    pool.push({ ...c, baseWeight: tierCfg.weight });
  }

  // 2. independence — collapse each cohort to its single best confirmation
  if (requireDistinct) {
    const byCohort = new Map();
    for (const c of pool) {
      const key = String(c.cohort_id ?? '');
      const prev = byCohort.get(key);
      const score = c.baseWeight * reliabilityMultiplier(c.reliability, rel);
      const prevScore = prev ? prev.baseWeight * reliabilityMultiplier(prev.reliability, rel) : -1;
      if (!prev || score > prevScore) {
        if (prev) dropped.push({ ...prev, why: 'duplicate_cohort' });
        byCohort.set(key, c);
      } else {
        dropped.push({ ...c, why: 'duplicate_cohort' });
      }
    }
    pool = [...byCohort.values()];
  }

  // 3. reliability-weighted effective N
  const counted = [];
  let effectiveN = 0;
  for (const c of pool) {
    const mult = reliabilityMultiplier(c.reliability, rel);
    const weight = c.baseWeight * mult;
    if (weight <= 0) { dropped.push({ ...c, why: 'reliability_below_hard_floor' }); continue; }
    counted.push({ ...c, weight });
    effectiveN += weight;
  }
  effectiveN = Math.round(effectiveN * 1000) / 1000;

  const meetsThreshold = effectiveN >= threshold;

  // 4. cold-start ramp → shadow-only until the network matures
  const active = Number.isFinite(ctx.activePractices) ? ctx.activePractices : null;
  const shadowOnly = Boolean(
    policy.cold_start?.shadow_only_below
    && active !== null
    && active < policy.cold_start.min_active_practices,
  );
  if (shadowOnly) reasons.push(`cold_start: ${active} < ${policy.cold_start.min_active_practices} active practices → shadow-only`);

  // 5. clinical paths never auto-promote — they become eligible for council ratification
  const clinicalGate = pathKind === 'clinical' && policy.clinical_requires_council;
  const eligibleForCouncil = clinicalGate && meetsThreshold;
  const promotable = Boolean(meetsThreshold && !shadowOnly && !clinicalGate);

  if (!meetsThreshold) reasons.push(`effectiveN ${effectiveN} < threshold ${threshold}`);
  if (clinicalGate && meetsThreshold) reasons.push('clinical path: eligible for council ratification (never auto — SB 1120)');
  if (promotable) reasons.push(`promotable: effectiveN ${effectiveN} >= ${threshold}`);

  return {
    promotable,
    eligibleForCouncil,
    shadowOnly,
    effectiveN,
    threshold,
    distinctCohorts: counted.length,
    counted,
    dropped,
    reasons,
  };
}

export default evaluateConsensus;

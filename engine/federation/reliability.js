// @sare/federation/reliability — rater reliability (Spine D, SARE-044).
//
// Domain-free port of the Beta-Bernoulli rater reliability from Mouth Quest's gold
// pipeline (functions/api/mouth-quest/_lib.js). Poisoning resistance: a cohort's
// confirmation weight follows its demonstrated reliability, so a flood of
// low-quality confirmations cannot cheaply move the consensus gate. Pure math —
// no domain facts, no DB. The consensus gate (SARE-042) weights by this score.
//
// Prior: 0.5 with pseudo-count 2 (1 pseudo-correct, 1 pseudo-incorrect), so a
// brand-new cohort with no history sits at the neutral prior and earns/loses trust
// from control-item outcomes.

export const RELIABILITY_PRIOR = 0.5;
const PRIOR_CORRECT = 1;
const PRIOR_INCORRECT = 1;

/**
 * Nudge a stored reliability score after one control-item outcome (ported exactly
 * from Mouth Quest's updateReliabilityScore).
 * @param {number|null|undefined} current  stored score 0..1 (null → prior 0.5)
 * @param {boolean} correct
 * @returns {number} updated score, clamped 0..1, 3-dp
 */
export function updateReliability(current, correct) {
  const score = typeof current === 'number' && !Number.isNaN(current) ? current : RELIABILITY_PRIOR;
  const priorCorrect = PRIOR_CORRECT + score * 2;
  const priorIncorrect = PRIOR_INCORRECT + (1 - score) * 2;
  const nextCorrect = priorCorrect + (correct ? 1 : 0);
  const nextIncorrect = priorIncorrect + (correct ? 0 : 1);
  const updated = nextCorrect / (nextCorrect + nextIncorrect);
  return Math.min(1, Math.max(0, Math.round(updated * 1000) / 1000));
}

/**
 * Beta posterior-mean reliability from raw counts (for backfilling a score from a
 * cohort's control-item history). (correct + 1) / (total + 2).
 * @param {number} correct
 * @param {number} total
 */
export function reliabilityFromCounts(correct, total) {
  const c = Math.max(0, Number(correct) || 0);
  const t = Math.max(c, Number(total) || 0);
  const score = (c + PRIOR_CORRECT) / (t + PRIOR_CORRECT + PRIOR_INCORRECT);
  return Math.min(1, Math.max(0, Math.round(score * 1000) / 1000));
}

export default { RELIABILITY_PRIOR, updateReliability, reliabilityFromCounts };

// engine/verification/staleness — re-verify window enforcement (SARE spine,
// IV-009 core). Makes the re-verify deadline load-bearing: a record past its
// window, or one whose plan year has rolled since it was captured (so its
// running accumulators have reset), is STALE and must never be served as
// "verified" until it is re-checked.
//
// Pure logic: the clock is INJECTED (`now` in epoch-ms) — the engine never
// reads a clock. Dates accept epoch-ms numbers or ISO strings (parsed
// deterministically). Domain-free — no vertical vocabulary.

export const Freshness = Object.freeze({
  FRESH: 'fresh',
  DUE_SOON: 'due_soon', // inside the lead window but not yet past deadline
  STALE: 'stale',       // past the re-verify deadline, or plan year rolled
});

const DAY_MS = 86_400_000;

/** Coerce an epoch-ms number or ISO string to epoch-ms; null if unparseable. */
function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

/**
 * Classify a verification's freshness at a given instant.
 *
 * @param {Object} record
 * @param {number|string} [record.verifiedAt]  - when the check was captured
 * @param {number|string} [record.reverifyAfter] - the re-verify deadline
 * @param {number|string} [record.planYearEnd] - end of the plan year the
 *   accumulators belong to; crossing it resets deductible/max → stale
 * @param {number} now - injected epoch-ms
 * @param {Object} [opts]
 * @param {number} [opts.leadDays=1] - how many days before the deadline to
 *   mark DUE_SOON (so the schedule-first gate re-enqueues day-before)
 * @returns {{ status:string, stale:boolean, reasons:string[] }}
 */
export function verificationFreshness(record = {}, now, opts = {}) {
  const leadMs = (opts.leadDays == null ? 1 : opts.leadDays) * DAY_MS;
  const reverifyAfter = toMs(record.reverifyAfter);
  const planYearEnd = toMs(record.planYearEnd);
  const verifiedAt = toMs(record.verifiedAt);
  const reasons = [];

  // never captured → cannot be fresh
  if (verifiedAt == null) {
    return { status: Freshness.STALE, stale: true, reasons: ['never_verified'] };
  }

  // plan year rolled since capture → accumulators reset → stale
  if (planYearEnd != null && now > planYearEnd && verifiedAt <= planYearEnd) {
    reasons.push('plan_year_rolled');
  }

  // past the explicit re-verify deadline → stale
  if (reverifyAfter != null && now >= reverifyAfter) {
    reasons.push('past_reverify_deadline');
  }

  if (reasons.length) {
    return { status: Freshness.STALE, stale: true, reasons };
  }

  // inside the lead window before the deadline → due soon (still servable)
  if (reverifyAfter != null && now >= reverifyAfter - leadMs) {
    return { status: Freshness.DUE_SOON, stale: false, reasons: ['within_lead_window'] };
  }

  return { status: Freshness.FRESH, stale: false, reasons: [] };
}

/**
 * A record may be served as "verified" only if its state is verified AND it is
 * not stale. This is the guard the read path calls before returning cached
 * accumulators to a user.
 * @param {string} state - the Kanban state (e.g. 'verified'/'done')
 * @param {Object} record - freshness inputs (verifiedAt/reverifyAfter/planYearEnd)
 * @param {number} now - injected epoch-ms
 * @param {string[]} [servableStates] - which states count as "verified"
 */
export function isServableAsVerified(state, record, now, servableStates = ['verified', 'done']) {
  if (!servableStates.includes(state)) return false;
  return !verificationFreshness(record, now).stale;
}

/**
 * Should this record be re-enqueued for a fresh check? True when it is stale OR
 * due-soon (so the schedule-first gate picks it up day-before / day-of and on
 * plan-year boundaries). Never re-enqueues a genuinely fresh record.
 */
export function shouldReenqueue(record, now, opts = {}) {
  const f = verificationFreshness(record, now, opts);
  return f.status === Freshness.STALE || f.status === Freshness.DUE_SOON;
}

// engine/verification/state-machine — domain-free work-item state machine
// with a "never lose a case" repair loop (SARE spine, IV-003 core).
//
// The prime invariant: a failure NEVER drops a case straight to a terminal
// error. Every failure routes queued/active → `blocked` with a machine-readable
// repair reason → `repairing` → back into the queue. A case only reaches the
// terminal `error` state after N failed repair attempts, and even then it is
// flagged for alert, never silently discarded.
//
// Pure logic: no DB, no env, no timers, no I/O. The caller persists the state;
// this module only decides the next legal state and guards the invariant. No
// domain vocabulary — the engine names states and events, the adapter maps them
// to a vertical's queue.

export const State = Object.freeze({
  QUEUED: 'queued',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  REPAIRING: 'repairing',
  RESOLVED: 'resolved',
  REVIEW: 'review',        // human-in-the-loop hold
  DONE: 'done',
  ERROR: 'error',          // terminal — only after repair budget exhausted
});

export const Event = Object.freeze({
  START: 'start',          // queued → in_progress
  FAIL: 'fail',            // active → blocked (+ repair_reason)
  REPAIR: 'repair',        // blocked → repairing
  REQUEUE: 'requeue',      // repairing → queued
  RESOLVE: 'resolve',      // in_progress → resolved
  SUBMIT_REVIEW: 'submit_review', // resolved → review
  APPROVE: 'approve',      // review → done
  REJECT: 'reject',        // review → blocked (needs rework)
  ABANDON: 'abandon',      // repairing → error (budget exhausted only)
});

// Legal transitions. Anything not listed is illegal and throws.
const TRANSITIONS = {
  [State.QUEUED]: {
    [Event.START]: State.IN_PROGRESS,
    [Event.FAIL]: State.BLOCKED,
  },
  [State.IN_PROGRESS]: {
    [Event.RESOLVE]: State.RESOLVED,
    [Event.FAIL]: State.BLOCKED,
  },
  [State.BLOCKED]: {
    [Event.REPAIR]: State.REPAIRING,
  },
  [State.REPAIRING]: {
    [Event.REQUEUE]: State.QUEUED,
    [Event.ABANDON]: State.ERROR, // guarded: only when repair budget exhausted
  },
  [State.RESOLVED]: {
    [Event.SUBMIT_REVIEW]: State.REVIEW,
    [Event.FAIL]: State.BLOCKED,
  },
  [State.REVIEW]: {
    [Event.APPROVE]: State.DONE,
    [Event.REJECT]: State.BLOCKED,
  },
  [State.DONE]: {},   // terminal
  [State.ERROR]: {},  // terminal
};

export const TERMINAL = Object.freeze([State.DONE, State.ERROR]);

function isTerminal(state) {
  return TERMINAL.includes(state);
}

/**
 * Advance a work item.
 *
 * @param {Object} item - `{ state, repairAttempts?, repairReason?, ... }`
 * @param {string} event - one of Event.*
 * @param {Object} [opts]
 * @param {number} [opts.maxRepairs=3] - repair budget before ERROR is allowed
 * @param {string} [opts.reason] - machine-readable repair reason (required on FAIL)
 * @returns {Object} a NEW item object with updated state/counters (never mutates input)
 * @throws on any illegal transition, or on an attempt to ABANDON before the
 *   repair budget is exhausted (the "never lose a case early" guard).
 */
export function advance(item, event, opts = {}) {
  const maxRepairs = opts.maxRepairs == null ? 3 : opts.maxRepairs;
  const from = item && item.state;
  if (!TRANSITIONS[from]) {
    throw new Error(`unknown or terminal state: ${JSON.stringify(from)}`);
  }
  const to = TRANSITIONS[from][event];
  if (!to) {
    throw new Error(`illegal transition: ${from} --${event}-->`);
  }

  const next = { ...item, state: to };
  const attempts = item.repairAttempts || 0;

  if (event === Event.FAIL) {
    // A failure MUST carry a machine-readable reason so the repair loop can act.
    if (!opts.reason) {
      throw new Error('FAIL requires a machine-readable repair reason');
    }
    next.repairReason = opts.reason;
  }

  if (event === Event.REPAIR) {
    next.repairAttempts = attempts + 1;
  }

  if (event === Event.REQUEUE) {
    // requeued for another pass; clear the transient reason
    next.repairReason = null;
  }

  if (event === Event.ABANDON) {
    // The invariant: you may only give up AFTER exhausting the repair budget.
    if (attempts < maxRepairs) {
      throw new Error(
        `cannot ABANDON to error: repair budget not exhausted (${attempts}/${maxRepairs})`,
      );
    }
    next.needsAlert = true; // terminal error is always surfaced, never silent
  }

  return next;
}

/**
 * Given a state + event, is the transition legal? (non-throwing predicate)
 */
export function canAdvance(state, event) {
  return !!(TRANSITIONS[state] && TRANSITIONS[state][event]);
}

/**
 * Prove the "never lose a case" property structurally: every non-terminal
 * state has at least one outgoing transition, and the ONLY edge into ERROR is
 * the budget-guarded ABANDON from REPAIRING. Returns violations (empty = safe).
 * A gate runs this so the property can't silently regress if the table changes.
 */
export function auditNoLostCase() {
  const violations = [];
  for (const [state, edges] of Object.entries(TRANSITIONS)) {
    if (!isTerminal(state) && Object.keys(edges).length === 0) {
      violations.push(`non-terminal state "${state}" has no outgoing transition (dead-end = lost case)`);
    }
  }
  // enumerate every edge into ERROR
  const edgesIntoError = [];
  for (const [state, edges] of Object.entries(TRANSITIONS)) {
    for (const [event, to] of Object.entries(edges)) {
      if (to === State.ERROR) edgesIntoError.push(`${state}--${event}`);
    }
  }
  if (edgesIntoError.length !== 1 || edgesIntoError[0] !== `${State.REPAIRING}--${Event.ABANDON}`) {
    violations.push(
      `ERROR must be reachable ONLY via repairing--abandon; found: [${edgesIntoError.join(', ')}]`,
    );
  }
  return violations;
}

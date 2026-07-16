// @sare/bounty — Fiat validator bounties scaffold (M5-BOUNTY).
//
// Domain-free. Posts structural / de-identified edge cases for elite cohort
// solve → council HITL promotion (never direct-to-hardened). Crypto parked;
// fiat payouts / card-checkout create are FAIL-CLOSED forever in this module
// (revenue-rail / founder Q). Dark flags seed OFF; even if flipped, payout
// helpers refuse until a future capped+audited ticket.
//
// Pure envelopes only. No DB, no network, no payment SDK, no vertical vocabulary.
// Adapters inject: store, clocks, optional flag reader, PHI de-id gate result.

/** Case lifecycle (HITL at promote). */
export const CASE_STATUS = Object.freeze({
  DRAFT: 'draft',
  POSTED: 'posted',
  SOLVED_PENDING_COUNCIL: 'solved_pending_council',
  PROMOTED: 'promoted',
  REJECTED: 'rejected',
});

/** Hard refuse for any money movement from this scaffold. */
export const PAYOUT_FORBIDDEN = 'payout_forbidden';
export const CHECKOUT_FORBIDDEN = 'release_gate_closed';

/** Dark flag keys (migration seeds OFF). */
export const BOUNTY_POST_FLAG = 'sare_bounty_post_live';
export const BOUNTY_PAYOUT_FLAG = 'sare_bounty_payout_live';

/**
 * Opaque structural keys (path / case) — same hygiene as inventory/twin.
 * @param {unknown} raw
 * @param {number} [maxLen]
 * @returns {string|null}
 */
export function normalizeStructuralKey(raw, maxLen = 128) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.length > maxLen) return null;
  if (!/^[A-Za-z0-9:_.\-/@]+$/.test(s)) return null;
  return s;
}

/**
 * Reward in integer cents only (fiat). Null/NaN/negative → null.
 * @param {unknown} raw
 * @returns {number|null}
 */
export function normalizeRewardCents(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/**
 * Draft / post a bounty case. Requires `anonymized === true` (caller / adapter
 * ran the PHI de-identification gate). Free text is stripped — structural only.
 *
 * @param {object} args
 * @returns {{ ok: boolean, case?: object, error?: string }}
 */
export function draftBountyCase(args = {}) {
  const case_key = normalizeStructuralKey(args.caseKey ?? args.case_key ?? args.id);
  const path_key = normalizeStructuralKey(args.pathKey ?? args.path_key);
  const practice_key = normalizeStructuralKey(args.practiceKey ?? args.practice_key);
  const reward_cents = normalizeRewardCents(args.rewardCents ?? args.reward_cents ?? 0);
  const anonymized = args.anonymized === true || args.phi_cleared === true;
  const now = typeof args.now === 'function' ? args.now() : new Date().toISOString();

  if (!case_key) return { ok: false, error: 'case_key_required' };
  if (!path_key) return { ok: false, error: 'path_key_required' };
  if (!anonymized) return { ok: false, error: 'phi_deid_required' };
  if (reward_cents == null) return { ok: false, error: 'reward_cents_invalid' };

  return {
    ok: true,
    case: {
      case_key,
      path_key,
      practice_key,
      reward_cents,
      currency: 'usd',
      status: CASE_STATUS.DRAFT,
      pending_hitl_review: true,
      anonymized: true,
      // Never carry free-text / PHI from caller
      solver_output: null,
      payout_status: 'not_payable',
      created_at: String(now),
      updated_at: String(now),
    },
  };
}

/**
 * Transition draft → posted (still no payout). Honors dark post flag when a
 * reader is injected; missing reader = allow unit/offline compose.
 *
 * @param {object} bountyCase
 * @param {object} [opts]
 * @returns {{ ok: boolean, case?: object, error?: string }}
 */
export function postBountyCase(bountyCase, opts = {}) {
  if (!bountyCase || bountyCase.status !== CASE_STATUS.DRAFT) {
    return { ok: false, error: 'case_not_draft' };
  }
  if (typeof opts.isFlagEnabled === 'function') {
    const on = opts.isFlagEnabled(BOUNTY_POST_FLAG);
    if (!on) return { ok: false, error: 'release_gate_closed', flag: BOUNTY_POST_FLAG };
  }
  const now = typeof opts.now === 'function' ? opts.now() : new Date().toISOString();
  return {
    ok: true,
    case: {
      ...bountyCase,
      status: CASE_STATUS.POSTED,
      pending_hitl_review: true,
      updated_at: String(now),
    },
  };
}

/**
 * Solver submits a structural solution envelope (path decisions only).
 * Queues council HITL — never hardens.
 *
 * @param {object} bountyCase
 * @param {object} solution  { solution_key, path_key?, decisions? } structural
 * @param {object} [opts]
 */
export function submitSolution(bountyCase, solution = {}, opts = {}) {
  if (!bountyCase || bountyCase.status !== CASE_STATUS.POSTED) {
    return { ok: false, error: 'case_not_posted' };
  }
  const solution_key = normalizeStructuralKey(solution.solutionKey ?? solution.solution_key ?? solution.id);
  if (!solution_key) return { ok: false, error: 'solution_key_required' };
  const now = typeof opts.now === 'function' ? opts.now() : new Date().toISOString();
  const decisions = Array.isArray(solution.decisions)
    ? solution.decisions
      .map((d) => normalizeStructuralKey(d, 64))
      .filter(Boolean)
    : [];
  return {
    ok: true,
    case: {
      ...bountyCase,
      status: CASE_STATUS.SOLVED_PENDING_COUNCIL,
      pending_hitl_review: true,
      solver_output: {
        solution_key,
        path_key: normalizeStructuralKey(solution.pathKey ?? solution.path_key) || bountyCase.path_key,
        decisions,
        submitted_at: String(now),
      },
      updated_at: String(now),
    },
  };
}

/**
 * Council HITL promote — marks case promoted for federation/council path.
 * Does NOT auto-harden clinical paths (SB 1120 / Spine D). Never pays out.
 *
 * @param {object} bountyCase
 * @param {object} actor  { actor_id, role: 'council'|'admin' }
 * @param {object} [opts]
 */
export function councilPromote(bountyCase, actor = {}, opts = {}) {
  if (!bountyCase || bountyCase.status !== CASE_STATUS.SOLVED_PENDING_COUNCIL) {
    return { ok: false, error: 'case_not_pending_council' };
  }
  const role = String(actor.role || '').toLowerCase();
  if (role !== 'council' && role !== 'admin') {
    return { ok: false, error: 'council_actor_required' };
  }
  const actor_id = normalizeStructuralKey(actor.actor_id ?? actor.actorId ?? actor.id, 64);
  if (!actor_id) return { ok: false, error: 'actor_id_required' };
  const now = typeof opts.now === 'function' ? opts.now() : new Date().toISOString();
  return {
    ok: true,
    case: {
      ...bountyCase,
      status: CASE_STATUS.PROMOTED,
      pending_hitl_review: false,
      council: {
        decision: 'promote',
        actor_id,
        role,
        at: String(now),
        hardens_clinical: false,
        note: 'Eligible for Spine D / council pathway only — never auto-harden clinical surfaces.',
      },
      // Still not payable from this scaffold
      payout_status: 'not_payable',
      updated_at: String(now),
    },
  };
}

/**
 * Council reject.
 * @param {object} bountyCase
 * @param {object} actor
 * @param {object} [opts]
 */
export function councilReject(bountyCase, actor = {}, opts = {}) {
  if (!bountyCase || bountyCase.status !== CASE_STATUS.SOLVED_PENDING_COUNCIL) {
    return { ok: false, error: 'case_not_pending_council' };
  }
  const role = String(actor.role || '').toLowerCase();
  if (role !== 'council' && role !== 'admin') {
    return { ok: false, error: 'council_actor_required' };
  }
  const actor_id = normalizeStructuralKey(actor.actor_id ?? actor.actorId ?? actor.id, 64);
  if (!actor_id) return { ok: false, error: 'actor_id_required' };
  const now = typeof opts.now === 'function' ? opts.now() : new Date().toISOString();
  return {
    ok: true,
    case: {
      ...bountyCase,
      status: CASE_STATUS.REJECTED,
      pending_hitl_review: false,
      council: { decision: 'reject', actor_id, role, at: String(now) },
      payout_status: 'not_payable',
      updated_at: String(now),
    },
  };
}

/**
 * Fiat payout attempt — ALWAYS forbidden in this scaffold (non-negotiable #11
 * revenue-rail posture / VISION_DELTA §3.4). Flag state is ignored.
 *
 * @returns {{ ok: false, error: string, flag: string }}
 */
export function attemptPayout(_bountyCase, _opts = {}) {
  return {
    ok: false,
    error: PAYOUT_FORBIDDEN,
    flag: BOUNTY_PAYOUT_FLAG,
    reason: 'M5-BOUNTY scaffold never moves money; payout needs a future founder-approved revenue rail ticket.',
  };
}

/**
 * Hosted checkout create — ALWAYS fail-closed (same as marketing dark rails).
 * @returns {{ ok: false, error: string }}
 */
export function createCheckoutSession(_bountyCase, _opts = {}) {
  return {
    ok: false,
    error: CHECKOUT_FORBIDDEN,
    flag: BOUNTY_PAYOUT_FLAG,
    reason: 'Fiat checkout remains dark; no checkout_url is ever emitted from engine/bounty.',
  };
}

/**
 * Factory with in-memory store for offline gates / adapters.
 * @param {object} [opts]
 */
export function createBountyStore(opts = {}) {
  /** @type {Map<string, object>} */
  const map = opts.map || new Map();
  return {
    async put(row) {
      map.set(row.case_key, row);
      return row;
    },
    async get(caseKey) {
      return map.get(String(caseKey)) || null;
    },
    async list() {
      return [...map.values()];
    },
  };
}

export default {
  CASE_STATUS,
  PAYOUT_FORBIDDEN,
  CHECKOUT_FORBIDDEN,
  BOUNTY_POST_FLAG,
  BOUNTY_PAYOUT_FLAG,
  draftBountyCase,
  postBountyCase,
  submitSolution,
  councilPromote,
  councilReject,
  attemptPayout,
  createCheckoutSession,
  createBountyStore,
};

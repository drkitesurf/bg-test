// @sare/inventory — Inventory arbitrage → HITL purchase-order drafting (M5-INVENT).
//
// Domain-free. Detects reorder signals from structural stock rows and drafts a
// purchase order queued for human approval. NEVER auto-purchases or submits to
// a vendor (non-negotiable #11 / vision-delta reconciled form). Approve moves
// a draft to `approved` only — vendor commit stays a separate, future dark-gated
// path that this module does not implement.
//
// Pure control + envelope shaping. No DB, no network, no vertical vocabulary.
// Adapters inject: stock snapshots, quote lookups, clocks, optional flag reader.

/** PO lifecycle (HITL). No purchased/submitted terminal here. */
export const PO_STATUS = Object.freeze({
  PENDING_HITL: 'pending_hitl_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/** Hard fail for any unattended buy path. */
export const AUTO_PURCHASE_FORBIDDEN = 'auto_purchase_forbidden';

/** Dark flag key (seeded OFF). Even if flipped, this engine never auto-buys. */
export const AUTO_PURCHASE_FLAG = 'sare_inventory_auto_purchase';

/**
 * Opaque practice key (same shape as twin). Empty → null.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizePracticeKey(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.length > 128) return null;
  if (!/^[A-Za-z0-9:_.\-/@]+$/.test(s)) return null;
  return s;
}

/**
 * Structural SKU key only (no free-text identity).
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeSkuKey(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.length > 64) return null;
  if (!/^[A-Za-z0-9:_.\-/]+$/.test(s)) return null;
  return s;
}

/**
 * Normalize one stock row for reorder detection.
 * @param {object} raw
 * @returns {{ sku_key: string, on_hand: number, reorder_point: number, suggested_qty: number, unit_cost: number|null, vendor_ref: string|null }|null}
 */
export function normalizeStockRow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const sku_key = normalizeSkuKey(raw.sku_key ?? raw.skuKey ?? raw.sku);
  if (!sku_key) return null;
  const on_hand = Number(raw.on_hand ?? raw.onHand ?? raw.qty ?? 0);
  const reorder_point = Number(raw.reorder_point ?? raw.reorderPoint ?? 0);
  if (!Number.isFinite(on_hand) || !Number.isFinite(reorder_point)) return null;
  let suggested_qty = Number(raw.suggested_qty ?? raw.suggestedQty);
  if (!Number.isFinite(suggested_qty) || suggested_qty <= 0) {
    // Default: bring back to reorder_point + one unit, or at least 1.
    suggested_qty = Math.max(1, Math.ceil(reorder_point - on_hand) || 1);
  }
  const unitRaw = raw.unit_cost ?? raw.unitCost;
  const unit_cost = unitRaw == null || unitRaw === '' ? null : Number(unitRaw);
  const vendor_ref = raw.vendor_ref != null || raw.vendorRef != null
    ? String(raw.vendor_ref ?? raw.vendorRef).trim() || null
    : null;
  return {
    sku_key,
    on_hand,
    reorder_point,
    suggested_qty,
    unit_cost: Number.isFinite(unit_cost) ? unit_cost : null,
    vendor_ref,
  };
}

/**
 * Arbitrage / depletion signal: stock at or below reorder point.
 * @param {Array} stockLevels
 * @returns {Array<{ sku_key: string, on_hand: number, reorder_point: number, suggested_qty: number, unit_cost: number|null, vendor_ref: string|null, basis: string }>}
 */
export function detectReorderSignals(stockLevels) {
  const out = [];
  for (const raw of stockLevels || []) {
    const row = normalizeStockRow(raw);
    if (!row) continue;
    if (row.on_hand > row.reorder_point) continue;
    out.push({
      ...row,
      basis: 'on_hand_lte_reorder_point',
    });
  }
  return out.sort((a, b) => (a.sku_key < b.sku_key ? -1 : a.sku_key > b.sku_key ? 1 : 0));
}

/**
 * Normalize a PO line (structural only).
 * @param {object} raw
 */
export function normalizePoLine(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const sku_key = normalizeSkuKey(raw.sku_key ?? raw.skuKey ?? raw.sku);
  if (!sku_key) return null;
  const qty = Number(raw.qty ?? raw.quantity ?? raw.suggested_qty ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unitRaw = raw.unit_cost ?? raw.unitCost;
  const unit_cost = unitRaw == null || unitRaw === '' ? null : Number(unitRaw);
  const vendor_ref = raw.vendor_ref != null || raw.vendorRef != null
    ? String(raw.vendor_ref ?? raw.vendorRef).trim() || null
    : null;
  return {
    sku_key,
    qty,
    unit_cost: Number.isFinite(unit_cost) ? unit_cost : null,
    vendor_ref,
  };
}

function newPoId(now) {
  const t = typeof now === 'function' ? now() : new Date().toISOString();
  const stamp = String(t).replace(/[^\d]/g, '').slice(0, 14) || '0';
  return `po_${stamp}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Draft a purchase order for HITL review. Never purchases.
 *
 * @param {object} opts
 * @param {string} opts.practiceKey
 * @param {Array} [opts.lines] — explicit lines
 * @param {Array} [opts.signals] — from detectReorderSignals (maps to lines)
 * @param {object} [opts.quote] — optional { source, noted_at } (never a live charge)
 * @param {() => string} [opts.now]
 * @param {(key:string)=>boolean} [opts.isFlagEnabled] — injected flag reader
 * @returns {{ ok: true, po: object } | { ok: false, error: string }}
 */
export function draftPurchaseOrder(opts = {}) {
  const practice_key = normalizePracticeKey(opts.practiceKey ?? opts.practice_id ?? opts.practiceId);
  if (!practice_key) {
    return { ok: false, error: 'practice_key_required' };
  }

  // Optional dark gate for *surfacing* drafts at the edge. Engine stays offline-safe:
  // when a reader is injected and reports false, refuse. When no reader, allow
  // (pure unit / offline path — same pattern as twin fixtures).
  if (typeof opts.isFlagEnabled === 'function') {
    // Draft path uses its own live flag when adapters wire edge exposure.
    // Auto-purchase flag is NEVER consulted here — drafts do not buy.
    const draftLive = opts.isFlagEnabled('sare_inventory_po_draft_live');
    if (draftLive === false) {
      return { ok: false, error: 'release_gate_closed', flag: 'sare_inventory_po_draft_live' };
    }
  }

  const now = typeof opts.now === 'function' ? opts.now : () => new Date().toISOString();
  const lines = [];
  for (const raw of opts.lines || []) {
    const line = normalizePoLine(raw);
    if (line) lines.push(line);
  }
  for (const sig of opts.signals || []) {
    const line = normalizePoLine({
      sku_key: sig.sku_key,
      qty: sig.suggested_qty,
      unit_cost: sig.unit_cost,
      vendor_ref: sig.vendor_ref,
    });
    if (line) lines.push(line);
  }
  // Dedupe by sku_key (sum qty).
  const bySku = new Map();
  for (const line of lines) {
    const prev = bySku.get(line.sku_key);
    if (!prev) {
      bySku.set(line.sku_key, { ...line });
    } else {
      prev.qty += line.qty;
      if (prev.unit_cost == null && line.unit_cost != null) prev.unit_cost = line.unit_cost;
      if (!prev.vendor_ref && line.vendor_ref) prev.vendor_ref = line.vendor_ref;
    }
  }
  const merged = [...bySku.values()].sort((a, b) => (a.sku_key < b.sku_key ? -1 : 1));
  if (merged.length === 0) {
    return { ok: false, error: 'no_lines' };
  }

  const quote = opts.quote && typeof opts.quote === 'object'
    ? {
        source: String(opts.quote.source || 'injected').slice(0, 64),
        noted_at: opts.quote.noted_at != null ? String(opts.quote.noted_at) : now(),
      }
    : null;

  const po = {
    id: opts.id || newPoId(now),
    practice_key,
    status: PO_STATUS.PENDING_HITL,
    pending_hitl_review: true,
    lines: merged,
    quote,
    created_at: now(),
    confirmed_by: null,
    rejected_by: null,
    rejection_reason: null,
    // Explicit: approved is not purchased.
    vendor_submitted: false,
    purchased: false,
  };

  return { ok: true, po };
}

/**
 * Compose draft from stock levels (detect → draft). Convenience for adapters.
 */
export function draftFromStock(opts = {}) {
  const signals = detectReorderSignals(opts.stockLevels || opts.stock || []);
  if (signals.length === 0) {
    return { ok: false, error: 'no_reorder_signals', signals: [] };
  }
  return draftPurchaseOrder({
    ...opts,
    signals,
  });
}

/**
 * HITL approve — human only. Does NOT purchase or submit to a vendor.
 * @param {object} po
 * @param {{ confirmedBy: string, now?: () => string }} opts
 */
export function approvePurchaseOrder(po, opts = {}) {
  if (!po || typeof po !== 'object') {
    return { ok: false, error: 'missing_po' };
  }
  if (po.status !== PO_STATUS.PENDING_HITL && po.pending_hitl_review !== true) {
    return { ok: false, error: 'not_pending_hitl', status: po.status };
  }
  const confirmedBy = String(opts.confirmedBy ?? opts.confirmed_by ?? '').trim();
  if (!confirmedBy) {
    return { ok: false, error: 'confirmed_by_required' };
  }
  const now = typeof opts.now === 'function' ? opts.now : () => new Date().toISOString();
  return {
    ok: true,
    po: {
      ...po,
      lines: Array.isArray(po.lines) ? po.lines.map((l) => ({ ...l })) : [],
      status: PO_STATUS.APPROVED,
      pending_hitl_review: false,
      confirmed_by: confirmedBy,
      approved_at: now(),
      vendor_submitted: false,
      purchased: false,
    },
  };
}

/**
 * HITL reject.
 * @param {object} po
 * @param {{ rejectedBy: string, reason?: string, now?: () => string }} opts
 */
export function rejectPurchaseOrder(po, opts = {}) {
  if (!po || typeof po !== 'object') {
    return { ok: false, error: 'missing_po' };
  }
  if (po.status !== PO_STATUS.PENDING_HITL && po.pending_hitl_review !== true) {
    return { ok: false, error: 'not_pending_hitl', status: po.status };
  }
  const rejectedBy = String(opts.rejectedBy ?? opts.rejected_by ?? '').trim();
  if (!rejectedBy) {
    return { ok: false, error: 'rejected_by_required' };
  }
  const now = typeof opts.now === 'function' ? opts.now : () => new Date().toISOString();
  return {
    ok: true,
    po: {
      ...po,
      lines: Array.isArray(po.lines) ? po.lines.map((l) => ({ ...l })) : [],
      status: PO_STATUS.REJECTED,
      pending_hitl_review: false,
      rejected_by: rejectedBy,
      rejection_reason: opts.reason != null ? String(opts.reason).slice(0, 500) : null,
      rejected_at: now(),
      vendor_submitted: false,
      purchased: false,
    },
  };
}

/**
 * Fail-closed: unattended purchase is never allowed by this module.
 * Even when the dark flag reader returns true, v1 refuses — auto-buy needs a
 * future ticket with spending caps + audit (vision §3.2). Always returns
 * `{ ok: false, error: 'auto_purchase_forbidden' }`.
 *
 * @param {object} [_po]
 * @param {{ isFlagEnabled?: (key:string)=>boolean }} [_opts]
 */
export function attemptAutoPurchase(_po, _opts = {}) {
  // Deliberately ignore flag / po state — non-negotiable #11.
  return {
    ok: false,
    error: AUTO_PURCHASE_FORBIDDEN,
    flag: AUTO_PURCHASE_FLAG,
    vendor_submitted: false,
    purchased: false,
  };
}

/** Alias — same fail-closed contract. */
export function submitToVendor(po, opts) {
  return attemptAutoPurchase(po, opts);
}

/**
 * Invariant helper for gates / adapters: a PO must never look "purchased"
 * without a separate governed path (which this engine does not provide).
 * @param {object} po
 */
export function assertDraftOnlyInvariants(po) {
  if (!po || typeof po !== 'object') {
    return { ok: false, error: 'missing_po' };
  }
  if (po.purchased === true || po.vendor_submitted === true) {
    return { ok: false, error: 'illegal_purchase_state' };
  }
  if (po.status === 'purchased' || po.status === 'submitted' || po.status === 'ordered') {
    return { ok: false, error: 'illegal_purchase_status', status: po.status };
  }
  return { ok: true };
}

/**
 * Factory store for in-memory HITL queue (adapter / tests). No persistence.
 * @param {object} [opts]
 * @param {() => string} [opts.now]
 * @param {(key:string)=>boolean} [opts.isFlagEnabled]
 */
export function createInventoryPoStore(opts = {}) {
  const now = typeof opts.now === 'function' ? opts.now : () => new Date().toISOString();
  const isFlagEnabled = typeof opts.isFlagEnabled === 'function' ? opts.isFlagEnabled : null;
  /** @type {Map<string, object>} */
  const byId = new Map();

  return {
    detectReorderSignals,
    list() {
      return [...byId.values()].map((p) => ({ ...p, lines: p.lines.map((l) => ({ ...l })) }));
    },
    get(id) {
      const p = byId.get(String(id || ''));
      return p ? { ...p, lines: p.lines.map((l) => ({ ...l })) } : null;
    },
    draft(draftOpts = {}) {
      const result = draftPurchaseOrder({
        ...draftOpts,
        now,
        isFlagEnabled: isFlagEnabled || undefined,
      });
      if (!result.ok) return result;
      byId.set(result.po.id, result.po);
      return { ok: true, po: { ...result.po, lines: result.po.lines.map((l) => ({ ...l })) } };
    },
    draftFromStock(stockOpts = {}) {
      const result = draftFromStock({
        ...stockOpts,
        now,
        isFlagEnabled: isFlagEnabled || undefined,
      });
      if (!result.ok) return result;
      byId.set(result.po.id, result.po);
      return { ok: true, po: { ...result.po, lines: result.po.lines.map((l) => ({ ...l })) } };
    },
    approve(id, conf) {
      const cur = byId.get(String(id || ''));
      if (!cur) return { ok: false, error: 'not_found' };
      const result = approvePurchaseOrder(cur, { ...conf, now });
      if (!result.ok) return result;
      byId.set(result.po.id, result.po);
      return { ok: true, po: { ...result.po, lines: result.po.lines.map((l) => ({ ...l })) } };
    },
    reject(id, conf) {
      const cur = byId.get(String(id || ''));
      if (!cur) return { ok: false, error: 'not_found' };
      const result = rejectPurchaseOrder(cur, { ...conf, now });
      if (!result.ok) return result;
      byId.set(result.po.id, result.po);
      return { ok: true, po: { ...result.po, lines: result.po.lines.map((l) => ({ ...l })) } };
    },
    /** Always fail-closed. */
    purchase(id) {
      const cur = byId.get(String(id || ''));
      return attemptAutoPurchase(cur || { id }, { isFlagEnabled: isFlagEnabled || undefined });
    },
  };
}

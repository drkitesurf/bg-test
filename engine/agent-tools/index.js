// engine/agent-tools — the governed agent tool-contract backbone (SARE spine,
// PMS-005 core). Turns a set of tools into a least-privilege, human-in-the-loop
// tool layer that all product agents standardize on. Domain-free: the engine
// names no tool, no role, no vertical — the adapter registers real tools and
// injects the permission matcher.
//
// Three load-bearing guarantees (clean-room re-implementation of a governed
// agentic pattern; no third-party code):
//   1. RBAC PARITY — a tool is filtered from the set the model even SEES if the
//      caller can't use it, AND re-validated with the SAME matcher at execution.
//      An agent can never do anything the caller couldn't do in the UI.
//   2. WRITE-CONFIRMATION-AS-STATE — READ tools auto-run; WRITE/DESTRUCTIVE
//      tools DO NOT execute — they return a pending-confirmation the caller
//      persists, and execute only when a human confirms. This IS
//      PENDING_HITL_REVIEW, native to the tool loop (SB-1120).
//   3. BUDGET — an optional per-session cost/token ceiling is checked before any
//      execution, so a runaway loop can't spend without bound.
//
// Pure logic: no I/O, no clock, no provider SDK. permissionMatches + handlers +
// budget are injected.

export const ToolCategory = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  DESTRUCTIVE: 'destructive',
});

const NEEDS_CONFIRM = new Set([ToolCategory.WRITE, ToolCategory.DESTRUCTIVE]);

/**
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} category - one of ToolCategory
 * @property {string[]} permissions - permission strings the caller must hold
 * @property {(args:Object, ctx:Object)=>Promise<any>} handler
 * @property {boolean} [exposesFreeText] - returns prose → excluded from an
 *   untrusted/non-BAA path when redaction is on (data-minimization)
 * @property {number} [cost] - nominal cost units charged to the budget on run
 */

/**
 * @param {Object} opts
 * @param {(required:string[], ctx:Object)=>boolean} opts.permissionMatches
 *   adapter-supplied: does the caller (ctx) hold ALL required permissions?
 * @param {Object} [opts.budget] - `{ remaining():number, charge(n:number):void }`
 * @param {boolean} [opts.redactUntrusted] - when true, exposesFreeText tools are
 *   withheld from `offerable(ctx, {untrusted:true})`
 */
export function createToolRegistry(opts = {}) {
  const permissionMatches =
    typeof opts.permissionMatches === 'function'
      ? opts.permissionMatches
      : () => false; // fail-closed: no matcher → nothing is allowed
  const budget = opts.budget || null;
  const redactUntrusted = !!opts.redactUntrusted;
  const tools = new Map();

  function register(tool) {
    if (!tool || typeof tool.name !== 'string') throw new Error('tool.name required');
    if (!Object.values(ToolCategory).includes(tool.category)) {
      throw new Error(`tool ${tool.name}: invalid category ${tool.category}`);
    }
    if (typeof tool.handler !== 'function') throw new Error(`tool ${tool.name}: handler required`);
    tools.set(tool.name, {
      name: tool.name,
      category: tool.category,
      permissions: Array.isArray(tool.permissions) ? tool.permissions : [],
      handler: tool.handler,
      exposesFreeText: !!tool.exposesFreeText,
      cost: Number.isFinite(tool.cost) ? tool.cost : 0,
    });
    return registry;
  }

  // PRE-OFFER GATE: only the tools this caller may use are shown to the model.
  function offerable(ctx, offerOpts = {}) {
    const untrusted = !!offerOpts.untrusted;
    const out = [];
    for (const t of tools.values()) {
      if (!permissionMatches(t.permissions, ctx)) continue;
      if (untrusted && redactUntrusted && t.exposesFreeText) continue;
      out.push({ name: t.name, category: t.category, exposesFreeText: t.exposesFreeText });
    }
    return out;
  }

  function checkBudget(tool) {
    if (!budget) return { ok: true };
    if (typeof budget.remaining === 'function' && budget.remaining() < tool.cost) {
      return { ok: false, error: 'budget_exhausted' };
    }
    return { ok: true };
  }

  async function run(tool, args, ctx) {
    const b = checkBudget(tool);
    if (!b.ok) return { status: 'error', error: b.error, tool: tool.name };
    if (budget && typeof budget.charge === 'function') budget.charge(tool.cost);
    const output = await tool.handler(args, ctx);
    return { status: 'ok', output, tool: tool.name };
  }

  /**
   * Invoke a tool. READ → runs. WRITE/DESTRUCTIVE → returns a pending
   * confirmation (does NOT execute). EXECUTION GATE re-checks permissions with
   * the same matcher every time.
   */
  async function invoke(name, args, ctx) {
    const tool = tools.get(name);
    if (!tool) return { status: 'error', error: 'unknown_tool', tool: name };
    // RBAC parity: re-validate at execution, even though offer() already filtered.
    if (!permissionMatches(tool.permissions, ctx)) {
      return { status: 'denied', error: 'permission_denied', tool: name };
    }
    if (NEEDS_CONFIRM.has(tool.category)) {
      // do not execute — suspend as a pending human-review state (PENDING_HITL_REVIEW)
      return {
        status: 'confirmation_required',
        tool: name,
        category: tool.category,
        args,
        requiresHitl: true,
      };
    }
    return run(tool, args, ctx);
  }

  /**
   * Confirm a previously-suspended WRITE/DESTRUCTIVE tool. Re-checks permissions
   * (RBAC parity) and budget before executing. A caller who lost permission
   * between offer and confirm is still denied.
   */
  async function confirm(pending, ctx) {
    if (!pending || typeof pending.tool !== 'string') {
      return { status: 'error', error: 'invalid_pending' };
    }
    const tool = tools.get(pending.tool);
    if (!tool) return { status: 'error', error: 'unknown_tool', tool: pending.tool };
    if (!NEEDS_CONFIRM.has(tool.category)) {
      return { status: 'error', error: 'tool_does_not_need_confirmation', tool: pending.tool };
    }
    if (!permissionMatches(tool.permissions, ctx)) {
      return { status: 'denied', error: 'permission_denied', tool: pending.tool };
    }
    return run(tool, pending.args, ctx);
  }

  const registry = { register, offerable, invoke, confirm, has: (n) => tools.has(n), size: () => tools.size };
  return registry;
}

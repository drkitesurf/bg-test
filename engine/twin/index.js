// @sare/twin — Practice digital twin (M5-TWIN).
//
// Domain-free. A twin is a live DAG instance bound to an opaque practice key,
// optionally fed by ambient run-tape summaries. It snapshots structural state,
// executes the DAG once (injected work), and re-runs Monte-Carlo what-ifs via
// Ghost-Run. Animation / UI / consent gates live in adapters — never here.
//
// Pure control + envelope shaping. No DB, no network, no vertical vocabulary.
// Adapters inject: nodes, run(node,inputs), ambient compose helpers, clocks.

import { executeDag, topoSort, executionLayers } from '../dag/index.js';
import { ghostRun, ghostCompare } from '../dag/ghost-run.js';
import { captureAmbientEvents, summarizeRunTape } from '../ambient/index.js';

/**
 * Opaque practice key only (no free-text identity). Empty → null.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizePracticeKey(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.length > 128) return null;
  // Structural keys only — reject whitespace / control chars.
  if (!/^[A-Za-z0-9:_.\-/@]+$/.test(s)) return null;
  return s;
}

/**
 * Freeze a structural twin snapshot (no PHI by construction — nodes + tape stats).
 * @param {object} twin
 */
export function snapshotTwin(twin) {
  if (!twin || typeof twin !== 'object') {
    return { ok: false, error: 'missing_twin' };
  }
  const practice_key = normalizePracticeKey(twin.practice_key ?? twin.practiceId);
  const nodes = Array.isArray(twin.nodes) ? twin.nodes.map((n) => ({ ...n })) : [];
  let order = [];
  let layers = [];
  try {
    order = topoSort(nodes);
    layers = executionLayers(nodes);
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), practice_key, nodes };
  }
  const tape = Array.isArray(twin.tape) ? twin.tape : [];
  const tapeSummary = summarizeRunTape(tape);
  return {
    ok: true,
    practice_key,
    node_count: nodes.length,
    order,
    layers: layers.map((L) => [...L]),
    tape_event_count: tapeSummary.event_count,
    tape_paths: Object.keys(tapeSummary.byPath || {}).sort(),
    revision: Number(twin.revision) || 0,
    at: twin.at != null ? String(twin.at) : null,
  };
}

/**
 * Create a practice twin. `practiceKey` is opaque. `nodes` is a DAG template.
 * Optional `tape` seeds ambient events (structural only).
 *
 * @param {object} opts
 * @param {string} opts.practiceKey
 * @param {Array} opts.nodes
 * @param {Array} [opts.tape]
 * @param {() => string} [opts.now] — injected clock (ISO string)
 */
export function createPracticeTwin(opts = {}) {
  const practice_key = normalizePracticeKey(opts.practiceKey ?? opts.practice_id ?? opts.practiceId);
  if (!practice_key) {
    throw new Error('practice_key_required');
  }
  let nodes = Array.isArray(opts.nodes) ? opts.nodes.map((n) => ({ ...n })) : [];
  // Validate graph eagerly.
  topoSort(nodes);
  let tape = captureAmbientEvents([], opts.tape || []);
  let revision = Number.isInteger(opts.revision) ? opts.revision : 0;
  const now = typeof opts.now === 'function' ? opts.now : () => new Date().toISOString();

  const api = {
    practice_key,
    get nodes() { return nodes.map((n) => ({ ...n })); },
    get tape() { return tape.map((e) => ({ ...e })); },
    get revision() { return revision; },

    /** Replace DAG template (validates topo). Bumps revision. */
    setNodes(next) {
      const copy = Array.isArray(next) ? next.map((n) => ({ ...n })) : [];
      topoSort(copy);
      nodes = copy;
      revision += 1;
      return api;
    },

    /** Append ambient events (structural path_key only). */
    attachAmbient(events) {
      tape = captureAmbientEvents(tape, events || []);
      revision += 1;
      return api;
    },

    summarizeAmbient() {
      return summarizeRunTape(tape);
    },

    snapshot() {
      return snapshotTwin({ practice_key, nodes, tape, revision, at: now() });
    },

    /**
     * Run the twin DAG once. Injected `run` does the work (adapter / ambient).
     * @param {{ run?: Function }} opts
     */
    async runOnce(runOpts = {}) {
      const run = typeof runOpts.run === 'function' ? runOpts.run : async () => undefined;
      const result = await executeDag(nodes, { run });
      return {
        practice_key,
        revision,
        at: now(),
        ...result,
        ambient: summarizeRunTape(tape),
      };
    },

    /**
     * Ghost-Run Monte Carlo over this twin's DAG.
     * @param {object} ghostOpts — same contract as engine/dag/ghost-run ghostRun
     */
    async ghost(ghostOpts = {}) {
      return ghostRun(nodes, ghostOpts);
    },

    /**
     * Baseline vs alternatives over this twin's DAG.
     */
    async compare(baseOpts, alternatives = []) {
      return ghostCompare(nodes, baseOpts, alternatives);
    },
  };

  return api;
}

export default {
  normalizePracticeKey,
  snapshotTwin,
  createPracticeTwin,
};

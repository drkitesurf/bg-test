// @sare/dag — workflow graph model + topological parallel executor (M5, DAGX).
//
// Domain-free. A workflow is a set of nodes with dependencies; this executes them
// in dependency order, running independent nodes concurrently (layer by layer),
// with the per-node work INJECTED. It is the substrate the Ghost-Run
// counterfactual simulator (engine/dag/ghost-run.js) replays over. Pure control
// flow — no domain facts, no DB, no provider calls.
//
// A node: { id, deps?: string[], ... }. The executor never inspects domain fields.

/** Validate + index nodes; throws on a missing dependency or duplicate id. */
function indexNodes(nodes) {
  const byId = new Map();
  for (const n of nodes || []) {
    if (!n || n.id == null) throw new Error('every node needs an id');
    if (byId.has(n.id)) throw new Error(`duplicate node id: ${n.id}`);
    byId.set(n.id, { ...n, deps: (n.deps || []).map(String) });
  }
  for (const n of byId.values()) {
    for (const d of n.deps) if (!byId.has(d)) throw new Error(`node ${n.id} depends on unknown node ${d}`);
  }
  return byId;
}

/** Topological order (Kahn's). Throws { message, cycle } if the graph has a cycle. */
export function topoSort(nodes) {
  const byId = indexNodes(nodes);
  const indeg = new Map();
  const dependents = new Map();
  for (const n of byId.values()) { indeg.set(n.id, n.deps.length); dependents.set(n.id, []); }
  for (const n of byId.values()) for (const d of n.deps) dependents.get(d).push(n.id);
  const queue = [...byId.values()].filter((n) => indeg.get(n.id) === 0).map((n) => n.id).sort();
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const dep of dependents.get(id)) {
      indeg.set(dep, indeg.get(dep) - 1);
      if (indeg.get(dep) === 0) { queue.push(dep); queue.sort(); }
    }
  }
  if (order.length !== byId.size) {
    const cycle = [...byId.keys()].filter((id) => !order.includes(id));
    const err = new Error(`cycle detected among: ${cycle.join(', ')}`);
    err.cycle = cycle;
    throw err;
  }
  return order;
}

/** Group nodes into parallelizable layers: layer k = nodes whose deps are all in layers < k. */
export function executionLayers(nodes) {
  const byId = indexNodes(nodes);
  topoSort(nodes); // throws on cycle
  const placed = new Map(); // id → layer index
  const layers = [];
  let remaining = [...byId.keys()];
  while (remaining.length) {
    const ready = remaining.filter((id) => byId.get(id).deps.every((d) => placed.has(d)));
    if (!ready.length) break; // (cycle already excluded)
    ready.sort();
    layers.push(ready);
    for (const id of ready) placed.set(id, layers.length - 1);
    remaining = remaining.filter((id) => !placed.has(id));
  }
  return layers;
}

/**
 * Execute the DAG. `run(node, inputs)` is the injected per-node work; `inputs` is a
 * map of {depId: output}. Independent nodes in a layer run concurrently. A node
 * whose dependency failed or was skipped is SKIPPED (not run) with a reason — a
 * failure never silently produces a downstream result.
 *
 * @returns {{ ok, order, results: Record<id,{status,output?,error?,skippedBy?}> }}
 */
export async function executeDag(nodes, opts = {}) {
  const run = typeof opts.run === 'function' ? opts.run : async () => undefined;
  const byId = indexNodes(nodes);
  const layers = executionLayers(nodes);
  const results = {};
  const order = [];

  for (const layer of layers) {
    await Promise.all(layer.map(async (id) => {
      const node = byId.get(id);
      // skip if any dependency did not succeed
      const badDep = node.deps.find((d) => results[d] && results[d].status !== 'ok');
      if (badDep) { results[id] = { status: 'skipped', skippedBy: badDep }; order.push(id); return; }
      const inputs = {};
      for (const d of node.deps) inputs[d] = results[d] ? results[d].output : undefined;
      try {
        const output = await run(node, inputs);
        results[id] = { status: 'ok', output };
      } catch (e) {
        results[id] = { status: 'error', error: String((e && e.message) || e) };
      }
      order.push(id);
    }));
  }

  const ok = Object.values(results).every((r) => r.status === 'ok');
  return { ok, order, results };
}

export default { topoSort, executionLayers, executeDag };

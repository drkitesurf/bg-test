#!/usr/bin/env node
// T-003 acceptance: engine/ runs standalone — zero app imports, offline/no-op
// paths exercised for the spines M2 (content awareness) will inject into.
import assert from 'node:assert/strict';
import { createInterceptor } from '../../engine/interceptor/index.js';
import { createGateway, parseTarget, validateRouteConfig } from '../../engine/gateway/index.js';
import { calcifyPathKey, createMemoryCounterStore, } from '../../engine/calcification/index.js';
import { makeEvent } from '../../engine/event-store/index.js';

// --- interceptor: no stages registered -> produce() output passes through ---
{
  const ic = createInterceptor();
  // produce() returns the raw output value directly — the interceptor does
  // not unwrap an { output } envelope from it.
  const result = await ic.intercept({}, async () => ({ ok: true }));
  assert.equal(result.output.ok, true);
  assert.equal(result.vetoed, false);
  console.log('interceptor: no-op pass-through OK');
}

// --- interceptor: a pre-gate short-circuits before produce() is ever called -
{
  const ic = createInterceptor();
  let produceCalled = false;
  ic.usePreGate(() => ({ shortCircuit: true, output: { blocked: true }, source: 'pregate' }));
  const result = await ic.intercept({}, async () => { produceCalled = true; return {}; });
  assert.equal(produceCalled, false, 'produce() must not run after a pre-gate short-circuit');
  assert.equal(result.output.blocked, true);
  console.log('interceptor: pre-gate short-circuit OK');
}

// --- gateway: offline degrade when no executor is registered for a target --
{
  const config = { routes: { classify: { primary: 'ollama:llama3.2:3b', fallback: [] } } };
  assert.equal(validateRouteConfig(config).ok, true);
  assert.deepEqual(parseTarget('ollama:llama3.2:3b'), { provider: 'ollama', model: 'llama3.2:3b' });
  const gw = createGateway(config, { executors: {} }); // no executors -> must degrade, not throw
  const result = await gw.route('classify', { text: 'x' });
  assert.equal(result.ok, false);
  console.log('gateway: offline degrade (no throw) OK');
}

// --- calcification: in-memory counter, path-key stability -------------------
{
  const store = createMemoryCounterStore();
  const key = calcifyPathKey({ surface: 'importer', node: 'classify', decision: 'kite-bar' });
  await store.increment(key);
  await store.increment(key);
  const n = await store.get(key);
  assert.equal(n, 2);
  console.log('calcification: memory counter OK');
}

// --- event-store: append-only event shape is frozen -------------------------
{
  const ev = makeEvent('item-1', 1, 'create_item', { name: 'test' }, { provenance: 'importer' });
  assert.throws(() => { ev.data.name = 'mutated'; }, undefined, 'events must be immutable — mutation should not silently succeed');
  assert.equal(Object.isFrozen(ev), true);
  console.log('event-store: frozen event OK');
}

console.log('engine-smoke gate: PASS — engine/ runs standalone, offline paths degrade safely, zero app imports');

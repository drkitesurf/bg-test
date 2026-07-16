// engine/event-store — event-sourced record core (SARE spine). The substrate
// for "the record proposes itself": every clinical/financial fact is an
// append-only, provenance-carrying event; current state is a PROJECTION over
// the event stream, and any past state is a replay. This is what makes
// time-travel, a complete audit trail, and the RSI outcome-signal (the event
// stream itself) native rather than bolted on.
//
// Two guarantees:
//   1. APPEND-ONLY + PROVENANCE — events are never mutated; each carries a
//      monotonic per-stream seq and a meta.provenance.
//   2. OPTIMISTIC CONCURRENCY (never wall-clock LWW) — an append with a stale
//      expectedVersion is REJECTED, so two concurrent edits can't silently
//      clobber each other by device clock. Corrections are new events.
//
// Pure/domain-free: the engine names no entity, field, or vertical. Persistence
// (read/append) and the reducers (event → state) are INJECTED by the adapter.

/** Recursively freeze a value so an event is truly append-only (no mutation). */
function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(v[k]);
  }
  return v;
}

/** Shape an immutable event. seq is 1-based per stream. */
export function makeEvent(streamId, seq, type, data, meta = {}) {
  return deepFreeze({
    streamId,
    seq,
    type,
    data: data ?? null,
    meta: {
      actor: meta.actor ?? null,
      at: meta.at ?? null, // injected timestamp (engine reads no clock)
      provenance: meta.provenance ?? null,
    },
  });
}

/** The version of a stream = number of events (= last seq). */
export function streamVersion(events) {
  return Array.isArray(events) ? events.length : 0;
}

/** Next seq to assign (1-based). */
export function nextSeq(events) {
  const last = Array.isArray(events) && events.length ? events[events.length - 1] : null;
  return (last ? last.seq : 0) + 1;
}

/**
 * Optimistic-concurrency guard. Throws if expectedVersion is provided and does
 * not equal the current version — the anti-LWW invariant. Pass expectedVersion
 * null to append unconditionally (use sparingly).
 */
export function guardConcurrency(events, expectedVersion) {
  if (expectedVersion == null) return;
  const v = streamVersion(events);
  if (expectedVersion !== v) {
    const err = new Error(`concurrency_conflict: expected version ${expectedVersion}, stream is at ${v}`);
    err.code = 'concurrency_conflict';
    err.expected = expectedVersion;
    err.actual = v;
    throw err;
  }
}

/**
 * Fold events into a state via a type→reducer map. Unknown event types are
 * ignored (forward-compatible: an old projector tolerates new event types).
 * @param {Array} events
 * @param {Object} opts - { reducers: {[type]: (state,event)=>state}, initial }
 */
export function project(events, opts = {}) {
  const reducers = opts.reducers || {};
  let state = opts.initial ?? null;
  for (const e of events || []) {
    const r = reducers[e.type];
    if (typeof r === 'function') state = r(state, e);
  }
  return state;
}

/** Replay a stream to a point in time (seq ≤ uptoSeq) → historical state. */
export function replayTo(events, uptoSeq, opts = {}) {
  return project((events || []).filter((e) => e.seq <= uptoSeq), opts);
}

/**
 * A live incremental projector — for CRUD read-models kept in sync with the
 * event stream. `apply` mutates the running state via the reducers.
 */
export function createProjector(opts = {}) {
  const reducers = opts.reducers || {};
  let state = opts.initial ?? null;
  return {
    get state() { return state; },
    apply(event) {
      const r = reducers[event.type];
      if (typeof r === 'function') state = r(state, event);
      return state;
    },
    applyAll(events) {
      for (const e of events || []) this.apply(e);
      return state;
    },
  };
}

/**
 * Compose an event store over injected persistence.
 * @param {Object} io
 * @param {(streamId:string)=>Promise<Array>|Array} io.read - load a stream's events
 * @param {(streamId:string, events:Array)=>Promise<any>|any} io.append - persist new events (append-only)
 */
export function createEventStore(io = {}) {
  const read = typeof io.read === 'function' ? io.read : () => [];
  const append = typeof io.append === 'function' ? io.append : () => {};

  async function load(streamId) {
    return (await read(streamId)) || [];
  }

  /**
   * Append new events to a stream with an optimistic-concurrency check.
   * @param {string} streamId
   * @param {Array} entries - [{ type, data, meta }]
   * @param {Object} [opts] - { expectedVersion }
   * @returns {{ version:number, events:Array }}
   */
  async function appendEvents(streamId, entries, opts = {}) {
    const existing = await load(streamId);
    guardConcurrency(existing, opts.expectedVersion); // throws on stale write
    let seq = nextSeq(existing);
    const built = (entries || []).map((e) => makeEvent(streamId, seq++, e.type, e.data, e.meta));
    await append(streamId, built);
    return { version: streamVersion(existing) + built.length, events: built };
  }

  async function projectStream(streamId, reducers, initial) {
    return project(await load(streamId), { reducers, initial });
  }

  async function replayStreamTo(streamId, uptoSeq, reducers, initial) {
    return replayTo(await load(streamId), uptoSeq, { reducers, initial });
  }

  return { load, appendEvents, projectStream, replayStreamTo };
}

# T-001 — M0 Scaffold: app, worker, schema, CI

**Owner:** Cursor · **Phase:** M0 · **Branch:** `feat/T-001-scaffold`
**Reads first:** `PLAN.md` §3 (data model), §4 (architecture), §7 (loop);
`importer/README.md` (T-002, already merged); `engine/VENDORED.md` +
`adapters/inventory/README.md` (T-003, already merged)

## Context — two things already exist in this repo, build to match them, don't redo them
1. **`importer/` (T-002, done)** parses `BULGARIA MFC BAG.md` into a
   normalized event array (`create_property`/`create_space`/`create_container`/
   `create_item`/`relocate_container`, each `{verb, entity_id, payload}`) — run
   `node importer/run.mjs` to regenerate `importer/fixtures/bulgaria.expected.json`.
   **Your `schema.sql` event table shape must be able to ingest this array
   directly** (same verb/entity_id/payload fields, `payload.parent_id` present)
   — don't invent a different event envelope. A seed script that loads this
   fixture into local D1 via `wrangler d1 execute --local` is in scope for
   this ticket (`worker/seed/seed_bulgaria.ts` or similar) and doubles as your
   own integration test for the schema.
2. **`engine/` (T-003, done, vendored)** is domain-free SARE infrastructure —
   **do not import from it, modify it, or reference it from `app/`/`worker/`
   in this ticket.** It's out of scope until M2. Just don't break the
   boundary-lint gate (`gates/tests/sare-boundary-lint.test.mjs`) — nothing
   you add under `app/`, `worker/`, or `importer/` needs to touch `engine/`
   at all for T-001 to be done.

Both existing gates (`gates/tests/importer.test.mjs` via `node --test`,
`gates/tests/sare-boundary-lint.test.mjs` + `gates/tests/engine-smoke.test.mjs`
via plain `node`) currently run standalone with zero toolchain. **Your CI
workflow must run all three of these alongside whatever you add** — don't
replace them, extend the pipeline to include them (they're cheap and already
green; a CI that skips them is a regression).

## Goal
Turn this repo into a running monorepo: React PWA + Cloudflare Worker API + D1
event-sourced schema + CI. No features — a green, deployable skeleton.

## Files (create)
```
app/                      Vite + React 18 + TS + Tailwind + shadcn/ui (dark-first)
  src/lib/types.ts        entities from PLAN §3 (Account…Item, Trip, Bill…, Booking…)
  src/lib/tokens.css      Coastal Adventure tokens (dark default + light)
worker/
  src/index.ts            Hono (or itty) router: /api/health, /api/auth/*, /api/events
  src/db/schema.sql       D1: events(append-only) + projections (properties, spaces,
                          containers, items) + kv(config)
  wrangler.toml           D1 binding `DB`, R2 binding `PHOTOS` (bucket may not exist yet)
.github/workflows/ci.yml  typecheck, lint, vitest, gates/00-run-all
                          + `node --test gates/tests/importer.test.mjs`
                          + `node gates/tests/sare-boundary-lint.test.mjs`
                          + `node gates/tests/engine-smoke.test.mjs`
gates/tests/schema.test.ts  event-log invariants (append-only, projection rebuild,
                          and: importer/fixtures/bulgaria.expected.json ingests
                          cleanly into the schema)
worker/seed/seed_bulgaria.ts (or .mjs)  loads the importer's fixture into local D1
package.json              npm workspaces: app, worker
```

## Do
1. Scaffold `app/` (Vite react-ts) + Tailwind + shadcn init; dark-first theme via
   CSS tokens only — **no raw hex in components** (CI-grep enforced).
2. Scaffold `worker/` with typed routes; auth = JWT (HS256, secret via
   `wrangler secret`), **fail closed** when secret unset (503, never a default
   password).
3. `schema.sql`: `events(id, ts, actor, entity_type, entity_id, verb, payload_json)`
   append-only + projection tables; a `project()` function in TS rebuilds
   projections from events (unit-tested).
4. CI: install → typecheck → lint → vitest → no-raw-hex grep → gates.
5. `README.md`: dev commands (`npm run dev:app`, `dev:worker`), deploy notes
   (deploy itself is a human/wrangler step).

## Acceptance
- [ ] `npm run build` green in both workspaces; CI green on the PR.
- [ ] `wrangler dev` serves `/api/health` → `{ok:true}`; auth'd `POST /api/events`
      appends + updates projection; unauth'd → 401; missing secret → 503.
- [ ] Projection rebuild from event log is idempotent (test proves it).
- [ ] Zero raw hex in `app/src/**` components; dark + light both render.
- [ ] `worker/seed/seed_bulgaria.ts` loads all events from
      `importer/fixtures/bulgaria.expected.json` into local D1 without
      transformation, and a projection query afterward shows the correct
      Property→Space→Container→Item counts (cross-check against
      `importer/README.md` and the generated fixture: 453 items, 5 Property
      events total — 4 real properties + 1 synthetic Unspecified).
- [ ] CI runs the two pre-existing gates (`importer.test.mjs`,
      `sare-boundary-lint.test.mjs` + `engine-smoke.test.mjs`) and they still
      pass — nothing in this ticket should touch `importer/` or `engine/`
      logic, only consume the former's output shape.

## Compliance stamp
No PHI/guest PII in this phase. No payment code. No default credentials —
fail-closed auth. Nothing outbound. Event log is append-only from day one.

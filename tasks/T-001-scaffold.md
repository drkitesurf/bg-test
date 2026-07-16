# T-001 — M0 Scaffold: app, worker, schema, CI

**Owner:** Cursor · **Phase:** M0 · **Branch:** `feat/T-001-scaffold`
**Reads first:** `PLAN.md` §3 (data model), §4 (architecture), §7 (loop)

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
gates/tests/schema.test.ts  event-log invariants (append-only, projection rebuild)
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

## Compliance stamp
No PHI/guest PII in this phase. No payment code. No default credentials —
fail-closed auth. Nothing outbound. Event log is append-only from day one.

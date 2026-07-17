# T-004 — M1 Property→Space→Container→Item drill-down UI

**Owner:** Cursor · **Phase:** M1 · **Branch:** `feat/T-004-inventory-drilldown`
**Depends on:** T-001 (scaffold + D1 projections + JWT), T-002 (Bulgaria fixture),
T-003 (vendored `engine/` — **do not touch**)
**Reads first:** `PLAN.md` §3 (data model), §4 (architecture), §6 M1, §7 (loop);
`README.md` (dev + `npm run seed:bulgaria`); `tasks/T-001-scaffold.md` (M0
constraints that still bind); `importer/README.md` (fixture shape + counts)

## Context
M0 is green on `main` (`4b1e114`+): Vite/React app shell, Worker (Hono) with
fail-closed HS256 JWT, append-only `events` + projection tables
(`properties` / `spaces` / `containers` / `items`), and a local seed that loads
`importer/fixtures/bulgaria.expected.json` unchanged.

The app today is a status landing page only. Projection tables exist, but the
Worker exposes **no read API over them** — only `GET/POST /api/events`. The UI
must not dump the full event log into the browser.

This ticket is the **first M1 slice**: hierarchical navigation that lets the
owner browse the real Bulgaria inventory Property → … → Item. Later M1 slices
(search, container-move, photo→R2, full CRUD, EN/BG, offline polish) are
**out of scope** — see below / proposed T-005+.

## Non-negotiables
1. **Read-path first.** No create/update/delete/move/photo writes in this PR.
   Existing `POST /api/events` may remain; the new UI must not call it.
2. **Auth stays fail-closed.** Reuse Worker JWT (`Authorization: Bearer …`).
   Missing `JWT_SECRET` / `AUTH_PASSWORD` → 503. Wrong/missing token → 401.
   **No default passwords**, no hard-coded secrets, no “demo unlock”.
3. **Tokens only / no raw hex** in `app/src/**` (existing `npm run lint:hex`
   gate). Dark-first; light theme must still render.
4. **Do not touch** `engine/` or `importer/` logic (or their golden fixtures).
   Boundary-lint + importer gates must stay green unchanged.
5. **Hierarchy is parent_id-driven, not a rigid 4-level wizard.** The fixture is
   messy by design: items hang under containers *or* spaces *or* properties;
   containers nest under properties/spaces/other containers. The UI lists
   **children of the selected node** (mixed types OK) and breadcrumbs up to the
   Property root. Labels still follow PLAN §3 vocabulary
   (Property / Space / Container / Item).
6. **Cyrillic-safe** (Градина, София, Червен куфар…). Do not transliterate or
   drop names.
7. **Invent nothing beyond this ticket.** No search box, no move UI, no R2
   uploads, no AI, no SARE wiring.

## Goal
Ship a JWT-gated inventory browser over D1 projections so an authenticated
operator can drill from the 5 properties down to individual items from the
seeded Bulgaria fixture — usable on phone-width layouts.

## Files
```
# create
worker/src/inventory.ts              projection read helpers (SQL against D1 tables)
app/src/lib/api.ts                   fetch wrapper: base URL, Bearer, 401/503 handling
app/src/lib/auth.tsx                 (or .ts) token get/set/clear; login helper
app/src/components/LoginForm.tsx     password → POST /api/auth/token
app/src/components/InventoryBrowser.tsx   root drill-down shell
app/src/components/Breadcrumbs.tsx
app/src/components/NodeList.tsx      typed children rows (Property|Space|Container|Item)
app/src/components/ItemDetail.tsx    leaf: name + known payload fields (never invent)
gates/tests/inventory-drilldown.test.ts   API + (optional) projection count assertions

# modify
worker/src/index.ts                  register JWT-gated GET inventory routes
worker/src/index.test.ts             unauth 401 / missing-secret 503 / seeded counts
app/src/App.tsx                      login gate → InventoryBrowser (replace status-only hero)
app/src/lib/types.ts                 only if response DTOs are missing (keep thin)
README.md                            one short “M1 drill-down” usage note (seed + login + browse)
PLAN.md                              changelog line only if Brain didn’t already; Cursor may skip
```

Exact filenames may vary slightly; keep the surface area above. Prefer small
focused modules over a single mega-file.

## Do (ordered)
1. **Projection read API** (Worker), all behind the same auth middleware pattern
   as `/api/events` (factor JWT or share a `/api/*` auth helper — fail-closed):
   - `GET /api/inventory/properties`
     → `{ properties: [{ id, name, synthetic, child_count }] }`
     sorted stably (e.g. synthetic last, then name).
   - `GET /api/inventory/nodes/:id`
     → `{ id, type, name, parent_id|null, payload, child_count }`
     where `type ∈ property|space|container|item`. 404 if unknown.
   - `GET /api/inventory/nodes/:id/children`
     → `{ parent: {…}, children: [{ id, type, name, child_count }] }`
     children = rows in `spaces`/`containers`/`items` (and **not** other
     properties) whose `parent_id = :id`. For `type=item`, children is `[]`.
   - Optional convenience: `GET /api/inventory/summary`
     → `{ properties, spaces, containers, items }` counts (handy for smoke + UI
     header). Must match seed after `npm run seed:bulgaria`:
     **5 / 7 / 23 / 453**.

   Implement with parameterized SQL on the existing projection tables. Do **not**
   rebuild from the event log on every request (rebuild stays for seed/ops).

2. **App auth shell.** Minimal login: password field → `POST /api/auth/token` →
   store Bearer in `sessionStorage` (or memory + sessionStorage). On 401, clear
   token and show login. Surface 503 `auth_unavailable` honestly (“server auth
   not configured”). No remember-me cloud sync.

3. **Drill-down UI.** After login:
   - Root = property list (expect **5**, including synthetic **Unspecified** —
     render it visibly, e.g. muted / “synthetic”, never hide it).
   - Selecting a node pushes breadcrumb + loads `/children`.
   - Mixed child types render with a clear type chip/label.
   - Selecting an **item** opens ItemDetail: show `name` and any present
     payload fields (`brand`, `quantity`, `sizes`, `notes`, …) from
     `payload_json` — omit missing keys; **never fabricate** values.
   - Empty folders show an honest empty state.
   - Mobile-friendly: single column, large tap targets, no horizontal overflow
     at ~375px.

4. **Wire `App.tsx`:** Coastal Adventure chrome may stay; replace the
   “M0 foundation online” status card with the login + browser flow. Keep
   theme toggle. Tokens from `tokens.css` only.

5. **Tests / gates.**
   - Extend `worker/src/index.test.ts` (or new vitest) for auth + route shape
     using an in-memory / mocked D1 seeded with a tiny fixture **or** the
     real Bulgaria counts if the test harness already loads schema+seed
     (prefer deterministic mini-fixture for unit speed; assert full counts in
     a gate that reads SQL against `buildSeedSql` like `schema.test.ts`).
   - New `gates/tests/inventory-drilldown.test.ts`: at minimum, after applying
     schema + `buildSeedSql(loadFixture())`, projection counts are
     **properties=5, spaces=7, containers=23, items=453**, and a sample
     parent→children query returns the expected types (spot-check one known
     Property name from the fixture: `Bansko` / `Градина` / `Lozenec storage` /
     `София` / `Unspecified`).
   - Ensure root `npm run test` still runs importer + sare-boundary-lint +
     engine-smoke.

6. **Docs.** README: prerequisites (`wrangler` secrets locally, `npm run
   seed:bulgaria`, `dev:worker` + `dev:app`, login with the password you put in
   `AUTH_PASSWORD`). Do not commit secrets.

## Acceptance
- [ ] Authenticated `GET /api/inventory/properties` returns **5** properties
      including synthetic `Unspecified`; unauthenticated → **401**; unset
      secrets → **503**.
- [ ] `GET /api/inventory/nodes/:id/children` walks the tree by `parent_id`
      for mixed child types; unknown id → **404**.
- [ ] After local seed, summary/counts are **5 properties · 7 spaces ·
      23 containers · 453 items** (489 fixture events including 1
      `relocate_container` — do not require exposing that event in the UI).
- [ ] UI: login → property list → drill at least Property→…→Item on seeded
      data; Cyrillic names render; Unspecified visible; item detail invents
      no fields.
- [ ] No raw hex in `app/src/**`; dark default + light toggle still work;
      ~375px width has no horizontal scroll on the browser screens.
- [ ] `engine/` and `importer/` untouched (git diff clean for those trees).
- [ ] `npm run typecheck && npm run lint && npm run build && npm run test`
      green; pre-existing gates still pass.

## Out of scope (do not implement — later tickets)
- Search / fuzzy “where is” (proposed **T-005**)
- Container move / subtree relocate UI (**T-006**)
- Photo capture → R2 (**T-007**)
- Manual CRUD (create/edit/delete item/space/…) beyond read (**T-006** or later)
- EN/BG (or RU/DE) i18n strings
- PWA offline queue / sync polish beyond whatever M0 already shipped
- Wiring `engine/` / SARE / vision / Packer / LEDGER / HOST
- Remote Cloudflare deploy, production D1 seed, release flags
- Changing importer golden fixture or event verbs

## Verify
```bash
npm install
npm run seed:bulgaria          # local D1; requires wrangler + worker secrets for full E2E
npm run typecheck
npm run lint
npm run build
npm run test
node --test gates/tests/importer.test.mjs
node gates/tests/sare-boundary-lint.test.mjs
node gates/tests/engine-smoke.test.mjs

# Manual E2E (after secrets + seed + both dev servers):
# 1) POST /api/auth/token with AUTH_PASSWORD
# 2) GET /api/inventory/properties with Bearer → 5 rows
# 3) Browser: login → open Bansko (or Градина) → drill to an item
```

## Compliance stamp
Personal inventory data — local/private; no outbound calls; no payment; no
default credentials; no PHI framing; read-only slice; append-only event log
untouched by the new UI.

## PR checklist
- [ ] Branch `feat/T-004-inventory-drilldown` from latest `main`
- [ ] Open a **draft** PR titled: `feat(inventory): T-004 — M1 property drill-down UI`
- [ ] Paste verify command output in the PR body
- [ ] List files touched; confirm `engine/` + `importer/` clean
- [ ] **Do not merge** — Brain merges after review

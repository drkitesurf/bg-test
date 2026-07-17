# T-005 — M1 search-first UX (fuzzy / attribute / “where is”)

**Owner:** Cursor · **Phase:** M1 · **Branch:** `feat/T-005-search-first`
**Depends on:** T-004 on `main` (Property→Space→Container→Item drill-down +
JWT-gated inventory GET APIs — merged via PR #6 @ `3681091`+). M0 (T-001–T-003)
already green; **do not re-touch** those trees.
**Reads first:** `PLAN.md` §3 (data model), §4 (architecture), §5 (Placement RSI
loop), §6 M1, §7 (loop), §8; `tasks/T-004-inventory-drilldown.md` (format +
non-negotiables that still bind); `README.md` (seed + login + browse);
`worker/src/inventory.ts` + `app/src/components/InventoryBrowser.tsx` (extend,
don’t fork)

## Context
T-004 shipped a read-only inventory browser: login → property list →
`parent_id`-driven mixed children → item detail. Projection tables
(`properties` / `spaces` / `containers` / `items`) and JWT-gated GETs exist:

- `GET /api/inventory/properties`
- `GET /api/inventory/summary`
- `GET /api/inventory/nodes/:id`
- `GET /api/inventory/nodes/:id/children`

PLAN §6 M1 calls for **search-first UX (fuzzy, attribute, “where is”)** as a
core daily surface — not a secondary filter bolted onto browse. The owner
should type (or paste) a query and land on the right node, then continue in the
**existing** T-004 drill-down hierarchy.

This ticket is the **second M1 slice**. Container move / CRUD (T-006), photo→R2
(T-007), EN/BG, and offline polish stay out of scope.

## Non-negotiables
1. **Read-path only.** No create/update/delete/move/photo writes. Do not call
   `POST /api/events` from the new UI.
2. **Auth stays fail-closed.** Reuse Worker JWT (`Authorization: Bearer …`) and
   the same `/api/inventory/*` auth middleware. Missing secrets → **503**;
   wrong/missing token → **401**. No default passwords, no hard-coded secrets,
   no “demo unlock”.
3. **Tokens only / no raw hex** in `app/src/**` (`npm run lint:hex`). Dark-first;
   light theme must still render.
4. **Do not touch** `engine/` or `importer/` (logic or golden fixtures). No new
   search index build that rewrites importer output. Search runs over **existing
   D1 projections** (SQL / in-Worker ranking). Boundary-lint + importer gates
   must stay green unchanged.
5. **Reuse T-004 navigation.** Selecting a search hit must open/jump into the
   existing `InventoryBrowser` path (breadcrumb + children / ItemDetail) — do
   **not** rebuild a parallel browse tree or dump the event log to the client.
6. **Cyrillic-safe** (Градина, София, Червен куфар, Naish…). Matching must work
   on Cyrillic names; do not transliterate or drop results.
7. **Never invent attributes.** Attribute / “where is” results only surface
   fields present in projection `name` / `payload_json`. Omit missing keys.
8. **Invent nothing beyond this ticket.** No move UI, no R2, no AI/SARE wiring,
   no Packer / LEDGER / HOST.

## Goal
Make search the primary entry after login: an authenticated operator types a
query (fuzzy name, optional attribute tokens, or “where is X”) and gets ranked
hits across properties, spaces, containers, and items from the seeded Bulgaria
fixture — each hit navigates into the T-004 drill-down. Usable at phone width.

## Files
```
# create
worker/src/search.ts                 projection search helpers (parameterized SQL + rank)
app/src/components/SearchBox.tsx     primary query input (debounced typeahead)
app/src/components/SearchResults.tsx typed hit list → onSelect navigates into browser
gates/tests/inventory-search.test.ts deterministic fixture-based search assertions

# modify
worker/src/inventory.ts              optional: shared node decode / breadcrumb path helper
                                     (keep search logic in search.ts if cleaner)
worker/src/index.ts                  register JWT-gated GET /api/inventory/search
worker/src/index.test.ts             unauth 401 / missing-secret 503 / seeded query spots
app/src/lib/api.ts                   search() client helper (Bearer, 401/503)
app/src/lib/types.ts                 SearchHit / SearchResponse DTOs (thin)
app/src/components/InventoryBrowser.tsx
                                     search-first chrome: SearchBox above/beside browse;
                                     selecting a hit sets path (or loads ancestors) + node
app/src/App.tsx                      only if needed to keep login → browser shell
README.md                            short “M1 search” note (query examples + seed)
PLAN.md                              changelog — Brain may already; Cursor may skip
```

Exact filenames may vary slightly; keep the surface area above. Prefer small
focused modules over a mega-file.

## Do (ordered)
1. **Search API** (Worker), behind the same auth as other `/api/inventory/*`
   routes:
   - `GET /api/inventory/search?q=<query>&limit=<n>`
     → `{ query, hits: SearchHit[] }`
   - Each `SearchHit`:
     `{ id, type, name, parent_id|null, score, snippet?, path?: [{id,type,name}] }`
     where `type ∈ property|space|container|item`.
   - **Fuzzy / name:** case-insensitive substring (or simple token AND) over
     `name` across all four projection tables. Prefer SQLite `LIKE` /
     `COLLATE NOCASE` with bound parameters — **no** full FTS5 schema migration
     required for v1 (optional later; do not block on it).
   - **Attribute:** if the query looks like `brand:Naish`, `brand=Naish`, or
     includes known payload keys (`brand`, `quantity`, `sizes`, `notes`, …),
     also match against `payload_json` string contents for those keys. Never
     invent keys that aren’t in the payload.
   - **“Where is”:** accept prefixes like `where is `, `where's `, `къде е `
     (trim the prefix, search the remainder). Hits should include enough
     location context (`path` of ancestors to the Property root, or at least
     `parent_id` + parent name) so the UI can answer “where” without a second
     round-trip when cheap — if ancestor walk is expensive, return `parent_id`
     and let the client call existing `GET /api/inventory/nodes/:id` to build
     breadcrumbs (document which approach you chose).
   - Default `limit` ≤ 25 (cap hard, e.g. 50). Empty / whitespace `q` →
     `{ hits: [] }` (200), not 400.
   - Stable sort: higher score first, then type priority
     (item → container → space → property) or the reverse — pick one, document
     it, keep deterministic. Tie-break by `name COLLATE NOCASE`, then `id`.
   - Parameterized SQL only. Do **not** rebuild from the event log per request.

2. **App: search-first shell.** After login, the **primary** control is the
   search input (autofocus on desktop; large tap target on mobile). Browse /
   property list from T-004 remains available (e.g. clear search / “Browse
   properties”) — search does not delete drill-down.
   - Debounce typeahead (~200–300ms); show loading + honest empty state
     (“No matches for …”).
   - Results show type chip + name + short location hint (path or parent).
   - Selecting a hit navigates into `InventoryBrowser`: set breadcrumb path to
     the hit’s ancestors and open children (non-item) or `ItemDetail` (item).
   - Esc / clear returns to the previous browse root or last path — don’t lose
     the user’s place awkwardly.

3. **Wire types + API client.** Extend `api.ts` / `types.ts` only as needed.
   Reuse existing 401 → logout and 503 → “auth not configured” handling.

4. **Tests / gates.**
   - Extend `worker/src/index.test.ts` (or vitest sibling): auth fail-closed on
     `/api/inventory/search`; seeded mini-fixture **or** Bulgaria-backed spots
     for known names (`Naish`, `Bansko`, `Градина`, `MFC`, `Червен`).
   - New `gates/tests/inventory-search.test.ts`: after schema +
     `buildSeedSql(loadFixture())` (same pattern as
     `inventory-drilldown.test.ts`):
     - A query for a known item/brand returns ≥1 hit with correct `type`/`name`.
     - Cyrillic property/space name query returns that node.
     - “where is &lt;known item fragment&gt;” returns a hit that includes
       location context (`path` or resolvable `parent_id`).
     - Empty `q` → empty hits.
     - Unauthenticated request → **401** (if the gate hits the HTTP app; else
       covered in `index.test.ts`).
   - Root `npm run test` still runs importer + sare-boundary-lint +
     engine-smoke + existing inventory-drilldown gate.

5. **Docs.** README: one short section — seed, login, example queries
   (`Naish`, `where is pump`, `brand:Ozone`, `Градина`). No secrets committed.

## Acceptance
- [ ] Authenticated `GET /api/inventory/search?q=…` returns ranked hits across
      property|space|container|item from D1 projections; unauthenticated →
      **401**; unset secrets → **503**.
- [ ] Fuzzy / substring name search finds known Bulgaria fixture entities
      (spot-check Latin brand **and** Cyrillic location).
- [ ] Attribute-style query can match a present payload field (e.g. brand)
      without fabricating fields.
- [ ] “Where is …” (prefix stripped) returns hits with location context
      sufficient to answer where the thing lives.
- [ ] UI: after login, search is the primary entry; selecting a hit lands in
      the existing T-004 drill-down (breadcrumb + children / ItemDetail).
- [ ] Empty query → empty results (no error spam); ~375px width has no
      horizontal scroll on search + results.
- [ ] No raw hex in `app/src/**`; dark default + light toggle still work.
- [ ] `engine/` and `importer/` untouched (git diff clean for those trees).
- [ ] `npm run typecheck && npm run lint && npm run build && npm run test`
      green; pre-existing gates still pass.

## Out of scope (do not implement — later tickets)
- Container move / subtree relocate + manual CRUD (**T-006**)
- Photo capture → R2 + EXIF strip (**T-007** / PLAN §9)
- Dedicated FTS5 / external search index migration (optional follow-on only)
- EN/BG (or RU/DE) i18n string catalogs
- PWA offline queue / sync polish; tree-conflict resolution spec (**PLAN §9**)
- Wiring `engine/` / SARE / vision / Packer / LEDGER / HOST
- Placement RSI learning loop (PLAN §5) — search *surfaces* location; it does
  not yet record “manual hunt” signals
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
# 1) Login with AUTH_PASSWORD
# 2) GET /api/inventory/search?q=Naish with Bearer → ranked hits
# 3) Browser: type "where is" + a known fragment → open hit → see breadcrumb location
# 4) Browser: type "Градина" → property/space hit → drill continues via T-004 UI
```

## Compliance stamp
Personal inventory data — local/private; no outbound calls; no payment; no
default credentials; no PHI framing; read-only search over projections;
append-only event log untouched by the new UI; no AI in this path.

## PR checklist
- [ ] Branch `feat/T-005-search-first` from latest `main`
- [ ] Open a **draft** PR titled: `feat(inventory): T-005 — M1 search-first UX`
- [ ] Paste verify command output in the PR body
- [ ] List files touched; confirm `engine/` + `importer/` clean
- [ ] **Do not merge** — Brain merges after review

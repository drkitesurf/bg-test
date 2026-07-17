# STOWAWAY

M0 monorepo foundation for the context-aware inventory OS:

- `app/` — React 18, Vite, TypeScript, Tailwind, shadcn-style components, installable PWA
- `worker/` — Cloudflare Worker API with Hono, fail-closed HS256 JWT auth, D1 and R2 bindings
- `worker/src/db/schema.sql` — append-only events plus current-state projections
- `importer/` — deterministic Bulgaria inventory importer (existing, consumed unchanged)
- `engine/` — vendored domain-free infrastructure (existing, intentionally not wired during T-001)

## Local development

Requires Node 22+ and npm.

```bash
npm install
npm run dev:app
npm run dev:worker
```

The Worker exposes:

- `GET /api/health` → `{"ok":true}`
- `GET /api/auth/status`
- `POST /api/auth/token` with `{"password":"..."}` → HS256 bearer token
- authenticated `GET /api/events`
- authenticated `POST /api/events` with one importer event envelope or an array of envelopes
- authenticated read-only inventory routes:
  - `GET /api/inventory/properties`
  - `GET /api/inventory/nodes/:id`
  - `GET /api/inventory/nodes/:id/children`
  - `GET /api/inventory/summary`

Configure local secrets without committing them:

```bash
cd worker
npx wrangler secret put JWT_SECRET
npx wrangler secret put AUTH_PASSWORD
```

Unset auth configuration returns `503`; missing or invalid authorization returns `401`. There are no default
credentials.

## D1 schema and fixture seed

Apply the schema and load the canonical importer fixture into local D1:

```bash
npm run seed:bulgaria
```

The seed reads `importer/fixtures/bulgaria.expected.json` directly and verifies its fixed acceptance counts before
calling Wrangler: 489 events, 453 items, and 5 properties (4 real plus synthetic `Unspecified`). A completion marker
makes normal re-runs event-idempotent while projections are rebuilt deterministically.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run test

node importer/run.mjs
node --test gates/tests/importer.test.mjs
node gates/tests/sare-boundary-lint.test.mjs
node gates/tests/engine-smoke.test.mjs
```

## Human-only Cloudflare setup and deployment

No remote resources are created by this repository.

1. Create a D1 database: `npx wrangler d1 create stowaway`.
2. Replace the all-zero `database_id` in `worker/wrangler.toml` with the returned ID.
3. Create the R2 bucket: `npx wrangler r2 bucket create stowaway-photos`.
4. Set `JWT_SECRET` and `AUTH_PASSWORD` with `wrangler secret put`; use long, unique values.
5. Apply the production schema:
   `npx wrangler d1 execute stowaway --remote --file worker/src/db/schema.sql`.
6. From `worker/`, review and run `npx wrangler deploy`.
7. Deploy `app/dist/` to the chosen Cloudflare Pages project after `npm run build --workspace app`.

The Bulgaria seed command intentionally targets local D1. Production fixture ingestion should be an explicit operator
decision, not an automatic deploy step.

## M1 inventory drill-down

For the local Property → Space/Container/Item browser, configure `JWT_SECRET` and `AUTH_PASSWORD`, run
`npm run seed:bulgaria`, then start `npm run dev:worker` and `npm run dev:app` in separate terminals. Log in with the
password you set in `AUTH_PASSWORD`; the app stores its bearer token only in `sessionStorage`.

The hierarchy follows projection `parent_id` values, so a location may contain mixed spaces, nested containers, and
items. The browser is read-only. Remote D1 seeding, secret binding, and deployment remain explicit human operations.

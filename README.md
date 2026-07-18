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

## Cloudflare setup and deployment

**Real infra already provisioned (2026-07-18):** the production D1 database
exists (`stowaway`, id in `worker/wrangler.toml`) and its schema is applied —
`events`/`properties`/`spaces`/`containers`/`items`/`kv` all live remotely.
Roughly the first third of the Bulgaria fixture's events are seeded (partial
— seeding was stopped partway through to avoid burning an excessive number of
manual tool calls doing it row-by-row; finishing it is one local command, see
below). **R2 is not yet enabled on the account** — Cloudflare gates
first-time R2 usage behind a one-time dashboard opt-in with no API path
(`10042: Please enable R2 through the Cloudflare Dashboard`). Photo capture
depends on this; the rest of the app (drill-down browsing, auth, D1) does
not.

### Automated path (recommended): GitHub Actions

`.github/workflows/deploy.yml` deploys the Worker (+ sets its secrets) and
the Pages app on every push to `main`. It no-ops (not a red X) until you add
these **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN` | A token with Workers Scripts:Edit, Workers KV/D1/R2:Edit, Pages:Edit permissions. Create at <https://dash.cloudflare.com/profile/api-tokens>. |
| `CLOUDFLARE_ACCOUNT_ID` | Found on the right sidebar of any Cloudflare dashboard page. |
| `JWT_SECRET` | A long random string, e.g. `openssl rand -hex 32`. Never reuse across environments. |
| `AUTH_PASSWORD` | The password you'll actually log in with. Not a default — pick one. |

Once all four exist, push to `main` (or run the workflow manually) and the
app is live: the Worker at its `workers.dev` URL (or a configured route), the
static app on Cloudflare Pages project `stowaway`.

### Manual path (fallback, same steps as before)

1. D1 already exists — skip `wrangler d1 create` (see above).
2. R2: once enabled in the dashboard, `npx wrangler r2 bucket create stowaway-photos`.
3. Set `JWT_SECRET` and `AUTH_PASSWORD` with `wrangler secret put`; use long, unique values.
4. Finish seeding the fixture into the *remote* D1 (only local was ever a target of
   `npm run seed:bulgaria`): adapt `worker/seed/seed_bulgaria.ts`'s wrangler call to
   add `--remote`, or run `npx wrangler d1 execute stowaway --remote --file <path-to-generated-sql>`
   after calling `buildSeedSql(loadFixture())` yourself.
5. From `worker/`, review and run `npx wrangler deploy`.
6. Deploy `app/dist/` to Cloudflare Pages after `npm run build --workspace app`.

The Bulgaria seed command intentionally targets local D1 by default. Full production
fixture ingestion was a deliberate partial/manual step this round — see the note above.

## M1 inventory drill-down

For the local Property → Space/Container/Item browser, configure `JWT_SECRET` and `AUTH_PASSWORD`, run
`npm run seed:bulgaria`, then start `npm run dev:worker` and `npm run dev:app` in separate terminals. Log in with the
password you set in `AUTH_PASSWORD`; the app stores its bearer token only in `sessionStorage`.

The hierarchy follows projection `parent_id` values, so a location may contain mixed spaces, nested containers, and
items. The browser is read-only. Remote D1 seeding, secret binding, and deployment remain explicit human operations.

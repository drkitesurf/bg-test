# INVENTORY — project handoff

**Purpose:** continue this project with **Claude Code as orchestrator + maintainer**
and **Cursor as the heavy code writer**. This is the single source of truth for
state, structure, live infrastructure, the operating model, and the backlog.

Last updated: 2026-07-15 · Owner: N (drkitesurf@gmail.com) · Region focus: Bulgaria

---

## 1. What this project is

INVENTORY is two related products for a set of vacation properties:

1. **Inventory + booking platform** (design system + spec, not yet coded) — a
   multi-property inventory app (Property → Space → Container → Item, where
   containers move and nest) with image/NFC/voice capture, plus an Airbnb-grade
   booking surface and a scoped client portal. Built and deployed target:
   Cloudflare, React + Vite + Tailwind + shadcn/ui.

2. **Tourist-facing guest apps + owner dashboard** (built, running, backend live)
   — two guest guides (Santa Marina, Sozopol · Bansko) and one control dashboard,
   backed by a Cloudflare Worker + D1.

Design language for everything: **Coastal Adventure**, dark-first, bilingual+ (EN/BG/RU/DE).

---

## 2. Current state (what exists today)

| Area | Status | Location |
|---|---|---|
| Design system (tokens, components, patterns, prompt pack, Cursor kit) | ✅ Complete | `design-system/` |
| Guest apps (Santa Marina + Bansko) | ✅ Built, runs locally | `guest-apps/index.html` |
| Owner control dashboard | ✅ Built, runs locally | `guest-apps/admin.html` |
| Worker API (config + auth) | ✅ Written | `guest-apps/worker/worker.js` |
| Live D1 database + auth seed | ✅ Live on Cloudflare | id `f9cb7b23-06b6-4d9b-9692-1bc33b3c4caa` |
| Worker + Pages deployment | ⛔ Not deployed (owner action) | see `guest-apps/README-DEPLOY.md` |
| Full content pushed to D1 | ⛔ Pending first Save / `seed.sql` | `guest-apps/worker/seed.sql` |
| Inventory + booking app (coded) | ⛔ Not started | greenfield, spec in `design-system/` |
| Source repo (git/GitHub) | ⛔ Not initialized | recommended below |
| Real photography | ⛔ Placeholders (picsum) | edit in dashboard |

Source inventory fixture (real data): `BULGARIA MFC BAG.md`.

---

## 3. Repository map

```
INVENTORY/
├─ HANDOFF.md                     ← this file
├─ BULGARIA MFC BAG.md            ← real inventory (import fixture)
├─ design-system/                 ← the design language + specs (handoff to Claude Design + Cursor)
│  ├─ README.md  00–05 *.md        principles, data model, components, patterns, prompt pack, Cursor kit
│  ├─ tokens/                      tokens.json · tokens.css · theme.css · tailwind.config.ts
│  ├─ code/                        .cursorrules · lib/{types,utils}.ts · components/{ui,inventory}
│  ├─ preview.html                 live token+component preview
│  └─ palette.py                   WCAG contrast verifier
└─ guest-apps/                     ← the two live tourist apps + dashboard
   ├─ index.html  admin.html
   ├─ assets/  app.css · i18n.js · seed.js · app.js · admin.js
   ├─ worker/  worker.js · schema.sql · seed.sql · wrangler.toml
   └─ README-DEPLOY.md
```

---

## 4. Live infrastructure & secrets

**Cloudflare (owner account, connected):**
- D1 database `inventory-guest` · id `f9cb7b23-06b6-4d9b-9692-1bc33b3c4caa` · region EEUR (Prague).
- Table `kv(key,value)`; seeded rows: `admin_pass` (sha256 of `owner123`), `secret` (HMAC signing key).
- Worker `inventory-api` — **not yet deployed**. Bind D1 as `DB`.
- Pages project `inventory` — **not yet created**.

**Auth model:** dashboard password → `POST /api/login` → HMAC token (7-day) →
`Bearer` on `PUT /api/config` and `POST /api/password`. Default password
`owner123` — **change on first login**.

**External services:**
- Open-Meteo — weather, no key, called client-side.
- Trafft — booking engine for the inventory/booking app (not yet wired). Needs API key.
- Grok STT + a vision model — capture rails for the inventory app (not yet wired). Need keys.

**Where keys live:** Worker env bindings / `wrangler secret put …` — never in the
client bundle. None are committed today.

> ⚠️ `owner123`, the D1 id, and the signing secret are operational, not
> confidential-grade. Rotate the password and secret before any public launch.

---

## 5. Operating model — Claude Code ↔ Cursor

**Principle:** Claude Code plans, coordinates, reviews, and maintains; Cursor
writes the bulk of the code inside a defined task. GitHub is the shared source of truth.

### Claude Code = orchestrator + maintainer
- Owns `HANDOFF.md`, the backlog, and task decomposition.
- Writes **Cursor-ready task briefs** (scope, files, acceptance criteria) — see §7.
- Runs cross-cutting maintenance: dependency bumps, token/`theme.css` sync,
  i18n key audits, accessibility passes, contrast checks (`palette.py`),
  release notes, Cloudflare provisioning (D1/KV/R2) and deploy runbooks.
- Reviews Cursor's diffs against the design system + `.cursorrules` before merge.
- Small, surgical edits and glue; NOT large feature implementation.

### Cursor = heavy code writer
- Implements features end-to-end from a Claude Code brief inside the repo.
- Obeys `design-system/code/.cursorrules` (tokens only, status via `utils.ts`
  maps, dark-first, WCAG AA, Cyrillic-safe, Cloudflare deploy).
- Builds the React/Vite/shadcn inventory + booking app; extends the guest apps.
- Writes tests and keeps the build green.

### The loop (per unit of work)
1. **Claude Code** picks a backlog item → writes a task brief (§7 format) → commits it to `/tasks/`.
2. **Cursor** implements on a feature branch, referencing the brief + `.cursorrules`.
3. **Claude Code** reviews the diff (design-system compliance, a11y, i18n, both themes), requests changes, then merges.
4. **Claude Code** updates `HANDOFF.md` state, tags a release, runs/handoffs the deploy.

### Guardrails both sides enforce
- Role tokens only — no raw hex in components. One coral CTA per view.
- Status/condition/booking colors come from `code/lib/utils.ts`, always with icon + label.
- Every surface works in dark **and** light, and with long Cyrillic strings.
- WCAG 2.1 AA; verify new color pairings with `design-system/palette.py`.
- Property layout and all guest content are **data**, never hard-coded.

---

## 6. First things to do (setup, in order)

1. **Initialize git + push to GitHub** (makes Claude Code ↔ Cursor sync real):
   ```bash
   cd INVENTORY && git init && git add . && git commit -m "INVENTORY: design system + live guest apps"
   git branch -M main && git remote add origin <your-repo> && git push -u origin main
   ```
   Add `.gitignore` for `node_modules`, `.dev.vars`, `dist`, `.wrangler`.
2. **Deploy the guest apps** per `guest-apps/README-DEPLOY.md` (3 dashboard clicks
   or `wrangler`), then set `window.INVENTORY_API` in `index.html` + `admin.html`.
3. **Change the dashboard password** and press Save once (publishes content to D1).
4. **Replace placeholder photos** with real images (dashboard, per card).

---

## 7. Backlog — Cursor-ready task briefs

Ordered by value. Each is written so Cursor can execute directly. Brief format:
**Goal · Files · Do · Acceptance.**

### P0 — Deploy & harden the guest apps
- **Goal:** guest apps live on Cloudflare with D1 persistence.
- **Files:** `guest-apps/*`, `worker/wrangler.toml`.
- **Do:** deploy Worker + Pages; set API URL; run `seed.sql`; rotate password + `secret`.
- **Acceptance:** both `?p=` apps load from D1; dashboard Save round-trips; login works; Lighthouse PWA ≥ 90.

### P1 — Convert guest apps to installable PWAs + offline
- **Goal:** add to home screen, works offline for cached content.
- **Files:** `guest-apps/manifest.webmanifest`, `sw.js`, `index.html`.
- **Do:** web app manifest (icons, theme `#0B1A24`), service worker caching shell + last config; offline weather fallback.
- **Acceptance:** installable on iOS/Android; offline load shows last content; passes PWA audit.

### P1 — Real media + maps on Explore cards
- **Goal:** award-grade imagery + directions.
- **Files:** `guest-apps/assets/{app.js,admin.js,seed.js}`.
- **Do:** image upload to R2 from the dashboard (create R2 bucket, signed PUT via Worker); embed a static map / directions link per place.
- **Acceptance:** owner uploads a photo and it appears; every place has a working map link.

### P1 — Live Bansko feed (ski)
- **Goal:** ski tab updates itself.
- **Files:** `worker/worker.js` (new `/api/ski` proxy), `guest-apps/assets/app.js`.
- **Do:** Worker fetches/caches a public lift-status/snow source daily; guest app shows live + owner-override.
- **Acceptance:** ski conditions refresh without manual edits; owner can still override.

### P2 — Scaffold the inventory + booking app (the big build)
- **Goal:** greenfield React app from the design system.
- **Files:** new `app/` (Vite + TS + Tailwind + shadcn), copy `design-system/tokens/*` + `code/*` + `.cursorrules`.
- **Do:** follow `design-system/05-cursor-build-kit.md`: app shell, dashboard, property→space→container→item drill-down, capture flow (photo/NFC/voice), search, booking (Trafft), client portal. D1 schema per `types.ts`; R2 for photos.
- **Acceptance:** each screen matches `03-patterns-and-screens.md`; tokens only; both themes; a11y AA; import parses `BULGARIA MFC BAG.md`.

### P2 — Auth & multi-user
- **Goal:** real owner/manager/guest auth for both products.
- **Do:** replace demo password with Cloudflare Access or a proper auth (JWT + roles); per-client portal scoping.
- **Acceptance:** roles enforced server-side; client portal shows only assigned properties.

### P3 — Analytics, backups, i18n completion
- Add privacy-friendly analytics; scheduled D1 export to R2; fill RU/DE long-form content.

---

## 8. Deploy runbook (summary)

Guest apps: `guest-apps/README-DEPLOY.md` (Path A = dashboard, Path B = wrangler).
Inventory app (future): `design-system/05-cursor-build-kit.md` §3.

Quick reference:
```
D1:         inventory-guest  ·  f9cb7b23-06b6-4d9b-9692-1bc33b3c4caa  ·  EEUR
Worker:     inventory-api    (bind D1 as DB)          [deploy pending]
Pages:      inventory        (drag guest-apps/ folder) [create pending]
API wire:   window.INVENTORY_API = "https://inventory-api.<you>.workers.dev"
Login:      owner123  →  change immediately
Seed all:   wrangler d1 execute inventory-guest --file=guest-apps/worker/seed.sql --remote
```

---

## 9. Conventions & references (read before coding)

- **Design foundations:** `design-system/00-foundations.md`
- **Data model (typed):** `design-system/code/lib/types.ts`
- **Status/condition color maps:** `design-system/code/lib/utils.ts`
- **Components spec:** `design-system/02-components.md`
- **Screens/patterns:** `design-system/03-patterns-and-screens.md`
- **Cursor rules:** `design-system/code/.cursorrules` (copy into any new app root)
- **Claude Design prompts:** `design-system/04-claude-design-prompt-pack.md`
- **Contrast verifier:** `python3 design-system/palette.py`

**Guest-app content shape:** `guest-apps/assets/seed.js` (multilingual fields are
`{en,bg,ru,de}`, fall back to `en`). The same object lives in D1 `kv.config`.

---

## 10. Verification checklist (run before every merge/release)

- [ ] `node --check` passes on changed JS; app builds (inventory app: `npm run build`).
- [ ] Both themes render; no raw hex introduced (`grep -rn "#[0-9a-fA-F]\{6\}" src/components` → only tokens files).
- [ ] i18n: no missing keys across en/bg/ru/de.
- [ ] Long-Cyrillic string doesn't break layout.
- [ ] WCAG AA on any new color pair (`palette.py`).
- [ ] Guest app: weather loads for both coordinates; Wi-Fi QR scans; dashboard Save round-trips through D1.
- [ ] a11y: keyboard path + visible focus on new interactive elements.

---

## 11. Open decisions / risks

- **Deploy tooling:** the connected Cloudflare tools can provision D1/KV/R2 and
  run SQL but **cannot deploy Workers/Pages** — deploys are a human/wrangler step.
  Decide: keep dashboard/wrangler, or add a GitHub Actions → Cloudflare CI.
- **Guest-app tech:** shipped as zero-build vanilla for instant hosting. Decide
  whether to keep it (simple, fast) or fold it into the React app later.
- **Booking:** Trafft is assumed; confirm account + API access before P2 booking work.
- **Secrets:** rotate `owner123` + D1 `secret`; move to Cloudflare Access for real auth.
- **Photos & RU/DE content:** owner-supplied; flagged as placeholders today.

---

## 12. Handoff prompts (paste to start a session)

**To Claude Code (orchestrator):**
> Read `INVENTORY/HANDOFF.md`. You are the orchestrator + maintainer. Take backlog
> item <ID> from §7, write a Cursor task brief to `tasks/<ID>.md`, and list the
> files Cursor will touch. Don't implement large features yourself — plan, then
> review Cursor's diff against `design-system/code/.cursorrules`.

**To Cursor (implementer):**
> Read `INVENTORY/HANDOFF.md` and `design-system/code/.cursorrules`. Implement
> `tasks/<ID>.md` on a branch. Use tokens only, status via `lib/utils.ts`,
> dark-first, WCAG AA, EN/BG/RU/DE. Keep the build green and add tests. Match the
> relevant section of `design-system/03-patterns-and-screens.md`.

# STOWAWAY — Master Plan v1.0

**The context-aware, self-improving inventory OS for homes, businesses, and travelers.**

Owner: N (drkitesurf@gmail.com) · Repo: `drkitesurf/bg-test` · Last updated: 2026-07-16
Supersedes: `HANDOFF.md` (kept as historical spec-lore; its design language + data model
survive here, its "already built" claims do not — **assume nothing exists but this repo**).

---

## 0. Ground truth (what actually exists today)

| Asset | Status |
|---|---|
| `BULGARIA MFC BAG.md` | ✅ Real inventory fixture — ~350 items, 5 locations, deep container nesting. The seed dataset AND the acceptance test. |
| `HANDOFF.md` | ✅ Spec-lore: Coastal Adventure design language, Property→Space→Container→Item model, EN/BG/RU/DE, Cloudflare target. Code it references is **not present**. |
| SARE engine (`drkitesurf/dental-network-state` → `engine/`) | ✅ Built, gated, **domain-free by CI-enforced boundary lint**: interceptor pipeline, model gateway (route→provider:model with fallback chains), calcification (confirmed-path hardening), federation/consensus, veto store, DAG + ghost-run simulator. Designed to be adapted to new verticals. |
| Everything else | ⛔ Greenfield. |

---

## 1. Product thesis — why this wins the market

Every inventory app on the market is a **database with a camera**. Sortly, Encircle,
HomeZada, Itemtopia — all make YOU do the thinking: you name items, you file them,
you remember where they are, you build packing lists by hand.

STOWAWAY's bet: **the inventory should think.** Three compounding differentiators:

1. **Content awareness** — the app *understands* items, not just stores them.
   A photo of a kite bar becomes `{category: kitesurfing/control, brand: Naish,
   size: 55cm, lines: 25m, condition, pairs-with: Flysurfer 7.5}` — extracted by
   vision+LLM, confirmed by the human (never-guess: an AI read is a *proposal*
   until confirmed — imported directly from the SARE verification pattern).

2. **SARE inside** — the routing/learning spine from dental-network-state, re-adapted:
   - **Interceptor**: every AI output (item classification, pack list, valuation)
     passes pre-gates → critics → veto → calcify. Wrong-guess patterns get vetoed;
     confirmed patterns harden.
   - **Calcification**: the 5th time you confirm "Ozone bar → Kite/Control-bars →
     lives in MFC bag", that path hardens — classification becomes deterministic,
     free, instant. The app literally gets cheaper and faster the more you use it.
   - **Gateway**: route_config-style model routing — local/cheap model first,
     frontier model only when confidence is low (§7 token discipline).
   - **Ghost-run (DAG)**: "what-if" simulation — *what if I move the ski gear to
     Sofia?* → simulated relocation shows resulting packing/availability conflicts
     before you touch a single item.

3. **The Packer** — the killer feature no competitor has. A travel-aware packing
   engine that knows (a) everything you own and where it is, (b) where you're going,
   when, and why, and (c) what that trip *needs*:
   - Input: "Kite trip, La Ventana, Jan 10–24, expect 15–25 knots, also 2 dinners out."
   - Engine: weather forecast + trip-type templates + **your own gear graph**
     (kite sizes vs wind range, wetsuit thickness vs water temp, chargers-pair-with-devices)
     + airline baggage constraints (weight/dimensions per fare class).
   - Output: a pack list **resolved to physical reality**: "Take the 9m + 12m
     (forecast 18kt avg) — 9m is in Червен куфар #1 in Bansko, you fly from Sofia:
     move it by Thu. Your 3/2 wetsuit is wrong for 68°F water — flag. Total kit
     weight 27kg > 23kg allowance — here's what to cut."
   - Round-trip: check-in/check-out per trip → the app knows what's *in transit*,
     what came back, what got lost (the "did the pump make it home?" problem).
   - RSI loop: every trip's "what I actually used / never used / wished I had"
     feeds back → pack templates calcify per trip-type → suggestions sharpen.

**Positioning:** "Sortly knows what you own. STOWAWAY knows what you'll need."

Two further pillars widen the moat from *things* to *money and guests* (§2b, §2c):
the inventory graph is the substrate both stand on — bills attach to properties and
items you already track; guests stay in properties whose contents, quirks, and costs
the app already knows. No competitor owns this triangle (things + money + guests).

---

## 2. The two account modes

One codebase, one data model, two lenses (a mode flag + feature gating, not forks):

**HOME** — households, vacation properties, serious-hobby gear (the Bulgaria fixture
is the canonical example): multi-property, insurance-ready valuations + export,
seasonal awareness ("ski gear dormant since March"), family sharing, the Packer.

**BUSINESS** — small ops (rental fleets, kite schools, clinics, crews): quantities +
par levels + reorder signals (HITL purchase-order drafting — auto-purchase forbidden,
same guardrail as dental M5-INVENT), check-in/out to staff/customers, audit trail,
CSV/accounting export, multi-user roles. A kite school is literally HOME's data
model + quantities + lending — that's the wedge (sell to the hobbyist, upsell the
school they teach at).

---

## 2b. LEDGER — budget planner & bill manager (award-grade)

Not a bolted-on expense tracker — a **property-and-item-aware money layer** that
reuses the same SARE spine. What "award-winning" means here, concretely:

**Core capabilities**
- **Bills as first-class recurring entities**, each anchored to a Property (or the
  account): electricity, water, internet, insurance, HOA/такса, property tax,
  subscriptions. Fields: payee, amount (fixed | variable-with-history), currency
  (BGN/EUR/USD — multi-currency native, ECB daily rates cached in the Worker),
  cadence (monthly/annual/seasonal), due rule, autopay flag, grace window.
- **Capture = the same never-guess AI rail as items**: photo/PDF/email-forward of a
  bill → vision+LLM extracts payee/amount/due/IBAN → `confirmed:false` until tapped.
  The 5th confirmed "ЧЕЗ → Bansko apt → electricity" **calcifies** — future ЧЕЗ bills
  auto-file deterministically, $0.
- **Budget planner**: envelope/category budgets per property + rollup; planned-vs-
  actual with variance chips; seasonal intelligence (a ski-town apartment's winter
  heating spike is *expected*, not an anomaly — the model learns each property's
  seasonal curve and alerts on *deviation from its own curve*, not raw thresholds).
- **Cashflow horizon**: 90-day forward ledger (known bills + learned variable
  estimates + booking income from §2c) → "March is 640 лв short at current pace."
- **Bill lifecycle**: upcoming → due → paid/overdue, with receipts attached to the
  event log (same append-only provenance as items — "what did we pay for the roof
  repair and when" is a query, not a memory).
- **Item linkage (the differentiator)**: expenses can reference inventory —
  the Atlantic 50L water heater's repair history lives ON the item; warranty expiry
  from the item feeds "don't pay for this repair" alerts; per-item total-cost-of-
  ownership emerges free. Insurance premiums reconcile against the inventory's
  insured-value rollup ("your contents value rose 18% since the policy was set").

**SARE/RSI loops**: variable-bill forecaster (learns each meter's curve) ·
anomaly critic (bill 2.3× its seasonal norm → flag before pay) · duplicate-bill
veto (same payee+period twice) · category calcification per payee.

**Guardrails (inherited whole)**: STOWAWAY **records and predicts money; it never
moves money.** No payment initiation in v1; any future pay-rail ships dark behind a
default-OFF flag with server-side check. Bank-account linking (open banking) is a
flagged, opt-in later phase — capture-first design works everywhere including BG.

**Award bar**: the budget UI is dataviz-grade (variance bars, seasonal curves,
cashflow river) in the Coastal Adventure system, dark-first, AA — the target is
"YNAB clarity × property intelligence neither YNAB nor Sortly has."

---

## 2c. HOST — tourist & rental property management (multi-location)

The guest-apps concept from HANDOFF.md, reborn as a **first-class module** on the
shared data model (Properties already exist; HOST makes them rentable and the
guest-facing surface world-class).

**Owner side (multi-property mission control)**
- **Unified booking calendar** across all properties; bookings entered manually or
  ingested via **iCal sync (Airbnb/Booking.com export URLs)** — read-only ingest
  first (universally supported, zero API-partner friction); channel-manager API
  integration is a later, flagged phase. Direct-booking requests via the guest page
  land as HITL approvals — **never auto-confirmed**.
- **Turnover ops on the inventory graph** (the differentiator): checkout triggers a
  cleaning/turnover task with a property-specific checklist *generated from actual
  inventory* — "restock Nespresso pods (consumable, low), verify TV remote ×2,
  towels ×6 present" — and every turnover is an inventory count that keeps the
  system true. Damage/loss during a stay is an event on the item, attributable to
  the booking.
- **Money flows into LEDGER automatically**: booking income, cleaning costs,
  platform fees, per-property occupancy/ADR/RevPAR and true P&L per property —
  the triangle closing (guests → money → things).
- Guest CRM: repeat-guest history, notes, quiet channel for "the heating in
  Bansko" questions.

**Guest side (the award-winning surface)**
- Per-property **guest web app** (PWA, no install, QR at the door): dark-first
  Coastal Adventure, EN/BG/RU/DE with auto-detect.
- **Stay-scoped access**: a booking mints a time-boxed guest link (signed token,
  auto-expires after checkout) — Wi-Fi QR, door/parking instructions, house guide,
  appliance how-tos *generated from the property's actual inventory* ("the Midea AC
  remote: here's the heat mode"), local weather (Open-Meteo), transport, curated
  explore cards (owner-editable), emergency numbers.
- **Live local intelligence**: Bansko property shows ski/lift conditions in season;
  Santa Marina shows beach/wind. Season-aware content switching per property.
- Guest requests (late checkout, extra towels, "the router is down") → owner inbox
  → resolution tracked; recurring issues per property surface as maintenance
  candidates (→ LEDGER expense when fixed, → item event on the appliance).
- Digital guestbook + review-funnel nudge at checkout.

**SARE/RSI loops**: turnover-checklist calcification (each property's checklist
hardens from what cleaners actually confirm) · consumable burn-rates learned per
property per season → restock forecasts · guest-question clustering ("4 guests
asked about the water heater" → add to the guide automatically, HITL-approved) ·
pricing *suggestions* from occupancy patterns (advisory-only, never auto-repriced).

**Guardrails**: guest PII minimized + auto-purged post-stay (configurable
retention); guest links scoped to exactly one booking's window; smart-lock/door-code
integrations ship dark behind flags; **no payment collection from guests in v1**
(platforms handle it; direct-booking payments = flagged later phase).

---

## 3. Data model (extends HANDOFF's, now travel/AI-aware)

```
Account (mode: home|business)
└─ Property (Bansko apt · Santa Marina · София · Lozenec storage · "In transit")
   └─ Space (wardrobe · upstairs chest · bed drawer · Градина)
      └─ Container (MFC bag · Червен куфар #1 · K2 ski bag)  ← nests, MOVES
         └─ Item
            ├─ identity: name, brand, model, category(taxonomy), photos[], serial
            ├─ physical: size, weight, color, condition, quantity(business)
            ├─ value: purchase price/date, current est, insurance flag
            ├─ ai: {extracted_attrs, confidence, confirmed:bool}   ← never-guess
            ├─ semantics: pairs_with[], substitutes[], consumable:bool, expiry
            ├─ travel: packable, wind_range/temp_range (sport gear), volume
            └─ provenance: every mutation event-sourced (who/when/what/why)
Trip (destination, dates, purpose[], forecast, baggage_constraints)
└─ PackList → PackItem (item_ref, status: suggested|confirmed|packed|returned|lost)

# LEDGER (§2b)
Bill (property_ref?, payee, amount|variable, currency, cadence, due_rule, autopay)
└─ BillInstance (period, amount, due, status: upcoming|due|paid|overdue, receipt_ref)
Budget (scope: account|property, category, period, planned) → variance = derived
Expense (property_ref?, item_ref?, booking_ref?, category, amount, receipt)  ← links the triangle
FxRate (currency, date, rate)  — cached, never live-blocking

# HOST (§2c)
Booking (property_ref, source: manual|ical|direct, guest_ref, dates, status,
         income, fees)              ← direct requests are HITL, never auto-confirmed
Guest (contact, language, notes, retention_policy)
GuestLink (booking_ref, signed_token, expires_at)   ← stay-scoped, auto-expiring
TurnoverTask (booking_ref, checklist[] ← generated from property inventory,
              counts_confirmed, issues[])
GuestRequest (booking_ref, text, status, resolution, item_ref?)
PropertyGuide (property_ref, sections[] ← partly generated from inventory, HITL-edited)
```

Key invariants (all CI-gated):
- **Containers are first-class movers** — moving a container moves its subtree;
  location of any item is always *derivable*, never hand-stamped.
- **Event-sourced core** (port `engine/event-store` pattern): append-only log,
  projections for current state; "where was the pump on June 3?" is a replay.
- **AI-extracted ≠ fact**: `confirmed:false` attrs render visually distinct and
  never feed valuations/exports until a human confirms.

---

## 4. Architecture

```
Cloudflare Pages (React 18 + Vite + TS + Tailwind + shadcn) — PWA, offline-first
   │
Cloudflare Worker API  ── D1 (event log + projections) ── R2 (photos)
   │                        └─ queues/cron: forecast refresh, reorder scan, RSI digest
   ├─ adapters/inventory/  ← SARE adapter layer (critics, calcify counter, pack-engine
   │                         domain logic, taxonomy) — vendored from dental engine/
   └─ engine/              ← SARE engine, vendored VERBATIM from dental-network-state
                             (boundary lint comes with it: engine stays domain-free)
External: Open-Meteo (forecast, keyless) · vision+LLM via gateway routes ·
          (later) airline baggage tables, barcode/UPC lookup
```

- **Vendor, don't fork-drift:** `SCRIPTS/vendor_sare_engine.sh` copies `engine/`
  + boundary-lint gate from dental-network-state at a pinned commit; a freshness
  check warns on upstream drift. Same pattern as dental's vendored snapshots.
- **Offline-first**: guest/field use (a storage unit has no signal). Local queue
  → sync on reconnect; conflicts resolved by event-log merge, never wall-clock LWW.
- Design language: **Coastal Adventure** per HANDOFF (dark-first, tokens-only,
  WCAG AA, EN/BG/RU/DE, long-Cyrillic-safe) — all guardrails carry over.

---

## 5. RSI — the self-improvement loops (concrete, not vibes)

| Loop | Signal | Learns |
|---|---|---|
| Classification | user corrects an AI-extracted attr | veto vector for the wrong pattern; calcify the right one → per-user taxonomy hardens |
| Packing | post-trip: used / unused / missing | trip-type templates reweight; "never used in 3 trips" → suggest-drop |
| Placement | "where is X" searches that end in a manual hunt | surfacing/location-confidence fixes |
| Valuation | user edits an estimate | per-category depreciation curves |
| Ops (business) | stockouts vs reorder timing | par-level suggestions (HITL) |
| **Meta (build-level)** | gate results + review findings per PR | backlog re-ranking each orchestration cycle — the *project* is RSI, not just the app |

All learning is per-account first; cross-account aggregation (e.g. "kiters going to
La Ventana pack X") only ever as opt-in, de-identified aggregates behind the
federation consensus gate — the PHI-wall discipline from dental applies as a
privacy-wall here (your home inventory is sensitive data; it never leaves raw).

---

## 6. Build phases

**M0 — Foundation (repo becomes real)**
Vite+TS+Tailwind+shadcn scaffold · vendor SARE engine + boundary gate · D1 schema
(event log + projections) · Worker API skeleton (auth: Cloudflare Access or JWT,
no `owner123`-class defaults — fail closed) · CI: lint, typecheck, gates, no-raw-hex.
**Exit test:** `BULGARIA MFC BAG.md` importer parses ≥95% of lines into the model
with correct Property/Space/Container nesting — the fixture IS the gate.

**M1 — Core inventory (usable daily)**
Property→Space→Container→Item drill-down UI · search-first UX (fuzzy, attribute,
"where is") · container move (subtree) · photo capture → R2 · manual CRUD ·
EN/BG · PWA offline shell. **Exit:** owner manages the real Bulgaria inventory
end-to-end on a phone.

**M2 — Content awareness (SARE lights up)**
Vision+LLM extraction behind the gateway (cheap-first routing) · never-guess
confirm flow · critics (impossible-attr, category-mismatch) · veto + calcification
live · voice capture ("Naish 55 bar, red-blue, MFC bag" → structured, confirmed).
**Exit:** photo of real gear → correct structured item in ≤2 confirms; 5th confirm
of a pattern classifies deterministically (calcification proven).

**M3 — The Packer (the moat)**
Trip entity · template packs (kite/ski/expedition/business/beach — seeded from the
fixture's actual bag groupings) · Open-Meteo forecast → gear-range matching ·
availability resolution ("it's in Bansko, you leave from Sofia") · weight/volume
budget vs baggage allowance · pack/return check-off · post-trip RSI capture.
**Exit:** plan a real trip against the real inventory; the list is *actionably
correct* (right kites for forecast, physical moves flagged, weight math right).

**M4 — Business mode**
Quantities/par/reorder (HITL PO drafts only) · check-in/out ledger · roles ·
exports (insurance PDF, CSV) · client-scoped portal. **Exit:** a kite school runs
a season's fleet.

**M4b — LEDGER (budget & bills, §2b)**
Bill/BillInstance/Budget/Expense entities on the event log · bill capture via the
M2 AI rail (photo/PDF → confirm) · recurring engine + due notifications · budget
planner UI (variance, seasonal curves) · multi-currency (BGN/EUR/USD) · 90-day
cashflow horizon · item-linked expenses (TCO on items, warranty alerts).
**Exit:** the real Bulgaria properties' actual bills run through it for one full
month — every bill captured, categorized (≥1 payee calcified), variance view
correct, zero money moved.
*Note: M4b needs only M0–M2 — it can run in parallel with M3/M4 as a separate
Cursor lane.*

**M4c — HOST (rental & tourist management, §2c)**
Booking calendar + iCal ingest (Airbnb/Booking export URLs) · Guest/GuestLink
(stay-scoped signed tokens) · per-property guest PWA (Wi-Fi QR, inventory-generated
house guide, weather, explore cards, EN/BG/RU/DE) · turnover tasks generated from
inventory · guest request inbox · booking income/fees → LEDGER · per-property
occupancy + P&L.
**Exit:** one real property (Santa Marina or Bansko) hosts a real stay end-to-end:
booking ingested, guest link used by an actual guest, turnover checklist completed,
income visible in LEDGER's property P&L.
*Depends on M4b (money entities) + M1 (inventory). The guest PWA sub-slice can
start as early as post-M1.*

**M5 — Ecosystem & polish**
Ghost-run "what-if" relocations · barcode/UPC · NFC tags on containers · family
sharing · RU/DE completion · app-store PWA packaging · opt-in federated pack wisdom.

Ship dark, flip deliberately: anything outbound (share links, exports, purchasing)
lands behind a default-OFF release flag with a server-side check — dental's
non-negotiable #11, inherited whole.

---

## 7. Operating model — orchestration + token discipline

**Roles:** Claude Code = orchestrator/reviewer/maintainer (this plan, task briefs
in `tasks/`, merge-gate review, gates, docs). **Cursor = primary implementer**
(feature branches from briefs). Claude implements directly only: glue, gates,
review fixes, pure-logic modules (pack-engine scoring, importer) — the Brain-track
carve-out from the dental playbook.

**Model-switching for token preservation** (both build-time and runtime):

| Work | Model tier |
|---|---|
| Architecture, plan revisions, merge-gate review, critic design | Opus / Fable (frontier) |
| Feature implementation from a written brief | Cursor (its own models) / Sonnet |
| Mechanical: renames, fixture parsing runs, i18n key sweeps, test scaffolds | Haiku / cheapest |
| Subagent fan-out (research, multi-file audits) | Sonnet, `effort: low` unless verifying |
| **Runtime** (in-app AI) | gateway route table: calcified path → $0 deterministic → local/cheap model → frontier only on low-confidence; per-route fallback chains + cost attribution, exactly like `route_config.yaml` |

**The loop per unit of work:**
1. Orchestrator picks backlog item → writes `tasks/<ID>.md` (Goal · Files · Do ·
   Acceptance · compliance stamp) → commits.
2. Cursor (or Claude, per routing table) implements on a branch.
3. Orchestrator reviews diff vs design system + gates + this plan → merge.
4. Same session: update `PLAN.md` changelog + state → push. (Document-every-change,
   the standing rule inherited from dental.)

**Verification:** every phase exit above is a *gate*, not a vibe — `gates/` dir
from M0, run in CI, results committed. The Bulgaria fixture is the permanent
regression corpus.

---

## 8. Task briefs (next actions)

### Done (M0)
- **T-001** `tasks/T-001-scaffold.md` — M0 scaffold: Vite+TS app, Worker, D1 schema
  (event log), CI. *(Cursor — merged)*
- **T-002** `tasks/T-002-fixture-importer.md` — parse `BULGARIA MFC BAG.md` →
  normalized JSON per §3 + import gate. *(Claude — pure logic, fixture-testable)*
- **T-003** `tasks/T-003-vendor-sare.md` — vendor `engine/` + boundary lint from
  dental-network-state at a pinned commit. *(Claude — cross-repo glue)*

### Next (M1)
- **T-004** `tasks/T-004-inventory-drilldown.md` — Property→Space→Container→Item
  **read-only** drill-down UI over D1 projections + JWT-gated inventory GET APIs.
  *(Cursor)* — first M1 slice; search / move / photo / CRUD split to T-005+.

### Proposed follow-ons (not cut yet)
- **T-005** — search-first UX (fuzzy / attribute / “where is”)
- **T-006** — container move (subtree) + manual CRUD
- **T-007** — photo capture → R2
- (EN/BG + offline polish ride with the above or a later polish ticket)

---

## 9. Blind spots & backlog (audit 2026-07-17)

A full concept/workflow/build audit surfaced 5 gaps the plan didn't cover and
20 candidate improvements. Full writeup: `LEARNINGS.md` (this is where every
future audit, wrong-turn, and gate failure gets logged too — the build's own
RSI loop, not just the app's). Disposition below; items not yet accepted stay
backlog, re-evaluated each phase boundary.

**Gaps folded into existing phases (accepted):**
- **Cold-start.** M1's exit test is now "a *new* user reaches 50 confirmed
  items in one sitting without typing markdown" (barcode/receipt-forward/
  voice-walk capture), not just "the Bulgaria fixture parses." The fixture
  stays the regression corpus; it stops being the onboarding proxy.
- **Confirmation fatigue.** M2 adds confidence-tiered auto-accept (visibly
  marked, undoable, never silently trusted for valuations/export) + confirm-
  whole-container-at-once, alongside the never-guess single-item flow.
- **Disaster export.** Promoted from "a feature" to an M1/M4b exit criterion:
  a scheduled, encrypted, off-device export (PDF+JSON+photos) a user can
  reach with zero access to the app or the burned house. Ships dark behind a
  release flag (first outbound surface — §6 rule applies).
- **EXIF stripping.** Added as an M1 photo-capture acceptance criterion, not
  optional: GPS/metadata stripped before any photo lands in R2.
- **Tree-conflict resolution.** Added to M0/M1 as a written spec + gate
  fixtures *before* offline sync goes deep: move-wins rule, cycle rejection,
  delete-vs-move precedence. Blocks "offline-first" from silently rotting.
- **GDPR for HOST.** Added to M4c scope: consent capture, retention timer,
  one-tap guest erasure (tombstone/crypto-shred pattern compatible with
  append-only event log — erasure ≠ deletion of the log, deletion of the
  *readable* PII), data-processing record.
- **Obligations surface.** New cross-cutting concept for M4b/M4c: bills,
  maintenance, warranties, reorders, and turnovers unify into one forward
  timeline instead of five competing notification systems. Designed once,
  before the modules that feed it (§2b/§2c revised to reference it rather
  than each inventing its own due-date UI).
- **Engine naming collision.** `engine/inventory/` (dental's HITL-PO reorder
  module) is *not* this app's inventory — `adapters/inventory/README.md`
  updated to call it out by name so Cursor/Claude never confuse the two.
  Docs-only fix; the vendored file itself is untouched (would break `diff -r`
  drift-check).
- **Round-trip gate.** New T-00X (queued): once T-001's D1 schema lands, a
  gate loads `importer/fixtures/bulgaria.expected.json` through the real
  projection and asserts the rebuilt tree matches the importer's tree
  node-for-node — catches schema/projection drift at the exact seam most
  likely to rot silently.

**New moat candidates (backlog, not yet phased):** lend/borrow tracking
(HOME), cost-per-use analytics, maintenance scheduler, warranty/manual vault,
QR container labels (pull forward from M5, NFC stays the premium upgrade),
moving/relocation mode (elevates "In transit" into a real feature), donation/
disposal tax tracking, consumables → auto shopping list. Re-evaluate for M3–M5
slotting once M1/M2 ship and real usage data exists to prioritize by.

**Operating-model changes (accepted):**
- Merge-gate review includes a live Cloudflare Pages preview, not diff-only,
  once M1 has UI to preview.
- `LEARNINGS.md` is a required step 4 in §7's loop (not optional) — every PR,
  gate failure, and audit appends an entry that can re-rank the backlog.

---

## Change log (append-only)

- **2026-07-17** — **v1.2: full concept/workflow/build audit → §9 added.**
  5 blind spots (cold-start proxy vs onboarding, confirmation fatigue, the
  disaster-export reframe, EU/GDPR guest data, tree-move conflict resolution
  left underspecified) folded into M0–M4c phase acceptance criteria; 8 new
  moat candidates backlogged; 2 operating-model changes (live-preview review,
  mandatory `LEARNINGS.md`). `LEARNINGS.md` created as the build's own RSI
  ledger. `adapters/inventory/README.md` gets a naming-collision callout
  against vendored `engine/inventory/` (docs-only, engine untouched).
- **2026-07-16** — **T-004 implemented:** JWT-gated read-only inventory APIs
  (`properties`, node detail, mixed `parent_id` children, summary) plus the
  dark-first app login and Property→Space/Container→Item browser. Fixture
  counts and deterministic hierarchy/item-detail behavior are gate-covered;
  search, moves, photos, CRUD, i18n, and remote deployment remain deferred.
- **2026-07-16** — **T-004 brief cut (M1 first slice):**
  `tasks/T-004-inventory-drilldown.md` — JWT-gated Property→…→Item drill-down
  over existing D1 projections (read path only; parent_id-driven mixed children;
  fixture acceptance 5/7/23/453). Search, container-move, photo→R2, and CRUD
  deferred to proposed T-005–T-007. §8 updated. No implementation in this commit.
- **2026-07-16** — **T-003 DONE: SARE engine vendored from dental-network-state.**
  `engine/` copied byte-verbatim (verified `diff -r` empty) from
  `drkitesurf/dental-network-state` @ `9f48757d660aad73b3b9ee0a242dbf3df712c5b4`
  — interceptor, gateway, calcification, federation/consensus, veto,
  DAG+Ghost-Run, event-store, plus M5 modules (ambient/assumptions/bounty/
  inventory-PO/twin/agent-tools) that rode along. Boundary-lint gate ported
  and re-pointed at this repo's own domain vocabulary instead of dental's —
  **caught a real bug in its own first draft**: `engine/VENDORED.md` (which
  I wrote) named the product directly and was rejected by its own gate,
  exactly the mistake the donor's README warns about ("this README lives
  under engine/, so it must be vertical-neutral too") — fixed by removing
  all product vocabulary from the file, including from its own explanatory
  examples. `gates/tests/engine-smoke.test.mjs` exercises interceptor
  no-op/pre-gate-short-circuit, gateway offline-degrade (no throw),
  calcification's in-memory counter, and event-store's frozen-event
  invariant — all against the vendored code with zero app imports.
  `SCRIPTS/vendor_sare_engine.sh` (re-vendor + `--check` drift detection)
  verified against both a no-drift run (real donor repo, confirmed clean)
  and a simulated-drift run (throwaway git repo with one line changed,
  correctly detected + exit code 2). `adapters/inventory/README.md` records
  the seam contract for M2 (which engine injection points get filled: 
  interceptor pre-gates/critics/calcify-counter, gateway route manifest,
  event-store reducers) without implementing any of it yet — M3 territory.
- **2026-07-16** — **T-002 DONE: Bulgaria fixture importer built, verified, gated.**
  `importer/{parse,heuristics,lexicon,emit,run}.mjs` (dependency-free Node ESM —
  no toolchain exists yet, T-001 hasn't landed) parse `BULGARIA MFC BAG.md` into
  a normalized event stream. Parse rate 100% (488/488 content lines), all 5 real
  properties correctly populated (Градина/София/Bansko/Lozenec storage/synthetic
  Unspecified), idempotent, Cyrillic-safe. Two real bugs caught by running
  against actual data before accepting the golden fixture: a parent-id
  self-reference bug (fixed via a proper two-pass id-assignment/emission split,
  which also fixed a forward-reference ordering bug for hints like "Bg Bansko
  upstairs" resolving to a property declared later in the file), and two
  never-guess violations ("Kanaha" mistaken for a brand; a parenthetical note
  leaking a false brand into an unrelated item) — both fixed and regression-
  tested. 11/11 gate assertions pass (`gates/tests/importer.test.mjs`). Design
  decisions + known limitations documented in `importer/README.md` (notably:
  "IKEA bag in lozenec" isn't auto-nested — unmarked implicit sub-headers are
  deliberately not inferred; `last-seen` property resolution is flagged as the
  least-confident tier for owner review).
- **2026-07-16** — **T-001/T-002/T-003 briefs written** to `tasks/` (scaffold →
  Cursor; fixture importer + SARE vendoring → Claude Brain-track). Loop §7 step 1
  complete for all three; next: execute T-002/T-003, hand T-001 to Cursor.
- **2026-07-16** — **v1.1: LEDGER + HOST pillars added (founder request).** §2b
  budget planner & bill manager (property/item-aware money layer, never-guess bill
  capture, seasonal-curve budgeting, cashflow horizon, records-never-moves-money
  guardrail) + §2c rental/tourist management (multi-property bookings via iCal
  ingest, stay-scoped guest PWA, inventory-generated turnover checklists + house
  guides, income → LEDGER P&L). Data model §3 extended; phases M4b/M4c inserted
  (M4b parallelizable after M2). Thesis widened to the things+money+guests triangle.
- **2026-07-16** — PLAN.md v1.0 created. Baseline reset: only this repo's two MD
  files exist; HANDOFF.md demoted to spec-lore. Thesis locked: content-aware +
  SARE-adapted + travel Packer + RSI, home/business dual mode, Claude-orchestrates /
  Cursor-implements with tiered model routing.

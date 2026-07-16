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

## 8. First three task briefs (next actions)

- **T-001** `tasks/T-001-scaffold.md` — M0 scaffold: Vite+TS app, Worker, D1 schema
  (event log), CI. *(Cursor)*
- **T-002** `tasks/T-002-fixture-importer.md` — parse `BULGARIA MFC BAG.md` →
  normalized JSON per §3 + import gate. *(Claude — pure logic, fixture-testable)*
- **T-003** `tasks/T-003-vendor-sare.md` — vendor `engine/` + boundary lint from
  dental-network-state at a pinned commit. *(Claude — cross-repo glue)*

---

## Change log (append-only)

- **2026-07-16** — PLAN.md v1.0 created. Baseline reset: only this repo's two MD
  files exist; HANDOFF.md demoted to spec-lore. Thesis locked: content-aware +
  SARE-adapted + travel Packer + RSI, home/business dual mode, Claude-orchestrates /
  Cursor-implements with tiered model routing.

# Vendored from dental-network-state

This `engine/` tree is copied **verbatim** from `drkitesurf/dental-network-state`
at a pinned commit — not forked, not adapted. It is the domain-free SARE
(Sovereign Adaptive Routing Ecosystem) engine: interceptor, model gateway,
calcification, federation/consensus, veto store, DAG + Ghost-Run, event-store,
plus a few M5 modules (ambient, assumptions, bounty, inventory-PO, twin,
agent-tools) that came along with the tree.

**Source repo:** `drkitesurf/dental-network-state`
**Pinned commit:** `9f48757d660aad73b3b9ee0a242dbf3df712c5b4` (2026-07-14 23:59:27 -0700)
**Vendored:** 2026-07-16
**Diff vs source at pin:** empty (`diff -r` verified clean at vendor time)

## Why vendor instead of depend

The donor repo's own `engine/README.md` states the extraction plan: this tree
is developed in-repo across several verticals and split into a standalone
`sare-engine` package "at maturity." Until then, every consuming repo
vendors a pinned snapshot rather than each inventing its own routing/learning
infrastructure from scratch — the same pattern the donor itself uses for
`@thedentist/clinical-contract`.

## Re-vendoring

Run `SCRIPTS/vendor_sare_engine.sh <path-to-dental-network-state-clone>` to
pull a fresh copy at the donor's current `main` and update the pinned SHA
above. Run with `--check` to diff the currently-vendored tree against the
donor's tree at the recorded pin (fails loudly on drift; does not write).

**Do not hand-edit anything under `engine/` to fix a bug found here** — a
local patch here is exactly how vendored trees drift and re-vendoring becomes
lossy. If something in `engine/` doesn't work standalone, that's an upstream
finding: report it against `dental-network-state`, fix it there, then
re-vendor.

## The boundary rule (gate-enforced, this side too)

`gates/tests/sare-boundary-lint.test.mjs` — ported from the donor and
re-pointed at this repo's own product vocabulary instead of the donor's
dental vocabulary (see that gate file for the exact banned-term list — not
repeated here on purpose). Fails CI on any of that vocabulary appearing
under `engine/`, or any import reaching into `adapters/`, `app/`, `worker/`,
or `importer/`. (This file itself must stay clean of that vocabulary too —
it lives under `engine/`, which is exactly why the term list isn't quoted
here.)

## The adapter seam (what M2 fills in)

Nothing under `engine/` is wired to the product vertical yet — this is
plumbing, not a feature. `adapters/inventory/README.md` documents which
injection points M2 (content awareness) will use:

- `engine/interceptor` — `usePreGate`/`useCritic`/`useVetoCheck`/
  `useCalcifyCounter`/`useShadowSampler` around the vision/LLM item-extraction
  call, implementing PLAN.md §5's "never-guess" + calcification loops.
- `engine/gateway` — the `route_config`-style cheap-first/frontier-fallback
  model routing for extraction + pack-list generation (PLAN.md §7 runtime row).
- `engine/calcification` + `engine/event-store` — the durable substrate for
  "the 5th confirm hardens the pattern," backed by D1 once T-001 lands.

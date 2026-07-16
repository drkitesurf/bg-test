# engine/ — SARE / Sentinel Engine (domain-free core)

This tree is the **Sovereign Adaptive Routing Ecosystem (SARE)** engine — the
vertical-agnostic core that converts probabilistic AI output into hardened
deterministic logic. It is developed in-repo and **extracted at maturity** into
the standalone `sare-engine` package (see `DOCS/SARE/CLAUDE_CODE_KICKOFF_2026-07-13.md`
§5 — single-repo-until-extraction, never a maintained parallel copy).

## The boundary rule (gate-enforced)

**No domain fact may appear anywhere under `engine/`.** No clinical vocabulary,
no procedure codes, no anatomy, no brand names, no imports from `adapters/`,
`cloudflare-pages/`, `functions/`, or any other vertical tree. All specifics are
supplied by a vertical adapter at registration time (today: the reference
vertical under `cloudflare-pages/cortex/adapters/`; the formal adapter home for
new SARE spines is `adapters/`).

This is enforced mechanically by the gate **`sare_boundary_lint`**
(`gates/tests/sare-boundary-lint.test.mjs`), which fails CI on:

1. any banned domain term in any file under `engine/`;
2. any import/require that reaches outside `engine/` into a vertical tree.

The gate is what keeps the future spin-off extraction clean: `git subtree split`
on `engine/` must always produce a repo that compiles and tests with zero
knowledge of the reference vertical.

## Planned spines (see `DOCS/SARE/00_ARCHITECTURE_BLUEPRINT.md` §4)

| Spine | Tree | Milestone | Status |
|---|---|---|---|
| A — Inference interceptor | `engine/interceptor/` | M1 | **built** (SARE-011..016) |
| — Calcification (harden/shadow) | `engine/calcification/` | M1→M4 | **counter + shadow + harden/melt loop built** (SARE-015/016/045); live enforce = `sare_calcify_live` dark |
| B — Model gateway | `engine/gateway/` | M2 | **core built** (SARE-021); provider adapters + MCP gated on founder Q1–Q3 |
| C — Negative-vector veto store | `engine/veto/` | M3 | packets drafted (`M3_VETO_STORE_PACKET_SET.md`) |
| D — Federation / consensus | `engine/federation/` | M4 | packets drafted (`M4_FEDERATION_PACKET_SET.md`) |
| DAG executor + Ghost-Run | `engine/dag/` | M5 | **built** (M5-DAGX / M5-GHOST) |
| Assumptions / pad contract | `engine/assumptions/` | M5 | **built** (M5-PAD · `sare_assumptions_pad`) |
| Ambient BI / overhead | `engine/ambient/` | M5 | **built** (M5-AMBI · `sare_ambient_bi`) — tape + pad + injected cost kernel; PMS bridge stays adapter |
| Practice digital twin | `engine/twin/` | M5 | **built** (M5-TWIN · `sare_practice_twin`) — live DAG per opaque practice key; animation/consent stay adapter |
| Inventory HITL PO | `engine/inventory/` | M5 | **built** (M5-INVENT · `sare_inventory_hitl`) — reorder signals → draft PO → human approve/reject; **never** auto-purchase |
| Fiat bounty scaffold | `engine/bounty/` | M5 | **built** (M5-BOUNTY · `sare_bounty_scaffold`) — post/solve/council HITL; payout+checkout **always** fail-closed (revenue-rail) |


### M1 — the Interceptor, as built

`engine/interceptor/index.js` — `createInterceptor()` runs
`preGates[] → produce() → critics[] → vetoCheck() → calcifyCount() → shadowSample()`,
every stage registerable with a safe no-op default, pre-gates able to
short-circuit before `produce()`. The reference vertical's adapter supplies the
specifics — a severity pre-gate (reads the SARE-006 threshold resolver) and
inference critics — and injects them via `usePreGate`/`useCritic`; the engine
names none of it. `engine/calcification/index.js` provides the confirmed-only
per-path counter and the shadow sampler. The first live endpoint is routed
through the interceptor behind a dark release flag defaulting to the legacy path.

> This README lives under `engine/`, so it is itself vertical-neutral by the same
> rule the gate enforces — it never names the reference domain. The adapter paths
> and flag key are recorded in `DOCS/SARE/tickets/README.md` and the changelog.

Contract sketch for Spine A (from ticket SARE-011 / M1-01):
`intercept(request, produce)` runs `preGates[] → produce() → critics[] →
vetoCheck() → calcifyCount() → shadowSample()`; every stage registerable with
safe no-op/pass defaults; pre-gates may short-circuit before `produce()`.

## Rules for contributors (human, Cursor, or agent)

- Adding a stage, provider, or strategy that needs domain knowledge? Define an
  **interface here**, implement it in the adapter tree, inject at registration.
- Pure logic only: no direct DB clients, no provider SDK calls, no env reads at
  module top level — dependencies are injected.
- Every new module ships with a unit gate under `gates/tests/`.

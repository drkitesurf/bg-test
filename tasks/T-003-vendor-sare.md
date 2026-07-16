# T-003 — Vendor the SARE engine from dental-network-state

**Owner:** Claude (Brain-track: cross-repo glue) · **Phase:** M0→M2 seam
**Branch:** `feat/T-003-vendor-sare` · **Reads first:** `PLAN.md` §4, §5;
`dental-network-state/engine/README.md` (boundary contract)

## Goal
Copy the domain-free SARE engine into this repo at a pinned commit, with its
boundary lint, so M2 (content awareness) composes adapters instead of building
routing/learning infrastructure from scratch.

## Files
```
engine/                                  verbatim copy from dental-network-state/engine/
  interceptor/ gateway/ calcification/ federation/ veto/ dag/ event-store/ verification/
  VENDORED.md                            source repo + pinned commit SHA + refresh cmd
SCRIPTS/vendor_sare_engine.sh            re-vendor at a SHA; writes VENDORED.md
gates/tests/sare-boundary-lint.test.mjs  adapted from donor: fails CI on any
                                         inventory/dental/domain term or app-tree
                                         import appearing under engine/
adapters/inventory/README.md             stub: where critics/calcify-counters/
                                         gateway-executors for THIS app will live (M2)
```

## Do
1. Clone donor repo read-only at current `main`; record SHA. Copy `engine/`
   **unmodified** — if anything in it fails to run standalone, that's an upstream
   finding to report, not something to patch locally (drift kills re-vendoring).
2. Port the boundary-lint gate; extend its banned-lexicon to include *inventory*
   domain terms (item, packing, bill, booking…) so the engine stays domain-free
   from this side too.
3. Write `vendor_sare_engine.sh` (idempotent; `--check` mode diffs against the
   pinned SHA and warns on upstream drift — same freshness pattern as donor's
   generated-mirror gates).
4. Smoke test: import `createGateway`, `engine/interceptor`, calcification counter
   in a vitest and exercise the no-op/offline paths (donor gates show these run
   dependency-free).
5. Do **not** wire any adapter logic yet — M2's job. The README stub documents the
   seam: which injection points (`preGates`, `critics`, `vetoCheck`,
   `calcifyCount`, gateway executors) M2 will fill.

## Acceptance
- [ ] `engine/` runs standalone: smoke vitest green with zero app imports.
- [ ] Boundary lint green, and *proven live* (a scratch file with a domain term
      under `engine/` makes it fail — test-fixture in tmpdir, never committed:
      donor's canon-lint-probe lesson).
- [ ] `VENDORED.md` records SHA; `--check` detects a simulated upstream change.
- [ ] No modifications to vendored files (diff vs donor at SHA is empty).

## Compliance stamp
Code-only vendoring; no secrets, no data, no network at runtime. License/provenance:
same owner, private→private.

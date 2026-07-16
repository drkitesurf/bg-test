# adapters/inventory — where STOWAWAY's domain knowledge lives

`engine/` (vendored from dental-network-state, see `engine/VENDORED.md`) is
domain-free by construction and gate-enforced (`gates/tests/sare-boundary-lint.test.mjs`).
This directory is the other half: every place STOWAWAY's actual vocabulary
(kite gear, properties, containers, bills, bookings, trips) is allowed to
exist and gets **injected** into the engine's seams.

Nothing is wired here yet — this is the seam contract for M2 (content
awareness) to fill in, per `PLAN.md` §6.

## Injection points to fill during M2

| Engine seam | What the adapter supplies |
|---|---|
| `engine/interceptor` `usePreGate` | A pre-gate that runs before an AI extraction call — the STOWAWAY equivalent of dental-network-state's emergency-severity short-circuit. For inventory this is lower-stakes (nothing here is a medical emergency), so the pre-gate is more likely to be a confidence/consent gate: e.g. refuse to auto-classify without a photo present. |
| `engine/interceptor` `useCritic` | Post-produce critics: impossible-attribute critic (e.g. a kite size outside any real product's range), category-mismatch critic (extracted category doesn't match the container it's already in). Findings with `severity: 'blocker'` veto the AI output before it's shown — never-guess, same pattern T-002's importer already follows by hand. |
| `engine/interceptor` `useCalcifyCounter` | Wraps `engine/calcification`'s `calcifyPathKey({surface, node, decision})` — e.g. `surface:'item-classify'`, `node:<brand-model-signature>`, `decision:<category>`. Only increments on a HITL-confirmed (never auto) result. |
| `engine/gateway` | A `route_config`-shaped manifest for STOWAWAY's own routes (`classify_item`, `pack_suggest`, `bill_extract`) with cheap-first/frontier-fallback targets, per PLAN.md §7's runtime routing row. Executors (Ollama/cloud) are the same donor-vendored provider modules under `engine/gateway/providers/` — no rewrite needed, just a new manifest. |
| `engine/event-store` | The projection functions (event → current Item/Bill/Booking state) — STOWAWAY's actual reducers, analogous to what T-002's importer hand-rolled for the one-time fixture import; this is the durable, ongoing version once T-001's D1 schema lands. |
| `engine/veto` | Deferred until there's a real "known-bad classification" corpus to embed against — not needed for M2's initial cut. |
| `engine/federation` | Deferred to M5 (opt-in, de-identified aggregate pack-list wisdom across accounts — PLAN.md §5). |

## Rule

Same rule as the donor: **no domain fact may appear anywhere under `engine/`.**
If a new engine capability needs domain knowledge, define the interface in
`engine/`, implement the specifics here, inject at registration. The
boundary gate enforces this on every commit.

# engine/verification — evidence-normalization core (domain-free)

Part of the SARE engine. Turns multi-source, possibly-conflicting evidence into
**one deterministic record with per-field provenance and a hard never-guess
gate**. The engine names no field, no source, no acquisition method, and no
vertical — the adapter supplies the field schema and the source-reliability
ranking. This is what lets a verification-style vertical (and any future one)
reuse one hardened normalizer instead of re-deriving provenance logic per
source.

> This README lives under `engine/`, so it is vertical-neutral by the same rule
> the boundary gate enforces — it never names the reference domain. The concrete
> adapter paths and field taxonomy are recorded in the vertical's own docs
> (`DOCS/INSURANCE_VERIFICATION/`) and the changelog.

## The prime directive it enforces

*Never let inferred data masquerade as source-returned data.*

- A field the evidence does not carry surfaces as **`needs-call`**, never as a
  placeholder value.
- A field the adapter marks **un-guessable** (`guessable:false`, the safe
  default) can only reach **`resolved`** from directly-observed evidence — an
  inferred datum can never resolve it.
- Two distinct values from equally-authoritative sources → **`conflict`**,
  routed to review, never silently picked.

## API (all pure, injected dependencies)

| Export | Purpose |
|--------|---------|
| `normalizeRecord(evidence, { schema, reliabilityOf })` | merge evidence → `{ fields, coverage, needsCall, conflicts }` |
| `auditNeverGuess(record, schema)` | belt-and-suspenders: list any un-guessable field that resolved from a non-observed source (empty = clean) |
| `compareNormalized(primary, shadow)` | dual-normalizer harness: per-field agreement + coverage delta (feeds `engine/calcification` shadow sampler for IV-007) |
| `VerificationStatus` | `{ RESOLVED, NEEDS_CALL, CONFLICT }` |

## What lives in the adapter, not here

The reference vertical's adapter tree (recorded in
`DOCS/INSURANCE_VERIFICATION/`) supplies:

- the **field schema** (which keys exist — coverage categories, deductibles,
  annual maxes, frequency limits, waiting periods, pre-existing-exclusion
  clauses, etc. — and which are un-guessable because the eligibility response
  structurally can't carry them);
- the **source-reliability ranking** (which acquisition method wins on conflict —
  clearinghouse vs voice vs portal);
- the **per-source adapters** that emit `Evidence[]` from an eligibility
  transaction or portal/voice result, each datum tagged with its real source and
  `inferred` flag.

The engine stays extractable: `git subtree split` on `engine/` compiles and
tests with zero knowledge of the reference vertical or any of its sources.

## Gate

`gates/tests/verification-normalizer.test.mjs` (`verification_normalizer_unit`)
— never-guess on missing + inferred-only, un-guessable safe default, conflict
detection, source-reliability ranking, coverage math, dual-normalizer compare,
and the `auditNeverGuess` invariant. Boundary lint (`sare_boundary_lint`) keeps
this tree domain-free.

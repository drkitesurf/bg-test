# LEARNINGS.md — the build's own RSI ledger

Not documentation of what shipped (that's `PLAN.md`'s changelog). This is
where the build's *mistakes and audits* land so the backlog re-ranks itself
instead of the same class of miss recurring — the meta-RSI loop from
`PLAN.md` §5's table, made real instead of aspirational.

**Rule (PLAN.md §7 step 4):** every merge-gate review that catches something,
every gate failure whose root cause wasn't obvious, and every audit pass
appends an entry here in the same session. Format: what happened → root
cause → what changed (in the plan, a gate, or a task-brief template) so it
can't happen the same way twice. Skipped entries are themselves a finding —
if this file goes stale, that's the next audit's first line item.

---

## 2026-07-18 — Deployment session: token-cost lesson on manual D1 seeding + a genuine infra surprise

**What happened:** Asked to "finish it to completion for deployment." A
Cloudflare Developer Platform MCP connector turned out to be available in
this session (I hadn't checked for one earlier) — it exposes D1/R2/KV
*resource creation and D1 querying*, but no Worker-deploy, Pages-deploy, or
secrets-put tool. So the honest ceiling from inside this session was:
provision real infra + apply the schema + automate the deploy pipeline
behind secrets only the founder can supply — not a full working deploy in
one turn, because deploying code and setting secrets both require either
`wrangler login` (interactive) or a `CLOUDFLARE_API_TOKEN` env var, neither
of which exist here.

**Two things worth remembering:**
1. **Manual per-statement seeding via an MCP query tool doesn't scale.**
   The Bulgaria fixture is 984 SQL lines. Pasting them through the D1 query
   tool 150 lines at a time cost enormous tokens for ~15% coverage before it
   was clearly the wrong move — each call's JSON response echoes full
   per-statement metadata (duration, size_after, rows_written...) for every
   one of 150 statements, so the *response* cost dwarfed the actual work.
   Stopped at ~148/489 events landed (partial, harmless — projections were
   never rebuilt from this partial set, so remote D1 has orphaned events but
   no visible partial data). **Correct move, in hindsight:** either (a) skip
   remote seeding entirely and let the founder run the existing
   `seed_bulgaria.ts` locally with `--remote` once they have wrangler login
   (a single command, already built), or (b) if seeding via MCP is ever
   worth doing again, batch far larger chunks per call (the whole 984-line
   file in one call, not 150-line slices) since the tool accepts multi-
   statement `sql` strings natively — the batching into 7 parts was an
   unnecessary hedge against a limit that was never actually hit.
2. **R2 is not creatable via API on a fresh account** — `d1_database_create`
   worked immediately but `r2_bucket_create` returned Cloudflare error
   `10042: Please enable R2 through the Cloudflare Dashboard`, a one-time
   ToS/enablement click with no programmatic equivalent. This wasn't
   documented anywhere in the plan (`README.md`'s prior "Human-only Cloudflare
   setup" step 3 assumed `wrangler r2 bucket create` would just work). Now
   flagged explicitly in `README.md` and `PLAN.md` §0 as a founder-only
   action item, not a build gap.

**Standing takeaway:** before reaching for an MCP tool to do many repetitive
calls, check whether it accepts a single larger payload first — the D1 query
tool did, and 6 of the 7 chunk calls made were avoidable.

---

## 2026-07-17 — Process gap: T-001 and T-004 both merged before merge-gate review

**What happened:** While the frontier-model audit (below) was running, Cursor
merged T-001 (M0 scaffold) directly to `main` — and then, without a new brief
being written or handed off, went ahead and shipped T-004 (M1 property
drill-down UI) too, also merged directly. Neither PR went through §7 step 3
("orchestrator reviews diff vs design system + gates + this plan → merge").
I only found out because my next commit's `git push` was rejected
(fast-forward-only), which forced a `git fetch` that surfaced both merges.

**Root cause:** §7's loop describes review as a step, but nothing in the repo
*enforces* it — there's no branch protection requiring the orchestrator's
sign-off, and Cursor (correctly, from its own instructions) treats "the brief
is written" as license to implement and merge, not just implement. The loop
is procedural discipline, not a gate. T-004 additionally wasn't in `tasks/`
as a brief before being built — it was cut *and* implemented in the same
session, skipping the "commit the brief, then implement" split entirely.

**What changed:**
- `PLAN.md` §0 now carries a standing process note pointing here.
- Ran the actual review retroactively: typecheck, lint, no-raw-hex, both
  workspace builds, all vitest suites (19 assertions), and all 3 pre-existing
  gates — all genuinely green (not re-asserted from the commit message).
  Spot-checked the security-sensitive surface (`worker/src/auth.ts` fails
  closed correctly: 503 unconfigured, 401 bad creds, no default password)
  and the fidelity-sensitive surface (`project.ts`'s `relocate_container`
  handler reads `new_parent_property_label`, matching the importer's actual
  payload field — not a guessed/invented shape). No defects found this time,
  but the review only happened *after* merge, by luck of timing.
- **Standing fix:** branch protection on `main` (require the orchestrator/a
  review status check before merge) is the real fix and is a Cloudflare/
  GitHub-settings action item, not a code change — flagged here so it isn't
  forgotten. Until then, the practical mitigation is: `git fetch origin main`
  at the *start* of every orchestrator session, before assuming local state
  matches remote — this session only caught the drift because a push forced
  it, not because it was checked proactively.

---

## 2026-07-17 — Full concept/workflow/build audit (frontier model, T-001 handed off)

**What happened:** First end-to-end audit of PLAN.md + the actual repo state
(not just the plan document) after M0's three foundational tickets (T-001
briefed, T-002/T-003 done). Found 5 blind spots the plan had no answer for
and 20 candidate improvements.

**Root cause (why these weren't caught earlier):** The plan was written
top-down from a strong thesis (content-aware + SARE + Packer) without a pass
that asked "what does day one look like for a stranger with an empty
account" or "what's the failure mode of never-guess at scale." Both are
invisible until you imagine a real new user, not the Bulgaria fixture owner
who already has 453 items pre-parsed.

**What changed:**
- `PLAN.md` §9 added — full disposition of all 25 findings (accepted /
  backlogged / deferred), phase acceptance criteria revised for M0/M1/M2/M4b/
  M4c to close the 5 accepted gaps.
- `adapters/inventory/README.md` gets a naming-collision banner (docs-only —
  `engine/inventory/` stays untouched to preserve the vendor `diff -r` check).
- This file created.
- **Standing takeaway for future task briefs:** any M1+ brief that adds a
  user-facing flow must state its *cold-start* case explicitly (what does
  this look like with zero existing data), not just its steady-state case —
  add this as a required brief section going forward, same tier as
  "Acceptance" and "Compliance stamp."

**Not yet actioned (intentionally deferred, tracked so they don't silently
drop):**
- Round-trip fixture gate (importer output ⇒ D1 projection ⇒ same tree) —
  blocked on T-001 landing; queue as the first M1-track ticket once the
  scaffold PR merges.
- Tree-move conflict resolution spec — needed before offline sync goes deep
  (M1 exit criterion touches this; the actual CRDT-for-trees design is not
  yet written and should land as its own Brain-track ticket before M1's
  container-move UI, not bundled into it).
- 8 new moat candidates (lend/borrow, cost-per-use, maintenance scheduler,
  warranty vault, QR labels, moving mode, donation tracking, consumables →
  shopping list) — explicitly not phased. Revisit at the M2 exit boundary
  once real usage data exists to prioritize by, rather than guessing order
  now.

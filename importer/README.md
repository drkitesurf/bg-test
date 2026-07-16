# Bulgaria fixture importer (T-002)

Deterministic, dependency-free parser: `BULGARIA MFC BAG.md` → a normalized
event stream (`create_property` / `create_space` / `create_container` /
`create_item` / `relocate_container`) matching `PLAN.md` §3's
Property → Space → Container → Item model.

No AI, no network, no invention. Every design choice below exists because the
source document is real, messy, human-written notes — not because the model
needs guessing. Written as plain Node ESM (`.mjs`) rather than TypeScript
because no build toolchain exists yet (T-001 hasn't landed) — this is
independently runnable today via `node --test`.

## Run it

```bash
node importer/run.mjs                # regenerates importer/fixtures/bulgaria.expected.json + prints a report
node --test gates/tests/importer.test.mjs   # the gate (11 assertions)
```

## The core design decision: type and depth are independent

Markdown heading depth (`#`/`##`/`###`) decides tree **shape** only — a
deeper heading nests inside the nearest shallower one, full stop. It does
**not** decide whether a heading is a Property, a Space, or a Container: this
document uses `#` for "Bansko" (a Property) *and* for "Червен куфар #1" (a
Container) *and* for "WARDROBE LUBA SIDE" (a Space), all at the same depth.

So `heuristics.classifyHeading()` runs an independent lexicon match
(`lexicon.mjs`: `CONTAINER_LEXICON`, `SPACE_LEXICON`, `PROPERTY_LEXICON`) on
every heading's own text, regardless of its `#` count.

## Resolving orphaned top-level headings

Most `#`/`##`/`###` headings get a real structural parent for free (a `###`
under a `##` genuinely nests under it). The hard case is a `#` heading with
**no** enclosing Property, because `#` always pops the stack back to root —
e.g. "Червен куфар #1" has no markdown ancestor at all.

`emit.resolveRootProperties()` resolves these in four tiers, most-confident
first, and **every emitted event records which tier fired** as
`property_source` so a human reviewing the fixture can see exactly how much
to trust each placement:

1. **`self`** — the node IS a property (e.g. "# Bansko").
2. **`hint`** — the heading's own text names a real, declared property
   *anywhere in the document* — even one declared later in the file (e.g.
   "Bg Bansko upstairs" at line 51 resolves to "Bansko", not declared until
   line 216; this required a two-pass resolution, see `emit.mjs`).
3. **`last-seen`** — no textual hint; falls back to the nearest preceding
   Property in document order. This is the weakest tier — a real inference
   from how the list was written (sections cluster by physical location),
   not a certainty.
4. **`unspecified`** — no hint, and no property has been declared *at all*
   yet (this only happens for four bags at the very top of the file, before
   "# Градина" — the first property — ever appears). These land in an
   honestly-labeled synthetic **"Unspecified"** property (`synthetic: true`
   in its event payload) rather than being guessed into a real one.

Current tier breakdown for this fixture: 4 `self`, 3 `hint`, 9 `last-seen`,
4 `unspecified` (see the `run.mjs` report output for the live numbers).

## The one relocation cross-reference

Line 540, "MFC bag is in lozenec", is not inventory — it's an instruction.
`heuristics.matchRelocationReference()` narrowly matches the literal pattern
`"<subject> is in <location>"` (requires the word "is" — deliberately does
**not** fire on "IKEA bag in lozenec" two lines later, which has no verb and
is a genuine item). When matched, the referenced container ("BULGARIA MFC
BAG") is re-parented to the named property (Lozenec storage) *before* any
event is emitted, and a `relocate_container` audit event records the
original line and the change — nothing is silently dropped or mutated
without a trace.

## Never-guess in item extraction

`heuristics.extractItemFields()` extracts `brand` / `sizes` / `quantity` /
`notes` from a line, but `name` is **always** the verbatim source line. Two
concrete bugs were caught and fixed by spot-checking real output against the
source before the golden fixture was accepted:

- **"KANAHA SHAPES BOARD"** — "Kanaha" (a Maui kite spot) was initially in
  the brand lexicon; removed, since it's a place/style name, not a confirmed
  brand. Left in `name`, `brand: null`.
- **Parenthetical notes leaking into attrs** — "Antiperspirant fote cream 60
  (not much in Mh shoe)" was extracting `brand: "MH"` from the *note*, not
  the item. Fixed: `working` text used for brand/size/qty matching has the
  parenthetical stripped *before* extraction; the note itself is preserved
  separately in `notes`, and the full original line (parenthetical
  included) is always preserved in `name`.

## Known limitations (by design, not oversight)

- **"IKEA bag in lozenec" (line 542) is not modeled as a container.** It's a
  bare body line with no `#` marker, immediately followed by six items that
  are clearly its contents — but detecting *unmarked* implicit sub-headers
  algorithmically risks false positives across the whole document. It's
  imported as a plain Item under "Lozenec storage" directly, siblings with
  the six bars that follow. Flagged here for manual re-nesting in the UI
  once M1 ships.
- **"Санта Марина" (Santa Marina) is never a declared Property.** It only
  appears as a qualifier inside a container name ("Бял куфар Санта Марина").
  That container is honestly parented via genuine markdown nesting (it's a
  `##` directly under "# Градина" in the source), not invented as a new
  top-level property the source never declares.
- **`last-seen` is a real inference, not a certainty** — 9 containers/spaces
  rely on it. It reads correctly for this fixture (everything from "Червен
  куфар #1" onward correctly lands under Bansko, matching the surrounding
  ski/kite gear), but the owner should skim the `property_source: 'last-seen'`
  rows in `bulgaria.expected.json` once before trusting them for insurance
  export.

## Parse-rate definition (T-002 acceptance: ≥95%)

`parse_rate = (items + headings + relocation_events) / total_content_lines`.
Every non-blank line either becomes a structural node (heading/property) or
an Item or a relocation event — a blank `##` heading (line 434) is the only
line excluded, since it carries zero information. Current: **100%**
(488/488 content lines resolved, 453 items + 34 headings + 1 relocation).

# T-002 — Bulgaria fixture importer (the M0 exit gate)

**Owner:** Claude (Brain-track: pure, fixture-testable logic) · **Phase:** M0
**Branch:** `feat/T-002-importer` · **Reads first:** `PLAN.md` §3, `BULGARIA MFC BAG.md`

## Goal
Deterministic parser: `BULGARIA MFC BAG.md` → normalized JSON matching PLAN §3
(Property → Space → Container → Item), emitted as an event stream the T-001 schema
can ingest. This is the permanent regression corpus and the M0 exit gate.

## Files
```
importer/parse.ts          heading-hierarchy parser (md → tree)
importer/heuristics.ts     line → Item field extraction (brand/size/qty/attrs)
importer/emit.ts           tree → events[] (create_property/space/container/item)
importer/fixtures/bulgaria.expected.json   golden output (reviewed by owner)
gates/tests/importer.test.ts
```

## Do
1. Parse the markdown heading levels into the location tree. Mapping rules:
   `#` = Property (София, Bansko, Градина…), `##`/`###` = Space or Container —
   classify by lexicon (куфар/bag/suitcase/box → Container; wardrobe/Гардероб/
   drawer/chest/upstairs → Space) with an explicit override table for ambiguous
   headings (e.g. "TV's" = virtual Space).
2. Per line: extract `{name, brand?, size?, quantity?, color?, attrs[]}` via
   conservative heuristics (known-brand lexicon: North Face/TNF, Ozone, Naish,
   Flysurfer/FS, Arcteryx…; size patterns: `\d+(\.\d+)?\s*(m|cm|L)`, shoe/clothing
   sizes; `X\d`/`x2` quantities; parenthetical notes → `notes`). **Never invent** —
   unparsed remainder stays verbatim in `name`; nothing is guessed into attrs.
3. Cyrillic-safe throughout (Градина, Гардероб, куфар, гети, ушанка, кубинки).
4. Emit events with stable deterministic ids (slugified path hash) so re-import
   is idempotent.
5. Gate: parse rate ≥95% of non-blank content lines produce an Item; tree depth
   and container nesting spot-checks (MFC bag ⊂ Lozenec; Червен куфар #1 items;
   "Red North Face cinder 32 backpack … in red suitcase" nests correctly);
   golden-file diff.

## Acceptance
- [ ] ≥95% line→Item parse rate, measured and printed by the gate.
- [ ] All 5 Property events are present — 4 source-declared locations plus the
      synthetic `Unspecified` bucket for pre-location inventory; nested-container
      cases from the gate list pass.
- [ ] Idempotent: running twice emits identical event ids.
- [ ] Zero fabricated attributes (spot-audit 20 random items against source lines).

## Compliance stamp
Personal data (owner's belongings) — stays in-repo/private; no external calls;
no AI in this path (deterministic only — the AI rail is M2).

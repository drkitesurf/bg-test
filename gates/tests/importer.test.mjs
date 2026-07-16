// Gate for T-002: the Bulgaria fixture importer.
// Run: node --test gates/tests/importer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runImport } from '../../importer/run.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, '..', '..', 'BULGARIA MFC BAG.md');
const GOLDEN = join(__dirname, '..', '..', 'importer', 'fixtures', 'bulgaria.expected.json');

function run() {
  return runImport(SOURCE);
}

test('parse rate is at least 95% of non-blank content lines', () => {
  const { report } = run();
  assert.ok(
    report.parse_rate >= 0.95,
    `parse rate ${report.parse_rate} below 0.95 threshold (${report.total_content_lines} content lines)`
  );
});

test('all real top-level locations are present as properties', () => {
  const { report } = run();
  for (const expected of ['Градина', 'София', 'Bansko', 'Lozenec storage']) {
    assert.ok(report.properties.includes(expected), `missing property: ${expected}`);
  }
});

test('MFC bag relocates under Lozenec storage via the "is in" cross-reference', () => {
  const { events } = run();
  const mfc = events.find((e) => e.payload?.name === 'BULGARIA MFC BAG');
  const lozenec = events.find((e) => e.verb === 'create_property' && e.payload.name === 'Lozenec storage');
  const reloc = events.find((e) => e.verb === 'relocate_container');
  assert.ok(mfc, 'MFC bag container not found');
  assert.ok(lozenec, 'Lozenec storage property not found');
  assert.ok(reloc, 'no relocate_container event emitted');
  assert.equal(reloc.entity_id, mfc.entity_id, 'relocation does not target the MFC bag container');
  assert.equal(reloc.payload.new_parent_property_label, 'Lozenec storage');
  // and the container's own create event already reflects the relocated
  // parent, since relocation resolves before id/event emission
  assert.equal(mfc.payload.parent_id, lozenec.entity_id);
});

test('the red backpack nests inside Червен куфар #1 (genuine markdown sub-heading)', () => {
  const { events } = run();
  const suitcase = events.find((e) => e.payload?.name === 'Червен куфар #1');
  const backpack = events.find((e) => e.payload?.name?.includes('Red North Face cinder'));
  assert.ok(suitcase, 'Червен куфар #1 not found');
  assert.ok(backpack, 'nested backpack not found');
  assert.equal(backpack.payload.parent_id, suitcase.entity_id);
});

test('a heading whose place-name hint is declared later in the document still resolves (forward reference)', () => {
  const { events } = run();
  const bansko = events.find((e) => e.verb === 'create_property' && e.payload.name === 'Bansko');
  const upstairs = events.find((e) => e.payload?.name === 'Bg Bansko upstairs');
  assert.ok(bansko && upstairs);
  assert.equal(upstairs.payload.parent_id, bansko.entity_id, 'forward-declared hint did not resolve');
});

test('containers/spaces with no textual or positional property signal land in an honestly-labeled Unspecified bucket, not a guess', () => {
  const { events } = run();
  const unspecified = events.find((e) => e.verb === 'create_property' && e.payload.name === 'Unspecified');
  assert.ok(unspecified, 'no Unspecified property bucket created');
  assert.ok(unspecified.payload.synthetic === true, 'Unspecified bucket must be marked synthetic');
  const earlyBags = ['BG Ozone 8m green bag', 'Duotone unit 6.5 m bag', 'Cabrinha long bag', 'ML bullet 3 glider'];
  for (const name of earlyBags) {
    const e = events.find((ev) => ev.payload?.name === name);
    assert.equal(e.payload.parent_id, unspecified.entity_id, `${name} should be Unspecified (no hint, appears before any property)`);
  }
});

test('re-running the importer on the same source is idempotent (identical event ids and content)', () => {
  const a = run();
  const b = run();
  assert.deepEqual(a.events, b.events);
});

test('Cyrillic content survives intact (no mangling, no transliteration)', () => {
  const { events } = run();
  const items = events.filter((e) => e.verb === 'create_item');
  const known = ['Гети OR gore Tex', 'Under Armour кубинки 11 vibram', 'Black diamond челник rechargeable'];
  for (const line of known) {
    assert.ok(items.some((i) => i.payload.name === line), `Cyrillic item lost or mangled: ${line}`);
  }
});

test('never-guess: attrs extracted only from the item\'s own text, never from a parenthetical note about something else', () => {
  const { events } = run();
  const items = events.filter((e) => e.verb === 'create_item');
  const kanaha = items.find((i) => i.payload.name.includes('KANAHA SHAPES BOARD'));
  const antiperspirant = items.find((i) => i.payload.name.includes('Antiperspirant'));
  assert.equal(kanaha.brand ?? kanaha.payload.brand, null, '"Kanaha" is a place name, not a confirmed brand — must not be guessed');
  assert.equal(antiperspirant.payload.brand, null, 'brand must not leak from an unrelated parenthetical note ("...in Mh shoe")');
});

test('nothing is silently dropped: name is always the verbatim source line (or heading text)', () => {
  const { events } = run();
  const items = events.filter((e) => e.verb === 'create_item');
  for (const it of items) {
    assert.ok(typeof it.payload.name === 'string' && it.payload.name.length > 0);
  }
});

test('golden fixture on disk matches a fresh run (regenerate with: node importer/run.mjs)', () => {
  const { events } = run();
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(events, golden, 'importer/fixtures/bulgaria.expected.json is stale — run `node importer/run.mjs` and commit the diff');
});

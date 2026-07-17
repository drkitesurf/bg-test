import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { EventEnvelope } from '../../app/src/lib/types.ts';
import { entityTypeForVerb, projectEvents } from '../src/db/project';

const fixturePath = resolve(import.meta.dirname, '../../importer/fixtures/bulgaria.expected.json');

function sql(value: unknown): string {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function loadFixture(): EventEnvelope[] {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as EventEnvelope[];
}

export function buildSeedSql(events: readonly EventEnvelope[]): string {
  const projection = projectEvents(events);
  const lines = [
    "INSERT OR IGNORE INTO kv(key,value_json) VALUES('seed:bulgaria:pending','true');"
  ];
  for (const event of events) {
    lines.push(
      `INSERT INTO events(actor,entity_type,entity_id,verb,payload_json) ` +
        `SELECT 'fixture-import',${sql(entityTypeForVerb(event.verb))},${sql(event.entity_id)},${sql(event.verb)},${sql(JSON.stringify(event.payload))} ` +
        `WHERE NOT EXISTS (SELECT 1 FROM kv WHERE key='seed:bulgaria:complete');`
    );
  }
  lines.push('DELETE FROM items;', 'DELETE FROM containers;', 'DELETE FROM spaces;', 'DELETE FROM properties;');
  for (const row of projection.properties.values()) {
    lines.push(
      `INSERT INTO properties(id,name,synthetic,payload_json) VALUES(${sql(row.id)},${sql(row.name)},${row.synthetic ?? 0},${sql(row.payload_json)});`
    );
  }
  for (const [table, rows] of [
    ['spaces', projection.spaces],
    ['containers', projection.containers],
    ['items', projection.items]
  ] as const) {
    for (const row of rows.values()) {
      lines.push(
        `INSERT INTO ${table}(id,parent_id,name,payload_json) VALUES(${sql(row.id)},${sql(row.parent_id)},${sql(row.name)},${sql(row.payload_json)});`
      );
    }
  }
  lines.push(
    "INSERT OR REPLACE INTO kv(key,value_json) VALUES('seed:bulgaria:complete','true');",
    "DELETE FROM kv WHERE key='seed:bulgaria:pending';",
    "SELECT (SELECT count(*) FROM events) AS events, (SELECT count(*) FROM properties) AS properties, (SELECT count(*) FROM spaces) AS spaces, (SELECT count(*) FROM containers) AS containers, (SELECT count(*) FROM items) AS items;"
  );
  return lines.join('\n');
}

function runWrangler(args: string[]) {
  const result = spawnSync('npx', ['wrangler', ...args], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    stdio: 'inherit'
  });
  if (result.status !== 0) throw new Error(`wrangler ${args.join(' ')} failed with exit code ${result.status}`);
}

function main() {
  const events = loadFixture();
  const counts = events.reduce<Record<string, number>>((result, event) => {
    result[event.verb] = (result[event.verb] ?? 0) + 1;
    return result;
  }, {});
  if (
    events.length !== 489 ||
    counts.create_item !== 453 ||
    counts.create_property !== 5
  ) {
    throw new Error('Fixture counts changed: expected 489 events, 453 items, and 5 properties');
  }

  const directory = mkdtempSync(join(tmpdir(), 'stowaway-seed-'));
  const seedFile = join(directory, 'bulgaria.sql');
  writeFileSync(seedFile, buildSeedSql(events));
  try {
    runWrangler(['d1', 'execute', 'stowaway', '--local', '--file', 'src/db/schema.sql']);
    runWrangler(['d1', 'execute', 'stowaway', '--local', '--file', seedFile]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log('Seeded local D1: 489 events → 5 properties, 7 spaces, 23 containers, 453 items.');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();

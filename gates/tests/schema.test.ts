import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, test } from 'vitest';
import { projectEvents } from '../../worker/src/db/project';
import { buildSeedSql, loadFixture } from '../../worker/seed/seed_bulgaria';

const schema = readFileSync(fileURLToPath(new URL('../../worker/src/db/schema.sql', import.meta.url)), 'utf8');
const fixtureText = readFileSync(
  fileURLToPath(new URL('../../importer/fixtures/bulgaria.expected.json', import.meta.url)),
  'utf8'
);

describe('D1 event schema and projections', () => {
  test('event log is protected by update and delete triggers', () => {
    expect(schema).toContain('CREATE TRIGGER IF NOT EXISTS events_no_update');
    expect(schema).toContain('CREATE TRIGGER IF NOT EXISTS events_no_delete');
    expect(schema).toContain("RAISE(ABORT, 'events are append-only')");
  });

  test('the importer fixture executes against the schema unchanged', () => {
    const events = loadFixture();
    expect(JSON.stringify(events, null, 2) + '\n').toBe(fixtureText);

    const database = new DatabaseSync(':memory:');
    database.exec(schema);
    database.exec(buildSeedSql(events));
    expect(() => database.exec("UPDATE events SET actor='tampered' WHERE id=1")).toThrow(
      /events are append-only/
    );
    expect(() => database.exec('DELETE FROM events WHERE id=1')).toThrow(/events are append-only/);
    database.exec(buildSeedSql(events));
    const counts = database
      .prepare(
        `SELECT
          (SELECT count(*) FROM events) events,
          (SELECT count(*) FROM properties) properties,
          (SELECT count(*) FROM spaces) spaces,
          (SELECT count(*) FROM containers) containers,
          (SELECT count(*) FROM items) items`
      )
      .get() as Record<string, number>;
    expect(counts).toEqual({ events: 489, properties: 5, spaces: 7, containers: 23, items: 453 });
    expect(
      database.prepare("SELECT count(*) count FROM properties WHERE name='Unspecified' AND synthetic=1").get()
    ).toEqual({ count: 1 });
    database.close();
  });

  test('projection rebuild is deterministic and idempotent', () => {
    const events = loadFixture();
    const first = projectEvents(events);
    const second = projectEvents(events);
    const snapshot = (state: ReturnType<typeof projectEvents>) =>
      Object.fromEntries(Object.entries(state).map(([key, rows]) => [key, [...rows.entries()]]));
    expect(snapshot(second)).toEqual(snapshot(first));
    expect(first.properties.size).toBe(5);
    expect(first.items.size).toBe(453);
  });
});

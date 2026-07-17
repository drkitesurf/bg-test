import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, test } from 'vitest';
import { buildSeedSql, loadFixture } from '../../worker/seed/seed_bulgaria';

const schema = readFileSync(fileURLToPath(new URL('../../worker/src/db/schema.sql', import.meta.url)), 'utf8');

function seededDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(schema);
  database.exec(buildSeedSql(loadFixture()));
  return database;
}

describe('T-004 inventory drill-down fixture contract', () => {
  test('Bulgaria projections retain the canonical acceptance counts', () => {
    const database = seededDatabase();
    const counts = database
      .prepare(
        `SELECT
          (SELECT count(*) FROM properties) properties,
          (SELECT count(*) FROM spaces) spaces,
          (SELECT count(*) FROM containers) containers,
          (SELECT count(*) FROM items) items`
      )
      .get();
    expect(counts).toEqual({ properties: 5, spaces: 7, containers: 23, items: 453 });
    expect(
      database.prepare("SELECT name,synthetic FROM properties ORDER BY synthetic,name COLLATE NOCASE,id").all()
    ).toEqual([
      { name: 'Bansko', synthetic: 0 },
      { name: 'Lozenec storage', synthetic: 0 },
      { name: 'Градина', synthetic: 0 },
      { name: 'София', synthetic: 0 },
      { name: 'Unspecified', synthetic: 1 }
    ]);
    database.close();
  });

  test('parent-id traversal supports mixed children in deterministic order', () => {
    const database = seededDatabase();
    const parent = database
      .prepare(
        `SELECT parent_id
         FROM (
           SELECT parent_id,'space' type FROM spaces
           UNION ALL SELECT parent_id,'container' type FROM containers
           UNION ALL SELECT parent_id,'item' type FROM items
         )
         GROUP BY parent_id
         HAVING count(DISTINCT type) > 1
         ORDER BY parent_id
         LIMIT 1`
      )
      .get() as { parent_id: string };

    const query = database.prepare(
      `SELECT id,type,name FROM (
        SELECT id,'space' type,name,parent_id FROM spaces
        UNION ALL SELECT id,'container' type,name,parent_id FROM containers
        UNION ALL SELECT id,'item' type,name,parent_id FROM items
       ) WHERE parent_id=?
       ORDER BY CASE type WHEN 'space' THEN 1 WHEN 'container' THEN 2 ELSE 3 END,
         name COLLATE NOCASE,id`
    );
    const first = query.all(parent.parent_id);
    const second = query.all(parent.parent_id);
    expect(second).toEqual(first);
    expect(new Set(first.map((row) => row.type)).size).toBeGreaterThan(1);
    database.close();
  });

  test('item detail is sourced verbatim from payload_json', () => {
    const database = seededDatabase();
    const row = database
      .prepare(
        `SELECT name,payload_json FROM items
         WHERE json_extract(payload_json,'$.quantity') IS NOT NULL
         ORDER BY name COLLATE NOCASE,id LIMIT 1`
      )
      .get() as { name: string; payload_json: string };
    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    expect(payload.name).toBe(row.name);
    expect(payload.quantity).toBeTruthy();
    database.close();
  });
});

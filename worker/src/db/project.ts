import type { EventEnvelope } from '../../../app/src/lib/types.ts';

type ProjectionRow = {
  id: string;
  parent_id?: string;
  name: string;
  payload_json: string;
  synthetic?: number;
};

export type ProjectionState = {
  properties: Map<string, ProjectionRow>;
  spaces: Map<string, ProjectionRow>;
  containers: Map<string, ProjectionRow>;
  items: Map<string, ProjectionRow>;
};

export type StoredEvent = EventEnvelope & { id?: number; actor?: string; ts?: string };

export function emptyProjection(): ProjectionState {
  return {
    properties: new Map(),
    spaces: new Map(),
    containers: new Map(),
    items: new Map()
  };
}

function payloadOf(event: EventEnvelope) {
  return event.payload as Record<string, unknown>;
}

function rowFor(event: EventEnvelope): ProjectionRow {
  const payload = payloadOf(event);
  if (typeof payload.name !== 'string' || payload.name.length === 0) {
    throw new Error(`${event.verb} requires payload.name`);
  }
  const parent = payload.parent_id;
  if (event.verb !== 'create_property' && typeof parent !== 'string') {
    throw new Error(`${event.verb} requires payload.parent_id`);
  }
  return {
    id: event.entity_id,
    ...(typeof parent === 'string' ? { parent_id: parent } : {}),
    name: payload.name,
    payload_json: JSON.stringify(event.payload),
    synthetic: payload.synthetic === true ? 1 : 0
  };
}

export function projectEvents(events: readonly EventEnvelope[]): ProjectionState {
  const state = emptyProjection();
  for (const event of events) {
    switch (event.verb) {
      case 'create_property':
        state.properties.set(event.entity_id, rowFor(event));
        break;
      case 'create_space':
        state.spaces.set(event.entity_id, rowFor(event));
        break;
      case 'create_container':
        state.containers.set(event.entity_id, rowFor(event));
        break;
      case 'create_item':
        state.items.set(event.entity_id, rowFor(event));
        break;
      case 'relocate_container': {
        const row = state.containers.get(event.entity_id);
        const label = payloadOf(event).new_parent_property_label;
        if (!row || typeof label !== 'string') break;
        const parent = [...state.properties.values()].find((property) => property.name === label);
        if (parent) state.containers.set(event.entity_id, { ...row, parent_id: parent.id });
        break;
      }
      default:
        throw new Error(`Unsupported event verb: ${event.verb}`);
    }
  }
  return state;
}

export function entityTypeForVerb(verb: string): string {
  const match = verb.match(/(?:create|relocate)_(property|space|container|item)$/);
  if (!match) throw new Error(`Unsupported event verb: ${verb}`);
  return match[1];
}

function insertProjectionStatement(db: D1Database, table: string, row: ProjectionRow): D1PreparedStatement {
  if (table === 'properties') {
    return db
      .prepare('INSERT OR REPLACE INTO properties(id,name,synthetic,payload_json) VALUES(?,?,?,?)')
      .bind(row.id, row.name, row.synthetic ?? 0, row.payload_json);
  }
  return db
    .prepare(`INSERT OR REPLACE INTO ${table}(id,parent_id,name,payload_json) VALUES(?,?,?,?)`)
    .bind(row.id, row.parent_id, row.name, row.payload_json);
}

export async function applyEventProjection(db: D1Database, event: EventEnvelope): Promise<void> {
  if (event.verb === 'relocate_container') {
    const label = payloadOf(event).new_parent_property_label;
    if (typeof label === 'string') {
      await db
        .prepare('UPDATE containers SET parent_id=(SELECT id FROM properties WHERE name=? LIMIT 1) WHERE id=?')
        .bind(label, event.entity_id)
        .run();
    }
    return;
  }
  const type = entityTypeForVerb(event.verb);
  const table = type === 'property' ? 'properties' : `${type}s`;
  await insertProjectionStatement(db, table, rowFor(event)).run();
}

export async function rebuildProjections(db: D1Database): Promise<ProjectionState> {
  const result = await db
    .prepare('SELECT id, actor, ts, entity_id, verb, payload_json FROM events ORDER BY id')
    .all<{ id: number; actor: string; ts: string; entity_id: string; verb: string; payload_json: string }>();
  const events = result.results.map((row) => ({
    id: row.id,
    actor: row.actor,
    ts: row.ts,
    verb: row.verb,
    entity_id: row.entity_id,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>
  }));
  const state = projectEvents(events);
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM items'),
    db.prepare('DELETE FROM containers'),
    db.prepare('DELETE FROM spaces'),
    db.prepare('DELETE FROM properties')
  ];
  for (const [table, rows] of Object.entries(state)) {
    for (const row of rows.values()) statements.push(insertProjectionStatement(db, table, row));
  }
  await db.batch(statements);
  return state;
}

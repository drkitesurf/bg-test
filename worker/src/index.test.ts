import { describe, expect, test } from 'vitest';
import { createApp, type Bindings } from './index';

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly calls: string[],
    private readonly rows: Array<{
      id: string;
      type: 'property' | 'space' | 'container' | 'item';
      name: string;
      parent_id: string | null;
      payload_json: string;
      synthetic: number;
      child_count: number;
    }>
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async run() {
    this.calls.push(this.sql);
    return { success: true, meta: { last_row_id: 1 } };
  }

  async all<T>() {
    if (this.sql.includes("WHERE type = 'property'")) {
      const properties = this.rows
        .filter((row) => row.type === 'property')
        .sort((left, right) => left.synthetic - right.synthetic || left.name.localeCompare(right.name));
      return { success: true, results: properties as T[], meta: {} };
    }
    if (this.sql.includes('WHERE parent_id = ?')) {
      const parentId = String(this.values[0]);
      const order = { space: 1, container: 2, item: 3, property: 0 };
      const children = this.rows
        .filter((row) => row.parent_id === parentId)
        .sort((left, right) => order[left.type] - order[right.type] || left.name.localeCompare(right.name));
      return { success: true, results: children as T[], meta: {} };
    }
    return { success: true, results: [] as T[], meta: {} };
  }

  async first<T>() {
    if (this.sql.includes('AS properties')) {
      return {
        properties: this.rows.filter((row) => row.type === 'property').length,
        spaces: this.rows.filter((row) => row.type === 'space').length,
        containers: this.rows.filter((row) => row.type === 'container').length,
        items: this.rows.filter((row) => row.type === 'item').length
      } as T;
    }
    if (this.sql.includes('WHERE id = ?')) {
      return (this.rows.find((row) => row.id === String(this.values[0])) ?? null) as T | null;
    }
    return null;
  }
}

function environment(overrides: Partial<Bindings> = {}) {
  const calls: string[] = [];
  const rows = [
    {
      id: 'property_bansko',
      type: 'property' as const,
      name: 'Bansko',
      parent_id: null,
      payload_json: JSON.stringify({ name: 'Bansko' }),
      synthetic: 0,
      child_count: 2
    },
    {
      id: 'property_unspecified',
      type: 'property' as const,
      name: 'Unspecified',
      parent_id: null,
      payload_json: JSON.stringify({ name: 'Unspecified', synthetic: true }),
      synthetic: 1,
      child_count: 0
    },
    {
      id: 'space_upstairs',
      type: 'space' as const,
      name: 'Upstairs',
      parent_id: 'property_bansko',
      payload_json: JSON.stringify({ name: 'Upstairs', parent_id: 'property_bansko' }),
      synthetic: 0,
      child_count: 0
    },
    {
      id: 'item_pump',
      type: 'item' as const,
      name: 'Помпа',
      parent_id: 'property_bansko',
      payload_json: JSON.stringify({ name: 'Помпа', parent_id: 'property_bansko', quantity: 1 }),
      synthetic: 0,
      child_count: 0
    }
  ];
  const DB = {
    prepare(sql: string) {
      return new FakeStatement(sql, calls, rows);
    }
  } as unknown as D1Database;
  return {
    env: {
      DB,
      PHOTOS: {} as R2Bucket,
      JWT_SECRET: 'test-only-secret',
      AUTH_PASSWORD: 'test-only-password',
      ...overrides
    } satisfies Bindings,
    calls
  };
}

async function bearer(env: Bindings) {
  const response = await createApp().request(
    '/api/auth/token',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'test-only-password' })
    },
    env
  );
  return ((await response.json()) as { token: string }).token;
}

describe('typed Worker API', () => {
  test('health is public and typed', async () => {
    const { env } = environment();
    const response = await createApp().request('/api/health', {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test('authentication fails closed when secrets are unset', async () => {
    const { env } = environment({ JWT_SECRET: undefined, AUTH_PASSWORD: undefined });
    const tokenResponse = await createApp().request(
      '/api/auth/token',
      { method: 'POST', body: JSON.stringify({ password: 'anything' }) },
      env
    );
    expect(tokenResponse.status).toBe(503);

    const eventsResponse = await createApp().request('/api/events', {}, env);
    expect(eventsResponse.status).toBe(503);
  });

  test('bad credentials and missing bearer authorization return 401', async () => {
    const { env } = environment();
    const tokenResponse = await createApp().request(
      '/api/auth/token',
      { method: 'POST', body: JSON.stringify({ password: 'wrong' }) },
      env
    );
    expect(tokenResponse.status).toBe(401);
    expect((await createApp().request('/api/events', {}, env)).status).toBe(401);
    expect((await createApp().request('/api/inventory/properties', {}, env)).status).toBe(401);
  });

  test('inventory routes fail closed when auth configuration is unset', async () => {
    const { env } = environment({ JWT_SECRET: undefined, AUTH_PASSWORD: undefined });
    expect((await createApp().request('/api/inventory/properties', {}, env)).status).toBe(503);
  });

  test('inventory properties and summary are authenticated and deterministic', async () => {
    const { env } = environment();
    const token = await bearer(env);
    const headers = { authorization: `Bearer ${token}` };
    const propertiesResponse = await createApp().request('/api/inventory/properties', { headers }, env);
    expect(propertiesResponse.status).toBe(200);
    expect(await propertiesResponse.json()).toEqual({
      properties: [
        { id: 'property_bansko', type: 'property', name: 'Bansko', child_count: 2 },
        {
          id: 'property_unspecified',
          type: 'property',
          name: 'Unspecified',
          child_count: 0,
          synthetic: true
        }
      ]
    });
    const summaryResponse = await createApp().request('/api/inventory/summary', { headers }, env);
    expect(await summaryResponse.json()).toEqual({ properties: 2, spaces: 1, containers: 0, items: 1 });
  });

  test('inventory children support mixed types and item detail preserves payload', async () => {
    const { env } = environment();
    const token = await bearer(env);
    const headers = { authorization: `Bearer ${token}` };
    const childrenResponse = await createApp().request(
      '/api/inventory/nodes/property_bansko/children',
      { headers },
      env
    );
    expect(childrenResponse.status).toBe(200);
    expect((await childrenResponse.json()) as { children: unknown[] }).toMatchObject({
      children: [
        { id: 'space_upstairs', type: 'space', name: 'Upstairs' },
        { id: 'item_pump', type: 'item', name: 'Помпа' }
      ]
    });

    const itemResponse = await createApp().request('/api/inventory/nodes/item_pump', { headers }, env);
    expect(await itemResponse.json()).toMatchObject({
      id: 'item_pump',
      type: 'item',
      name: 'Помпа',
      payload: { quantity: 1 }
    });
    expect(
      (await createApp().request('/api/inventory/nodes/unknown', { headers }, env)).status
    ).toBe(404);
  });

  test('a valid HS256 token appends and projects an unchanged event envelope', async () => {
    const { env, calls } = environment();
    const token = await bearer(env);
    const event = {
      verb: 'create_item',
      entity_id: 'item_test',
      payload: { name: 'Test item', parent_id: 'container_test' }
    };
    const response = await createApp().request(
      '/api/events',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(event)
      },
      env
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, appended: 1 });
    expect(calls.some((sql) => sql.startsWith('INSERT INTO events'))).toBe(true);
    expect(calls.some((sql) => sql.startsWith('INSERT OR REPLACE INTO items'))).toBe(true);
  });
});

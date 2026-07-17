import { describe, expect, test } from 'vitest';
import { createApp, type Bindings } from './index';

class FakeStatement {
  constructor(
    private readonly sql: string,
    private readonly calls: string[]
  ) {}

  bind(...values: unknown[]) {
    void values;
    return this;
  }

  async run() {
    this.calls.push(this.sql);
    return { success: true, meta: { last_row_id: 1 } };
  }

  async all<T>() {
    return { success: true, results: [] as T[], meta: {} };
  }
}

function environment(overrides: Partial<Bindings> = {}) {
  const calls: string[] = [];
  const DB = {
    prepare(sql: string) {
      return new FakeStatement(sql, calls);
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
  });

  test('a valid HS256 token appends and projects an unchanged event envelope', async () => {
    const { env, calls } = environment();
    const tokenResponse = await createApp().request(
      '/api/auth/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'test-only-password' })
      },
      env
    );
    const { token } = (await tokenResponse.json()) as { token: string };
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

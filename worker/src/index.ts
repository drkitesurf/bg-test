import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { EventEnvelope } from '../../app/src/lib/types.ts';
import { AuthUnavailableError, issueToken, UnauthorizedError, verifyBearer } from './auth';
import { applyEventProjection, entityTypeForVerb } from './db/project';
import { getNode, inventorySummary, listChildren, listProperties } from './inventory';

export type Bindings = {
  DB: D1Database;
  PHOTOS: R2Bucket;
  JWT_SECRET?: string;
  AUTH_PASSWORD?: string;
};

type Variables = {
  actor: string;
};

function isEventEnvelope(value: unknown): value is EventEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.verb === 'string' &&
    typeof candidate.entity_id === 'string' &&
    !!candidate.payload &&
    typeof candidate.payload === 'object' &&
    !Array.isArray(candidate.payload)
  );
}

export function createApp() {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
  const requireAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (context, next) => {
    try {
      const actor = await verifyBearer(context.env, context.req.header('Authorization'));
      context.set('actor', actor);
      await next();
    } catch (error) {
      if (error instanceof AuthUnavailableError) {
        return context.json({ error: 'auth_unavailable' }, 503);
      }
      if (error instanceof UnauthorizedError) return context.json({ error: 'unauthorized' }, 401);
      throw error;
    }
  });

  app.get('/api/health', (context) => context.json({ ok: true as const }));

  app.get('/api/auth/status', (context) =>
    context.json({ configured: Boolean(context.env.JWT_SECRET && context.env.AUTH_PASSWORD) })
  );

  app.post('/api/auth/token', async (context) => {
    let body: { password?: string };
    try {
      body = await context.req.json<{ password?: string }>();
    } catch {
      return context.json({ error: 'invalid_json' }, 400);
    }
    try {
      const token = await issueToken(context.env, body.password ?? '');
      return context.json({ token, token_type: 'Bearer' as const, expires_in: 43_200 });
    } catch (error) {
      if (error instanceof AuthUnavailableError) return context.json({ error: 'auth_unavailable' }, 503);
      return context.json({ error: 'invalid_credentials' }, 401);
    }
  });

  app.use('/api/events', requireAuth);
  app.use('/api/inventory/*', requireAuth);

  app.get('/api/inventory/properties', async (context) =>
    context.json({ properties: await listProperties(context.env.DB) })
  );

  app.get('/api/inventory/summary', async (context) =>
    context.json(await inventorySummary(context.env.DB))
  );

  app.get('/api/inventory/nodes/:id', async (context) => {
    const node = await getNode(context.env.DB, context.req.param('id'));
    return node ? context.json(node) : context.json({ error: 'not_found' }, 404);
  });

  app.get('/api/inventory/nodes/:id/children', async (context) => {
    const id = context.req.param('id');
    const parent = await getNode(context.env.DB, id);
    if (!parent) return context.json({ error: 'not_found' }, 404);
    return context.json({
      parent,
      children: parent.type === 'item' ? [] : await listChildren(context.env.DB, id)
    });
  });

  app.get('/api/events', async (context) => {
    const rows = await context.env.DB.prepare(
      'SELECT id,ts,actor,entity_type,entity_id,verb,payload_json FROM events ORDER BY id'
    ).all<{
      id: number;
      ts: string;
      actor: string;
      entity_type: string;
      entity_id: string;
      verb: string;
      payload_json: string;
    }>();
    return context.json({
      events: rows.results.map((row) => ({
        id: row.id,
        ts: row.ts,
        actor: row.actor,
        entity_type: row.entity_type,
        verb: row.verb,
        entity_id: row.entity_id,
        payload: JSON.parse(row.payload_json) as Record<string, unknown>
      }))
    });
  });

  app.post('/api/events', async (context) => {
    let input: unknown;
    try {
      input = await context.req.json<unknown>();
    } catch {
      return context.json({ error: 'invalid_json' }, 400);
    }
    const events = Array.isArray(input) ? input : [input];
    if (!events.length || !events.every(isEventEnvelope)) {
      return context.json({ error: 'invalid_event_envelope' }, 400);
    }
    try {
      for (const event of events) entityTypeForVerb(event.verb);
    } catch {
      return context.json({ error: 'unsupported_event_verb' }, 400);
    }

    const actor = context.get('actor');
    const ids: number[] = [];
    for (const event of events) {
      const result = await context.env.DB.prepare(
        'INSERT INTO events(actor,entity_type,entity_id,verb,payload_json) VALUES(?,?,?,?,?)'
      )
        .bind(actor, entityTypeForVerb(event.verb), event.entity_id, event.verb, JSON.stringify(event.payload))
        .run();
      ids.push(Number(result.meta.last_row_id));
      await applyEventProjection(context.env.DB, event);
    }
    return context.json({ ok: true as const, appended: events.length, ids }, 201);
  });

  app.notFound((context) => context.json({ error: 'not_found' }, 404));
  return app;
}

export default createApp();

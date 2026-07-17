import type {
  InventoryNode,
  InventoryNodeSummary,
  InventorySummary
} from './types';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new ApiError(response.status, body.error ?? 'request_failed');
  return body;
}

export async function login(password: string): Promise<string> {
  const response = await fetch(`${apiBase}/api/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const body = await readJson<{ token: string }>(response);
  return body.token;
}

async function authorized<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  return readJson<T>(response);
}

export function getProperties(token: string) {
  return authorized<{ properties: InventoryNodeSummary[] }>('/api/inventory/properties', token);
}

export function getNode(token: string, id: string) {
  return authorized<InventoryNode>(`/api/inventory/nodes/${encodeURIComponent(id)}`, token);
}

export function getChildren(token: string, id: string) {
  return authorized<{ parent: InventoryNode; children: InventoryNodeSummary[] }>(
    `/api/inventory/nodes/${encodeURIComponent(id)}/children`,
    token
  );
}

export function getInventorySummary(token: string) {
  return authorized<InventorySummary>('/api/inventory/summary', token);
}

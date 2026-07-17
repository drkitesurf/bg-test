export type InventoryNodeType = 'property' | 'space' | 'container' | 'item';

type NodeRow = {
  id: string;
  type: InventoryNodeType;
  name: string;
  parent_id: string | null;
  payload_json: string;
  child_count: number;
  synthetic: number;
};

export type InventoryNode = {
  id: string;
  type: InventoryNodeType;
  name: string;
  parent_id: string | null;
  payload: Record<string, unknown>;
  child_count: number;
  synthetic?: boolean;
};

export type InventoryNodeSummary = Pick<InventoryNode, 'id' | 'type' | 'name' | 'child_count'> & {
  synthetic?: boolean;
};

const nodeSelect = `
  SELECT id, type, name, parent_id, payload_json, synthetic,
    (
      SELECT count(*) FROM spaces WHERE spaces.parent_id = nodes.id
    ) + (
      SELECT count(*) FROM containers WHERE containers.parent_id = nodes.id
    ) + (
      SELECT count(*) FROM items WHERE items.parent_id = nodes.id
    ) AS child_count
  FROM (
    SELECT id, 'property' AS type, name, NULL AS parent_id, payload_json, synthetic FROM properties
    UNION ALL
    SELECT id, 'space' AS type, name, parent_id, payload_json, 0 AS synthetic FROM spaces
    UNION ALL
    SELECT id, 'container' AS type, name, parent_id, payload_json, 0 AS synthetic FROM containers
    UNION ALL
    SELECT id, 'item' AS type, name, parent_id, payload_json, 0 AS synthetic FROM items
  ) AS nodes
`;

function decodeNode(row: NodeRow): InventoryNode {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    parent_id: row.parent_id,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    child_count: Number(row.child_count),
    ...(row.synthetic === 1 ? { synthetic: true } : {})
  };
}

export async function listProperties(db: D1Database): Promise<InventoryNodeSummary[]> {
  const result = await db
    .prepare(`${nodeSelect} WHERE type = 'property' ORDER BY synthetic ASC, name COLLATE NOCASE ASC, id ASC`)
    .all<NodeRow>();
  return result.results.map((row) => {
    const node = decodeNode(row);
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      child_count: node.child_count,
      ...(node.synthetic ? { synthetic: true } : {})
    };
  });
}

export async function getNode(db: D1Database, id: string): Promise<InventoryNode | null> {
  const row = await db.prepare(`${nodeSelect} WHERE id = ? LIMIT 1`).bind(id).first<NodeRow>();
  return row ? decodeNode(row) : null;
}

export async function listChildren(db: D1Database, parentId: string): Promise<InventoryNodeSummary[]> {
  const result = await db
    .prepare(
      `${nodeSelect}
       WHERE parent_id = ?
       ORDER BY CASE type WHEN 'space' THEN 1 WHEN 'container' THEN 2 ELSE 3 END,
         name COLLATE NOCASE ASC, id ASC`
    )
    .bind(parentId)
    .all<NodeRow>();
  return result.results.map((row) => {
    const node = decodeNode(row);
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      child_count: node.child_count
    };
  });
}

export async function inventorySummary(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT
        (SELECT count(*) FROM properties) AS properties,
        (SELECT count(*) FROM spaces) AS spaces,
        (SELECT count(*) FROM containers) AS containers,
        (SELECT count(*) FROM items) AS items`
    )
    .first<{ properties: number; spaces: number; containers: number; items: number }>();
  return {
    properties: Number(row?.properties ?? 0),
    spaces: Number(row?.spaces ?? 0),
    containers: Number(row?.containers ?? 0),
    items: Number(row?.items ?? 0)
  };
}

import { Box, Building2, ChevronRight, Package, Warehouse } from 'lucide-react';
import type { InventoryNodeSummary, InventoryNodeType } from '../lib/types';

const labels: Record<InventoryNodeType, string> = {
  property: 'Property',
  space: 'Space',
  container: 'Container',
  item: 'Item'
};

const icons = {
  property: Building2,
  space: Warehouse,
  container: Box,
  item: Package
} satisfies Record<InventoryNodeType, typeof Box>;

type Props = {
  nodes: InventoryNodeSummary[];
  onSelect: (node: InventoryNodeSummary) => void;
};

export function NodeList({ nodes, onSelect }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing is stored here yet.
      </div>
    );
  }

  return (
    <ul className="grid gap-3" aria-label="Inventory nodes">
      {nodes.map((node) => {
        const Icon = icons[node.type];
        return (
          <li key={node.id}>
            <button
              className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left text-card-foreground transition hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => onSelect(node)}
              type="button"
            >
              <span className="shrink-0 rounded-lg bg-secondary p-2 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">{node.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{labels[node.type]}</span>
                  {node.synthetic ? <span className="rounded-full bg-muted px-2 py-0.5">Synthetic</span> : null}
                  {node.type !== 'item' ? <span>{node.child_count} children</span> : null}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

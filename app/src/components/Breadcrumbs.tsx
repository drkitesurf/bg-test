import { ChevronRight, Home } from 'lucide-react';
import type { InventoryNodeSummary } from '../lib/types';

type Props = {
  path: InventoryNodeSummary[];
  onNavigate: (index: number) => void;
  onRoot: () => void;
};

export function Breadcrumbs({ path, onNavigate, onRoot }: Props) {
  return (
    <nav aria-label="Inventory breadcrumb" className="overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-1 text-sm">
        <li>
          <button
            aria-label="All properties"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={onRoot}
            type="button"
          >
            <Home aria-hidden="true" className="size-4" />
            Properties
          </button>
        </li>
        {path.map((node, index) => (
          <li className="flex items-center gap-1" key={node.id}>
            <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
            <button
              aria-current={index === path.length - 1 ? 'page' : undefined}
              className="min-h-11 max-w-52 truncate rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring aria-[current=page]:font-medium aria-[current=page]:text-foreground"
              onClick={() => onNavigate(index)}
              type="button"
            >
              {node.name}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

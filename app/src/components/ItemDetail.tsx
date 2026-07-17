import { Package } from 'lucide-react';
import type { InventoryNode } from '../lib/types';

const hiddenKeys = new Set(['name', 'parent_id']);

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(displayValue).join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function displayLabel(key: string): string {
  return key.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

export function ItemDetail({ item }: { item: InventoryNode }) {
  const fields = Object.entries(item.payload).filter(([key, value]) => !hiddenKeys.has(key) && isPresent(value));

  return (
    <article className="rounded-lg border border-border bg-card p-5 text-card-foreground sm:p-7">
      <span className="inline-flex rounded-lg bg-secondary p-3 text-primary">
        <Package aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">Item</p>
      <h2 className="mt-2 break-words text-2xl font-semibold">{item.name}</h2>
      {fields.length > 0 ? (
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {fields.map(([key, value]) => (
            <div className="min-w-0 border-t border-border pt-3" key={key}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {displayLabel(key)}
              </dt>
              <dd className="mt-1 break-words text-sm">{displayValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">No additional item details were recorded.</p>
      )}
    </article>
  );
}

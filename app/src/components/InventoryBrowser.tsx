import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, getChildren, getInventorySummary, getNode, getProperties } from '../lib/api';
import type { InventoryNode, InventoryNodeSummary, InventorySummary } from '../lib/types';
import { Breadcrumbs } from './Breadcrumbs';
import { ItemDetail } from './ItemDetail';
import { NodeList } from './NodeList';
import { Button } from './ui/button';

type Props = {
  token: string;
  onLogout: () => void;
};

export function InventoryBrowser({ token, onLogout }: Props) {
  const [nodes, setNodes] = useState<InventoryNodeSummary[]>([]);
  const [path, setPath] = useState<InventoryNodeSummary[]>([]);
  const [item, setItem] = useState<InventoryNode | null>(null);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  function handleError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      onLogout();
      return;
    }
    if (error instanceof ApiError && error.status === 503) {
      setMessage('Server authentication is not configured.');
    } else {
      setMessage('Unable to load this inventory location.');
    }
  }

  async function loadRoot() {
    setLoading(true);
    setMessage(null);
    setPath([]);
    setItem(null);
    try {
      const [properties, totals] = await Promise.all([getProperties(token), getInventorySummary(token)]);
      setNodes(properties.properties);
      setSummary(totals);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSelection(node: InventoryNodeSummary, nextPath: InventoryNodeSummary[]) {
    setLoading(true);
    setMessage(null);
    setPath(nextPath);
    try {
      if (node.type === 'item') {
        setItem(await getNode(token, node.id));
        setNodes([]);
      } else {
        const response = await getChildren(token, node.id);
        setItem(null);
        setNodes(response.children);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoot();
  }, [token]);

  const heading = path.length > 0 ? path[path.length - 1].name : 'Properties';

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Inventory</p>
          <h2 className="mt-1 break-words text-3xl font-semibold">{heading}</h2>
          {summary ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.properties} properties · {summary.spaces} spaces · {summary.containers} containers ·{' '}
              {summary.items} items
            </p>
          ) : null}
        </div>
        <Button className="min-h-11" onClick={onLogout} variant="ghost">
          <LogOut aria-hidden="true" className="mr-2 size-4" />
          Log out
        </Button>
      </div>

      <Breadcrumbs
        onNavigate={(index) => {
          const node = path[index];
          void loadSelection(node, path.slice(0, index + 1));
        }}
        onRoot={() => void loadRoot()}
        path={path}
      />

      {message ? (
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground" role="alert">
          {message}
        </div>
      ) : null}
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading inventory…</p> : null}
      {!loading && !message && item ? <ItemDetail item={item} /> : null}
      {!loading && !message && !item ? (
        <NodeList
          nodes={nodes}
          onSelect={(node) => void loadSelection(node, [...path, node])}
        />
      ) : null}
    </section>
  );
}

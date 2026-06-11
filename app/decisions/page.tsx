"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EntityForm, FieldConfig } from "@/components/modules/entity-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTable } from "@/lib/db";
import { formatDate, todayIso } from "@/lib/utils";
import { decisionSchema } from "@/lib/validation";
import { Decision } from "@/types";

export default function DecisionsPage() {
  const api = useTable("decisions");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Decision | null>(null);
  const [adding, setAdding] = useState(false);
  const fields: FieldConfig[] = [
    { name: "date", label: "Date", type: "date" },
    { name: "title", label: "Title" },
    { name: "context", label: "Context", type: "textarea" },
    { name: "decision", label: "Decision", type: "textarea" },
    { name: "alternatives", label: "Alternatives", type: "textarea" },
    { name: "owner", label: "Owner" },
  ];

  const decisions = useMemo(
    () =>
      api.rows
        .filter((item) => `${item.title} ${item.context} ${item.decision}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [api.rows, query],
  );

  async function save(values: Record<string, unknown>) {
    const parsed = decisionSchema.parse(values);
    if (editing) await api.update(editing.id, parsed);
    else await api.create(parsed);
    toast.success(editing ? "Decision updated" : "Decision added");
    setEditing(null);
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">Decision log</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Decisions</h1>
          <p className="text-muted-foreground">Chronological record of important operating choices and tradeoffs.</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add decision</Button>
      </div>
      <Input placeholder="Search decisions..." value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="grid gap-4">
        {decisions.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone="muted">{formatDate(item.date)}</Badge>
                    <Badge tone="accent">{item.owner}</Badge>
                  </div>
                  <button className="text-left text-xl font-semibold" onClick={() => setEditing(item)}>{item.title}</button>
                  <p className="mt-2 text-sm text-muted-foreground"><b>Context:</b> {item.context}</p>
                  <p className="mt-2 text-sm"><b>Decision:</b> {item.decision}</p>
                  <p className="mt-2 text-sm text-muted-foreground"><b>Alternatives:</b> {item.alternatives}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => void api.remove(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <EntityForm
        open={adding || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit decision" : "Add decision"}
        fields={fields}
        initial={editing ?? { date: todayIso(), owner: "Founder" }}
        schema={decisionSchema}
        onSubmit={save}
      />
    </div>
  );
}

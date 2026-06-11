"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/modules/data-table";
import { EntityForm, FieldConfig } from "@/components/modules/entity-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { useTable } from "@/lib/db";
import { formatDate, isOverdue } from "@/lib/utils";
import { riskSchema } from "@/lib/validation";
import { Risk, RiskCategory, RiskStatus } from "@/types";

const categories: RiskCategory[] = ["market", "execution", "regulatory", "safety", "funding", "competition", "technical"];
const statuses: RiskStatus[] = ["open", "mitigating", "closed"];

export default function RisksPage() {
  const api = useTable("risks");
  const [selected, setSelected] = useState<Risk | null>(null);
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const fields = riskFields();
  const filtered = api.rows.filter((risk) => (category === "all" || risk.category === category) && (status === "all" || risk.status === status));

  const columns = useMemo<ColumnDef<Risk>[]>(
    () => [
      { header: "Risk", accessorKey: "title" },
      { header: "Category", cell: ({ row }) => <Badge tone="muted">{row.original.category}</Badge> },
      { header: "Score", cell: ({ row }) => row.original.likelihood * row.original.impact },
      { header: "Status", cell: ({ row }) => <Badge tone={row.original.status === "closed" ? "success" : row.original.status === "mitigating" ? "accent" : "danger"}>{row.original.status}</Badge> },
      { header: "Review", cell: ({ row }) => <span className={isOverdue(row.original.review_date) ? "text-destructive" : ""}>{formatDate(row.original.review_date)}</span> },
      { header: "Owner", accessorKey: "owner" },
    ],
    [],
  );

  async function save(values: Record<string, unknown>) {
    const parsed = riskSchema.parse(values);
    if (selected) await api.update(selected.id, parsed);
    else await api.create(parsed);
    toast.success(selected ? "Risk updated" : "Risk added");
    setSelected(null);
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">Risk register</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Risks</h1>
          <p className="text-muted-foreground">Track clinical safety, regulatory, funding, market, and execution risks.</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add risk</Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Likelihood / impact matrix</CardTitle>
            <CardDescription>Click a risk dot to open and edit.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 grid-rows-5 gap-1">
              {[5, 4, 3, 2, 1].flatMap((impact) =>
                [1, 2, 3, 4, 5].map((likelihood) => {
                  const risks = filtered.filter((risk) => risk.impact === impact && risk.likelihood === likelihood);
                  const heat = likelihood * impact;
                  return (
                    <div
                      key={`${likelihood}-${impact}`}
                      className="relative min-h-24 rounded-lg border border-border p-2"
                      style={{ background: `rgba(227, 178, 60, ${Math.min(0.08 + heat / 60, 0.5)})` }}
                    >
                      <span className="text-xs text-muted-foreground">L{likelihood}/I{impact}</span>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {risks.map((risk) => (
                          <button
                            key={risk.id}
                            title={risk.title}
                            className="h-4 w-4 rounded-full bg-primary ring-2 ring-background"
                            onClick={() => setSelected(risk)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>Filter by category/status; overdue reviews are red.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All statuses</option>
                {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </div>
            <DataTable data={filtered} columns={columns} searchPlaceholder="Search risks..." onRowClick={setSelected} />
          </CardContent>
        </Card>
      </div>

      <EntityForm
        open={adding || Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setSelected(null);
          }
        }}
        title={selected ? "Edit risk" : "Add risk"}
        fields={fields}
        initial={selected ?? { category: "execution", likelihood: 3, impact: 3, status: "open", owner: "Founder" }}
        schema={riskSchema}
        onSubmit={save}
        drawer
      />
      {selected ? (
        <div className="fixed bottom-4 right-4 z-40">
          <Button variant="destructive" onClick={() => void api.remove(selected.id).then(() => setSelected(null))}>Delete selected risk</Button>
        </div>
      ) : null}
    </div>
  );
}

function riskFields(): FieldConfig[] {
  return [
    { name: "title", label: "Title" },
    { name: "category", label: "Category", type: "select", options: categories.map((value) => ({ label: value, value })) },
    { name: "likelihood", label: "Likelihood", type: "number" },
    { name: "impact", label: "Impact", type: "number" },
    { name: "mitigation", label: "Mitigation", type: "textarea" },
    { name: "owner", label: "Owner" },
    { name: "status", label: "Status", type: "select", options: statuses.map((value) => ({ label: value, value })) },
    { name: "review_date", label: "Review date", type: "date" },
  ];
}

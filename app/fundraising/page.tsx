"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/modules/data-table";
import { EntityForm, FieldConfig } from "@/components/modules/entity-form";
import { Kanban } from "@/components/modules/kanban";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useTable } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { investorSchema } from "@/lib/validation";
import { Investor, InvestorStage } from "@/types";

const stages: InvestorStage[] = ["research", "contacted", "meeting", "dd", "term_sheet", "committed", "passed"];

export default function FundraisingPage() {
  const api = useTable("investors");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [selected, setSelected] = useState<Investor | null>(null);
  const [editing, setEditing] = useState<Investor | null>(null);
  const [adding, setAdding] = useState(false);
  const fields = investorFields();

  const committed = api.rows.filter((row) => row.stage === "committed").reduce((sum, row) => sum + row.check_max, 0);
  const inDd = api.rows.filter((row) => row.stage === "dd" || row.stage === "term_sheet").reduce((sum, row) => sum + row.check_max, 0);
  const target = 500000;

  const columns = useMemo<ColumnDef<Investor>[]>(
    () => [
      { header: "Investor", cell: ({ row }) => <div><p className="font-semibold">{row.original.name}</p><p className="text-xs text-muted-foreground">{row.original.firm}</p></div> },
      { header: "Stage", cell: ({ row }) => <Badge tone="muted">{row.original.stage}</Badge> },
      { header: "Country", accessorKey: "country" },
      { header: "Check", cell: ({ row }) => `${formatCurrency(row.original.check_min, true)}-${formatCurrency(row.original.check_max, true)}` },
      { header: "Warm intro", accessorKey: "warm_intro_via" },
      { header: "Next action", accessorKey: "next_action" },
    ],
    [],
  );

  const kanbanColumns = stages.map((stage) => {
    const items = api.rows.filter((investor) => investor.stage === stage);
    const total = items.reduce((sum, investor) => sum + investor.check_max, 0);
    return { id: stage, title: stage.replace("_", " "), subtitle: `${formatCurrency(total, true)} max`, items };
  });

  async function save(values: Record<string, unknown>) {
    const parsed = investorSchema.parse(values);
    if (editing) await api.update(editing.id, parsed);
    else await api.create(parsed);
    toast.success(editing ? "Investor updated" : "Investor added");
    setAdding(false);
    setEditing(null);
    setSelected(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">Pre-seed EUR500k</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Fundraising CRM</h1>
          <p className="text-muted-foreground">Manage CEE funds, angels, warm intros, diligence, and committed capital.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView(view === "kanban" ? "table" : "kanban")}>{view === "kanban" ? "Table view" : "Kanban view"}</Button>
          <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add investor</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Committed" value={formatCurrency(committed, true)} detail={`${Math.round((committed / target) * 100)}% of target`} />
        <Metric title="In DD / term sheet" value={formatCurrency(inDd, true)} detail="weighted pipeline" />
        <Metric title="Round target" value={formatCurrency(target, true)} detail="pre-seed" />
        <RoundMath />
      </div>

      {view === "kanban" ? (
        <Kanban
          columns={kanbanColumns}
          onMove={async (id, stage) => {
            await api.update(id, { stage: stage as InvestorStage });
          }}
          renderCard={(investor) => (
            <Card className="cursor-grab p-4 active:cursor-grabbing" onClick={() => setSelected(investor)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{investor.name}</h3>
                  <p className="text-sm text-muted-foreground">{investor.firm} · {investor.country}</p>
                </div>
                <Badge tone={investor.stage === "committed" ? "success" : "muted"}>{investor.type}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{formatCurrency(investor.check_min, true)}-{formatCurrency(investor.check_max, true)}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{investor.next_action}</p>
            </Card>
          )}
        />
      ) : (
        <DataTable data={api.rows} columns={columns} searchPlaceholder="Search investors..." onRowClick={setSelected} />
      )}

      <Drawer open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title={selected?.name ?? "Investor"} description="Notes, warm intro path, last/next touch, and stage controls.">
        {selected ? (
          <div className="space-y-4 text-sm">
            <p><b>Firm:</b> {selected.firm}</p>
            <p><b>Check:</b> {formatCurrency(selected.check_min, true)} to {formatCurrency(selected.check_max, true)}</p>
            <p><b>Warm intro:</b> {selected.warm_intro_via}</p>
            <p><b>Last touch:</b> {formatDate(selected.last_touch)}</p>
            <p><b>Next action:</b> {selected.next_action}</p>
            <p className="rounded-lg border border-border bg-background/50 p-3">{selected.notes}</p>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <Button key={stage} size="sm" variant={selected.stage === stage ? "default" : "outline"} onClick={() => void api.update(selected.id, { stage }).then(setSelected)}>
                  {stage}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setEditing(selected)}>Edit</Button>
              <Button variant="destructive" onClick={() => void api.remove(selected.id).then(() => setSelected(null))}>Delete</Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <EntityForm
        open={adding || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit investor" : "Add investor"}
        fields={fields}
        initial={editing ?? { type: "angel", stage: "research", check_min: 0, check_max: 0 }}
        schema={investorSchema}
        onSubmit={save}
        drawer
      />
    </div>
  );
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle>{value}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function RoundMath() {
  const [roundSize, setRoundSize] = useState(500000);
  const [preMoney, setPreMoney] = useState(4000000);
  const post = roundSize + preMoney;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Round math</CardTitle>
        <CardDescription>Dilution: {post ? Math.round((roundSize / post) * 1000) / 10 : 0}% · Post: {formatCurrency(post, true)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Label>Round size</Label>
        <Input type="number" value={roundSize} onChange={(event) => setRoundSize(Number(event.target.value))} />
        <Label>Pre-money</Label>
        <Input type="number" value={preMoney} onChange={(event) => setPreMoney(Number(event.target.value))} />
      </CardContent>
    </Card>
  );
}

function investorFields(): FieldConfig[] {
  return [
    { name: "name", label: "Name" },
    { name: "firm", label: "Firm" },
    { name: "type", label: "Type", type: "select", options: ["angel", "preseed", "seed", "series_a"].map((value) => ({ label: value, value })) },
    { name: "country", label: "Country" },
    { name: "stage", label: "Stage", type: "select", options: stages.map((stage) => ({ label: stage, value: stage })) },
    { name: "check_min", label: "Check min", type: "number" },
    { name: "check_max", label: "Check max", type: "number" },
    { name: "warm_intro_via", label: "Warm intro via" },
    { name: "last_touch", label: "Last touch", type: "date" },
    { name: "next_action", label: "Next action" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
}

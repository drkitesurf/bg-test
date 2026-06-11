"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { DataTable } from "@/components/modules/data-table";
import { EntityForm, FieldConfig } from "@/components/modules/entity-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { db, useDatabaseSnapshot, useTable } from "@/lib/db";
import { formatDate, formatNumber, todayIso } from "@/lib/utils";
import { kpiEntrySchema, weeklyUpdateSchema } from "@/lib/validation";
import { Kpi } from "@/types";

type KpiRow = {
  kpi: Kpi;
  latest: number;
  previous: number;
  target: number;
  pct: number;
};

export default function KpisPage() {
  const { data, reload } = useDatabaseSnapshot();
  const entriesApi = useTable("kpi_entries");
  const [selected, setSelected] = useState<Kpi | null>(null);
  const [addingEntry, setAddingEntry] = useState(false);
  const [checkIn, setCheckIn] = useState(false);

  const rows: KpiRow[] = data.kpis.map((kpi) => {
    const entries = data.kpi_entries.filter((entry) => entry.kpi_id === kpi.id).sort((a, b) => a.date.localeCompare(b.date));
    const latest = entries.at(-1)?.value ?? 0;
    const previous = entries.at(-2)?.value ?? latest;
    return { kpi, latest, previous, target: kpi.target_y1, pct: kpi.target_y1 === 0 ? 100 : Math.round((latest / kpi.target_y1) * 100) };
  });

  const columns = useMemo<ColumnDef<KpiRow>[]>(
    () => [
      { header: "KPI", cell: ({ row }) => <div><p className="font-semibold">{row.original.kpi.label}</p><p className="text-xs text-muted-foreground">{row.original.kpi.key}</p></div> },
      { header: "Category", cell: ({ row }) => <Badge tone="muted">{row.original.kpi.category}</Badge> },
      { header: "Latest", cell: ({ row }) => formatNumber(row.original.latest, row.original.kpi.unit) },
      { header: "Trend", cell: ({ row }) => row.original.latest >= row.original.previous ? <span className="flex items-center gap-1 text-emerald-300"><ArrowUp className="h-4 w-4" /> up</span> : <span className="flex items-center gap-1 text-destructive"><ArrowDown className="h-4 w-4" /> down</span> },
      { header: "Target", cell: ({ row }) => formatNumber(row.original.target, row.original.kpi.unit) },
      { header: "% to target", cell: ({ row }) => `${Math.max(0, Math.min(999, row.original.pct))}%` },
    ],
    [],
  );

  const selectedEntries = selected
    ? data.kpi_entries.filter((entry) => entry.kpi_id === selected.id).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  async function addEntry(values: Record<string, unknown>) {
    const parsed = kpiEntrySchema.parse({ ...values, kpi_id: selected?.id });
    await entriesApi.create(parsed);
    await reload();
    toast.success("KPI entry added");
    setAddingEntry(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">KPI tracker</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Metrics</h1>
          <p className="text-muted-foreground">Weekly operating metrics by product, commercial, financial, and clinical safety categories.</p>
        </div>
        <Button onClick={() => setCheckIn(true)}>Weekly check-in</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {["product", "commercial", "financial", "clinical_safety"].map((category) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="capitalize">{category.replace("_", " ")}</CardTitle>
              <CardDescription>Click a KPI row to open history and add entries.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={rows.filter((row) => row.kpi.category === category)}
                columns={columns}
                searchPlaceholder="Filter KPIs..."
                onRowClick={(row) => setSelected(row.kpi)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Drawer open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title={selected?.label ?? "KPI"} description="History, notes, and manual entry.">
        {selected ? (
          <div className="space-y-5">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedEntries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                  <XAxis dataKey="date" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip contentStyle={{ background: "#11272E", border: "1px solid rgba(255,255,255,.14)" }} />
                  <Line dataKey="value" stroke="#0E9594" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Button onClick={() => setAddingEntry(true)}>
              <Plus className="h-4 w-4" />
              Add entry
            </Button>
            <div className="space-y-2">
              {selectedEntries.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/50 p-3">
                  <div>
                    <p className="font-semibold">{formatNumber(entry.value, selected.unit)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.date)} · {entry.note}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => void entriesApi.remove(entry.id).then(reload)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Drawer>

      <EntityForm
        open={addingEntry}
        onOpenChange={setAddingEntry}
        title={`Add ${selected?.label ?? "KPI"} entry`}
        fields={[
          { name: "date", label: "Date", type: "date" },
          { name: "value", label: "Value", type: "number" },
          { name: "note", label: "Note", type: "textarea" },
        ]}
        initial={{ date: todayIso(), note: "" }}
        schema={kpiEntrySchema.omit({ kpi_id: true })}
        onSubmit={addEntry}
      />

      <WeeklyCheckIn open={checkIn} onOpenChange={setCheckIn} kpis={data.kpis} reload={reload} />
    </div>
  );
}

function WeeklyCheckIn({ open, onOpenChange, kpis, reload }: { open: boolean; onOpenChange: (open: boolean) => void; kpis: Kpi[]; reload: () => Promise<void> }) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState({ wins: "", problems: "", next_week: "" });
  const kpi = kpis[index];

  async function next() {
    if (!kpi) return finish();
    await db.upsert("kpi_entries", kpiEntrySchema.parse({ kpi_id: kpi.id, date: todayIso(), value: Number(value || 0), note }));
    setValue("");
    setNote("");
    setIndex((current) => current + 1);
  }

  async function finish() {
    await db.upsert(
      "weekly_updates",
      weeklyUpdateSchema.parse({
        week_start: todayIso(),
        wins: summary.wins,
        problems: summary.problems,
        metrics_note: "Weekly check-in completed in Mission Control.",
        next_week: summary.next_week,
      }),
    );
    await reload();
    setIndex(0);
    onOpenChange(false);
    toast.success("Weekly check-in saved");
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Weekly check-in" description="Step through every KPI, then save a weekly update.">
      {index < kpis.length ? (
        <div className="space-y-4">
          <Badge tone="muted">{index + 1} / {kpis.length}</Badge>
          <h3 className="text-xl font-semibold">{kpi.label}</h3>
          <div className="grid gap-2">
            <Label>New value</Label>
            <Input type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Note</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <Button onClick={() => void next()}>Next KPI</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2"><Label>Wins</Label><Textarea value={summary.wins} onChange={(event) => setSummary((s) => ({ ...s, wins: event.target.value }))} /></div>
          <div className="grid gap-2"><Label>Problems</Label><Textarea value={summary.problems} onChange={(event) => setSummary((s) => ({ ...s, problems: event.target.value }))} /></div>
          <div className="grid gap-2"><Label>Next week</Label><Textarea value={summary.next_week} onChange={(event) => setSummary((s) => ({ ...s, next_week: event.target.value }))} /></div>
          <Button onClick={() => void finish()}>Save weekly update</Button>
        </div>
      )}
    </Drawer>
  );
}

"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Download, Plus, Upload } from "lucide-react";
import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/modules/data-table";
import { EntityForm, FieldConfig } from "@/components/modules/entity-form";
import { Kanban } from "@/components/modules/kanban";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/dialog";
import { useTable } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { clinicSchema } from "@/lib/validation";
import { Clinic, ClinicStage } from "@/types";

const stages: ClinicStage[] = ["lead", "contacted", "demo", "pilot", "paying", "churned"];

export default function PipelinePage() {
  const api = useTable("clinics");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [selected, setSelected] = useState<Clinic | null>(null);
  const [editing, setEditing] = useState<Clinic | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fields = clinicFields();

  const columns = useMemo<ColumnDef<Clinic>[]>(
    () => [
      { header: "Clinic", accessorKey: "name" },
      { header: "City", accessorKey: "city" },
      { header: "Stage", cell: ({ row }) => <Badge tone="muted">{row.original.stage}</Badge> },
      { header: "MRR", cell: ({ row }) => formatCurrency(row.original.mrr, true) },
      { header: "Next action", accessorKey: "next_action" },
      { header: "Next date", cell: ({ row }) => formatDate(row.original.next_action_date) },
    ],
    [],
  );

  const kanbanColumns = stages.map((stage) => {
    const items = api.rows.filter((clinic) => clinic.stage === stage);
    const mrr = items.reduce((sum, clinic) => sum + clinic.mrr, 0);
    return { id: stage, title: stage, subtitle: `${formatCurrency(mrr, true)} MRR`, items };
  });

  async function save(values: Record<string, unknown>) {
    const parsed = clinicSchema.parse(values);
    if (editing) await api.update(editing.id, parsed);
    else await api.create(parsed);
    toast.success(editing ? "Clinic updated" : "Clinic added");
    setAdding(false);
    setEditing(null);
    setSelected(null);
  }

  async function importCsv(file: File) {
    Papa.parse<Partial<Clinic>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        for (const row of result.data) {
          const parsed = clinicSchema.safeParse({
            country: "Bulgaria",
            stage: "lead",
            mrr: 0,
            vets_count: 0,
            ...row,
          });
          if (parsed.success) await api.create(parsed.data);
        }
        toast.success(`Imported ${result.data.length} clinics`);
      },
    });
  }

  function exportCsv() {
    const csv = Papa.unparse(api.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clinics.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">Clinic sales</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Clinic CRM</h1>
          <p className="text-muted-foreground">Track Bulgarian clinic leads from first touch to paying AI Staff accounts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setView(view === "kanban" ? "table" : "kanban")}>{view === "kanban" ? "Table view" : "Kanban view"}</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import CSV</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add clinic</Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(event) => event.target.files?.[0] && void importCsv(event.target.files[0])} />
        </div>
      </div>

      {view === "kanban" ? (
        <Kanban
          columns={kanbanColumns}
          onMove={async (id, stage) => {
            await api.update(id, { stage: stage as ClinicStage });
          }}
          renderCard={(clinic) => (
            <Card className="cursor-grab p-4 active:cursor-grabbing" onClick={() => setSelected(clinic)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{clinic.name}</h3>
                  <p className="text-sm text-muted-foreground">{clinic.city} · {clinic.vets_count} vets</p>
                </div>
                <Badge tone={clinic.mrr > 0 ? "success" : "muted"}>{formatCurrency(clinic.mrr, true)}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{clinic.next_action}</p>
            </Card>
          )}
        />
      ) : (
        <DataTable data={api.rows} columns={columns} searchPlaceholder="Search clinics..." onRowClick={setSelected} />
      )}

      <Drawer open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title={selected?.name ?? "Clinic"} description="Contact, notes, next action, and stage controls.">
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm">
              <p><b>Contact:</b> {selected.contact_name} · {selected.contact_email} · {selected.phone}</p>
              <p><b>Location:</b> {selected.city}, {selected.country}</p>
              <p><b>Last touch:</b> {formatDate(selected.last_touch)}</p>
              <p><b>Next:</b> {selected.next_action} ({formatDate(selected.next_action_date)})</p>
              <p className="rounded-lg border border-border bg-background/50 p-3">{selected.notes}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <Button key={stage} size="sm" variant={selected.stage === stage ? "default" : "outline"} onClick={() => void api.update(selected.id, { stage }).then((row) => setSelected(row))}>
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
        title={editing ? "Edit clinic" : "Add clinic"}
        fields={fields}
        initial={editing ?? { country: "Bulgaria", stage: "lead", mrr: 0, vets_count: 0 }}
        schema={clinicSchema}
        onSubmit={save}
        drawer
      />
    </div>
  );
}

function clinicFields(): FieldConfig[] {
  return [
    { name: "name", label: "Name" },
    { name: "city", label: "City" },
    { name: "country", label: "Country" },
    { name: "contact_name", label: "Contact name" },
    { name: "contact_email", label: "Contact email" },
    { name: "phone", label: "Phone" },
    { name: "stage", label: "Stage", type: "select", options: stages.map((stage) => ({ label: stage, value: stage })) },
    { name: "mrr", label: "MRR", type: "number" },
    { name: "vets_count", label: "Vets count", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
    { name: "last_touch", label: "Last touch", type: "date" },
    { name: "next_action", label: "Next action" },
    { name: "next_action_date", label: "Next action date", type: "date" },
  ];
}

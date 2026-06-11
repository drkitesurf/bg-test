"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityForm, FieldConfig } from "@/components/modules/entity-form";
import { useTable } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { milestoneSchema } from "@/lib/validation";
import { Milestone, MilestonePhase } from "@/types";

const phases: MilestonePhase[] = ["pilot", "bulgaria", "eu", "us", "insurance"];
const phaseLabels: Record<MilestonePhase, string> = {
  pilot: "Pilot",
  bulgaria: "Bulgaria",
  eu: "EU",
  us: "US",
  insurance: "Insurance",
};

export default function RoadmapPage() {
  const { rows, create, update, remove } = useTable("milestones");
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [adding, setAdding] = useState(false);
  const fields: FieldConfig[] = [
    { name: "title", label: "Title" },
    { name: "target_date", label: "Target date", type: "date" },
    { name: "phase", label: "Phase", type: "select", options: phases.map((phase) => ({ label: phaseLabels[phase], value: phase })) },
    { name: "status", label: "Status", type: "select", options: ["pending", "hit", "missed", "at_risk"].map((value) => ({ label: value, value })) },
    { name: "description", label: "Description", type: "textarea" },
  ];

  async function save(values: Record<string, unknown>) {
    const parsed = milestoneSchema.parse(values);
    if (editing) await update(editing.id, parsed);
    else await create(parsed);
    toast.success(editing ? "Milestone updated" : "Milestone added");
    setEditing(null);
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">Milestones</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Roadmap</h1>
          <p className="text-muted-foreground">Phase timeline from CVC pilot through insurance network scale.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Add milestone
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase timeline</CardTitle>
          <CardDescription>Milestones grouped by strategic expansion phase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {phases.map((phase) => {
            const items = rows.filter((item) => item.phase === phase).sort((a, b) => a.target_date.localeCompare(b.target_date));
            return (
              <section key={phase}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{phaseLabels[phase]}</h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge tone={item.status === "hit" ? "success" : item.status === "at_risk" ? "danger" : "muted"}>{item.status}</Badge>
                          <button className="mt-3 block text-left font-semibold" onClick={() => setEditing(item)}>
                            {item.title}
                          </button>
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                          <p className="mt-3 text-xs text-accent">{formatDate(item.target_date)}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => void remove(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gantt-lite view</CardTitle>
          <CardDescription>Simple month-positioned bars for planning cadence.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[900px] space-y-3">
            {rows
              .slice()
              .sort((a, b) => a.target_date.localeCompare(b.target_date))
              .map((item) => {
                const year = Number(item.target_date.slice(0, 4));
                const month = Number(item.target_date.slice(5, 7));
                const start = Math.max(1, Math.min(36, (year - 2026) * 12 + month - 5));
                return (
                  <div key={item.id} className="grid grid-cols-[220px_1fr] items-center gap-4">
                    <div className="truncate text-sm">{item.title}</div>
                    <div className="relative h-8 rounded bg-secondary">
                      <div
                        className="absolute top-1 h-6 rounded bg-primary"
                        style={{ left: `${(start / 36) * 100}%`, width: "8%" }}
                        title={formatDate(item.target_date)}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      <EntityForm
        open={adding || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit milestone" : "Add milestone"}
        fields={fields}
        initial={editing ?? { phase: "pilot", status: "pending" }}
        schema={milestoneSchema}
        onSubmit={save}
      />
    </div>
  );
}

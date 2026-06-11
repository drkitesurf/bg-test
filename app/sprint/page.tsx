"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityForm, FieldConfig } from "@/components/modules/entity-form";
import { Kanban } from "@/components/modules/kanban";
import { db, useDatabaseSnapshot, useTable } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { decisionSchema, taskSchema } from "@/lib/validation";
import { Decision, Task } from "@/types";

export default function SprintPage() {
  const { rows: tasks, update, create, remove } = useTable("tasks");
  const { data, reload } = useDatabaseSnapshot();
  const [editing, setEditing] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);

  const workstreamMap = new Map(data.workstreams.map((item) => [item.id, item]));
  const fields: FieldConfig[] = [
    { name: "title", label: "Title" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "workstream_id", label: "Workstream", type: "select", options: data.workstreams.map((item) => ({ label: item.name, value: item.id })) },
    { name: "status", label: "Status", type: "select", options: ["backlog", "todo", "doing", "blocked", "done"].map((value) => ({ label: value, value })) },
    { name: "priority", label: "Priority", type: "select", options: ["P0", "P1", "P2"].map((value) => ({ label: value, value })) },
    { name: "sprint_day", label: "Sprint day", type: "number" },
    { name: "due_date", label: "Due date", type: "date" },
    { name: "owner", label: "Owner" },
    { name: "tags", label: "Tags", type: "tags", placeholder: "pilot, launch-critical" },
  ];

  const complete = tasks.filter((task) => task.status === "done").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const p0 = tasks.filter((task) => task.priority === "P0" && task.status !== "done").length;
  const progress = tasks.length ? Math.round((complete / tasks.length) * 100) : 0;

  const columns = useMemo(
    () => [
      ...Array.from({ length: 7 }, (_, index) => {
        const day = index + 1;
        return {
          id: String(day),
          title: `Day ${day}`,
          subtitle: `${tasks.filter((task) => task.sprint_day === day && task.status !== "done" && task.status !== "blocked").length} active`,
          items: tasks
            .filter((task) => task.sprint_day === day && task.status !== "done" && task.status !== "blocked")
            .sort((a, b) => a.sort_order - b.sort_order),
        };
      }),
      { id: "done", title: "Done", subtitle: `${complete} complete`, items: tasks.filter((task) => task.status === "done") },
      { id: "blocked", title: "Blocked", subtitle: `${blocked} blocked`, items: tasks.filter((task) => task.status === "blocked") },
    ],
    [blocked, complete, tasks],
  );

  async function moveTask(id: string, columnId: string) {
    if (columnId === "done") await update(id, { status: "done", updated_at: new Date().toISOString() });
    else if (columnId === "blocked") await update(id, { status: "blocked", updated_at: new Date().toISOString() });
    else await update(id, { sprint_day: Number(columnId), status: "todo", updated_at: new Date().toISOString() });
    toast.success("Task moved");
  }

  async function slipDay(day: number) {
    const affected = tasks.filter((task) => task.sprint_day === day && task.status !== "done");
    await Promise.all(affected.map((task) => update(task.id, { sprint_day: Math.min(7, day + 1), updated_at: new Date().toISOString() })));
    const decision: Omit<Decision, "id"> = {
      date: new Date().toISOString().slice(0, 10),
      title: `Slipped Day ${day} incomplete sprint work`,
      context: `${affected.length} incomplete tasks needed more time.`,
      decision: `Move incomplete Day ${day} tasks to Day ${Math.min(7, day + 1)}.`,
      alternatives: "Reduce scope or mark blockers individually.",
      owner: "Founder",
    };
    decisionSchema.parse(decision);
    await db.upsert("decisions", decision);
    await reload();
    toast.success(`Slipped ${affected.length} tasks and logged a decision`);
  }

  async function saveTask(values: Record<string, unknown>) {
    const parsed = taskSchema.parse(values);
    const base = {
      ...parsed,
      created_at: editing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sort_order: editing?.sort_order ?? tasks.length + 1,
    };
    if (editing) await update(editing.id, base);
    else await create(base);
    toast.success(editing ? "Task updated" : "Task created");
    setEditing(null);
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">7-day build sprint</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Sprint board</h1>
          <p className="text-muted-foreground">Move cards across days, done, and blocked. Use slip-day when scope spills.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Add task
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Complete" value={`${progress}%`} detail={`${complete}/${tasks.length} tasks`} />
        <Stat title="Blocked" value={blocked} detail="needs founder attention" />
        <Stat title="P0 remaining" value={p0} detail="launch-critical" />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Slip a day</CardTitle>
            <CardDescription>Move incomplete work to next day.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((day) => (
              <Button key={day} size="sm" variant="outline" onClick={() => void slipDay(day)}>
                Day {day}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Kanban
        columns={columns}
        onMove={moveTask}
        renderCard={(task) => {
          const workstream = workstreamMap.get(task.workstream_id);
          return (
            <Card className="cursor-grab p-4 active:cursor-grabbing">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge tone={task.priority === "P0" ? "danger" : task.priority === "P1" ? "accent" : "muted"}>{task.priority}</Badge>
                    {workstream ? (
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${workstream.color}25`, color: workstream.color }}>
                        {workstream.name}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="font-semibold">{task.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    void remove(task.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <button className="mt-3 text-left text-xs text-muted-foreground" onClick={() => setEditing(task)}>
                {task.owner} · due {formatDate(task.due_date)}
              </button>
            </Card>
          );
        }}
      />

      <EntityForm
        open={adding || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        title={editing ? "Edit task" : "Add task"}
        fields={fields}
        initial={editing ?? { status: "todo", priority: "P1", sprint_day: 1, workstream_id: data.workstreams[0]?.id, owner: "Founder", tags: [] }}
        schema={taskSchema}
        onSubmit={saveTask}
      />
    </div>
  );
}

function Stat({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}

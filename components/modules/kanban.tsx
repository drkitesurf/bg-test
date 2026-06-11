"use client";

import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import type React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KanbanColumn<T> = {
  id: string;
  title: string;
  subtitle?: string;
  items: T[];
};

export function Kanban<T extends { id: string }>({
  columns,
  renderCard,
  onMove,
  className,
}: {
  columns: Array<KanbanColumn<T>>;
  renderCard: (item: T) => React.ReactNode;
  onMove: (itemId: string, columnId: string) => void | Promise<void>;
  className?: string;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id?.toString();
    if (!overId) return;
    const columnId = overId.startsWith("column:") ? overId.replace("column:", "") : overId;
    await onMove(event.active.id.toString(), columnId);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className={cn("grid auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4", className)}>
        {columns.map((column) => (
          <KanbanColumnView key={column.id} column={column} renderCard={renderCard} />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumnView<T extends { id: string }>({
  column,
  renderCard,
}: {
  column: KanbanColumn<T>;
  renderCard: (item: T) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });
  return (
    <section
      ref={setNodeRef}
      className={cn("min-h-[28rem] rounded-xl border border-border bg-card/50 p-3", isOver && "ring-2 ring-primary")}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{column.title}</h3>
          {column.subtitle ? <p className="text-xs text-muted-foreground">{column.subtitle}</p> : null}
        </div>
        <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">{column.items.length}</span>
      </div>
      <div className="grid gap-3">
        {column.items.map((item) => (
          <DraggableCard key={item.id} item={item}>
            {renderCard(item)}
          </DraggableCard>
        ))}
        {column.items.length === 0 ? (
          <Card className="border-dashed p-4 text-center text-sm text-muted-foreground">Drop items here</Card>
        ) : null}
      </div>
    </section>
  );
}

function DraggableCard<T extends { id: string }>({ item, children }: { item: T; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && "opacity-60")}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Command,
  FileText,
  Gauge,
  Home,
  Landmark,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db, getSupabaseSetupStatus, useDatabaseSnapshot } from "@/lib/db";
import { cn, todayIso } from "@/lib/utils";
import { Task } from "@/types";

const navItems = [
  { href: "/", label: "Command Center", icon: Home },
  { href: "/sprint", label: "7-Day Sprint", icon: CalendarDays },
  { href: "/roadmap", label: "Roadmap", icon: ClipboardList },
  { href: "/kpis", label: "KPIs", icon: BarChart3 },
  { href: "/pipeline", label: "Clinic CRM", icon: BriefcaseBusiness },
  { href: "/fundraising", label: "Fundraising", icon: Landmark },
  { href: "/risks", label: "Risks", icon: ShieldAlert },
  { href: "/docs", label: "Docs", icon: FileText },
  { href: "/decisions", label: "Decisions", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const mode = getSupabaseSetupStatus();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-border bg-background/80 p-3 backdrop-blur lg:block",
          collapsed ? "w-[76px]" : "w-72",
        )}
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center justify-between gap-3 px-2 py-3">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Bot className="h-5 w-5" />
              </div>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate font-semibold">Mission Control</p>
                  <p className="truncate text-xs text-muted-foreground">THEVETERINARIAN.AI</p>
                </div>
              ) : null}
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setCollapsed((value) => !value)}>
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground",
                    active && "bg-primary/15 text-primary",
                    collapsed && "justify-center px-2",
                  )}
                  title={item.label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3 rounded-xl border border-border bg-card/60 p-3">
            {!collapsed ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Data mode</span>
                  <Badge tone={mode.activeMode === "demo" ? "accent" : "success"}>{mode.activeMode}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Cmd/Ctrl+K opens the command palette.</p>
              </>
            ) : (
              <Gauge className="mx-auto h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {navItems.slice(0, 8).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="rounded-lg border border-border bg-card p-2">
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </div>
            <button
              onClick={() => setCommandOpen(true)}
              className="ml-auto flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-secondary lg:max-w-md"
            >
              <Search className="h-4 w-4" />
              <span className="truncate">Search pages, tasks, clinics, investors...</span>
              <kbd className="ml-auto hidden rounded bg-secondary px-2 py-0.5 text-xs sm:inline-flex">⌘K</kbd>
            </button>
            <ThemeToggle />
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { data } = useDatabaseSnapshot();
  const [query, setQuery] = useState("");
  const [quickTitle, setQuickTitle] = useState("");

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const pageResults = navItems.map((item) => ({ type: "Page", id: item.href, label: item.label, href: item.href }));
    const entityResults = [
      ...data.tasks.map((item) => ({ type: "Task", id: item.id, label: item.title, href: "/sprint" })),
      ...data.clinics.map((item) => ({ type: "Clinic", id: item.id, label: item.name, href: "/pipeline" })),
      ...data.investors.map((item) => ({ type: "Investor", id: item.id, label: item.name, href: "/fundraising" })),
    ];
    return [...pageResults, ...entityResults].filter((item) => !q || item.label.toLowerCase().includes(q)).slice(0, 12);
  }, [data.clinics, data.investors, data.tasks, query]);

  async function quickAddTask() {
    if (!quickTitle.trim()) return;
    const task: Partial<Task> = {
      title: quickTitle.trim(),
      description: "",
      workstream_id: data.workstreams[0]?.id ?? "ws-product",
      status: "todo",
      priority: "P1",
      sprint_day: 1,
      due_date: todayIso(),
      owner: "Founder",
      tags: ["quick-add"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sort_order: data.tasks.length + 1,
    };
    await db.upsert("tasks", task);
    toast.success("Task added");
    setQuickTitle("");
    onOpenChange(false);
    router.push("/sprint");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Jump anywhere or quick-add sprint work.">
      <div className="space-y-4">
        <Input autoFocus placeholder="Search..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="grid gap-2">
          {results.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                router.push(item.href);
                onOpenChange(false);
              }}
            >
              <span>{item.label}</span>
              <Badge tone="muted">{item.type}</Badge>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            Quick-add task
          </div>
          <div className="flex gap-2">
            <Input placeholder="Task title" value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") void quickAddTask();
            }} />
            <Button onClick={() => void quickAddTask()}>Add</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

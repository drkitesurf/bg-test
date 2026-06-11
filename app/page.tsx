"use client";

import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { Activity, CalendarClock, Flag, TrendingUp } from "lucide-react";
import type React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDatabaseSnapshot } from "@/lib/db";
import { formatCurrency, formatDate, formatNumber, isOverdue, todayIso } from "@/lib/utils";

const homeKpis = ["pets_um", "clinics_paying", "mrr", "mau", "consults_wk", "runway"];

export default function CommandCenterPage() {
  const { data, loading } = useDatabaseSnapshot();
  const today = todayIso();
  const sprintEnd = addDays(parseISO("2026-06-11"), 6);
  const pilot = data.milestones.find((item) => item.id === "ms-pilot-live");
  const latestEntries = data.kpis.map((kpi) => {
    const entries = data.kpi_entries.filter((entry) => entry.kpi_id === kpi.id).sort((a, b) => a.date.localeCompare(b.date));
    const latest = entries.at(-1);
    const previous = entries.at(-2);
    return { kpi, entries, latest, previous };
  });
  const mrr = latestEntries.find((item) => item.kpi.key === "mrr");
  const mrrChart =
    mrr?.entries.map((entry, index) => ({
      date: entry.date.slice(5),
      MRR: entry.value,
      Target: Math.round((41000 / 12) * (index + 1)),
    })) ?? [];

  const dueTasks = data.tasks
    .filter((task) => task.status !== "done" && task.due_date && task.due_date <= today)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 6);
  const nextMilestones = data.milestones
    .filter((milestone) => milestone.status !== "hit")
    .sort((a, b) => a.target_date.localeCompare(b.target_date))
    .slice(0, 3);
  const investorActions = data.investors.filter((item) => item.next_action).slice(0, 4);
  const clinicActions = data.clinics.filter((item) => item.next_action).slice(0, 4);
  const activity = [
    ...data.decisions.map((item) => ({ date: item.date, title: item.title, body: item.decision, type: "Decision" })),
    ...data.weekly_updates.map((item) => ({ date: item.week_start, title: "Weekly update", body: item.wins, type: "Update" })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (loading) {
    return <Skeleton className="h-[70vh]" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">Founder OS</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="mt-1 text-muted-foreground">Control tower for THEVETERINARIAN.AI sprint, KPIs, pipelines, and risk.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Countdown title="7-day sprint" days={Math.max(0, differenceInCalendarDays(sprintEnd, new Date()))} />
          <Countdown title="Pilot launch" days={pilot ? Math.max(0, differenceInCalendarDays(parseISO(pilot.target_date), new Date())) : 0} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {homeKpis.map((key) => {
          const item = latestEntries.find((entry) => entry.kpi.key === key);
          if (!item) return null;
          const latest = item.latest?.value ?? 0;
          const previous = item.previous?.value ?? 0;
          const pct = item.kpi.target_y1 === 0 ? 100 : Math.min(100, Math.round((latest / item.kpi.target_y1) * 100));
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardDescription>{item.kpi.label}</CardDescription>
                <CardTitle className="text-2xl">{formatNumber(latest, item.kpi.unit)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={item.entries}>
                      <Line dataKey="value" stroke="#0E9594" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pct}% to Y1</span>
                  <span className={latest >= previous ? "text-emerald-300" : "text-destructive"}>{latest >= previous ? "↑" : "↓"} vs last</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>MRR burn-up to EUR500k ARR run-rate</CardTitle>
            <CardDescription>Latest MRR is {formatCurrency(mrr?.latest?.value ?? 0, true)} against EUR41k month-12 target.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrChart}>
                <defs>
                  <linearGradient id="mrrFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#0E9594" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#0E9594" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                <XAxis dataKey="date" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip contentStyle={{ background: "#11272E", border: "1px solid rgba(255,255,255,.14)" }} />
                <Area type="monotone" dataKey="MRR" stroke="#0E9594" fill="url(#mrrFill)" strokeWidth={2} />
                <Line type="monotone" dataKey="Target" stroke="#E3B23C" strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>Due work and next commercial/fundraising actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <TodaySection icon={<CalendarClock className="h-4 w-4" />} title="Due / overdue tasks">
              {dueTasks.map((task) => (
                <MiniRow key={task.id} title={task.title} meta={formatDate(task.due_date)} danger={isOverdue(task.due_date)} />
              ))}
            </TodaySection>
            <TodaySection icon={<Flag className="h-4 w-4" />} title="Next milestones">
              {nextMilestones.map((item) => (
                <MiniRow key={item.id} title={item.title} meta={`${item.phase} · ${formatDate(item.target_date)}`} />
              ))}
            </TodaySection>
            <TodaySection icon={<TrendingUp className="h-4 w-4" />} title="Fundraising actions">
              {investorActions.map((item) => (
                <MiniRow key={item.id} title={item.name} meta={item.next_action} />
              ))}
            </TodaySection>
            <TodaySection icon={<Activity className="h-4 w-4" />} title="Clinic actions">
              {clinicActions.map((item) => (
                <MiniRow key={item.id} title={item.name} meta={item.next_action} />
              ))}
            </TodaySection>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity feed</CardTitle>
          <CardDescription>Decisions and weekly updates.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {activity.map((item) => (
            <div key={`${item.type}-${item.date}-${item.title}`} className="rounded-xl border border-border bg-background/50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Badge tone={item.type === "Decision" ? "accent" : "default"}>{item.type}</Badge>
                <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
              </div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Countdown({ title, days }: { title: string; days: number }) {
  return (
    <div className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-accent">{title}</p>
      <p className="text-2xl font-bold">{days} days</p>
    </div>
  );
}

function TodaySection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon}
        {title}
      </h3>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function MiniRow({ title, meta, danger }: { title: string; meta: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className={danger ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{meta}</p>
    </div>
  );
}

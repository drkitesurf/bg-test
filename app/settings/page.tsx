"use client";

import { RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, getSupabaseSetupStatus } from "@/lib/db";

export default function SettingsPage() {
  const status = getSupabaseSetupStatus();
  const { theme, setTheme } = useTheme();

  async function resetDemo() {
    await db.resetDemo();
    toast.success("Demo data reset");
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="accent">Settings</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure data mode, theme, and local demo data.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data mode</CardTitle>
            <CardDescription>Default is demo mode, backed by localStorage seed data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>Requested mode: <Badge tone="muted">{status.requestedMode}</Badge></p>
            <p>Active mode: <Badge tone={status.activeMode === "demo" ? "accent" : "success"}>{status.activeMode}</Badge></p>
            <p className="text-sm text-muted-foreground">Supabase URL present: {String(status.hasUrl)} · anon key present: {String(status.hasAnonKey)}</p>
            <Button variant="outline" onClick={() => void resetDemo()}><RotateCcw className="h-4 w-4" /> Reset demo data</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Mission Control defaults to dark navy/teal.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>Dark</Button>
            <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>Light</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment setup</CardTitle>
          <CardDescription>Use demo mode with no env vars, or enable Supabase with these values.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
{`# .env.local
NEXT_PUBLIC_DATA_MODE=demo

# Supabase mode
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Database setup
1. Create a Supabase project.
2. Run supabase/migration.sql in SQL editor.
3. Run supabase/seed.sql for the same seed data.
4. Enable authentication provider(s) as needed.
5. Keep Row Level Security policies from the migration enabled.`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

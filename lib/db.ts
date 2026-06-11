"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { seedDatabase } from "@/lib/seed";
import { DataMode, Database, TableName, TableRow } from "@/types";

const STORAGE_KEY = "theveterinarian.mission-control.v1";
const CHANGE_EVENT = "mission-control-db-change";

let supabaseClient: SupabaseClient | null = null;

export function getConfiguredDataMode(): DataMode {
  const requested = process.env.NEXT_PUBLIC_DATA_MODE;
  if (requested === "supabase" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "supabase";
  }
  return "demo";
}

export function getSupabaseSetupStatus() {
  return {
    requestedMode: (process.env.NEXT_PUBLIC_DATA_MODE || "demo") as DataMode,
    activeMode: getConfiguredDataMode(),
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Supabase mode requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

function cloneSeed(): Database {
  return JSON.parse(JSON.stringify(seedDatabase)) as Database;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readDemoDatabase(): Database {
  if (!canUseStorage()) return cloneSeed();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const fresh = cloneSeed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    return { ...cloneSeed(), ...(JSON.parse(raw) as Partial<Database>) };
  } catch {
    const fresh = cloneSeed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

function writeDemoDatabase(data: Database) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function idFor(table: TableName) {
  return `${table}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export const db = {
  mode: getConfiguredDataMode,

  async list<T extends TableName>(table: T): Promise<TableRow<T>[]> {
    if (getConfiguredDataMode() === "supabase") {
      const { data, error } = await getSupabase().from(table).select("*");
      if (error) throw error;
      return (data ?? []) as TableRow<T>[];
    }
    return readDemoDatabase()[table] as TableRow<T>[];
  },

  async getAll(): Promise<Database> {
    if (getConfiguredDataMode() === "supabase") {
      const entries = await Promise.all(
        (Object.keys(seedDatabase) as TableName[]).map(async (table) => [table, await db.list(table)] as const),
      );
      return Object.fromEntries(entries) as Database;
    }
    return readDemoDatabase();
  },

  async upsert<T extends TableName>(table: T, row: Partial<TableRow<T>> & { id?: string }): Promise<TableRow<T>> {
    const next = { ...row, id: row.id ?? idFor(table) } as TableRow<T>;
    if (getConfiguredDataMode() === "supabase") {
      const { data, error } = await getSupabase().from(table).upsert(next).select("*").single();
      if (error) throw error;
      return data as TableRow<T>;
    }
    const data = readDemoDatabase();
    const rows = data[table] as TableRow<T>[];
    const index = rows.findIndex((item) => item.id === next.id);
    if (index >= 0) rows[index] = { ...rows[index], ...next };
    else rows.push(next);
    writeDemoDatabase(data);
    return next;
  },

  async update<T extends TableName>(table: T, id: string, patch: Partial<TableRow<T>>): Promise<TableRow<T>> {
    if (getConfiguredDataMode() === "supabase") {
      const { data, error } = await getSupabase().from(table).update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return data as TableRow<T>;
    }
    const data = readDemoDatabase();
    const rows = data[table] as TableRow<T>[];
    const index = rows.findIndex((item) => item.id === id);
    if (index === -1) throw new Error(`Missing ${table} row ${id}`);
    rows[index] = { ...rows[index], ...patch };
    writeDemoDatabase(data);
    return rows[index];
  },

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    if (getConfiguredDataMode() === "supabase") {
      const { error } = await getSupabase().from(table).delete().eq("id", id);
      if (error) throw error;
      return;
    }
    const data = readDemoDatabase();
    data[table] = (data[table] as Array<{ id: string }>).filter((item) => item.id !== id) as Database[T];
    writeDemoDatabase(data);
  },

  async replace<T extends TableName>(table: T, rows: TableRow<T>[]): Promise<void> {
    if (getConfiguredDataMode() === "supabase") {
      const client = getSupabase();
      const { error: deleteError } = await client.from(table).delete().neq("id", "__never__");
      if (deleteError) throw deleteError;
      if (rows.length) {
        const { error } = await client.from(table).insert(rows);
        if (error) throw error;
      }
      return;
    }
    const data = readDemoDatabase();
    data[table] = rows as Database[T];
    writeDemoDatabase(data);
  },

  async resetDemo(): Promise<void> {
    writeDemoDatabase(cloneSeed());
  },
};

export function subscribeToDemoChanges(listener: () => void) {
  if (!canUseStorage()) return () => undefined;
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useTable<T extends TableName>(table: T) {
  const [rows, setRows] = useState<TableRow<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await db.list(table));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      setLoading(false);
    }
  }, [table]);

  useEffect(() => {
    void reload();
    return subscribeToDemoChanges(() => void reload());
  }, [reload]);

  const api = useMemo(
    () => ({
      rows,
      loading,
      error,
      reload,
      create: async (row: Partial<TableRow<T>>) => {
        const created = await db.upsert(table, row);
        setRows((current) => [...current, created]);
        return created;
      },
      update: async (id: string, patch: Partial<TableRow<T>>) => {
        const updated = await db.update(table, id, patch);
        setRows((current) => current.map((item) => (item.id === id ? updated : item)));
        return updated;
      },
      remove: async (id: string) => {
        await db.remove(table, id);
        setRows((current) => current.filter((item) => item.id !== id));
      },
      replace: async (nextRows: TableRow<T>[]) => {
        await db.replace(table, nextRows);
        setRows(nextRows);
      },
    }),
    [error, loading, reload, rows, table],
  );

  return api;
}

export function useDatabaseSnapshot() {
  const [data, setData] = useState<Database>(cloneSeed());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setData(await db.getAll());
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    return subscribeToDemoChanges(() => void reload());
  }, [reload]);

  return { data, loading, reload };
}

#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

export const DBC_LOOKUP_BASE_URL = "https://search.dca.ca.gov/advanced";

export const PUBLIC_DIRECTORY_PROVIDER_COLUMNS = [
  "id",
  "state",
  "license_number",
  "license_type",
  "license_status",
  "board_verified_at",
];

const VALID_ACTIVE_STATUSES = new Set(["active", "current", "clear", "valid"]);
const REVIEW_STATUSES = new Set(["probation", "restricted", "discipline", "disciplinary", "accusation"]);
const INACTIVE_STATUSES = new Set(["expired", "inactive", "cancelled", "canceled", "revoked", "suspended", "retired", "delinquent"]);

function parseArgs(argv = process.argv.slice(2)) {
  const args = { mode: process.env.BOARD_SYNC_MODE || "json", dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replaceAll("-", "_");
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

export function normalizeLicenseNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isCaliforniaDirectoryProvider(row) {
  return String(row?.state || "").trim().toUpperCase() === "CA";
}

export function selectPublicDirectoryProviderColumns(row) {
  return Object.fromEntries(PUBLIC_DIRECTORY_PROVIDER_COLUMNS.map((column) => [column, row[column] ?? null]));
}

export function buildDcaLookupUrl({ licenseNumber, licenseType }) {
  const url = new URL(DBC_LOOKUP_BASE_URL);
  url.searchParams.set("boardCode", "800");
  url.searchParams.set("boardName", "Dental Board of California");
  url.searchParams.set("licenseNumber", normalizeLicenseNumber(licenseNumber));
  if (licenseType) url.searchParams.set("licenseType", String(licenseType));
  return url;
}

export function parseDcaHtml(html, licenseNumber) {
  const normalizedNeedle = normalizeLicenseNumber(licenseNumber);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  const lower = text.toLowerCase();

  if (!normalizedNeedle) return { found: false, rawStatus: "missing license number" };
  if (lower.includes("no records") || lower.includes("no results") || lower.includes("not found")) {
    return { found: false, rawStatus: "not found" };
  }
  if (!normalizeLicenseNumber(text).includes(normalizedNeedle)) {
    return { found: false, rawStatus: "not found" };
  }

  const statusMatch =
    text.match(/(?:primary\s+status|license\s+status|status)\s*:?\s*([A-Za-z /-]+)/i) ||
    text.match(/\b(Active|Current|Clear|Valid|Expired|Inactive|Cancelled|Canceled|Revoked|Suspended|Retired|Delinquent|Probation|Restricted|Disciplinary)\b/i);

  return {
    found: true,
    rawStatus: statusMatch?.[1]?.trim() || "unknown",
    sourceText: text.slice(0, 500),
  };
}

export function mapBoardStatus(result) {
  if (result.error) return "BOARD_LOOKUP_ERROR";
  if (result.missingLicense) return "MISSING_LICENSE";
  if (!result.found) return "NOT_FOUND";

  const normalized = String(result.rawStatus || "").toLowerCase();
  if ([...REVIEW_STATUSES].some((status) => normalized.includes(status))) return "DISCIPLINARY_REVIEW";
  if ([...INACTIVE_STATUSES].some((status) => normalized.includes(status))) return "VERIFIED_INACTIVE";
  if ([...VALID_ACTIVE_STATUSES].some((status) => normalized.includes(status))) return "VERIFIED_ACTIVE";
  return "VERIFIED_UNKNOWN";
}

export class DcaDentalBoardClient {
  constructor({ fetchImpl = globalThis.fetch, userAgent = "THEVETERINARIAN.AI board-sync/1.0" } = {}) {
    if (!fetchImpl) throw new Error("fetch is required for DCA lookup");
    this.fetchImpl = fetchImpl;
    this.userAgent = userAgent;
  }

  async verify(provider) {
    const licenseNumber = normalizeLicenseNumber(provider.license_number);
    if (!licenseNumber) return { missingLicense: true, found: false, rawStatus: "missing license number" };

    const url = buildDcaLookupUrl({ licenseNumber, licenseType: provider.license_type });
    const response = await this.fetchImpl(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": this.userAgent,
      },
    });
    if (!response.ok) {
      return { error: `DBC lookup HTTP ${response.status}`, found: false, rawStatus: "lookup error" };
    }
    return parseDcaHtml(await response.text(), licenseNumber);
  }
}

export async function syncDirectoryProviders({ providers, lookupClient, now = new Date(), logger = console }) {
  const verifiedAt = now.toISOString();
  const updates = [];
  const unchanged = [];
  const safeProviders = providers.map(selectPublicDirectoryProviderColumns);

  for (const provider of safeProviders) {
    if (!isCaliforniaDirectoryProvider(provider)) {
      unchanged.push({ id: provider.id, reason: "non_ca" });
      continue;
    }

    let boardResult;
    try {
      boardResult = normalizeLicenseNumber(provider.license_number)
        ? await lookupClient.verify(provider)
        : { missingLicense: true, found: false, rawStatus: "missing license number" };
    } catch (error) {
      boardResult = { error: error instanceof Error ? error.message : "lookup failed", found: false, rawStatus: "lookup error" };
    }

    const update = {
      id: provider.id,
      license_status: mapBoardStatus(boardResult),
      board_verified_at: verifiedAt,
    };
    updates.push(update);
    logger.info?.(
      JSON.stringify({
        event: "ca_dental_board_verified",
        id: provider.id,
        state: provider.state,
        license_status: update.license_status,
      }),
    );
  }

  return { updates, unchanged, verifiedAt };
}

async function runJsonMode(args, lookupClient) {
  if (!args.input) throw new Error("JSON mode requires --input <directory_provider.json>");
  const providers = JSON.parse(await readFile(args.input, "utf8"));
  if (!Array.isArray(providers)) throw new Error("JSON input must be an array of directory_provider rows");

  const result = await syncDirectoryProviders({ providers, lookupClient });
  const byId = new Map(result.updates.map((update) => [update.id, update]));
  const nextRows = providers.map((provider) => (byId.has(provider.id) ? { ...provider, ...byId.get(provider.id) } : provider));

  if (!args.dryRun) {
    await writeFile(args.output || args.input, `${JSON.stringify(nextRows, null, 2)}\n`);
  }
  return { ...result, rowsWritten: args.dryRun ? 0 : nextRows.length };
}

async function supabaseFetch(path, init = {}) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase REST ${response.status}: ${await response.text()}`);
  return response;
}

async function runSupabaseMode(args, lookupClient) {
  const columns = PUBLIC_DIRECTORY_PROVIDER_COLUMNS.join(",");
  const limit = args.limit ? `&limit=${encodeURIComponent(args.limit)}` : "";
  const response = await supabaseFetch(`directory_provider?state=eq.CA&select=${encodeURIComponent(columns)}${limit}`);
  const providers = await response.json();
  const result = await syncDirectoryProviders({ providers, lookupClient });

  if (!args.dryRun) {
    for (const update of result.updates) {
      await supabaseFetch(`directory_provider?id=eq.${encodeURIComponent(update.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          license_status: update.license_status,
          board_verified_at: update.board_verified_at,
        }),
      });
    }
  }

  return { ...result, rowsWritten: args.dryRun ? 0 : result.updates.length };
}

export async function main(argv = process.argv.slice(2), { lookupClient } = {}) {
  const args = parseArgs(argv);
  const client = lookupClient || new DcaDentalBoardClient();
  const result = args.mode === "supabase" ? await runSupabaseMode(args, client) : await runJsonMode(args, client);
  console.log(
    JSON.stringify({
      event: "ca_dental_board_sync_complete",
      mode: args.mode,
      verified_at: result.verifiedAt,
      updated: result.updates.length,
      skipped: result.unchanged.length,
      rows_written: result.rowsWritten,
    }),
  );
  return result;
}

if (basename(process.argv[1] || "") === "ca_dental_board_sync.mjs") {
  main().catch((error) => {
    console.error(JSON.stringify({ event: "ca_dental_board_sync_failed", error: error.message }));
    process.exitCode = 1;
  });
}

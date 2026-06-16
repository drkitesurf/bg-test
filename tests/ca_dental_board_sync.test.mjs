import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import {
  DcaDentalBoardClient,
  PUBLIC_DIRECTORY_PROVIDER_COLUMNS,
  main,
  mapBoardStatus,
  parseDcaHtml,
  selectPublicDirectoryProviderColumns,
  syncDirectoryProviders,
} from "../SCRIPTS/ca_dental_board_sync.mjs";

test("parseDcaHtml maps DBC active lookup HTML", async () => {
  const html = await readFile(new URL("./fixtures/dbc_active.html", import.meta.url), "utf8");
  const result = parseDcaHtml(html, "D-123456");
  assert.equal(result.found, true);
  assert.equal(result.rawStatus, "Active");
  assert.equal(mapBoardStatus(result), "VERIFIED_ACTIVE");
});

test("parseDcaHtml maps DBC no-records page", async () => {
  const html = await readFile(new URL("./fixtures/dbc_not_found.html", import.meta.url), "utf8");
  const result = parseDcaHtml(html, "999999");
  assert.equal(result.found, false);
  assert.equal(mapBoardStatus(result), "NOT_FOUND");
});

test("syncDirectoryProviders filters CA rows and only persists license_status plus board_verified_at", async () => {
  const providers = [
    {
      id: "ca-active",
      state: "CA",
      license_number: "123456",
      license_status: "UNKNOWN",
      board_verified_at: null,
      patient_name: "must not be selected",
    },
    { id: "ny-skip", state: "NY", license_number: "123456", license_status: "UNKNOWN", board_verified_at: null },
    { id: "ca-missing", state: "CA", license_number: "", license_status: "UNKNOWN", board_verified_at: null },
  ];
  const lookupClient = {
    async verify(provider) {
      if (provider.id === "ca-active") return { found: true, rawStatus: "Active" };
      throw new Error("missing license should not call remote lookup");
    },
  };

  const result = await syncDirectoryProviders({
    providers,
    lookupClient,
    now: new Date("2026-06-16T02:18:00.000Z"),
    logger: { info() {} },
  });

  assert.deepEqual(result.updates, [
    { id: "ca-active", license_status: "VERIFIED_ACTIVE", board_verified_at: "2026-06-16T02:18:00.000Z" },
    { id: "ca-missing", license_status: "MISSING_LICENSE", board_verified_at: "2026-06-16T02:18:00.000Z" },
  ]);
  assert.deepEqual(result.unchanged, [{ id: "ny-skip", reason: "non_ca" }]);
  assert.deepEqual(Object.keys(selectPublicDirectoryProviderColumns(providers[0])), PUBLIC_DIRECTORY_PROVIDER_COLUMNS);
  assert.equal("patient_name" in selectPublicDirectoryProviderColumns(providers[0]), false);
});

test("DcaDentalBoardClient uses official public lookup URL and strips license punctuation", async () => {
  let calledUrl;
  const client = new DcaDentalBoardClient({
    fetchImpl: async (url) => {
      calledUrl = url;
      return { ok: true, text: async () => "<div>License Number: 123456</div><div>Status: Active</div>" };
    },
  });
  const result = await client.verify({ license_number: "DDS-123456" });
  assert.equal(result.found, true);
  assert.equal(calledUrl.hostname, "search.dca.ca.gov");
  assert.equal(calledUrl.searchParams.get("licenseNumber"), "123456");
});

test("JSON mode updates CA directory_provider rows refresh-safely", async () => {
  const dir = await mkdir(join(tmpdir(), `board-sync-${Date.now()}`), { recursive: true });
  const input = join(dir, "providers.json");
  const output = join(dir, "updated.json");
  await writeFile(
    input,
    JSON.stringify([
      { id: "ca-1", state: "CA", license_number: "123456", license_status: "UNKNOWN", board_verified_at: null },
      { id: "or-1", state: "OR", license_number: "222222", license_status: "UNKNOWN", board_verified_at: null },
    ]),
  );

  await main(["--mode", "json", "--input", input, "--output", output], {
    lookupClient: { async verify() { return { found: true, rawStatus: "Active" }; } },
  });
  const rows = JSON.parse(await readFile(output, "utf8"));

  assert.equal(rows[0].license_status, "VERIFIED_ACTIVE");
  assert.match(rows[0].board_verified_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(rows[1].license_status, "UNKNOWN");
  await rm(dir, { recursive: true, force: true });
});

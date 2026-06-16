import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { runSafetyGate } from "../SCRIPTS/gates/nppes_ingest_unit_gate.mjs";

async function fixtureRoot(name) {
  const root = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}

test("hard-rails gate passes clean repository surfaces", async () => {
  const root = await fixtureRoot("gate-clean");
  await mkdir(join(root, "app"), { recursive: true });
  await writeFile(
    join(root, "app", "page.tsx"),
    "export default function Page() { return <p>Find licensed dental providers.</p>; }\n",
  );
  const result = await runSafetyGate({ root });
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  await rm(root, { recursive: true, force: true });
});

test("hard-rails gate blocks PHI on public paths", async () => {
  const root = await fixtureRoot("gate-phi");
  await mkdir(join(root, "public"), { recursive: true });
  await writeFile(join(root, "public", "profile.json"), '{"patient_name":"Jane Example"}\n');
  const result = await runSafetyGate({ root });
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].rail, "no_phi_on_public_paths");
  await rm(root, { recursive: true, force: true });
});

test("hard-rails gate blocks uncited public cost numbers", async () => {
  const root = await fixtureRoot("gate-cost");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs", "pricing.md"), "Our cost is $49 per visit.\n");
  const result = await runSafetyGate({ root });
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.rail === "cited_cost_rule"), true);
  await rm(root, { recursive: true, force: true });
});

test("hard-rails gate blocks paid placement language", async () => {
  const root = await fixtureRoot("gate-paid-placement");
  await mkdir(join(root, "app"), { recursive: true });
  await writeFile(join(root, "app", "directory.tsx"), "export const copy = 'sponsored provider results';\n");
  const result = await runSafetyGate({ root });
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.rail === "no_paid_placement"), true);
  await rm(root, { recursive: true, force: true });
});

test("hard-rails gate blocks clinical LLM without triage, AB 3030, and SB 1120 HITL", async () => {
  const root = await fixtureRoot("gate-llm");
  await mkdir(join(root, "app"), { recursive: true });
  await writeFile(
    join(root, "app", "clinical.ts"),
    "export async function clinicalTriage(symptom) { return anthropic.messages.create({ model: 'x', messages: [{ role: 'user', content: symptom }] }); }\n",
  );
  const result = await runSafetyGate({ root });
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.rail === "rule_based_triage_before_llm"), true);
  assert.equal(result.issues.some((issue) => issue.rail === "ab3030_disclosure_and_sb1120_hitl"), true);
  await rm(root, { recursive: true, force: true });
});

#!/usr/bin/env node

import { spawn } from "node:child_process";
import { runSafetyGate } from "./gates/nppes_ingest_unit_gate.mjs";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
    child.on("error", reject);
  });
}

const gate = await runSafetyGate();
console.log(JSON.stringify({ event: "hard_rails_gate", ok: gate.ok, checked_files: gate.checkedFiles, issues: gate.issues }, null, 2));
if (!gate.ok) process.exit(1);

await run(process.execPath, ["--test"]);
console.log(JSON.stringify({ event: "preflight_green" }));

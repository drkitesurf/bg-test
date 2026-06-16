#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative } from "node:path";

const require = createRequire(import.meta.url);
const hardRails = require("./hard_rails.json");

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".md", ".mdx", ".json", ".html"]);
const PUBLIC_SURFACE_DIRS = new Set(["app", "pages", "public", "content", "docs"]);
const PHI_PATTERNS = [
  /\bpatient[_ -]?name\b/i,
  /\bdate[_ -]?of[_ -]?birth\b/i,
  /\bdob\b/i,
  /\bssn\b/i,
  /\bmedical[_ -]?record\b/i,
  /\bmrn\b/i,
  /\bdiagnosis\b/i,
  /\bprescription\b/i,
];
const LLM_PATTERNS = [/\bopenai\b/i, /\banthropic\b/i, /\bclaude\b/i, /\bchatcompletion\b/i, /\bgenerate(?:Text|Object)?\b/i];
const CLINICAL_AI_PATTERNS = [/\bclinical\b/i, /\btriage\b/i, /\bsymptom\b/i, /\bemergency\b/i, /\bdiagnos/i];
const COST_PATTERNS = [/(?:\$|€|£)\s?\d[\d,.]*(?:\s?(?:k|m|million|thousand))?/i, /\b\d+(?:\.\d+)?\s?(?:usd|eur|gbp)\b/i];
const COST_CONTEXT = /\b(cost|price|pricing|fee|fees|charge|mrr|arr|revenue|valuation|round size|pre-money|post-money)\b/i;
const CITATION_PATTERN = /(https?:\/\/|doi:|\[source:|\bcitation:)/i;
const PAID_PLACEMENT_PATTERNS = [/\bpaid placement\b/i, /\bsponsored provider\b/i, /\badvertorial\b/i, /\bpay[- ]to[- ]rank\b/i];

function extension(path) {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

async function listSourceFiles(root) {
  const files = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (SOURCE_EXTENSIONS.has(extension(entry.name))) files.push(path);
    }
  }

  await walk(root);
  return files;
}

function isPublicSurface(root, file) {
  const [top] = relative(root, file).split(/[\\/]/);
  return PUBLIC_SURFACE_DIRS.has(top);
}

function lineNumberFor(content, index) {
  return content.slice(0, index).split("\n").length;
}

function assertRailsEnabled(issues) {
  for (const [name, enabled] of Object.entries(hardRails.rails)) {
    if (enabled !== true) issues.push({ rail: "never_weaken_gate", message: `${name} is disabled in hard_rails.json` });
  }
}

function scanPublicPhi(root, file, content, issues) {
  if (!isPublicSurface(root, file)) return;
  for (const pattern of PHI_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      issues.push({
        rail: "no_phi_on_public_paths",
        file: relative(root, file),
        line: lineNumberFor(content, match.index),
        message: `Potential PHI token on public path: ${match[0]}`,
      });
    }
  }
}

function scanTriageBeforeLlm(root, file, content, issues) {
  const llmMatches = LLM_PATTERNS.flatMap((pattern) => [...content.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))]);
  if (llmMatches.length === 0 || !CLINICAL_AI_PATTERNS.some((pattern) => pattern.test(content))) return;

  const firstLlm = Math.min(...llmMatches.map((match) => match.index ?? Number.POSITIVE_INFINITY));
  const triageIndex = content.search(/rule[-_ ]?based[-_ ]?triage|severity\s*>=?\s*8|emergency resources first/i);
  if (triageIndex === -1 || triageIndex > firstLlm) {
    issues.push({
      rail: "rule_based_triage_before_llm",
      file: relative(root, file),
      line: lineNumberFor(content, firstLlm),
      message: "Clinical LLM usage must be preceded by rule-based triage; severity 8+ must show emergency resources first.",
    });
  }
}

function scanClinicalAiDisclosure(root, file, content, issues) {
  if (!CLINICAL_AI_PATTERNS.some((pattern) => pattern.test(content)) || !LLM_PATTERNS.some((pattern) => pattern.test(content))) return;
  if (!/AB\s?3030|AB_3030_DISCLOSURE/i.test(content) || !/PENDING_HITL_REVIEW|SB\s?1120/i.test(content)) {
    issues.push({
      rail: "ab3030_disclosure_and_sb1120_hitl",
      file: relative(root, file),
      message: "AI clinical content must carry AB 3030 disclosure and SB 1120 PENDING_HITL_REVIEW handling.",
    });
  }
}

function scanCitedCosts(root, file, content, issues) {
  if (!isPublicSurface(root, file)) return;
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (COST_CONTEXT.test(line) && COST_PATTERNS.some((pattern) => pattern.test(line)) && !CITATION_PATTERN.test(line)) {
      issues.push({
        rail: "cited_cost_rule",
        file: relative(root, file),
        line: index + 1,
        message: "Public cost/price/financial number must include a citation.",
      });
    }
  });
}

function scanPaidPlacement(root, file, content, issues) {
  if (!isPublicSurface(root, file)) return;
  for (const pattern of PAID_PLACEMENT_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      issues.push({
        rail: "no_paid_placement",
        file: relative(root, file),
        line: lineNumberFor(content, match.index),
        message: "Paid placement language is not allowed.",
      });
    }
  }
}

export async function runSafetyGate({ root = process.cwd() } = {}) {
  const issues = [];
  assertRailsEnabled(issues);
  const files = await listSourceFiles(root);
  for (const file of files) {
    const content = await readFile(file, "utf8");
    scanPublicPhi(root, file, content, issues);
    scanTriageBeforeLlm(root, file, content, issues);
    scanClinicalAiDisclosure(root, file, content, issues);
    scanCitedCosts(root, file, content, issues);
    scanPaidPlacement(root, file, content, issues);
  }
  return { ok: issues.length === 0, issues, checkedFiles: files.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSafetyGate()
    .then((result) => {
      console.log(JSON.stringify({ event: "nppes_ingest_unit_gate", ...result }, null, 2));
      if (!result.ok) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(JSON.stringify({ event: "nppes_ingest_unit_gate_failed", error: error.message }));
      process.exitCode = 1;
    });
}

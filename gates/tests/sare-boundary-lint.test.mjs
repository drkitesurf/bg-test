#!/usr/bin/env node
/**
 * sare_boundary_lint — the SARE engine/adapter boundary gate, vendored from
 * dental-network-state (T-003; DOCS/SARE/00_ARCHITECTURE_BLUEPRINT.md §3 in
 * the donor repo) and re-pointed at THIS repo's inventory domain.
 *
 * Guarantees engine/ stays extractable as a standalone package and never
 * couples to STOWAWAY's own vertical:
 *   1. no inventory/travel/money/guest domain term appears in ANY file
 *      under engine/;
 *   2. no code file under engine/ imports/requires a vertical tree
 *      (adapters/, app/, worker/, importer/) or escapes engine/ via a
 *      relative parent import.
 * Also self-tests the scanner against known-bad fixtures so a silently
 * broken scan can never report a false PASS.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const engineDir = path.join(root, 'engine');

// STOWAWAY domain vocabulary that must never appear under engine/.
// Deliberately specific to THIS product (inventory/packing/property/bills/
// bookings), not general-purpose words ("item" alone would be too broad —
// engine/inventory (vendored, a generic reorder/PO module) legitimately
// says "item" of its own domain-free kind, so we ban the STOWAWAY nouns
// that name OUR vertical specifically, not every English word a generic
// module might use).
const BANNED_TERMS = /\b(stowaway|bulgaria|bansko|santa marina|lozenec|kite(?:surf\w*)?|wetsuit|flysurfer|packlist|pack[ _-]?item|trip itinerary|guest[ _-]?link|turnover[ _-]?task|reputation[ _-]?review|vps score)\b/i;

// Import/require reaches that would couple the engine to a vertical tree.
const BANNED_IMPORT = /(?:\bimport\b[^;]*?\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]((?:[^'"]*\/)?(?:adapters|app|worker|importer)\/[^'"]*|[^'"]*(?:\.\.\/\.\.\/)[^'"]*)['"]/;

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.yaml', '.yml']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function scanEngineTree(dir) {
  const violations = [];
  if (!fs.existsSync(dir)) return violations;
  for (const file of walk(dir)) {
    const rel = path.relative(dir, file);
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // binary — skip
    }
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const term = line.match(BANNED_TERMS);
      if (term) violations.push(`${rel}:${i + 1} banned domain term "${term[0]}"`);
      if (CODE_EXT.has(path.extname(file))) {
        const imp = line.match(BANNED_IMPORT);
        if (imp) violations.push(`${rel}:${i + 1} banned vertical import "${imp[1]}"`);
      }
    });
  }
  return violations;
}

// --- 1. self-test: the scanner MUST flag known-bad fixtures -----------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sare-lint-probe-'));
try {
  fs.writeFileSync(path.join(tmp, 'bad-term.js'), 'const label = "Bansko property inventory";\n');
  fs.writeFileSync(path.join(tmp, 'bad-import.mjs'), "import { x } from '../../app/lib/inventory.js';\n");
  fs.writeFileSync(path.join(tmp, 'clean.js'), "export const ok = (a) => a; // domain-free pipeline stage\n");
  const probe = scanEngineTree(tmp);
  assert.ok(probe.some((v) => v.includes('bad-term.js')), 'scanner failed to flag a domain term');
  assert.ok(probe.some((v) => v.includes('bad-import.mjs')), 'scanner failed to flag a vertical import');
  assert.ok(!probe.some((v) => v.includes('clean.js')), 'scanner false-positived on a clean file');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- 2. the real tree must exist (README contract) and be clean -------------
assert.ok(fs.existsSync(path.join(engineDir, 'README.md')), 'engine/README.md boundary contract missing');
const violations = scanEngineTree(engineDir);
assert.equal(
  violations.length,
  0,
  `engine/adapter boundary violated (${violations.length}):\n  ${violations.join('\n  ')}`,
);

console.log('sare_boundary_lint gate: PASS — engine/ is domain-free and vertically decoupled (scanner self-test green)');

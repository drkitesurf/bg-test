#!/usr/bin/env node
// CLI entry: parse BULGARIA MFC BAG.md -> normalized event stream.
// Usage: node importer/run.mjs [--out path] [--quiet]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDocument } from './parse.mjs';
import { buildEvents } from './emit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runImport(sourcePath) {
  const text = readFileSync(sourcePath, 'utf8');
  const { root, stats: parseStats } = parseDocument(text);
  const { events, stats: emitStats } = buildEvents(root);

  const totalContentLines = parseStats.totalContentLines;
  const resolvedLines = emitStats.itemCount + emitStats.headingCount + emitStats.structuralRelocationCount;
  const parseRate = totalContentLines === 0 ? 1 : resolvedLines / totalContentLines;

  const propertyEvents = events.filter((e) => e.verb === 'create_property');
  const propertySourceCounts = {};
  for (const e of events) {
    if (e.verb === 'create_container' || e.verb === 'create_space') {
      const src = e.payload.property_source || 'n/a';
      propertySourceCounts[src] = (propertySourceCounts[src] || 0) + 1;
    }
  }

  return {
    events,
    report: {
      total_content_lines: totalContentLines,
      items: emitStats.itemCount,
      headings: emitStats.headingCount,
      relocation_events: emitStats.structuralRelocationCount,
      parse_rate: Number(parseRate.toFixed(4)),
      properties: propertyEvents.map((e) => e.payload.name),
      space_or_container_property_source_counts: propertySourceCounts,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : join(__dirname, 'fixtures', 'bulgaria.expected.json');
  const quiet = args.includes('--quiet');
  const sourcePath = join(__dirname, '..', 'BULGARIA MFC BAG.md');

  const { events, report } = runImport(sourcePath);
  writeFileSync(outPath, JSON.stringify(events, null, 2) + '\n', 'utf8');

  if (!quiet) {
    console.log(`Wrote ${events.length} events to ${outPath}`);
    console.log(JSON.stringify(report, null, 2));
  }
}

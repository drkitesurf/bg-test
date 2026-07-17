import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../app/src/', import.meta.url));
const allowed = new Set(['.ts', '.tsx']);
const hex = /#[0-9a-f]{3,8}\b/gi;
const failures = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
    } else if (allowed.has(extname(entry.name))) {
      const contents = await readFile(path, 'utf8');
      const matches = contents.match(hex);
      if (matches) failures.push(`${relative(process.cwd(), path)}: ${matches.join(', ')}`);
    }
  }
}

await walk(root);
if (failures.length) {
  console.error(`Raw hex colors are forbidden in app components:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('no-raw-hex: PASS');

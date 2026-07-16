// @sare/veto/dedup — non-destructive near-duplicate clustering (Spine C, SARE-033).
//
// Domain-free. Keeps the veto store small and fast, and stops one bad act from
// counting as fifty, by clustering near-duplicate vectors. NON-DESTRUCTIVE: it
// returns cluster assignments (canonical + linked members); it never deletes —
// the same discipline as the directory identity-resolution pass. The similarity
// function is injectable so the vector format stays open.

/** Default cosine similarity over numeric arrays. */
export function cosineArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  let dot = 0; let na = 0; let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * Greedy near-duplicate clustering. Deterministic given input order.
 * @param {Array<{key:string, vec:any}>} rows
 * @param {object} opts
 *   opts.threshold   similarity at/above which two rows are duplicates (default 0.95)
 *   opts.similarity  (a, b) => number   (default cosineArray)
 * @returns {Array<{canonical:string, members:string[], size:number}>}
 */
export function dedupeVectors(rows, opts = {}) {
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : 0.95;
  const similarity = typeof opts.similarity === 'function' ? opts.similarity : cosineArray;
  const clusters = []; // { canonical, vec, members[] }
  for (const row of rows || []) {
    if (!row || row.key == null) continue;
    let placed = false;
    for (const c of clusters) {
      if (similarity(row.vec, c.vec) >= threshold) {
        c.members.push(row.key);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ canonical: row.key, vec: row.vec, members: [row.key] });
  }
  return clusters.map((c) => ({ canonical: c.canonical, members: c.members, size: c.members.length }));
}

/** Map key → canonical key, for excluding duplicates from ANN result weighting. */
export function canonicalMap(clusters) {
  const map = {};
  for (const c of clusters || []) {
    for (const m of c.members) map[m] = c.canonical;
  }
  return map;
}

export default dedupeVectors;

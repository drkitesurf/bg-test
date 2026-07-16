// @sare/veto/writer — embedding writer for the veto store (Spine C, SARE-031).
//
// Domain-free. Turns veto-worthy text into a persisted vector via two injected
// ports: `embed(text) => number[]` and `write({key, vector, text, meta})`.
// No provider SDK, no vertical-domain strings, no vertical imports — the adapter
// supplies both ports (pgvector upsert + embed_text / OpenAI embeddings).
//
// Idempotent: if `write` returns `{skipped:true}` (already has an embedding),
// the item counts as a no-op. Re-runs are therefore safe.

/**
 * @param {object} opts
 *   opts.embed  async (text:string) => number[]
 *   opts.write  async ({key, vector, text, meta}) =>
 *                 { ok:true, skipped?:boolean, key?:string } | { ok:false, error:string }
 *   opts.dimensions  expected vector length (optional; validated when set)
 */
export function createVetoWriter(opts = {}) {
  const embed = typeof opts.embed === 'function' ? opts.embed : null;
  const write = typeof opts.write === 'function' ? opts.write : null;
  const dimensions = Number.isFinite(opts.dimensions) ? opts.dimensions : null;

  async function writeVector(item = {}) {
    const key = item.key != null ? String(item.key) : '';
    const text = String(item.text || '').trim();
    const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
    if (!key) return { ok: false, error: 'key_required' };
    if (!text) return { ok: false, error: 'text_required' };
    if (!embed) return { ok: false, error: 'embed_unconfigured' };
    if (!write) return { ok: false, error: 'write_unconfigured' };

    let vector;
    try {
      vector = await embed(text);
    } catch (e) {
      return { ok: false, error: `embed_failed:${String((e && e.message) || e)}` };
    }
    if (!Array.isArray(vector) || !vector.length) {
      return { ok: false, error: 'embed_empty' };
    }
    if (dimensions != null && vector.length !== dimensions) {
      return { ok: false, error: `embed_dim_mismatch:${vector.length}!=${dimensions}` };
    }

    let saved;
    try {
      saved = await write({ key, vector, text, meta });
    } catch (e) {
      return { ok: false, error: `write_failed:${String((e && e.message) || e)}` };
    }
    if (!saved || saved.ok === false) {
      return { ok: false, error: (saved && saved.error) || 'write_rejected' };
    }
    return {
      ok: true,
      key: saved.key || key,
      skipped: saved.skipped === true,
      dims: vector.length,
    };
  }

  /**
   * Batch write. Stops counting failures but continues (best-effort) unless
   * opts.stopOnError. Re-runs that only hit already-embedded keys report skipped.
   */
  async function writeBatch(items, batchOpts = {}) {
    const list = Array.isArray(items) ? items : [];
    const stopOnError = batchOpts.stopOnError === true;
    const results = [];
    let written = 0;
    let skipped = 0;
    let failed = 0;
    for (const item of list) {
      const r = await writeVector(item);
      results.push(r);
      if (!r.ok) {
        failed += 1;
        if (stopOnError) break;
        continue;
      }
      if (r.skipped) skipped += 1;
      else written += 1;
    }
    return { ok: failed === 0, written, skipped, failed, results };
  }

  return { writeVector, writeBatch };
}

export default createVetoWriter;

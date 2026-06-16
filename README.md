# BG Test Repository
AI Training Data Generator - Medical Laboratory Data

## CA Dental Board sync

This branch adds `SCRIPTS/ca_dental_board_sync.mjs`, a public-directory-only sync for `directory_provider` rows where `state=CA`.

### Local JSON mode

```bash
npm run board:sync -- --mode json --input directory_provider.json --output directory_provider.updated.json
```

Only CA rows are verified. The script updates `license_status` and `board_verified_at`.

### Supabase REST mode

```bash
SUPABASE_URL=https://example.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run board:sync -- --mode supabase
```

The Supabase mode selects only public directory-provider columns:

- `id`
- `state`
- `license_number`
- `license_type`
- `license_status`
- `board_verified_at`

No PHI fields are selected or logged.

### Gates and preflight

```bash
npm run preflight
```

Preflight runs the NPPES-ingest-style hard-rails gate and unit tests. The gate fails closed for:

- PHI on public paths
- clinical LLM usage before rule-based triage, including severity 8+ emergency-first handling
- AI clinical content without AB 3030 disclosure and SB 1120 `PENDING_HITL_REVIEW`
- public cost/price numbers without citations
- paid placement language
- disabled hard rails

### n8n

Import `n8n/workflows/weekly_ca_dental_board_sync.json` into n8n for a weekly Sunday 02:15 cron that runs:

```bash
npm run board:sync -- --mode supabase
```

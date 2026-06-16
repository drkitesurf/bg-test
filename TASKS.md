# Tasks

- [x] Create `feat/board-sync-ca` branch.
- [x] Build `SCRIPTS/ca_dental_board_sync.mjs` to validate `directory_provider` rows where `state=CA` against the Dental Board of California public lookup.
- [x] Update only `license_status` and `board_verified_at` for verified CA rows.
- [x] Keep public sync paths PHI-free by selecting/logging only public directory-provider fields.
- [x] Add CA dental board sync unit tests.
- [x] Add `nppes_ingest_unit`-style hard-rails gate stub without weakening any gate.
- [x] Enforce hard rails in preflight: no public PHI, rule-based triage before LLM, AB 3030/SB 1120 HITL, cited-cost rule, and no paid placement.
- [x] Add weekly n8n cron export for CA dental board sync.
- [x] Make `npm run preflight` green.

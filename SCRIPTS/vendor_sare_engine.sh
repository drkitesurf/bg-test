#!/usr/bin/env bash
# Re-vendor engine/ from a dental-network-state clone at its current commit.
#
# Usage:
#   SCRIPTS/vendor_sare_engine.sh <path-to-dental-network-state-clone>          # re-vendor + update pin
#   SCRIPTS/vendor_sare_engine.sh <path-to-dental-network-state-clone> --check  # diff only, no write
#
# Never hand-edit files under engine/ to fix a bug found here — see
# engine/VENDORED.md. Fix upstream, then re-run this script.
set -euo pipefail

SRC_REPO="${1:-}"
MODE="${2:-}"

if [ -z "$SRC_REPO" ] || [ ! -d "$SRC_REPO/.git" ]; then
  echo "Usage: $0 <path-to-dental-network-state-clone> [--check]" >&2
  exit 1
fi
if [ ! -d "$SRC_REPO/engine" ]; then
  echo "error: $SRC_REPO/engine not found — is this a dental-network-state clone?" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$REPO_ROOT/engine"
SHA="$(git -C "$SRC_REPO" rev-parse HEAD)"
DATE="$(git -C "$SRC_REPO" log -1 --format='%ci')"

if [ "$MODE" = "--check" ]; then
  echo "Checking vendored engine/ against $SRC_REPO @ $SHA ..."
  if diff -rq "$SRC_REPO/engine" "$DEST" --exclude=VENDORED.md; then
    echo "OK: vendored tree matches donor working tree exactly (excluding VENDORED.md)."
    exit 0
  else
    echo "DRIFT DETECTED — vendored engine/ differs from the donor's current tree." >&2
    echo "Re-run without --check to update, or investigate the diff above." >&2
    exit 2
  fi
fi

echo "Vendoring engine/ from $SRC_REPO @ $SHA ($DATE) ..."

# VENDORED.md is owned by THIS repo (the donor has no such file) — preserve
# its curated prose across a re-vendor; only its provenance header updates.
VENDORED_MD_BACKUP=""
if [ -f "$DEST/VENDORED.md" ]; then
  VENDORED_MD_BACKUP="$(mktemp)"
  cp "$DEST/VENDORED.md" "$VENDORED_MD_BACKUP"
fi

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC_REPO/engine/." "$DEST/"

if [ -n "$VENDORED_MD_BACKUP" ]; then
  cp "$VENDORED_MD_BACKUP" "$DEST/VENDORED.md"
  rm -f "$VENDORED_MD_BACKUP"
  # update just the provenance lines, leave the curated prose intact
  sed -i.bak \
    -e "s/^\*\*Pinned commit:\*\*.*/\*\*Pinned commit:\*\* \`$SHA\` ($DATE)/" \
    -e "s/^\*\*Vendored:\*\*.*/\*\*Vendored:\*\* $(date -u +%Y-%m-%d)/" \
    -e "s/^\*\*Diff vs source at pin:\*\*.*/\*\*Diff vs source at pin:\*\* empty (just re-vendored)/" \
    "$DEST/VENDORED.md"
  rm -f "$DEST/VENDORED.md.bak"
else
  echo "note: no prior engine/VENDORED.md found to preserve — writing a minimal one"
  cat > "$DEST/VENDORED.md" <<EOF
# Vendored from dental-network-state

Source repo: drkitesurf/dental-network-state
Pinned commit: $SHA ($DATE)
Vendored: $(date -u +%Y-%m-%d)

Do not hand-edit files under engine/ -- fix upstream, then re-run this script.
EOF
fi

echo "Done. Pinned commit: $SHA"
echo "Run: node gates/tests/sare-boundary-lint.test.mjs && node gates/tests/engine-smoke.test.mjs"

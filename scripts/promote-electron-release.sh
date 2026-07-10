#!/usr/bin/env bash
# Runs on the update host while deploy-electron-update.sh holds .deploy.lock.
# Validate the staged manifest against both its bytes and the currently published
# release, then publish artifacts before atomically switching the manifest.
set -euo pipefail

TARGET_DIR="${1:?target directory required}"
STAGE_DIR="${2:?stage directory required}"
GUARD="$STAGE_DIR/electron-release-collision-guard.cjs"

mapfile -t ARTIFACTS < <(
  node "$GUARD" \
    --local "$STAGE_DIR/latest-linux.yml" \
    --artifacts-dir "$STAGE_DIR" \
    --remote "$TARGET_DIR/latest-linux.yml" \
    --print-files
)

if [ "${#ARTIFACTS[@]}" -eq 0 ]; then
  echo "[electron-release] Refusing to promote a manifest with no artifacts" >&2
  exit 1
fi

for artifact in "${ARTIFACTS[@]}"; do
  mv -f -- "$STAGE_DIR/$artifact" "$TARGET_DIR/$artifact"
done

# Publish this last: clients never observe a manifest before its files exist.
mv "$STAGE_DIR/latest-linux.yml" "$TARGET_DIR/latest-linux.yml"

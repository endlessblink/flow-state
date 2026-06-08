#!/usr/bin/env bash
# Read-only live readiness gate for FlowState server-backed AI memory.
#
# This command does not upload SQL, apply migrations, or write probe rows. It
# verifies that the VPS database is reachable and then checks whether PostgREST
# can see the AI memory schema required by the app.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JSON_OUT="${AI_MEMORY_LIVE_READINESS_JSON_OUT:-/tmp/flowstate-ai-memory-live-readiness-current.json}"

cd "$ROOT_DIR"

echo "[ai-memory-live-readiness] Running read-only VPS DB preflight..."
AI_MEMORY_PREFLIGHT_ONLY=1 npm run apply:ai-memory-live-migration

echo "[ai-memory-live-readiness] Running read-only REST schema check..."
npm run check:ai-memory-schema -- --json --json-out "$JSON_OUT"

echo "[ai-memory-live-readiness] Live AI memory schema is ready."
echo "[ai-memory-live-readiness] JSON report: $JSON_OUT"

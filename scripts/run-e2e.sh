#!/usr/bin/env bash
# TASK-1457: Run Playwright E2E tests with auto-fetched Supabase keys
# Usage: ./scripts/run-e2e.sh [playwright args...]
# Example: ./scripts/run-e2e.sh --grep "Morning Dashboard"

set -euo pipefail

get_supabase_status_value() {
  local key="$1"
SUPABASE_STATUS_KEY="$key" node -e '
const key = process.env.SUPABASE_STATUS_KEY;
const { spawnSync } = require("node:child_process");

try {
  const result = spawnSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) process.exit(0);
  const status = JSON.parse(output.slice(start, end + 1));
  if (status[key]) process.stdout.write(status[key]);
} catch {
  process.exit(0);
}
'
}

# Auto-fetch keys from local Supabase if not already set
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  # Try new-format secret key first (Supabase v2.x uses sb_secret_* instead of HS256 JWT)
  SUPABASE_SERVICE_ROLE_KEY=$(get_supabase_status_value SECRET_KEY)
  # Fall back to classic JWT SERVICE_ROLE_KEY if secret key not present
  if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    SUPABASE_SERVICE_ROLE_KEY=$(get_supabase_status_value SERVICE_ROLE_KEY)
  fi
fi

if [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  # Try new-format publishable key first (Supabase v2.x)
  VITE_SUPABASE_ANON_KEY=$(get_supabase_status_value PUBLISHABLE_KEY)
  # Fall back to classic ANON_KEY if publishable key not present
  if [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
    VITE_SUPABASE_ANON_KEY=$(get_supabase_status_value ANON_KEY)
  fi
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: Could not fetch Supabase keys. Is local Supabase running? (supabase start)"
  exit 1
fi

export SUPABASE_SERVICE_ROLE_KEY
export VITE_SUPABASE_ANON_KEY
export SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
# Override VITE_SUPABASE_URL so the Vite dev server connects to local Supabase
# (not production from .env.local). Env vars take precedence over .env files in Vite.
export VITE_SUPABASE_URL="${SUPABASE_URL}"

exec npx playwright test "$@"

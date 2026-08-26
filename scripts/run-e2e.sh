#!/usr/bin/env bash
# TASK-1457: Run Playwright E2E tests with auto-fetched Supabase keys
# Usage: ./scripts/run-e2e.sh [playwright args...]
# Example: ./scripts/run-e2e.sh --grep "Morning Dashboard"

set -euo pipefail

# Auto-fetch keys from local Supabase if not already set
SUPABASE_STATUS_ENV="${SUPABASE_STATUS_ENV:-$(supabase status -o env 2>&1 || true)}"

status_value() {
  local key="$1"
  printf '%s\n' "$SUPABASE_STATUS_ENV" \
    | awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); gsub(/^"|"$/, ""); print; exit }'
}

LOCAL_API_URL=$(status_value API_URL)
LOCAL_SERVICE_ROLE_KEY=$(status_value SERVICE_ROLE_KEY)
if [ -z "$LOCAL_SERVICE_ROLE_KEY" ]; then
  LOCAL_SERVICE_ROLE_KEY=$(status_value SECRET_KEY)
fi
LOCAL_ANON_KEY=$(status_value PUBLISHABLE_KEY)
if [ -z "$LOCAL_ANON_KEY" ]; then
  LOCAL_ANON_KEY=$(status_value ANON_KEY)
fi

if [ -n "$LOCAL_API_URL" ]; then
  # A running local Supabase instance owns the E2E boundary, even when a
  # caller injected production credentials for the surrounding build.
  SUPABASE_URL="$LOCAL_API_URL"
  SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SERVICE_ROLE_KEY"
  VITE_SUPABASE_ANON_KEY="$LOCAL_ANON_KEY"
else
  # Preserve explicitly supplied credentials for remote or externally managed
  # E2E environments when local Supabase is unavailable.
  SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
  VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}"
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: Could not fetch Supabase keys. Is local Supabase running? (supabase start)"
  exit 1
fi

export SUPABASE_SERVICE_ROLE_KEY
export VITE_SUPABASE_ANON_KEY
export SUPABASE_URL
export SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
# Override VITE_SUPABASE_URL so the Vite dev server connects to local Supabase
# (not production from .env.local). Env vars take precedence over .env files in Vite.
export VITE_SUPABASE_URL="${SUPABASE_URL}"

node scripts/check-local-e2e-canonical-schema.cjs

exec npx playwright test "$@"

#!/usr/bin/env bash
# TASK-1457: Run Playwright E2E tests with auto-fetched Supabase keys
# Usage: ./scripts/run-e2e.sh [playwright args...]
# Example: ./scripts/run-e2e.sh --grep "Morning Dashboard"

set -euo pipefail

# Auto-fetch keys from local Supabase if not already set
SUPABASE_STATUS_ENV="${SUPABASE_STATUS_ENV:-$(npx supabase status -o env 2>&1 || true)}"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  # Try new-format secret key first (Supabase v2.x uses sb_secret_* instead of HS256 JWT)
  SUPABASE_SERVICE_ROLE_KEY=$(printf '%s\n' "$SUPABASE_STATUS_ENV" | grep '^SECRET_KEY=' | sed 's/^SECRET_KEY="//' | sed 's/"$//')
  # Fall back to classic JWT SERVICE_ROLE_KEY if secret key not present
  if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    SUPABASE_SERVICE_ROLE_KEY=$(printf '%s\n' "$SUPABASE_STATUS_ENV" | grep '^SERVICE_ROLE_KEY=' | sed 's/^SERVICE_ROLE_KEY="//' | sed 's/"$//')
  fi
fi

if [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  # Try new-format publishable key first (Supabase v2.x)
  VITE_SUPABASE_ANON_KEY=$(printf '%s\n' "$SUPABASE_STATUS_ENV" | grep '^PUBLISHABLE_KEY=' | sed 's/^PUBLISHABLE_KEY="//' | sed 's/"$//')
  # Fall back to classic ANON_KEY if publishable key not present
  if [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
    VITE_SUPABASE_ANON_KEY=$(printf '%s\n' "$SUPABASE_STATUS_ENV" | grep '^ANON_KEY=' | sed 's/^ANON_KEY="//' | sed 's/"$//')
  fi
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: Could not fetch Supabase keys. Is local Supabase running? (npx supabase start)"
  exit 1
fi

export SUPABASE_SERVICE_ROLE_KEY
export VITE_SUPABASE_ANON_KEY
export SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
# Override VITE_SUPABASE_URL so the Vite dev server connects to local Supabase
# (not production from .env.local). Env vars take precedence over .env files in Vite.
export VITE_SUPABASE_URL="${SUPABASE_URL}"

node scripts/check-local-e2e-canonical-schema.cjs

exec npx playwright test "$@"

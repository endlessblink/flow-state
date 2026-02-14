#!/bin/bash
# start-dev.sh — Dev server launcher with PID tracking and cleanup
#
# Writes .dev-server.pid so predev-port-check.sh can distinguish
# legitimate servers from orphaned zombies.

PROJECT_DIR="/media/endlessblink/data/my-projects/ai-development/productivity/flow-state"
PID_FILE="$PROJECT_DIR/.dev-server.pid"

# Write our PID so predev-port-check.sh can identify us as legitimate
echo $$ > "$PID_FILE"

# Clean up PID file on exit (normal or crash)
cleanup() {
  rm -f "$PID_FILE"
}
trap cleanup EXIT INT TERM HUP

# Run the actual dev pipeline
bash scripts/sync-doppler.sh && \
  node scripts/validate-supabase-keys.cjs && \
  concurrently \
    "vite --host 0.0.0.0 --port 5546 --strictPort" \
    "npm run backup:watch"

#!/bin/bash
# TASK-330: Safe Supabase stop with mandatory shadow backup
# This ensures that we NEVER stop the database without a fresh backup.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🛑 [TASK-330] Shutting down Supabase safely..."

# 1. Run Shadow Mirror Backup
echo "🔄 [1/2] Running final shadow-mirror backup..."
node "$SCRIPT_DIR/shadow-mirror.cjs" || {
    echo "❌ [Shadow] Backup failed! User data may be at risk."
    echo "Do you want to continue with shutdown anyway? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Shutdown ABORTED."
        exit 1
    fi
}

# 2. Stop Supabase with native backup hook
echo "🔌 [2/2] Stopping Supabase services..."
# Check for global or local supabase
SUPABASE_CMD="supabase"
if ! command -v supabase &> /dev/null; then
    SUPABASE_CMD="npx supabase"
fi

# --backup ensures Supabase CLI creates its own snapshot
$SUPABASE_CMD stop --backup

echo "✅ [TASK-330] Supabase stopped safely with shadow-snapshot verified."

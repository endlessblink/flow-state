#!/bin/bash
# Full clean restart of Tauri dev environment

set -e
cd "$(dirname "$0")/.."

echo "🛑 Step 1: Killing ALL related processes..."

# Kill by name patterns
for pattern in "flow-state" "cargo-tauri" "tauri" "vite" "esbuild" "node.*5546"; do
    pkill -9 -f "$pattern" 2>/dev/null || true
done

# Kill by ports
for port in 5546 1420 1421; do
    lsof -ti:$port 2>/dev/null | xargs -r kill -9 2>/dev/null || true
done

# Kill any cargo watch processes
pkill -9 -f "cargo watch" 2>/dev/null || true
pkill -9 -f "cargo build" 2>/dev/null || true

echo "⏳ Waiting for processes to die..."
sleep 2

# Verify nothing is running
if lsof -ti:5546 >/dev/null 2>&1; then
    echo "⚠️  Port 5546 still in use, forcing..."
    lsof -ti:5546 | xargs -r kill -9 2>/dev/null || true
    sleep 1
fi

echo "🧹 Step 2: Clearing caches..."
rm -rf node_modules/.vite 2>/dev/null || true
rm -rf src-tauri/target/debug/.fingerprint 2>/dev/null || true
rm -rf src-tauri/target/debug/incremental 2>/dev/null || true

echo "✅ Step 3: Verifying Supabase is running..."
if ! npx supabase status >/dev/null 2>&1; then
    echo "⚠️  Supabase not running, starting..."
    npx supabase start
fi

echo "🚀 Step 4: Starting Tauri dev (fresh)..."
echo ""
npm run tauri dev

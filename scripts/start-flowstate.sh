#!/bin/bash
# Start FlowState with all dependencies

echo "🚀 Starting FlowState..."

# Check if Supabase is running
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:54321/rest/v1/ 2>/dev/null | grep -q "200"; then
    echo "✅ Supabase already running"
else
    echo "⏳ Starting Supabase..."
    cd "$(dirname "${BASH_SOURCE[0]}")"
    supabase start
fi

# Start the Tauri app
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "🍅 Launching FlowState..."
"$SCRIPT_DIR/src-tauri/target/release/flow-state" &

echo "✅ FlowState started!"

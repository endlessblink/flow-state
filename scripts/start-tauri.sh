#!/bin/bash
# FlowState Tauri Quick Start Script

echo "🔄 Killing existing FlowState processes..."
npm run kill 2>/dev/null || true
pkill -f "flow-state" 2>/dev/null || true

echo "📦 Installing dependencies..."
npm install

echo "🚀 Starting Tauri dev mode..."
npm run tauri dev

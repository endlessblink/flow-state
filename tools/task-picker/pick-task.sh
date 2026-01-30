#!/bin/bash
# FlowState Task Picker - convenience wrapper
# Run from anywhere in the project

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
npx tsx index.tsx "$@"

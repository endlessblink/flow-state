#!/bin/bash

# Debug hook to test if hooks are triggering at all
set -euo pipefail

# Create debug log file
DEBUG_LOG="/tmp/claude-hook-debug.log"

# Get current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

# Log hook trigger
echo "[$TIMESTAMP] Hook triggered!" >> "$DEBUG_LOG"
echo "[$TIMESTAMP] Action: $1" >> "$DEBUG_LOG"
echo "[$TIMESTAMP] Tool Name: $2" >> "$DEBUG_LOG"
echo "[$TIMESTAMP] Data: $3" >> "$DEBUG_LOG"
echo "[$TIMESTAMP] Environment Variables:" >> "$DEBUG_LOG"
env | grep CLAUDE_ >> "$DEBUG_LOG" || echo "No CLAUDE_ variables found" >> "$DEBUG_LOG"
echo "[$TIMESTAMP] ----------------------------------------" >> "$DEBUG_LOG"
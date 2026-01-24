#!/bin/bash
# Auto-sync secrets from Doppler to .env.local
# This runs before npm run dev to ensure secrets are up to date

# Skip if Doppler not installed or not configured
if ! command -v doppler &> /dev/null; then
    # Doppler not installed - use existing .env.local
    exit 0
fi

# Check if we're in a Doppler project
if ! doppler configs &> /dev/null 2>&1; then
    # Not configured - check for DOPPLER_TOKEN in environment
    if [ -z "$DOPPLER_TOKEN" ]; then
        # No Doppler config, use existing .env.local
        exit 0
    fi
fi

# Sync secrets to .env.local
echo "🔄 Syncing secrets from Doppler..."
doppler secrets download --no-file --format env > .env.local 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Doppler secrets synced to .env.local"
else
    echo "⚠️  Doppler sync failed, using existing .env.local"
fi

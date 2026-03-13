#!/bin/bash
# Purge entire Cloudflare cache for FlowState (in-theflow.com)

set -e

if ! command -v doppler &> /dev/null; then
  echo "Error: doppler CLI not found"
  exit 1
fi

CF_ZONE_ID=$(doppler secrets get CF_ZONE_ID --plain) || { echo "Error: CF_ZONE_ID not in Doppler"; exit 1; }
CF_API_TOKEN=$(doppler secrets get CF_API_TOKEN --plain) || { echo "Error: CF_API_TOKEN not in Doppler"; exit 1; }

echo "Purging Cloudflare cache..."

RESPONSE=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "Done - Cloudflare cache purged"
else
  echo "Error: $RESPONSE"
  exit 1
fi

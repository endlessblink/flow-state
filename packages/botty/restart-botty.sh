#!/bin/bash
# Restart Botty container with fresh secrets from Doppler
set -e

DOPPLER_DIR=/opt/waha  # Doppler is scoped to this directory

echo "Fetching secrets from Doppler..."
GROQ_KEY=$(cd "$DOPPLER_DIR" && doppler secrets get GROQ_API_KEY --plain)
WAHA_KEY=$(cd "$DOPPLER_DIR" && doppler secrets get WAHA_API_KEY --plain)
SERVICE_KEY=$(cd "$DOPPLER_DIR" && doppler secrets get SUPABASE_SERVICE_ROLE_KEY --plain)
ALLOWED_CHATS=$(cd "$DOPPLER_DIR" && doppler secrets get ALLOWED_CHAT_IDS --plain 2>/dev/null || echo "")

SUPABASE_URL="https://api.in-theflow.com"
DEFAULT_USER="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

echo "Stopping existing botty container..."
docker stop botty 2>/dev/null || true
docker rm botty 2>/dev/null || true

echo "Rebuilding botty image from source..."
docker build -t botty:latest /opt/botty/

echo "Starting Botty..."
docker run -d \
  --name botty \
  --restart unless-stopped \
  --network supabase_default \
  -e "WAHA_URL=http://waha:3000" \
  -e "WAHA_API_KEY=${WAHA_KEY}" \
  -e "GROQ_API_KEY=${GROQ_KEY}" \
  -e "SUPABASE_URL=${SUPABASE_URL}" \
  -e "SUPABASE_SERVICE_KEY=${SERVICE_KEY}" \
  -e "BOT_PORT=3001" \
  -e "ALLOWED_CHAT_IDS=${ALLOWED_CHATS}" \
  -e "DEFAULT_USER_ID=${DEFAULT_USER}" \
  botty:latest

echo "Done! Botty running."
docker ps --filter name=botty --format "table {{.Names}}\t{{.Status}}"

if [ -z "$ALLOWED_CHATS" ]; then
  echo ""
  echo "NOTE: ALLOWED_CHAT_IDS is empty in Doppler."
  echo "Send a WhatsApp message and run: docker logs botty"
  echo "Look for: [BOTTY] Rejected message from unlisted chat: <YOUR_CHAT_ID>"
  echo "Then: cd /opt/waha && doppler secrets set ALLOWED_CHAT_IDS='<YOUR_CHAT_ID>'"
  echo "Then re-run: bash /opt/botty/restart-botty.sh"
fi

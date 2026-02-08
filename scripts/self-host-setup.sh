#!/usr/bin/env bash
# ============================================================================
# FlowState Self-Hosting Setup Wizard
# ============================================================================
#
# Interactive script that configures and launches a self-hosted FlowState
# instance using Docker Compose.
#
# Usage:
#   ./scripts/self-host-setup.sh
#
# What it does:
#   1. Checks prerequisites (docker, docker compose, openssl, node)
#   2. Generates secure secrets (Postgres password, JWT secret, Supabase keys)
#   3. Writes .env.self-host with all generated values
#   4. Optionally configures Cloudflare Tunnel for external access
#   5. Starts Docker Compose stack
#   6. Waits for health checks
#   7. Prints access URL and next steps
#
# Safe to re-run: prompts before overwriting existing config.
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors & helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# Detect script directory (works from any cwd)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.self-host.yml"
ENV_FILE="$PROJECT_DIR/.env.self-host"

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║         FlowState Self-Hosting Setup              ║"
echo "  ║   Task management + Pomodoro + Canvas views       ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Check prerequisites
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

MISSING=()

# Docker
if ! command -v docker &>/dev/null; then
  MISSING+=("docker")
else
  success "docker $(docker --version | head -1 | sed 's/Docker version /v/' | sed 's/,.*//')"
fi

# Docker Compose (v2 plugin or standalone)
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  success "docker compose $(docker compose version --short 2>/dev/null || echo '(available)')"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
  success "docker-compose $(docker-compose --version | sed 's/.*version //' | sed 's/,.*//')"
else
  MISSING+=("docker-compose")
fi

# openssl
if ! command -v openssl &>/dev/null; then
  MISSING+=("openssl")
else
  success "openssl $(openssl version | awk '{print $2}')"
fi

# node (for JWT key generation)
if ! command -v node &>/dev/null; then
  MISSING+=("node")
else
  success "node $(node --version)"
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  error "Missing required tools: ${MISSING[*]}"
  echo ""
  echo "  Install instructions:"
  for tool in "${MISSING[@]}"; do
    case "$tool" in
      docker)
        echo "    docker:          https://docs.docker.com/get-docker/"
        ;;
      docker-compose)
        echo "    docker compose:  https://docs.docker.com/compose/install/"
        ;;
      openssl)
        echo "    openssl:         apt install openssl / brew install openssl"
        ;;
      node)
        echo "    node:            https://nodejs.org/ (v20+ recommended)"
        ;;
    esac
  done
  echo ""
  exit 1
fi

echo ""

# ---------------------------------------------------------------------------
# Step 2: Check for existing config
# ---------------------------------------------------------------------------
if [ -f "$ENV_FILE" ]; then
  warn "Found existing .env.self-host"
  echo ""
  read -rp "  Overwrite existing configuration? [y/N] " OVERWRITE
  if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
    info "Keeping existing configuration. Starting services..."
    # Skip to docker compose up
    cd "$PROJECT_DIR"
    info "Starting Docker Compose stack..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    success "Services started. Check status with: docker compose -f docker-compose.self-host.yml ps"
    exit 0
  fi
  echo ""
fi

# ---------------------------------------------------------------------------
# Step 3: Check that docker-compose file exists
# ---------------------------------------------------------------------------
if [ ! -f "$COMPOSE_FILE" ]; then
  error "docker-compose.self-host.yml not found at $COMPOSE_FILE"
  echo "  Make sure you are running this from the FlowState project root."
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 4: Generate secrets
# ---------------------------------------------------------------------------
info "Generating secure secrets..."

POSTGRES_PASSWORD="$(openssl rand -hex 32)"
JWT_SECRET="$(openssl rand -hex 32)"

success "Generated Postgres password (64 hex chars)"
success "Generated JWT secret (64 hex chars)"

# Generate Supabase JWT keys using Node.js (inline, mirrors generate-supabase-keys.cjs)
info "Generating Supabase JWT keys..."

read -r ANON_KEY SERVICE_ROLE_KEY <<< "$(node -e "
const crypto = require('crypto');
const secret = '$JWT_SECRET';
const exp = Math.floor(Date.now() / 1000) + (10 * 365.25 * 24 * 60 * 60); // 10 years

function jwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

const anon = jwt({ iss: 'supabase', ref: 'self-hosted', role: 'anon', iat: Math.floor(Date.now()/1000), exp });
const service = jwt({ iss: 'supabase', ref: 'self-hosted', role: 'service_role', iat: Math.floor(Date.now()/1000), exp });
process.stdout.write(anon + ' ' + service);
")"

success "Generated anon key"
success "Generated service_role key"

# ---------------------------------------------------------------------------
# Step 5: Prompt for configuration
# ---------------------------------------------------------------------------
echo ""
info "Configuration options:"
echo ""

# Site URL
read -rp "  Site URL [http://localhost:3050]: " SITE_URL
SITE_URL="${SITE_URL:-http://localhost:3050}"

# Cloudflare Tunnel (optional)
echo ""
read -rp "  Enable Cloudflare Tunnel for external access? [y/N] " ENABLE_TUNNEL
TUNNEL_TOKEN=""
if [[ "$ENABLE_TUNNEL" =~ ^[Yy]$ ]]; then
  echo ""
  echo "  To get a tunnel token:"
  echo "    1. Go to https://one.dash.cloudflare.com/"
  echo "    2. Navigate to Networks > Tunnels"
  echo "    3. Create a tunnel and copy the token"
  echo ""
  read -rp "  Cloudflare Tunnel token: " TUNNEL_TOKEN
  if [ -z "$TUNNEL_TOKEN" ]; then
    warn "No token provided. Tunnel will not be configured."
    ENABLE_TUNNEL="n"
  fi
fi

# ---------------------------------------------------------------------------
# Step 6: Write .env.self-host
# ---------------------------------------------------------------------------
info "Writing .env.self-host..."

cat > "$ENV_FILE" << ENVEOF
# ============================================================================
# FlowState Self-Hosting Configuration
# Generated by self-host-setup.sh on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# ============================================================================

# --- Postgres ---
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# --- Supabase Auth ---
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# --- URLs ---
# Public-facing URL where users access FlowState
SITE_URL=${SITE_URL}

# Supabase API gateway URL (Kong on port 8000)
API_EXTERNAL_URL=http://localhost:8000

# --- Email (default: no SMTP — emails auto-confirmed) ---
SMTP_HOST=inbucket
SMTP_PORT=2500
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=FlowState
SMTP_ADMIN_EMAIL=admin@localhost

# --- Cloudflare Tunnel (optional) ---
ENABLE_TUNNEL=${ENABLE_TUNNEL:-n}
TUNNEL_TOKEN=${TUNNEL_TOKEN}

# --- AI Chat (optional) ---
# For local AI: install Ollama (https://ollama.com) on the host
# The container connects to host Ollama via host.docker.internal:11434
OLLAMA_HOST=host.docker.internal
OLLAMA_PORT=11434

# For cloud AI: uncomment and set your Groq API key
# GROQ_API_KEY=gsk_your_key_here

# --- Frontend build args ---
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
ENVEOF

success "Wrote $ENV_FILE"
echo ""

# ---------------------------------------------------------------------------
# Step 7: Start Docker Compose
# ---------------------------------------------------------------------------
info "Starting FlowState..."
echo ""

cd "$PROJECT_DIR"
$COMPOSE_CMD -f "$COMPOSE_FILE" up -d

echo ""

# ---------------------------------------------------------------------------
# Step 8: Wait for health checks
# ---------------------------------------------------------------------------
info "Waiting for services to become healthy (up to 120 seconds)..."

TIMEOUT=120
ELAPSED=0
INTERVAL=5

while [ $ELAPSED -lt $TIMEOUT ]; do
  # Check if all services are healthy/running
  UNHEALTHY=$($COMPOSE_CMD -f "$COMPOSE_FILE" ps --format json 2>/dev/null | \
    node -e "
      let data = '';
      process.stdin.on('data', d => data += d);
      process.stdin.on('end', () => {
        try {
          // docker compose ps --format json can output one JSON per line
          const lines = data.trim().split('\n').filter(Boolean);
          const services = lines.map(l => JSON.parse(l));
          const bad = services.filter(s =>
            s.Health === 'unhealthy' || s.State === 'exited' || s.State === 'dead'
          );
          process.stdout.write(String(bad.length));
        } catch(e) {
          process.stdout.write('unknown');
        }
      });
    " 2>/dev/null || echo "unknown")

  if [ "$UNHEALTHY" = "0" ]; then
    echo ""
    success "All services are running!"
    break
  fi

  # Show progress
  printf "\r  Waiting... %ds / %ds" "$ELAPSED" "$TIMEOUT"
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo ""
  warn "Some services may still be starting. Check status with:"
  echo "  $COMPOSE_CMD -f docker-compose.self-host.yml ps"
fi

# ---------------------------------------------------------------------------
# Step 9: Print summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║          FlowState is ready!                      ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "  ${BOLD}FlowState App:${NC}      ${SITE_URL}"
echo -e "  ${BOLD}Supabase API:${NC}       http://localhost:8000"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo "    View logs:        $COMPOSE_CMD -f docker-compose.self-host.yml logs -f"
echo "    Stop:             $COMPOSE_CMD -f docker-compose.self-host.yml down"
echo "    Restart:          $COMPOSE_CMD -f docker-compose.self-host.yml restart"
echo "    Update:           git pull && $COMPOSE_CMD -f docker-compose.self-host.yml up -d --build"
echo ""

if [[ "${ENABLE_TUNNEL:-n}" =~ ^[Yy]$ ]]; then
  echo -e "  ${BOLD}Cloudflare Tunnel:${NC}  Configured. Check tunnel status at:"
  echo "                      https://one.dash.cloudflare.com/ > Networks > Tunnels"
  echo ""
fi

echo "  First-time setup:"
echo "    1. Open ${SITE_URL} in your browser"
echo "    2. Create an account (email + password)"
echo "    3. Start adding tasks!"
echo ""
echo "  For Tauri desktop app, see: docs/SELF-HOSTING.md#option-c-build-tauri-desktop-app"
echo ""
echo -e "  ${CYAN}Full documentation: docs/SELF-HOSTING.md${NC}"
echo ""

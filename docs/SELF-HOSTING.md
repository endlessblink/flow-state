# Self-Hosting FlowState

FlowState is a Vue 3 productivity app with task management (Board, Calendar, Canvas views), an integrated Pomodoro timer, gamification, and AI chat. This guide covers all the ways to run your own instance.

---

## Table of Contents

- [Quick Start (5 Minutes)](#quick-start-5-minutes)
- [What You Get](#what-you-get)
- [Prerequisites](#prerequisites)
- [Option A: Docker Self-Hosting](#option-a-docker-self-hosting)
- [Option B: Local Development](#option-b-local-development)
- [Option C: Build Tauri Desktop App](#option-c-build-tauri-desktop-app)
- [Enabling External Access](#enabling-external-access)
- [Optional: AI Chat](#optional-ai-chat)
- [Troubleshooting](#troubleshooting)
- [Updating](#updating)
- [Architecture Overview](#architecture-overview)

---

## Quick Start (5 Minutes)

The fastest path from zero to a running FlowState instance:

```bash
git clone https://github.com/user/flow-state.git
cd flow-state
./scripts/self-host-setup.sh
```

The setup wizard will:
1. Verify you have Docker, Docker Compose, openssl, and Node.js
2. Generate secure secrets (Postgres password, JWT keys, Supabase keys)
3. Ask for your site URL and a few optional settings
4. Start the Docker Compose stack
5. Wait for everything to become healthy
6. Print the access URL

Open http://localhost:3050 in your browser and create an account.

---

## What You Get

| Feature | Docker | Local Dev | Tauri Desktop |
|---------|--------|-----------|---------------|
| Task Management (Board, Calendar, Canvas) | Yes | Yes | Yes |
| Pomodoro Timer with cross-device sync | Yes | Yes | Yes |
| Real-time sync via Supabase | Yes | Yes | Yes |
| Gamification (XP, achievements, shop) | Yes | Yes | Yes |
| AI Chat (Ollama local) | Yes | Yes | Yes |
| AI Chat (Groq cloud) | Config required | Config required | Config required |
| Supabase Studio (DB admin) | No (use `supabase start` for Studio) | Yes (port 54323) | N/A |
| Native desktop app | N/A | N/A | Yes |
| Auto-updates | N/A | N/A | Yes |
| Offline mode | N/A | N/A | Yes |

---

## Prerequisites

### All Platforms

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker](https://docs.docker.com/get-docker/) | 24+ | Container runtime |
| [Docker Compose](https://docs.docker.com/compose/install/) | v2+ | Multi-container orchestration |
| [Node.js](https://nodejs.org/) | 20+ | JWT key generation, frontend build |
| openssl | Any | Secret generation |
| Git | Any | Clone the repository |

### Linux (Ubuntu/Debian)

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect

# Node.js 20 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# openssl (usually pre-installed)
sudo apt-get install -y openssl
```

### macOS

```bash
# Docker Desktop
brew install --cask docker

# Node.js
brew install node@20

# openssl (usually pre-installed via LibreSSL)
```

### Windows

Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) with WSL 2 backend.

All commands below should be run in WSL 2 (Ubuntu) or Git Bash.

```bash
# Inside WSL 2:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs openssl
```

---

## Option A: Docker Self-Hosting

This is the recommended approach for running FlowState as a persistent service.

### 1. Clone and Run Setup

```bash
git clone https://github.com/user/flow-state.git
cd flow-state
./scripts/self-host-setup.sh
```

### 2. What Gets Created

The setup script creates a `.env.self-host` file with all secrets and configuration, then starts:

| Service | Port | Description |
|---------|------|-------------|
| **flowstate** | 3000 | Vue 3 frontend (nginx serving static files) |
| **db** | 5432 | PostgreSQL 17 database (Supabase-flavored) |
| **auth** | 9999 | GoTrue authentication server |
| **rest** | 3000 (internal) | PostgREST REST API |
| **realtime** | 4000 | Real-time WebSocket server (timer sync) |
| **kong** | 8000 | API gateway (routes to auth, rest, realtime) |
| **cloudflared** | — | Cloudflare Tunnel (optional, for HTTPS access) |

### 3. Access Your Instance

- **FlowState App**: http://localhost:3000
- **Supabase API**: http://localhost:8000

### 4. Managing the Stack

```bash
# View logs
docker compose -f docker-compose.self-host.yml logs -f

# View logs for a specific service
docker compose -f docker-compose.self-host.yml logs -f flowstate

# Stop all services
docker compose -f docker-compose.self-host.yml down

# Stop and remove volumes (WARNING: deletes all data)
docker compose -f docker-compose.self-host.yml down -v

# Restart
docker compose -f docker-compose.self-host.yml restart

# Check service status
docker compose -f docker-compose.self-host.yml ps
```

### 5. Database Backups

```bash
# Manual backup
docker compose -f docker-compose.self-host.yml exec db \
  pg_dumpall -U postgres > backup-$(date +%Y%m%d).sql

# Restore from backup
docker compose -f docker-compose.self-host.yml exec -T db \
  psql -U postgres < backup-20260208.sql
```

---

## Option B: Local Development

For contributors or those who want to run from source without Docker containers for the frontend.

### 1. Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh

# Windows (scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2. Clone and Install

```bash
git clone https://github.com/user/flow-state.git
cd flow-state
npm install
```

### 3. Start Supabase

```bash
supabase start
```

This spins up a local Supabase stack via Docker. Note the output -- it shows your local API URL, anon key, and service role key.

### 4. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with the values from `supabase start` output:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start output>
```

Or generate keys matching the local Supabase secret:

```bash
npm run generate:keys
# Copy the output to .env.local
```

### 5. Run Database Migrations

```bash
supabase db reset
```

This applies all migrations from `supabase/migrations/`.

### 6. Start the Dev Server

```bash
npm run dev
```

The app starts at http://localhost:5546.

### 7. Login Credentials

The seed file creates a development user automatically:

| Field | Value |
|-------|-------|
| Email | `dev@flowstate.local` |
| Password | `dev123` |

### Key Dev Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (port 5546) |
| `npm run build` | Production build |
| `npm run test` | Run tests (Vitest) |
| `npm run lint` | Lint code (ESLint) |
| `npm run type-check` | TypeScript type checking |
| `npm run generate:keys` | Generate Supabase JWT keys |
| `npm run kill` | Kill all FlowState processes |

### Ports Reference (Local Dev)

| Port | Service |
|------|---------|
| 5546 | Vite dev server (FlowState UI) |
| 54321 | Supabase API (PostgREST + Auth) |
| 54322 | PostgreSQL direct |
| 54323 | Supabase Realtime (WebSocket) |
| 54324 | Supabase Storage |
| 54325 | Supabase Studio (DB admin UI) |

---

## Option C: Build Tauri Desktop App

FlowState can be compiled as a native desktop app using [Tauri 2.x](https://tauri.app/). The desktop app supports offline mode and auto-updates.

### Prerequisites (in addition to base requirements)

| Tool | Version | Install |
|------|---------|---------|
| [Rust](https://rustup.rs/) | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| System libraries | varies | See below per platform |

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++".

### Build Steps

```bash
# 1. Install frontend dependencies
npm install

# 2. Configure environment (same as Option B)
cp .env.example .env.local
# Edit .env.local with your Supabase URL and keys

# 3. Build the desktop app
npm run build
npx tauri build
```

The built application will be in:
- **Linux**: `src-tauri/target/release/bundle/appimage/` (AppImage)
- **macOS**: `src-tauri/target/release/bundle/dmg/` (DMG)
- **Windows**: `src-tauri/target/release/bundle/nsis/` (NSIS installer)

### Running the Desktop App

```bash
# Linux - run the AppImage directly
chmod +x src-tauri/target/release/bundle/appimage/FlowState_*.AppImage
./src-tauri/target/release/bundle/appimage/FlowState_*.AppImage

# Or run in dev mode (hot-reload)
npx tauri dev
```

---

## Enabling External Access

To make your FlowState instance accessible from the internet, the recommended approach is a Cloudflare Tunnel (free, no port forwarding needed).

### Cloudflare Tunnel Setup

1. Create a free [Cloudflare](https://dash.cloudflare.com/) account
2. Add your domain to Cloudflare (or use a free `*.trycloudflare.com` subdomain)
3. Go to **Networks > Tunnels** and create a tunnel
4. Copy the tunnel token

**If you already ran setup**, edit `.env.self-host`:
```
ENABLE_TUNNEL=y
TUNNEL_TOKEN=your-token-here
```

Then restart:
```bash
docker compose -f docker-compose.self-host.yml up -d
```

**If you haven't run setup yet**, the setup wizard will ask if you want to enable Cloudflare Tunnel and prompt for the token.

### Configure the Tunnel Route

In the Cloudflare dashboard, configure your tunnel to route:
- `yourdomain.com` to `http://flowstate:3000`
- `api.yourdomain.com` to `http://kong:8000`

Then update `.env.self-host`:
```
SITE_URL=https://yourdomain.com
API_EXTERNAL_URL=https://api.yourdomain.com
```

And restart the stack.

### Alternative: Reverse Proxy (Caddy, Nginx, Traefik)

If you prefer using your own reverse proxy, expose ports 3000 (frontend) and 8000 (API) and configure TLS termination at your proxy.

Example Caddy config:
```
yourdomain.com {
    reverse_proxy localhost:3000
}

api.yourdomain.com {
    reverse_proxy localhost:8000
}
```

---

## Optional: AI Chat

FlowState includes an AI chat sidebar that can help with task management. It supports two backends:

### Ollama (Local, Private)

[Ollama](https://ollama.com/) runs AI models entirely on your machine. No data leaves your network.

1. Install Ollama on the host machine (not inside Docker):
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. Pull a model:
   ```bash
   ollama pull llama3.2
   ```

3. The Docker stack is pre-configured to connect to Ollama on the host via `host.docker.internal:11434`. If running locally (Option B), it connects to `localhost:11434`.

4. In FlowState, go to **Settings > AI** and select Ollama as the provider.

### Groq (Cloud, Fast)

[Groq](https://groq.com/) provides fast cloud inference. Requires an API key.

1. Get an API key at https://console.groq.com/
2. For Docker (Option A): add `GROQ_API_KEY=gsk_your_key_here` to `.env.self-host` and restart
3. For local dev (Option B): AI chat uses Supabase Edge Functions — no API keys needed in `.env.local` (BUG-1131)
4. In FlowState, go to **Settings > AI** and select Groq as the provider

### Supabase Edge Functions (Advanced)

For server-side AI key management via Supabase Edge Functions:

```bash
# Add API keys to your Supabase instance
supabase secrets set GROQ_API_KEY=your-key
supabase secrets set OPENROUTER_API_KEY=your-key

# Deploy the proxy function
supabase functions deploy ai-chat-proxy
```

---

## Troubleshooting

### Services won't start

```bash
# Check which services are failing
docker compose -f docker-compose.self-host.yml ps

# Check logs for a specific service
docker compose -f docker-compose.self-host.yml logs db
docker compose -f docker-compose.self-host.yml logs auth
```

### Port conflicts

If port 3000, 8000, or 5432 is already in use:

```bash
# Find what's using the port
lsof -i :3000
# or
ss -tlnp | grep 3000
```

Edit `.env.self-host` to change ports, or stop the conflicting service.

### `npm run dev` fails with "JWT signature mismatch"

```bash
npm run generate:keys
# Copy the output to .env.local
```

### Database connection errors

```bash
# Verify the database is running
docker compose -f docker-compose.self-host.yml exec db pg_isready -U postgres

# Check database logs
docker compose -f docker-compose.self-host.yml logs db
```

### Authentication not working (401 errors)

1. Verify JWT keys are correct:
   ```bash
   grep JWT_SECRET .env.self-host
   grep ANON_KEY .env.self-host
   ```
2. The ANON_KEY must be a JWT signed with the JWT_SECRET. If you edited the JWT_SECRET manually, re-run the setup script to regenerate all keys.

### "Cannot connect to Supabase" in the app

1. Check that the Supabase Kong gateway is running:
   ```bash
   curl -s http://localhost:8000/rest/v1/ -H "apikey: YOUR_ANON_KEY"
   ```
2. Verify `VITE_SUPABASE_URL` in `.env.self-host` matches the Kong gateway URL.

### Ollama AI chat not working

1. Verify Ollama is running on the host: `curl http://localhost:11434/api/tags`
2. On Linux, `host.docker.internal` may not resolve. The docker-compose file includes an `extra_hosts` mapping for this. If it still fails, use the host's LAN IP instead.

### Supabase won't start (local dev)

```bash
# Make sure Docker is running
docker info

# Reset Supabase (WARNING: deletes local data)
npx supabase stop
npx supabase start
```

### Tasks disappear on refresh

Check that the anon key in `.env.local` (or `.env.self-host`) matches the JWT secret used by Supabase. Mismatched keys cause silent auth failures.

### Port 5546 already in use (local dev)

```bash
npm run kill
npm run dev
```

### Reset everything (Docker)

```bash
# Stop and remove all containers and volumes
docker compose -f docker-compose.self-host.yml down -v

# Remove generated config
rm .env.self-host

# Start fresh
./scripts/self-host-setup.sh
```

---

## Updating

### Docker (Option A)

```bash
# Pull latest code
git pull

# Rebuild and restart (new migrations run automatically)
docker compose -f docker-compose.self-host.yml up -d --build
```

### Local Development (Option B)

```bash
git pull
npm install

# Apply new migrations (non-destructive)
npx supabase migration up

# Or full reset (WARNING: deletes data, re-runs all migrations + seed)
npx supabase db reset

npm run dev
```

### Tauri Desktop (Option C)

If you built from source:
```bash
git pull
npm install
npm run build
npx tauri build
```

---

## Architecture Overview

```
                    Internet
                       |
              Cloudflare Tunnel (optional)
                       |
            +----------+----------+
            |     Docker Host      |
            |                      |
            |  +--- flowstate ---+ |  :3000  Vue 3 SPA (nginx)
            |  +--- kong --------+ |  :8000  API Gateway
            |  +--- rest --------+ |         PostgREST
            |  +--- auth --------+ |         GoTrue Auth
            |  +--- realtime ----+ |         WebSocket Sync
            |  +--- db ----------+ |  :5432  PostgreSQL 17
            |                      |
            +----------------------+
```

**Tech stack:**
- Frontend: Vue 3 + TypeScript + Vite + Pinia
- UI: Tailwind CSS + Naive UI + Glass morphism design
- Canvas: Vue Flow (node-based task visualization)
- Backend: Supabase (PostgreSQL + GoTrue Auth + Realtime + PostgREST)
- Desktop: Tauri 2.x (Rust + WebView)
- AI: Ollama (local) / Groq (cloud)

For detailed architecture documentation, see [architecture.md](claude-md-extension/architecture.md).

---

## Doppler

Doppler is **not needed** for self-hosting or local development. It is only used for the official production deployment. Your `.env.self-host` (Docker) or `.env.local` (local dev) file is all you need.

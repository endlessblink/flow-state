# Self-Hosting FlowState

Run FlowState locally with your own Supabase instance. No cloud account needed.

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node -v` |
| npm | 10+ | `npm -v` |
| Docker Desktop | Latest | `docker -v` |
| Supabase CLI | Latest | `npx supabase --version` |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/user/flow-state.git
cd flow-state
npm install

# 2. Start local Supabase (Postgres, Auth, Realtime, Storage)
npx supabase start

# 3. Copy Supabase keys to .env.local
#    supabase start prints API URL and anon key — copy them:
cp .env.example .env.local
#    Edit .env.local with the values from step 2:
#      VITE_SUPABASE_URL=http://127.0.0.1:54321
#      VITE_SUPABASE_ANON_KEY=<anon key from supabase start output>

# 4. Generate JWT keys (validates your local Supabase keys)
npm run generate:keys

# 5. Start dev server
npm run dev
# Open http://localhost:5546
```

## Login Credentials

The seed file creates a development user automatically:

| Field | Value |
|-------|-------|
| Email | `dev@flowstate.local` |
| Password | `dev123` |

## Tauri Desktop Build

Build FlowState as a native desktop app that connects to your local Supabase:

```bash
# Ensure .env.local has your local Supabase URL
# VITE_SUPABASE_URL=http://127.0.0.1:54321

# Build the web assets + native app
npm run build && npx tauri build

# Install (Linux)
sudo dpkg -i src-tauri/target/release/bundle/deb/FlowState_*.deb

# Install (macOS)
# Open the .dmg from src-tauri/target/release/bundle/dmg/

# Install (Windows)
# Run the .msi from src-tauri/target/release/bundle/msi/
```

The Tauri app reads `VITE_SUPABASE_URL` from your `.env.local` at build time. If unset, it falls back to the official cloud instance.

## Optional: AI Chat

FlowState includes an AI chat panel. You have two options:

### Option A: Ollama (Local, Free)

```bash
# Install Ollama: https://ollama.ai
ollama pull llama3.2

# Default config works out of the box:
# VITE_OLLAMA_HOST=localhost
# VITE_OLLAMA_PORT=11434
```

### Option B: Supabase Edge Functions (Cloud)

For cloud AI providers (Groq, OpenRouter), deploy the edge function:

```bash
# Add API keys to your Supabase instance
supabase secrets set GROQ_API_KEY=your-key
supabase secrets set OPENROUTER_API_KEY=your-key

# Deploy the proxy
supabase functions deploy ai-chat-proxy
```

## What Works Locally

| Feature | Status | Notes |
|---------|--------|-------|
| Task Management | Works | All views: Board, Calendar, Canvas, Focus |
| Pomodoro Timer | Works | Notifications, break tracking |
| Cloud Sync | Works | Via local Supabase |
| Gamification | Works | XP, achievements, shop |
| AI Chat | Works | Requires Ollama or Edge Functions |
| PWA Install | Works | Browser install prompt |
| Tauri Desktop | Works | Build with local Supabase URL |
| Cross-device Sync | N/A | Requires exposing Supabase to network |
| Auto-updater | N/A | Only for official releases |

## Ports Reference

| Port | Service |
|------|---------|
| 5546 | Vite dev server (FlowState UI) |
| 54321 | Supabase API (PostgREST + Auth) |
| 54322 | PostgreSQL direct |
| 54323 | Supabase Realtime (WebSocket) |
| 54324 | Supabase Storage |
| 54325 | Supabase Studio (DB admin UI) |

## Troubleshooting

### `npm run dev` fails with "JWT signature mismatch"

```bash
npm run generate:keys
# Copy the output to .env.local
```

### Supabase won't start

```bash
# Make sure Docker is running
docker info

# Reset Supabase (WARNING: deletes local data)
npx supabase stop
npx supabase start
```

### Login fails with 401

1. Verify Supabase is running: `npx supabase status`
2. Check that `.env.local` has the correct `VITE_SUPABASE_ANON_KEY`
3. Re-run: `npm run generate:keys`

### Tasks disappear on refresh

Check that the anon key in `.env.local` matches `npx supabase status` output. Mismatched keys cause silent auth failures.

### Port 5546 already in use

```bash
npm run kill
# Then retry
npm run dev
```

## Doppler

Doppler is **not needed** for local development. It's only used for the production deployment at in-theflow.com. Your `.env.local` file is all you need locally.

## Database Migrations

When pulling new changes that include migration files (`supabase/migrations/`):

```bash
# Apply new migrations to your local database
npx supabase db reset
# This resets the DB and re-runs all migrations + seed.sql

# Or apply only new migrations (preserves data)
npx supabase migration up
```

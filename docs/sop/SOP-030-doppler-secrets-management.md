# SOP-030: Doppler Secrets Management

**Status**: Active
**Created**: 2026-01-23
**Related Task**: TASK-351

## Overview

FlowState uses [Doppler](https://doppler.com) for secure secrets management across CI/CD and VPS deployments. This eliminates the need for `.env` files in production.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DOPPLER PROJECT                            │
│                         (flowstate-prod)                            │
├─────────────────────────────────────────────────────────────────────┤
│  Environments:                                                      │
│  ├── dev        → Local development (optional)                      │
│  ├── staging    → Staging environment                               │
│  └── prod       → Production (VPS + CI/CD)                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │  GitHub CI  │         │    VPS      │         │  Release    │
    │  (Actions)  │         │  (Deploy)   │         │  (Tauri)    │
    └─────────────┘         └─────────────┘         └─────────────┘
```

## Required Secrets

### Application Secrets (Doppler)

| Secret | Required | Description |
|--------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| ~~VITE_OPENAI_API_KEY~~ | No | Removed — AI keys are now server-side in Supabase Edge Functions (BUG-1131) |
| ~~VITE_GROQ_API_KEY~~ | No | Removed — AI keys are now server-side in Supabase Edge Functions (BUG-1131) |
| `NODE_ENV` | Yes | Environment (production) |

### GitHub Repository Secrets

These must remain in GitHub Secrets (not Doppler):

| Secret | Required | Description |
|--------|----------|-------------|
| `DOPPLER_TOKEN` | Yes | Doppler service token for CI/CD |
| `SSH_PRIVATE_KEY` | Yes | SSH key for VPS deployment |
| `VPS_HOST` | Yes | VPS hostname/IP |
| `VPS_USER` | Yes | VPS SSH username |
| `VPS_TARGET_DIR` | Yes | Deployment directory on VPS |
| `TAURI_SIGNING_PRIVATE_KEY` | Yes | Tauri update signing key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Yes | Tauri signing key password |

## Setup Instructions

### 1. Create Doppler Project

1. Sign up at [doppler.com](https://doppler.com)
2. Create a new project: `flowstate-prod`
3. Create environments: `dev`, `staging`, `prod`

### 2. Add Secrets to Doppler

In Doppler dashboard, add these secrets to the `prod` environment:

```
VITE_SUPABASE_URL=https://api.in-theflow.com
VITE_SUPABASE_ANON_KEY=<your-production-key>
# AI API keys are now server-side only (BUG-1131) — no VITE_* keys needed for AI
NODE_ENV=production
```

### 3. Create Service Token

1. In Doppler: Project > Access > Service Tokens
2. Create token for `prod` environment
3. Copy the token (starts with `dp.st.`)

### 4. Add Token to GitHub

1. Go to: GitHub repo > Settings > Secrets and variables > Actions
2. Add secret: `DOPPLER_TOKEN` = `<your-service-token>`

### 5. VPS One-Time Setup (Optional)

If you prefer to have Doppler CLI pre-installed on VPS:

```bash
# SSH into VPS
ssh user@your-vps

# Install Doppler CLI
curl -sLf --retry 3 --tlsv1.2 --proto "=https" \
  'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | \
  sudo tee /etc/apt/sources.list.d/doppler-cli.list

sudo apt-get update && sudo apt-get install -y doppler

# Verify installation
doppler --version
```

Note: The deployment workflow auto-installs Doppler CLI if not present.

## Workflow Integration

### Deploy Workflow (`.github/workflows/deploy.yml`)

The deploy workflow:
1. Installs Doppler CLI in CI
2. Downloads secrets to `.env.production` for build
3. SSHs to VPS and generates `.env` from Doppler
4. Restarts Docker containers

### Release Workflow (`.github/workflows/release.yml`)

The release workflow:
1. Installs Doppler CLI
2. Downloads secrets for production build
3. Uses GitHub Secrets for Tauri signing (kept separate for security)

### CI Workflow (`.github/workflows/ci.yml`)

The CI workflow:
1. Optionally uses Doppler if `DOPPLER_TOKEN` is configured
2. Falls back to building without secrets (for public CI builds)

## Local Development

For local development, continue using `.env.local`:

```bash
# Copy example and fill in your values
cp .env.example .env.local
```

Or use Doppler CLI locally:

```bash
# Install Doppler CLI locally
brew install dopplerhq/cli/doppler  # macOS
# or
curl -sLf https://cli.doppler.com/install.sh | sh  # Linux

# Login and configure
doppler login
doppler setup

# Run with secrets injected
doppler run -- npm run dev
```

## Troubleshooting

### "Invalid token" error

1. Verify the token is for the correct project/environment
2. Check the token hasn't been revoked in Doppler dashboard
3. Regenerate if necessary

### "Secret not found" error

1. Ensure secrets exist in the correct environment (prod vs staging)
2. Check for typos in secret names
3. Verify the service token has access to the environment

### VPS Deployment Fails

1. SSH into VPS and check Doppler is installed: `doppler --version`
2. Test manually: `DOPPLER_TOKEN=<token> doppler secrets download --no-file --format env`
3. Check Docker can read the generated `.env` file

## Security Notes

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Rotate tokens periodically** - Create new service tokens and update GitHub secrets
3. **Use environment-specific tokens** - Don't share tokens between environments
4. **Audit access** - Regularly review who has access to Doppler project

## Migration Checklist

- [x] Update `deploy.yml` to use Doppler
- [x] Update `release.yml` to use Doppler
- [x] Update `ci.yml` to use Doppler (optional)
- [ ] Create Doppler project (user action)
- [ ] Add secrets to Doppler (user action)
- [ ] Create service token (user action)
- [ ] Add `DOPPLER_TOKEN` to GitHub secrets (user action)
- [ ] Test deployment (user action)
- [ ] Remove `.env` files from VPS after successful migration (user action)

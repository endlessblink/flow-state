# SOP-032: Self-Hosted Mobile Client for Claude Code + Dev-Maestro

**Created:** 2026-01-29
**Status:** Active
**Task:** TASK-1105

## Overview

This SOP documents the self-hosted mobile client solution that provides secure mobile access to Claude Code sessions and Dev-Maestro task management.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           YOUR MACHINE                                   │
│                                                                          │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────────────┐ │
│  │ Claude Code  │───►│ Happy CLI        │───►│ Local Relay Server     │ │
│  │ (sessions)   │    │ (forked/hardened)│    │ (replaces cluster-     │ │
│  └──────────────┘    └──────────────────┘    │  fluster.com)          │ │
│                                              │ Port 3847              │ │
│  ┌──────────────┐                            │                        │ │
│  │ Dev-Maestro  │◄──────────────────────────►│ + Dev-Maestro proxy    │ │
│  │ (port 6010)  │    SSE / REST              │   /maestro/* → :6010   │ │
│  └──────────────┘                            └───────────┬────────────┘ │
│                                                          │              │
└──────────────────────────────────────────────────────────┼──────────────┘
                                                           │
                                              Cloudflare Tunnel
                                              (encrypted, no open ports)
                                                           │
                                                           ▼
                                              ┌────────────────────────┐
                                              │ mobile.in-theflow.com  │
                                              │ (Cloudflare Access)    │
                                              └───────────┬────────────┘
                                                          │
                                              HTTPS (Cloudflare SSL)
                                                          │
                                                          ▼
                                              ┌────────────────────────┐
                                              │ Your Phone             │
                                              │ - Happy mobile app     │
                                              │ - PWA fallback         │
                                              └────────────────────────┘
```

## Components

### 1. Happy Local Fork

Location: `~/projects/happy-local/`

A security-hardened fork of [happy-cli](https://github.com/slopus/happy-cli) with:

| Change | Purpose |
|--------|---------|
| Local relay server | Replaces external cluster-fluster.com |
| Command allowlist | Blocks dangerous RPC commands |
| File write disabled | Prevents remote file writes by default |
| Token local-only | Tokens never sent to external servers |

### 2. Local Relay Server

The relay server (`src/relay-server/`) provides:

- **Socket.IO relay** for real-time Claude Code session events
- **Dev-Maestro proxy** at `/maestro/*` → localhost:6010
- **REST endpoints** for session and machine management
- **Health check** at `/health`

### 3. Cloudflare Tunnel

Securely exposes the local relay without opening ports:

- **Domain:** mobile.in-theflow.com
- **Authentication:** Cloudflare Access (email OTP)
- **Encryption:** TLS 1.3 end-to-end

## Setup

### Prerequisites

1. cloudflared installed
2. Cloudflare account with in-theflow.com domain
3. Node.js 20+
4. Dev-Maestro installed at ~/.dev-maestro

### Step 1: Clone and Setup Happy Local

```bash
# Already done - fork is at ~/projects/happy-local
cd ~/projects/happy-local
npm install
```

### Step 2: Configure Cloudflare Tunnel

```bash
# Login to Cloudflare (opens browser)
cloudflared tunnel login

# Create tunnel and DNS route
./scripts/setup-tunnel.sh
```

### Step 3: Configure Cloudflare Access (Security)

```bash
# Follow the interactive guide
./scripts/setup-access.sh
```

Then in Cloudflare dashboard:
1. Go to Zero Trust > Access > Applications
2. Create application for mobile.in-theflow.com
3. Add policy: Allow your email address

### Step 4: Start the Services

**Option A: Combined startup script**
```bash
./scripts/start-mobile-relay.sh
```

**Option B: Manual startup**
```bash
# Terminal 1: Start relay server
npm run relay

# Terminal 2: Start tunnel
cloudflared tunnel --config ~/.cloudflared/config-happy.yml run
```

**Option C: Systemd service (persistent)**
```bash
systemctl --user enable claude-mobile-tunnel
systemctl --user start claude-mobile-tunnel
```

## Security Hardening

### Security Levels

Set via `HAPPY_SECURITY_LEVEL` environment variable:

| Level | Description | Use Case |
|-------|-------------|----------|
| `strict` | Allowlist only (read-only commands) | Untrusted networks, shared access |
| `standard` | Block dangerous commands (DEFAULT) | Self-hosted with Cloudflare Access |
| `relaxed` | Block only system-level dangers | Full trust in Access authentication |
| `off` | No restrictions | Development/testing only |

**What's blocked at each level:**

| Command | strict | standard | relaxed | off |
|---------|--------|----------|---------|-----|
| `npm run dev` | ✗ | ✓ | ✓ | ✓ |
| `curl localhost` | ✗ | ✓ | ✓ | ✓ |
| `rm -rf /tmp/test` | ✗ | ✓ | ✓ | ✓ |
| `rm -rf /` | ✗ | ✗ | ✓ | ✓ |
| `sudo apt update` | ✗ | ✗ | ✗ | ✓ |
| `dd if=/dev/zero` | ✗ | ✗ | ✗ | ✓ |

**Recommendation:** Use `standard` (default) for personal self-hosted use with Cloudflare Access.

```bash
# Set security level
HAPPY_SECURITY_LEVEL=standard npm run relay

# Or in your shell profile
export HAPPY_SECURITY_LEVEL=standard
```

**Disable command execution entirely:**
```bash
HAPPY_DISABLE_BASH_RPC=true npm run relay
```

### File Writes

File writes are **disabled by default**.

**Enable (use with caution):**
```bash
HAPPY_ENABLE_WRITE_RPC=true npm run relay
```

### Network Security

- **No open ports:** Cloudflare Tunnel uses outbound-only connections
- **E2E encryption:** All traffic encrypted via Cloudflare's edge
- **Access control:** Cloudflare Access requires authentication
- **Token isolation:** API tokens never leave your machine

## Dev-Maestro Integration

The relay server proxies Dev-Maestro on `/maestro/*`:

| Mobile Route | Dev-Maestro API | Purpose |
|--------------|-----------------|---------|
| `/maestro/status` | `/api/status` | Server health |
| `/maestro/master-plan` | `/api/master-plan` | Task list |
| `/maestro/task/:id/status` | `/api/task/:id/status` | Update task |
| `/maestro/health/cached` | `/api/health/cached` | Code health |
| `/maestro/orchestrator/:id/stream` | SSE passthrough | Real-time |

**Requires Dev-Maestro running:**
```bash
cd ~/.dev-maestro && npm start
```

## Verification

### Test Local Relay
```bash
curl http://localhost:3847/health
# Should return: {"status":"ok",...}
```

### Test Tunnel (without Access)
```bash
curl https://mobile.in-theflow.com/health
# Should return: {"status":"ok",...} or redirect to Access
```

### Test Dev-Maestro Proxy
```bash
curl http://localhost:3847/maestro/status
# Should return Dev-Maestro status
```

### Test Cloudflare Access
```bash
~/.cloudflared/test-access.sh
# Should report Access is protecting endpoint
```

## Troubleshooting

### Relay server won't start

```bash
# Check if port is in use
lsof -i :3847

# Kill existing process
fuser -k 3847/tcp

# Retry
npm run relay
```

### Tunnel not connecting

```bash
# Check tunnel status
cloudflared tunnel list

# Check config
cat ~/.cloudflared/config-happy.yml

# Re-authenticate
cloudflared tunnel login
```

### Dev-Maestro proxy 502

```bash
# Start Dev-Maestro
cd ~/.dev-maestro && npm start

# Verify it's running
curl http://localhost:6010/api/status
```

### Mobile app can't connect

1. Verify tunnel is running
2. Check Cloudflare Access permissions
3. Ensure mobile app is configured for mobile.in-theflow.com
4. Check browser console for CORS errors

## Configuration Reference

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `RELAY_PORT` | 3847 | Local relay server port |
| `DEV_MAESTRO_URL` | http://localhost:6010 | Dev-Maestro address |
| `HAPPY_SERVER_URL` | http://localhost:3847 | CLI connects here |
| `HAPPY_SECURITY_LEVEL` | standard | Security level (strict/standard/relaxed/off) |
| `HAPPY_DISABLE_BASH_RPC` | false | Disable command execution entirely |
| `HAPPY_ENABLE_WRITE_RPC` | false | Enable file writes (disabled by default) |

### Files

| Path | Purpose |
|------|---------|
| `~/projects/happy-local/` | Hardened Happy CLI fork |
| `~/.cloudflared/config-happy.yml` | Tunnel configuration |
| `~/.cloudflared/*.json` | Tunnel credentials |
| `~/.config/systemd/user/claude-mobile-tunnel.service` | Systemd service |

## Security Checklist

Before using in production:

- [ ] Cloudflare Access configured with email allowlist
- [ ] `HAPPY_ENABLE_WRITE_RPC` is NOT set (or set to false)
- [ ] Tunnel uses HTTPS only (no HTTP fallback)
- [ ] Dev-Maestro only accessible via tunnel
- [ ] No ports exposed on firewall (ufw/iptables)
- [ ] Systemd service running as non-root user

## Related

- [SOP-026: Custom Domain Deployment](SOP-026-custom-domain-deployment.md)
- [SOP-030: Doppler Secrets Management](SOP-030-doppler-secrets-management.md)
- [Dev-Maestro](~/.dev-maestro/README.md)

# SOP-044: VPS DNS & OAuth Redirect Troubleshooting

**Created**: 2026-02-17
**Trigger**: Google OAuth fails with "Unsupported provider" or localhost redirects to production

## Symptoms

### Symptom 1: Google OAuth returns "Unsupported provider"

```json
{
  "code": 400,
  "error_code": "validation_failed",
  "msg": "Unsupported provider: Get \"https://accounts.google.com/.well-known/openid-configuration\": dial tcp: lookup accounts.google.com on 127.0.0.11:53: server misbehaving"
}
```

**Root Cause**: DNS resolution broken on VPS. Docker's internal DNS (`127.0.0.11`) forwards to host's `systemd-resolved` (`127.0.0.53`), which forwards to upstream DNS. If upstream DNS is down, the entire chain fails.

**Diagnosis**:
```bash
# SSH into VPS
ssh -i ~/.ssh/id_ed25519 root@84.46.253.137

# Test host DNS
nslookup accounts.google.com
# If times out → host DNS broken

# Check which DNS servers are configured
resolvectl status eth0
# Look at "DNS Servers" line

# Test specific DNS servers
nslookup accounts.google.com 213.136.95.10   # Contabo DNS
nslookup accounts.google.com 8.8.8.8          # Google DNS
```

**Fix**:
```bash
# Switch to reliable public DNS (immediate, temporary)
resolvectl dns eth0 8.8.8.8 1.1.1.1

# Make it persistent across reboots
cat > /etc/systemd/resolved.conf.d/dns.conf << 'EOF'
[Resolve]
DNS=8.8.8.8 1.1.1.1
FallbackDNS=8.8.4.4 1.0.0.1
EOF
systemctl restart systemd-resolved

# Restart Supabase auth to pick up working DNS
cd /opt/supabase/docker && docker compose restart auth
```

**Current State** (as of 2026-02-17): Persistent config at `/etc/systemd/resolved.conf.d/dns.conf` uses Google + Cloudflare DNS. Contabo DNS (`213.136.95.10`, `213.136.95.11`) bypassed entirely.

---

### Symptom 2: Localhost OAuth redirects to production (`in-theflow.com`)

After Google sign-in from `http://localhost:5546`, user lands on `https://in-theflow.com` instead of localhost.

**Root Cause**: VPS Supabase GoTrue `GOTRUE_URI_ALLOW_LIST` doesn't include localhost URLs. GoTrue falls back to `GOTRUE_SITE_URL` (`https://in-theflow.com`).

**Diagnosis**:
```bash
# Check what's inside the running container
docker exec supabase-auth env | grep -i -E 'ALLOW|URI|SITE|REDIRECT'

# Expected output should include:
# GOTRUE_URI_ALLOW_LIST=http://127.0.0.1,http://localhost:5546,http://localhost:5173
# GOTRUE_SITE_URL=https://in-theflow.com
```

**Fix**:
```bash
# Edit .env on VPS
vim /opt/supabase/docker/.env

# Ensure this line has all localhost URLs:
# ADDITIONAL_REDIRECT_URLS=http://127.0.0.1,http://localhost:5546,http://localhost:5173

# CRITICAL: Use 'up -d', NOT 'restart'!
# 'restart' reuses old container with cached env vars
# 'up -d' recreates the container with updated .env
cd /opt/supabase/docker && docker compose up -d auth

# Verify the change took effect
docker exec supabase-auth env | grep GOTRUE_URI_ALLOW
```

**Current State** (as of 2026-02-17): `ADDITIONAL_REDIRECT_URLS=http://127.0.0.1,http://localhost:5546,http://localhost:5173` in `/opt/supabase/docker/.env`.

---

## Key Gotchas

| Gotcha | Detail |
|--------|--------|
| `docker compose restart` vs `up -d` | `restart` does NOT reload `.env` changes. Must use `docker compose up -d` to recreate container with new env vars. |
| Contabo DNS unreliable | Contabo's DNS servers (`213.136.95.10/11`) can go down. Always use public DNS (Google/Cloudflare) as primary. |
| Google "continue to" text | Google's OAuth screen shows "to continue to in-theflow.com" — this is the OAuth client name, NOT the redirect URL. It's cosmetic. |
| `ADDITIONAL_REDIRECT_URLS` mapping | `.env` uses `ADDITIONAL_REDIRECT_URLS`, docker-compose maps it to `GOTRUE_URI_ALLOW_LIST` inside the container. |

## Key Files on VPS

| Path | Purpose |
|------|---------|
| `/opt/supabase/docker/.env` | Supabase env vars (SITE_URL, ADDITIONAL_REDIRECT_URLS, etc.) |
| `/opt/supabase/docker/docker-compose.yml` | Maps `.env` vars to GoTrue env vars |
| `/etc/systemd/resolved.conf.d/dns.conf` | Persistent DNS config (Google + Cloudflare) |
| `/etc/resolv.conf` | Symlink to systemd-resolved stub (don't edit directly) |

# SOP-036: Supabase JWT Key Regeneration

> **Created**: 2026-01-28
> **Status**: Active
> **Related Bug**: BUG-1105

## Overview

This SOP documents how to regenerate and deploy Supabase JWT keys when authentication fails with "JwtSignatureError: Failed to validate JWT signature" or 401 Unauthorized errors.

## Symptoms

- All Supabase REST API requests return 401 Unauthorized
- Console errors: `JwtSignatureError: Failed to validate JWT signature`
- Console errors: `No suitable key or wrong key type (None of the keys was able to decode the JWT)`
- Realtime WebSocket connections fail repeatedly

## Root Cause

JWT keys (ANON_KEY, SERVICE_ROLE_KEY) must be signed with the same secret as the Supabase instance's `JWT_SECRET`. When these don't match, JWT validation fails.

Common causes:
1. Using local demo keys with production Supabase (or vice versa)
2. VPS Supabase `.env` has mismatched keys
3. Doppler secrets out of sync with VPS configuration

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     JWT Key Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  VPS Supabase (/opt/supabase/docker/.env)                      │
│  ┌─────────────────────────────────────────┐                   │
│  │ JWT_SECRET = "your-secret-here"         │                   │
│  │ ANON_KEY = JWT signed with JWT_SECRET   │◄─── Must match    │
│  │ SERVICE_ROLE_KEY = JWT signed with same │                   │
│  └─────────────────────────────────────────┘                   │
│                         ▲                                       │
│                         │ Keys must be identical                │
│                         ▼                                       │
│  Client App (via Doppler/.env.local)                           │
│  ┌─────────────────────────────────────────┐                   │
│  │ VITE_SUPABASE_URL = https://api...      │                   │
│  │ VITE_SUPABASE_ANON_KEY = same as above  │◄─── Must match    │
│  │ SUPABASE_SERVICE_ROLE_KEY = same        │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Resolution Steps

### Step 1: Get VPS JWT Secret

```bash
ssh root@84.46.253.137
cd /opt/supabase/docker
grep JWT_SECRET .env
```

Note the JWT_SECRET value (e.g., `your-super-secret-jwt-token-with-at-least-32-characters-long`)

### Step 2: Generate New Keys

Run this Node.js script locally (replace `jwtSecret` with actual value):

```javascript
const crypto = require('crypto');

const jwtSecret = 'your-super-secret-jwt-token-with-at-least-32-characters-long';

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function createJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(headerB64 + '.' + payloadB64)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return headerB64 + '.' + payloadB64 + '.' + signature;
}

const exp = Math.floor(new Date('2033-01-01').getTime() / 1000);

console.log('ANON_KEY:');
console.log(createJwt({ iss: 'supabase', role: 'anon', iat: Math.floor(Date.now() / 1000), exp }, jwtSecret));

console.log('\nSERVICE_ROLE_KEY:');
console.log(createJwt({ iss: 'supabase', role: 'service_role', iat: Math.floor(Date.now() / 1000), exp }, jwtSecret));
```

### Step 3: Update VPS Supabase

```bash
ssh root@84.46.253.137
cd /opt/supabase/docker

# Edit .env file
nano .env

# Replace ANON_KEY and SERVICE_ROLE_KEY with new values

# Restart Supabase
docker compose down && docker compose up -d
```

### Step 4: Update Doppler

```bash
doppler secrets set VITE_SUPABASE_ANON_KEY="<new-anon-key>"
doppler secrets set SUPABASE_SERVICE_ROLE_KEY="<new-service-role-key>"
```

### Step 5: Update .env.local (for non-Doppler runs)

```bash
# Edit .env.local
VITE_SUPABASE_ANON_KEY="<new-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<new-service-role-key>"
```

### Step 6: Verify

```bash
# Test API with new key
curl -s "https://api.in-theflow.com/rest/v1/tasks?limit=1" \
  -H "apikey: <new-anon-key>" \
  -H "Authorization: Bearer <new-anon-key>"

# Should return [] or data, NOT 401 error
```

## Current Production Keys (2026-01-28)

**JWT_SECRET**: `your-super-secret-jwt-token-with-at-least-32-characters-long`

**ANON_KEY**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY5NjIyOTA3LCJleHAiOjE5ODgxNTA0MDB9.aLhhbRQ3t3i9ON40_te1rngOUVUouPFrysdp7DLwLXg
```

**SERVICE_ROLE_KEY**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Njk2MjI5MDcsImV4cCI6MTk4ODE1MDQwMH0.Whn8SGOv-oMSYbnFYuwm8yUfYrHJ59GH34KQCuBkEmI
```

**Expiry**: 2033-01-01

## Prevention

1. **Never mix local and production keys** - local Supabase uses different JWT_SECRET
2. **Always use Doppler for production** - `doppler run -- npm run dev`
3. **Document key changes** - update this SOP when keys are regenerated
4. **Use the validation script** - `npm run dev` validates JWT on startup (for local only)

## Related Files

| File | Purpose |
|------|---------|
| `/opt/supabase/docker/.env` (VPS) | Supabase server configuration |
| `.env.local` | Local development overrides |
| `scripts/generate-supabase-keys.cjs` | Key generation for LOCAL Supabase |
| `scripts/validate-supabase-keys.cjs` | JWT validation on startup |

## Troubleshooting

### "Remote URL detected, skipping local key validation"

This is **expected** when connecting to production. The validation script only checks local Supabase keys.

### Keys work locally but not in CI/CD

Ensure Doppler secrets are updated and CI/CD workflows pull from Doppler.

### After key regeneration, old sessions fail

Users need to sign out and sign back in to get new JWT tokens.

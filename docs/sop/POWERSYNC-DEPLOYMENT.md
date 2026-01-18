# PowerSync E2E Sync Deployment Guide

**Status**: Ready for Deployment
**Date**: January 4, 2026
**Related Task**: TASK-093 (Database Engine Migration Phase 2)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    POWERSYNC ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Web Browser │    │    Tauri     │    │   Mobile     │      │
│  │  (WASQLite)  │    │   (SQLite)   │    │  (SQLite)    │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  PowerSync      │ ◄── PORT 8080            │
│                    │  Sync Service   │     (Real-time sync)     │
│                    └────────┬────────┘                          │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  Sync Backend   │ ◄── PORT 3000            │
│                    │   (Express.js)  │     (Upload handler)     │
│                    └────────┬────────┘                          │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │   PostgreSQL    │ ◄── PORT 5432            │
│                    │    Database     │     (Source of Truth)    │
│                    └─────────────────┘                          │
│                                                                 │
│  Supporting Services:                                           │
│  - MongoDB (PowerSync bucket storage) ◄── PORT 27017            │
│  - Redis (Optional caching)           ◄── PORT 6379             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- Docker & Docker Compose installed
- ~2GB RAM available for containers
- Ports 3000, 5432, 6379, 8080, 27017 available

---

## Deployment Steps

### Step 1: Start Docker Stack

```bash
# From project root
cd /home/endlessblink/my-projects/ai-development/productivity/flow-state

# Start all services
docker-compose up -d

# Verify all containers are running
docker-compose ps
```

**Expected output:**
```
NAME                    STATUS
flowstate-postgres       Up (healthy)
flowstate-mongodb        Up
flowstate-redis          Up
flowstate-powersync      Up
flowstate-sync-backend   Up (healthy)
```

### Step 2: Initialize PostgreSQL Schema

```bash
# Wait for Postgres to be ready (~10 seconds)
sleep 10

# Run init script
docker exec -i flowstate-postgres psql -U user -d flowstate < scripts/init-postgres.sql

# Verify tables created
docker exec -it flowstate-postgres psql -U user -d flowstate -c "\dt"
```

**Expected output:**
```
        List of relations
 Schema |      Name       | Type  | Owner
--------+-----------------+-------+-------
 public | groups          | table | user
 public | notifications   | table | user
 public | projects        | table | user
 public | settings        | table | user
 public | subtasks        | table | user
 public | tasks           | table | user
 public | timer_sessions  | table | user
```

### Step 3: Verify PowerSync Connection

```bash
# Check PowerSync logs
docker logs flowstate-powersync --tail 50

# Look for: "Replication connected"
```

### Step 4: Test Sync Backend

```bash
# Test JWKS endpoint
curl http://localhost:3000/.well-known/jwks.json

# Expected: JSON with keys array
```

### Step 5: Update Frontend Environment

Create/update `.env.local`:

```env
# For local development
VITE_POWERSYNC_URL=http://localhost:8080

# For production (replace with your server IP)
# VITE_POWERSYNC_URL=http://your-server-ip:8080
```

### Step 6: Enable PowerSync Connection in Frontend

Edit `src/services/database/PowerSyncDatabase.ts` to connect:

```typescript
// Add after database initialization
await db.connect(new PowerSyncConnector());
```

### Step 7: Restart Dev Server

```bash
npm run kill  # Kill existing instances
npm run dev   # Start fresh
```

---

## Verification Checklist

- [ ] All Docker containers running (`docker-compose ps`)
- [ ] PostgreSQL tables created (`\dt` shows 7 tables)
- [ ] PowerSync shows "Replication connected" in logs
- [ ] Sync backend JWKS endpoint responds
- [ ] Frontend connects without errors
- [ ] Create task in Web → appears in Tauri
- [ ] Create task in Tauri → appears in Web

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs postgres
docker-compose logs powersync

# Restart specific container
docker-compose restart powersync
```

### Replication not working

```bash
# Verify replication slot exists
docker exec -it flowstate-postgres psql -U user -d flowstate -c "SELECT * FROM pg_replication_slots;"

# Verify publication exists
docker exec -it flowstate-postgres psql -U user -d flowstate -c "SELECT * FROM pg_publication;"
```

### MongoDB replica set issues

```bash
# Initialize replica set manually
docker exec -it flowstate-mongodb mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
```

### Frontend connection errors

Check browser console for:
- `Failed to fetch` → Backend not reachable
- `401 Unauthorized` → JWT issue
- `Network error` → CORS or firewall

---

## Production Deployment Notes

### Security Checklist

1. **Change default passwords**:
   - PostgreSQL: `POSTGRES_PASSWORD` in docker-compose.yml
   - JWT secret: `SECRET` in sync-backend.cjs
   - JWKS key: Regenerate in scripts/jwks.json

2. **Enable HTTPS**:
   - Use reverse proxy (nginx/traefik) for SSL termination
   - Update `VITE_POWERSYNC_URL` to use `https://`

3. **Firewall rules**:
   - Only expose ports 8080 (PowerSync) and 3000 (sync backend)
   - Keep PostgreSQL, MongoDB, Redis internal only

### Environment Variables for Production

```env
VITE_POWERSYNC_URL=https://sync.your-domain.com
```

---

## File Reference

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Container orchestration |
| `Dockerfile.postgres` | PostgreSQL with SSL |
| `Dockerfile.sync-backend` | Upload API server |
| `powersync-config.yaml` | PowerSync service config |
| `sync-rules.yaml` | Data sync rules |
| `scripts/init-postgres.sql` | Database schema |
| `scripts/sync-backend.cjs` | Upload handler API |
| `scripts/jwks.json` | JWT verification keys |
| `scripts/certificates/` | SSL certificates |
| `src/services/database/PowerSyncConnector.ts` | Frontend connector |
| `src/database/AppSchema.ts` | SQLite schema (must match Postgres) |

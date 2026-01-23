# SOP-022: Stress Testing System

**Created**: 2026-01-23
**Status**: Active
**Related Tasks**: TASK-338, TASK-361, TASK-362, TASK-363, TASK-364, TASK-365

---

## Overview

FlowState includes a comprehensive stress testing system designed for VPS deployment stability. This SOP documents how to run, interpret, and automate these tests.

---

## Quick Reference

| Test Suite | Command | Tests | Focus |
|------------|---------|-------|-------|
| **All Tests** | `npm run test:all-stress` | 50 | Complete suite |
| Backup System | `npm run test:backup` | 14 | Shadow DB, JSON, checksums |
| Restore Verification | `npm run test:restore` | 14 | Actual restore functionality |
| Container Stability | `npm run test:container` | 11 | Docker, Supabase health |
| Sync Conflicts | `npm run test:sync` | 3 | Race conditions, RLS |
| Auth Edge Cases | `npm run test:auth` | 5 | Token validation, security |
| WebSocket Stability | `npm run test:websocket` | 3 | Realtime connections |

---

## When to Run Tests

### Before VPS Deployment
```bash
npm run test:all-stress
```
All 50 tests must pass before deploying to production VPS.

### After Infrastructure Changes
Run specific tests based on what changed:
- Docker/container changes → `npm run test:container`
- Auth/RLS policy changes → `npm run test:auth` + `npm run test:sync`
- Realtime subscription changes → `npm run test:websocket`
- Backup system changes → `npm run test:backup` + `npm run test:restore`

### Regular Health Checks
```bash
# Quick daily check (uses --quick flag)
npm run test:container:quick && npm run test:auth:quick
```

---

## Test Details

### 1. Backup System Tests (`npm run test:backup`)

**Purpose**: Verify backup files exist, are valid, and have correct structure.

**Tests**:
- Shadow DB exists and is valid SQLite
- Shadow JSON exists and is valid JSON
- Required fields present (tasks, groups, timestamp, checksum)
- Checksum integrity matches calculated value
- Data integrity (no duplicate IDs, valid parent refs)
- SQL backup files exist and are fresh

**Expected Output**:
```
✅ Passed: 14
❌ Failed: 0
```

### 2. Restore Verification (`npm run test:restore`)

**Purpose**: Verify backup can actually be restored (not just that files exist).

**Tests**:
- Backup structure is restorable
- All tasks have required fields (id, title, status, created_at)
- All groups have required fields (id, name, position_json)
- No duplicate IDs that would cause conflicts
- Checksum matches calculated value
- Restore simulation passes

**Expected Output**:
```
✅ Backup is READY for restore
```

### 3. Container Stability (`npm run test:container`)

**Purpose**: Verify Docker/Supabase infrastructure is healthy.

**Tests**:
- Docker daemon running
- Supabase containers present (db, auth, rest, realtime)
- REST API responding
- Auth API healthy
- Database query latency acceptable (<500ms avg)
- Connection recovery after interruption
- Graceful degradation (shadow backup available)

**VPS-Critical**: Run this after any server restart.

### 4. Sync Conflict Tests (`npm run test:sync`)

**Purpose**: Verify race conditions are handled correctly.

**Tests**:
- Concurrent task creation (RLS enforcement)
- Rapid update race conditions
- Duplicate ID prevention

**Note**: Without authentication, tests verify RLS blocks writes (expected behavior).

### 5. Auth Edge Cases (`npm run test:auth`)

**Purpose**: Verify authentication security.

**Tests**:
- Valid anon key access works
- Invalid tokens rejected (empty, random, malformed, SQL injection)
- Missing auth header handled
- Expired token simulation
- Rate limiting behavior

### 6. WebSocket Stability (`npm run test:websocket`)

**Purpose**: Verify Realtime connections are stable.

**Tests**:
- Realtime HTTP endpoint responding
- WebSocket connection establishment
- Heartbeat response
- Multiple connections (5 concurrent)
- Channel subscription
- Message throughput
- Reconnection after disconnect

---

## Interpreting Results

### Pass/Fail Summary
```
✅ Passed: N    # Tests that succeeded
❌ Failed: N    # Tests that failed (must be 0 for deploy)
⚠️  Warnings: N # Non-critical issues
⏭️  Skipped: N  # Tests skipped due to missing prerequisites
```

### Common Warnings (OK to ignore)

| Warning | Meaning |
|---------|---------|
| "RLS enforcement: All writes blocked" | Correct - no auth token provided |
| "Shadow backup age > 60 min" | Run `node scripts/shadow-mirror.cjs` |
| "No rate limiting detected" | Local Supabase doesn't rate limit |
| "Missing auth header succeeded" | Check RLS if this concerns you |

### Failures That Block Deployment

| Failure | Action |
|---------|--------|
| "Supabase REST API: Failed" | Check Docker: `docker ps | grep supabase` |
| "Shadow DB not found" | Run `node scripts/shadow-mirror.cjs` |
| "Checksum mismatch" | Backup may be corrupted - regenerate |
| "Invalid tokens accepted" | Critical security issue - check auth config |
| "WebSocket connect failed" | Check realtime container |

---

## Automation Options

### Option 1: Pre-commit Hook (Recommended for Development)

**Already configured!** Install with:
```bash
npm run file:install-hooks
```

This installs a pre-commit hook that runs backup/restore stress tests before every commit. To bypass in emergencies: `git commit --no-verify`

### Option 2: GitHub Actions (CI/CD)

Add to `.github/workflows/stress-test.yml`:
```yaml
name: Stress Tests
on:
  push:
    branches: [master]
  schedule:
    - cron: '0 6 * * *'  # Daily at 6am

jobs:
  stress-test:
    runs-on: ubuntu-latest
    services:
      supabase:
        image: supabase/postgres:15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:backup
      - run: npm run test:restore
```

### Option 3: Cron Job on VPS

Add to crontab (`crontab -e`):
```bash
# Run stress tests every 6 hours, log results
0 */6 * * * cd /path/to/flow-state && npm run test:all-stress >> /var/log/flow-state-stress.log 2>&1
```

### Option 4: Dev Server Integration

Already implemented: `npm run dev` runs shadow-mirror automatically.

To add stress checks on startup, modify `scripts/auto-backup-daemon.cjs`:
```javascript
// Run quick stress check on startup
const { execSync } = require('child_process');
try {
  execSync('npm run test:backup', { stdio: 'inherit' });
} catch (e) {
  console.error('⚠️ Backup stress test failed on startup');
}
```

---

## Troubleshooting

### "Cannot connect to Supabase"
```bash
# Check Docker containers
docker ps | grep supabase

# Restart if needed
docker compose -f supabase/docker-compose.yml restart
```

### "Shadow backup not found"
```bash
# Regenerate shadow backup
node scripts/shadow-mirror.cjs
```

### "WebSocket tests fail"
```bash
# Check realtime container
docker logs supabase_realtime_flow-state --tail 50

# Restart realtime
docker restart supabase_realtime_flow-state
```

### "All sync tests show RLS blocked"
This is **correct behavior** when running without authentication. To test actual sync conflicts, you need an authenticated session (run tests via Playwright E2E).

---

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/verify-backup-system.cjs` | Backup system tests |
| `scripts/verify-restore.cjs` | Restore verification tests |
| `scripts/stress-container.cjs` | Container stability tests |
| `scripts/stress-sync.cjs` | Sync conflict tests |
| `scripts/stress-auth.cjs` | Auth edge case tests |
| `scripts/stress-websocket.cjs` | WebSocket stability tests |
| `tests/stress/restore-verification.spec.ts` | Playwright E2E restore tests |

---

## Maintenance

- **Add new tests**: Create new `scripts/stress-*.cjs` file, add npm script
- **Update thresholds**: Edit constants at top of each stress script
- **Disable a test**: Use `--quick` flag or comment out in test file

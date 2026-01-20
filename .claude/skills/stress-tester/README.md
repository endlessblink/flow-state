# Comprehensive Stress Testing Skill

**TASK-338** | **Priority: P0 Critical**

This skill rigorously tests FlowState to find issues that other agents and manual testing missed. It covers reliability, backup systems, container stability, security, and data integrity.

## When to Use

- Before major releases
- After significant refactoring
- When reliability is questioned
- To verify backup systems work
- Security audit requirements
- Regression testing after bug fixes

## Quick Start

```
/stress-tester quick      # 5-10 min smoke test
/stress-tester standard   # 30-60 min full test
/stress-tester --category=security  # Security only
```

---

## Pre-Flight Checks

Before running any tests, verify:

```bash
# 1. Dev server running
curl -s http://localhost:5546 > /dev/null && echo "OK: Dev server" || echo "FAIL: Start with npm run dev"

# 2. Supabase containers healthy
docker ps --filter "name=supabase" --format "{{.Names}}: {{.Status}}" | grep -q "healthy" && echo "OK: Supabase" || echo "FAIL: Run npx supabase start"

# 3. Test database exists
supabase db lint 2>/dev/null && echo "OK: Database" || echo "WARN: Database lint issues"
```

---

## Test Categories

### 1. Data Integrity Tests (Critical)

Tests task CRUD operations, sync, and canvas position persistence.

#### 1.1 Task Duplication Check

```bash
# Rapid task creation stress test
npm run test -- --grep "task duplication" --timeout=60000
```

**Manual Test:**
1. Open app in 2 browser tabs
2. Create 10 tasks rapidly in each tab simultaneously
3. Verify: No duplicates, all 20 tasks exist

**Pass Criteria:**
- Zero duplicate task IDs
- All tasks saved to Supabase
- Canvas positions preserved

#### 1.2 Canvas Position Consistency

```bash
# Position drift detection
npm run test -- --grep "canvas position"
```

**Manual Test:**
1. Drag task to specific position (note coordinates)
2. Refresh page
3. Verify: Position unchanged (within 5px tolerance)

**Pass Criteria:**
- Positions persist across refresh
- No "jumping" during sync
- Parent-child relationships preserved

#### 1.3 Concurrent Edit Handling

**Manual Test:**
1. Open same task in 2 tabs
2. Edit title in Tab A: "Title A"
3. Edit title in Tab B: "Title B" (within 1 second)
4. Verify: Last-write-wins, final title consistent in both tabs

---

### 2. Backup System Tests (Critical)

Tests backup creation, restoration, and data fidelity.

#### 2.1 Backup Creation Verification

```bash
# Run backup test script
node scripts/test-backup-restore.cjs --create
```

**Manual Test:**
1. Create 50 test tasks
2. Go to Settings > Storage
3. Click "Create Manual Backup"
4. Verify: Backup appears in list with correct count

**Pass Criteria:**
- Backup created < 10 seconds
- Checksum generated
- Task count matches actual

#### 2.2 Restore Data Fidelity

```bash
# Full restore cycle test
node scripts/test-backup-restore.cjs --restore
```

**Manual Test:**
1. Note current task count
2. Delete 10 random tasks
3. Restore from backup
4. Verify: Original task count restored, all data intact

**Pass Criteria:**
- 100% data fidelity
- All task fields restored
- Canvas positions preserved
- No orphaned relationships

#### 2.3 Threshold Guard Test

**Manual Test:**
1. Create backup with 100 tasks (as "golden")
2. Delete 60 tasks (>50% loss)
3. Trigger auto-backup
4. Verify: Auto-backup BLOCKED, golden backup preserved

---

### 3. Container Health Tests

Tests Docker/Supabase container resilience.

#### 3.1 Database Crash Recovery

```bash
# Kill and verify recovery
docker kill supabase_db_flow-state
sleep 10
docker inspect --format='{{.State.Health.Status}}' supabase_db_flow-state
```

**Pass Criteria:**
- Container restarts automatically
- Health status returns to "healthy" < 60 seconds
- No data loss

#### 3.2 Full Stack Restart

```bash
# Full restart cycle
npx supabase stop && npx supabase start
```

**Pass Criteria:**
- All services healthy < 90 seconds
- App reconnects automatically
- No data corruption

#### 3.3 Network Partition Simulation

```bash
# Use Playwright to simulate offline
# tests/stress/network-partition.spec.ts
npm run test:stress -- --grep "network partition"
```

---

### 4. Security Tests

Tests OWASP vulnerabilities and dependencies.

#### 4.1 Dependency Vulnerability Scan

```bash
# Run Trivy scan
trivy fs --scanners vuln,secret . --severity HIGH,CRITICAL

# Fallback: npm audit
npm audit --audit-level=high
```

**Pass Criteria:**
- Zero CRITICAL vulnerabilities
- Zero HIGH vulnerabilities in production deps
- All secrets detected and removed

#### 4.2 RLS Policy Verification

```bash
# Run pgTAP tests
supabase test db
```

**Manual Test:**
1. Create task as User A
2. Attempt to fetch task as User B (different session)
3. Verify: 403 or empty result

**Pass Criteria:**
- All RLS policies pass pgTAP tests
- No cross-user data access possible

#### 4.3 XSS Prevention Check

**Manual Test:**
1. Create task with title: `<script>alert('XSS')</script>`
2. Create task with title: `<img onerror="alert('XSS')" src="x">`
3. View task in all views (Canvas, Board, Calendar)
4. Verify: No script execution, content escaped

---

### 5. Performance Tests

Tests load handling and memory management.

#### 5.1 Large Dataset Performance

```bash
# Load test with 10,000 tasks
npm run test:bench
```

**Pass Criteria:**
- Canvas renders 1000 nodes < 3 seconds
- Board view loads 10,000 tasks < 5 seconds
- No browser memory crash

#### 5.2 Memory Leak Detection

```bash
# Run Fuite scenario
fuite http://localhost:5546 --scenario tests/memory/scenario.mjs
```

**Manual Test:**
1. Open Chrome DevTools > Memory
2. Take heap snapshot
3. Navigate: Canvas > Board > Calendar > Settings (10x)
4. Take another snapshot
5. Compare: Memory growth < 50MB

---

### 6. Timer System Tests

Tests cross-device sync and leadership election.

#### 6.1 Leadership Election

**Manual Test:**
1. Start timer on Tab A
2. Open Tab B
3. Verify: Tab B shows timer running (follower mode)
4. Close Tab A
5. Verify: Tab B takes over leadership after 30 seconds

**Pass Criteria:**
- Single leader at all times
- Countdown continuous across leadership change
- No session loss

#### 6.2 Cross-Tab Sync

**Manual Test:**
1. Start 25-minute timer on Tab A
2. Wait 30 seconds
3. Check Tab B remaining time
4. Verify: Within 2 seconds of Tab A

---

## Report Format

After running tests, generate report:

```markdown
## Stress Test Report - [DATE]

### Summary
- **Tests Run**: X
- **Passed**: Y
- **Failed**: Z
- **Skipped**: W

### Critical Failures
[List any Tier 1 failures]

### Warnings
[List Tier 2/3 issues]

### Recommendations
[Prioritized fix list]
```

---

## Failure Response Protocol

### Critical Failure (Tier 1)
1. STOP deployment/release
2. Create MASTER_PLAN bug entry
3. Fix before any other work

### High Failure (Tier 2)
1. Document in bug report
2. Schedule fix within sprint
3. Can proceed with caution

### Medium Failure (Tier 3)
1. Add to backlog
2. Fix when convenient
3. Does not block release

---

## Integration with CI/CD

Add to GitHub Actions:

```yaml
name: Stress Tests
on:
  schedule:
    - cron: '0 3 * * *'  # Daily at 3 AM
  workflow_dispatch:

jobs:
  stress-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: npm ci
      - run: npm run test:stress
      - run: trivy fs --scanners vuln .
```

---

## Research References

Full research documentation: `docs/research/TASK-338-stress-testing-research.md`

Tools evaluated:
- Artillery + Playwright (load testing)
- k6 (API stress)
- Fuite (memory leaks)
- Vitest bench (component benchmarks)
- pgTAP (database testing)
- Trivy + Snyk (security)
- Pumba (chaos engineering)
- cAdvisor + Prometheus (container monitoring)

# Stress Test Coverage Matrix

**TASK-338** | Comprehensive Stress Testing Suite

This matrix documents which completed tasks are covered by stress tests.

---

## Coverage Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Covered by automated stress test |
| 🔄 | Partially covered (manual test required) |
| ⚠️ | Needs coverage |
| ➖ | Not applicable (docs, refactoring, etc.) |

---

## Core Features

### Canvas System

| Task ID | Description | Test Coverage | Test File |
|---------|-------------|---------------|-----------|
| TASK-131 | Position reset during session | ✅ | `data-integrity.spec.ts` |
| TASK-142 | Position reset on refresh | ✅ | `data-integrity.spec.ts` |
| TASK-255 | Canvas geometry invariants | ✅ | `geometry-invariants.test.ts` |
| TASK-256 | Canvas geometry tests | ✅ | `geometry-invariants.test.ts` |
| TASK-335 | Canvas distribution stacked | ✅ | `data-integrity.spec.ts` |

### Task Management

| Task ID | Description | Test Coverage | Test File |
|---------|-------------|---------------|-----------|
| TASK-309-B | Undo/redo system | 🔄 | Manual memory check |
| TASK-334 | Completion protocol | ✅ | Enforced via hooks |

### Backup & Restore

| Task ID | Description | Test Coverage | Test File |
|---------|-------------|---------------|-----------|
| TASK-365 | Restore verification | ✅ | `restore-verification.spec.ts` |
| TASK-338 | Stress testing suite | ✅ | All stress tests |

### Security

| Task ID | Description | Test Coverage | Test File |
|---------|-------------|---------------|-----------|
| SEC-001 | XSS prevention | ✅ | `security.spec.ts` |
| SEC-004 | SQL injection | ✅ | `security.spec.ts` |
| N/A | Input validation | ✅ | `security.spec.ts` |

### Container & Infrastructure

| Task ID | Description | Test Coverage | Test File |
|---------|-------------|---------------|-----------|
| TASK-361 | Container restart resilience | ✅ | `container-stability.spec.ts` |
| N/A | Docker health checks | ✅ | `container-stability.spec.ts` |
| N/A | Network recovery | ✅ | `container-stability.spec.ts` |

---

## Test Files Summary

| File | Category | Tests | Quick Tests |
|------|----------|-------|-------------|
| `data-integrity.spec.ts` | Data | 4 | 2 |
| `security.spec.ts` | Security | 5 | 3 |
| `restore-verification.spec.ts` | Backup | 5 | - |
| `container-stability.spec.ts` | Infra | 6 | 3 |
| `store-operations.bench.ts` | Perf | 9 | - |

**Total: 29 tests**

---

## Child Tasks (TASK-338 Dependencies)

| Task ID | Description | Status | Coverage |
|---------|-------------|--------|----------|
| TASK-361 | Container restart resilience | 📋 PLANNED | ✅ Implemented |
| TASK-362 | Sync conflict resolution | 📋 PLANNED | 🔄 Basic coverage |
| TASK-363 | Auth edge cases | 📋 PLANNED | ⚠️ Needs work |
| TASK-364 | WebSocket stability | 📋 PLANNED | 🔄 Basic coverage |
| TASK-365 | Restore verification | ✅ DONE | ✅ Full coverage |
| TASK-366 | Redundancy assessment | 📋 PLANNED | ⚠️ Needs work |

---

## Running the Matrix

```bash
# Run all stress tests
npm run test:stress

# Run quick tests only
npm run test:stress:quick

# Run by category
npm run test:stress -- --grep "Security"
npm run test:stress -- --grep "Data Integrity"
npm run test:stress -- --grep "Container"
npm run test:stress -- --grep "Restore"

# Generate HTML report
npm run test:stress:report
```

---

## Adding New Coverage

When adding coverage for a new task:

1. Identify the appropriate test file based on category
2. Add test with descriptive name including task ID
3. Tag quick tests with `@quick` for smoke testing
4. Update this matrix with coverage status
5. Run full suite to verify no regressions

---

## Version History

- v1.0 (2026-01-23): Initial matrix for TASK-338

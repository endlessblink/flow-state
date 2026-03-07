# Implementation Checklist: Automated Archival System

**Related Plan**: [automated-archival-system.md](./automated-archival-system.md)
**Status**: 📋 PENDING APPROVAL
**Created**: 2026-01-15

---

## Pre-Implementation

### Architectural Review
- [ ] Main Claude instance reviews [automated-archival-system.md](./automated-archival-system.md)
- [ ] Open questions answered (see section in plan):
  - [ ] Archive file organization (monthly/quarterly/single file?)
  - [ ] Git hook enabled by default? (yes/no/opt-in)
  - [ ] Validation strictness (strict/relaxed/configurable?)
  - [ ] Backup retention period (30/90/180 days?)
  - [ ] Dev-manager integration (transparent/aware/enhanced?)
- [ ] Approval to proceed with implementation

---

## Phase 1: Foundation (Week 1)

### Setup & Dependencies

- [ ] **TASK-001**: Install npm dependencies
  ```bash
  npm install --save-dev \
    remark@^15.0.1 \
    remark-parse@^11.0.0 \
    remark-stringify@^11.0.0 \
    remark-gfm@^4.0.0 \
    unified@^11.0.4 \
    unist-util-visit@^5.0.0 \
    unist-util-remove@^4.0.0 \
    write-file-atomic@^5.0.1
  ```
  - [ ] Run `npm install`
  - [ ] Verify no dependency conflicts
  - [ ] Update `package-lock.json`

- [ ] **TASK-002**: Update package.json scripts
  ```json
  {
    "scripts": {
      "archive": "node scripts/archive-completed-tasks.cjs",
      "archive:dry-run": "node scripts/archive-completed-tasks.cjs --dry-run",
      "archive:restore": "node scripts/restore-from-backup.cjs",
      "archive:list-backups": "node scripts/list-backups.cjs",
      "archive:audit": "node scripts/audit-query.cjs"
    }
  }
  ```

### Core Script Implementation

- [ ] **TASK-003**: Create `scripts/archive-completed-tasks.cjs`
  - [ ] Basic class structure (`ArchivalSystem`)
  - [ ] Constructor with options (dryRun, paths, config)
  - [ ] Main `run()` method skeleton
  - [ ] Error handling wrapper

- [ ] **TASK-004**: Implement pre-flight checks
  - [ ] `performPreFlightChecks()` method
  - [ ] Check MASTER_PLAN.md exists
  - [ ] Check archive directory exists (create if missing)
  - [ ] Check backup directory exists (create if missing)
  - [ ] Check disk space (basic implementation)
  - [ ] Check git status (warn if dirty)

- [ ] **TASK-005**: Implement AST parsing
  - [ ] Initialize remark processor (parse + GFM + stringify)
  - [ ] `findCompletedTasks()` method
  - [ ] Task pattern: `~~(TASK|BUG|ROAD)-(\d+)~~.*\(✅\s*DONE\)`
  - [ ] Extract task ID, title, node reference
  - [ ] Collect content until next h3 heading
  - [ ] Test with actual MASTER_PLAN.md

- [ ] **TASK-006**: Implement validation
  - [ ] `validateTasks()` method
  - [ ] Duplicate ID detection (blocking)
  - [ ] Unchecked sub-tasks detection (warning)
  - [ ] Missing completion date detection (warning)
  - [ ] Return `{ blocking: [], warnings: [] }`

- [ ] **TASK-007**: Implement backup creation
  - [ ] `createBackup()` method
  - [ ] Generate timestamped filename
  - [ ] Use `write-file-atomic` for safety
  - [ ] Store `lastBackupPath` for rollback
  - [ ] Verify backup file created

- [ ] **TASK-008**: Implement dry-run mode
  - [ ] Check `this.dryRun` flag before execution
  - [ ] Log preview of tasks to archive
  - [ ] Log target archive file path
  - [ ] Log backup path (would create)
  - [ ] Return without modifying files

### Testing

- [ ] **TASK-009**: Manual testing - dry-run mode
  ```bash
  npm run archive:dry-run
  ```
  - [ ] Verify console output matches expectations
  - [ ] Verify no files modified
  - [ ] Verify correct tasks detected
  - [ ] Verify validation warnings displayed

- [ ] **TASK-010**: Create test fixtures
  - [ ] Create `tests/fixtures/test-master-plan.md`
  - [ ] Include completed tasks with various formats
  - [ ] Include active tasks (should not be archived)
  - [ ] Include edge cases (missing dates, unchecked sub-tasks)

### Commit & Review

- [ ] **CHECKPOINT-1**: Phase 1 complete
  - [ ] All tasks TASK-001 through TASK-010 done
  - [ ] Dry-run mode working
  - [ ] No file modifications in dry-run
  - [ ] Git commit: `feat: archival system phase 1 - dry-run mode`
  - [ ] Push to branch
  - [ ] Request review from main Claude

---

## Phase 2: Live Archival (Week 2)

### Execution Engine

- [ ] **TASK-011**: Implement task section extraction
  - [ ] `extractTaskSection()` method
  - [ ] Find task heading node in AST
  - [ ] Collect all nodes until next h3 heading
  - [ ] Return array of nodes
  - [ ] Preserve formatting (indentation, spacing)

- [ ] **TASK-012**: Implement task section removal
  - [ ] `removeTaskSection()` method
  - [ ] Use `unist-util-remove` to remove nodes
  - [ ] Remove heading + all content nodes
  - [ ] Verify AST structure remains valid

- [ ] **TASK-013**: Implement archive file creation
  - [ ] Determine monthly archive filename
  - [ ] Check if archive file exists
  - [ ] If new: create with header (title, metadata, separator)
  - [ ] If exists: parse existing content

- [ ] **TASK-014**: Implement archival execution
  - [ ] `archiveTasks()` method
  - [ ] Read current MASTER_PLAN.md
  - [ ] Read/create archive file
  - [ ] Extract task sections from master AST
  - [ ] Append sections to archive AST
  - [ ] Remove sections from master AST
  - [ ] Stringify both ASTs

- [ ] **TASK-015**: Implement atomic writes
  - [ ] Use `write-file-atomic` for archive file
  - [ ] Use `write-file-atomic` for master plan
  - [ ] Handle write errors with try-catch
  - [ ] Verify writes succeeded

- [ ] **TASK-016**: Implement verification
  - [ ] `verifyArchival()` method
  - [ ] Read archive file, check tasks present
  - [ ] Read master plan, check tasks removed
  - [ ] Throw error if verification fails

- [ ] **TASK-017**: Implement audit logging
  - [ ] `writeAuditLog()` method
  - [ ] Generate operation ID (UUID)
  - [ ] Create log entry (JSON format)
  - [ ] Append to `supabase/backups/archival-audit.log`
  - [ ] Include: timestamp, operationId, status, tasksArchived, paths

- [ ] **TASK-018**: Implement rollback mechanism
  - [ ] `rollback()` method
  - [ ] Accept backup path parameter
  - [ ] Read backup file
  - [ ] Restore to MASTER_PLAN.md using atomic write
  - [ ] Log rollback operation

- [ ] **TASK-019**: Integrate rollback into error handling
  - [ ] Wrap `archiveTasks()` in try-catch
  - [ ] On error, call `rollback(lastBackupPath)`
  - [ ] Log error details
  - [ ] Re-throw error after rollback

### Testing

- [ ] **TASK-020**: Manual testing - live archival
  ```bash
  # Create test backup first
  cp docs/MASTER_PLAN.md docs/MASTER_PLAN.test-backup.md

  # Run live archival
  npm run archive
  ```
  - [ ] Verify backup created
  - [ ] Verify archive file created/updated
  - [ ] Verify tasks removed from master plan
  - [ ] Verify audit log entry created
  - [ ] Verify git diff shows expected changes

- [ ] **TASK-021**: Manual testing - rollback
  ```bash
  # Intentionally cause failure (e.g., chmod archive dir read-only)
  chmod 444 docs/archive

  # Run archival (should fail and rollback)
  npm run archive

  # Verify
  # 1. Error message displayed
  # 2. Rollback occurred
  # 3. MASTER_PLAN.md unchanged
  ```
  - [ ] Verify automatic rollback works
  - [ ] Verify error logged
  - [ ] Verify files unchanged after rollback

### Commit & Review

- [ ] **CHECKPOINT-2**: Phase 2 complete
  - [ ] All tasks TASK-011 through TASK-021 done
  - [ ] Live archival working
  - [ ] Rollback on failure working
  - [ ] Audit log created
  - [ ] Git commit: `feat: archival system phase 2 - live execution`
  - [ ] Push to branch
  - [ ] Request review from main Claude

---

## Phase 3: Testing & Polish (Week 3)

### Utility Scripts

- [ ] **TASK-022**: Create `scripts/restore-from-backup.cjs`
  - [ ] Accept backup file path as argument
  - [ ] Validate backup file exists
  - [ ] Read backup content
  - [ ] Write to MASTER_PLAN.md atomically
  - [ ] Log restore operation

- [ ] **TASK-023**: Create `scripts/list-backups.cjs`
  - [ ] Scan `supabase/backups/` directory
  - [ ] Filter for `MASTER_PLAN.backup-*.md` files
  - [ ] Sort by timestamp (newest first)
  - [ ] Display with relative timestamps ("2 hours ago")
  - [ ] Show file sizes

- [ ] **TASK-024**: Create `scripts/audit-query.cjs`
  - [ ] Read `archival-audit.log`
  - [ ] Parse JSON entries
  - [ ] Filter by date range (--since, --until)
  - [ ] Filter by status (--status SUCCESS|FAILED)
  - [ ] Export to file (--export filename.json)
  - [ ] Pretty print to console

### Configuration

- [ ] **TASK-025**: Create `.claude/hooks/archival-config.json`
  - [ ] Define schema (see plan document)
  - [ ] Set default values
  - [ ] Document all options with comments
  - [ ] Add validation for required fields

- [ ] **TASK-026**: Implement config loading
  - [ ] `loadConfig()` method in ArchivalSystem
  - [ ] Read config file if exists
  - [ ] Merge with defaults
  - [ ] Validate config values
  - [ ] Apply to system options

### Unit Tests

- [ ] **TASK-027**: Create `tests/archival.test.ts`
  - [ ] Setup: create test directory with fixtures
  - [ ] Teardown: clean up test files
  - [ ] Test: detect completed tasks
  - [ ] Test: dry-run doesn't modify files
  - [ ] Test: backup created before archival
  - [ ] Test: validation catches duplicates
  - [ ] Test: validation warns on unchecked sub-tasks
  - [ ] Test: rollback restores original state

- [ ] **TASK-028**: Create `tests/markdown-parsing.test.ts`
  - [ ] Test: parse valid MASTER_PLAN structure
  - [ ] Test: extract task sections correctly
  - [ ] Test: preserve formatting (indentation, spacing)
  - [ ] Test: handle edge cases (empty tasks, nested lists)
  - [ ] Test: detect malformed markdown

- [ ] **TASK-029**: Create `tests/file-operations.test.ts`
  - [ ] Test: atomic write succeeds
  - [ ] Test: atomic write fails, no partial file
  - [ ] Test: backup creation
  - [ ] Test: restore from backup
  - [ ] Test: audit log appending

- [ ] **TASK-030**: Run test suite
  ```bash
  npm run test -- archival
  npm run test -- markdown-parsing
  npm run test -- file-operations
  ```
  - [ ] All tests passing
  - [ ] Coverage >80%

### Integration Tests

- [ ] **TASK-031**: Create `tests/e2e-archival.test.ts`
  - [ ] Test: full archival flow (detect → validate → backup → execute → verify)
  - [ ] Test: archive file created with correct format
  - [ ] Test: master plan updated correctly
  - [ ] Test: git diff shows expected changes
  - [ ] Test: rollback on failure

- [ ] **TASK-032**: Manual end-to-end test
  ```bash
  # 1. Create test branch
  git checkout -b test/archival-system

  # 2. Run archival on actual MASTER_PLAN.md
  npm run archive

  # 3. Verify results
  git diff docs/MASTER_PLAN.md
  git diff docs/archive/MASTER_PLAN_2026-01.md
  cat supabase/backups/archival-audit.log

  # 4. Test restore
  npm run archive:restore 1

  # 5. Verify restoration
  git diff docs/MASTER_PLAN.md  # Should show no changes

  # 6. Clean up test branch
  git checkout -
  git branch -D test/archival-system
  ```
  - [ ] Archival works on real data
  - [ ] Archive file format correct
  - [ ] Restore works correctly
  - [ ] No data loss

### Documentation

- [ ] **TASK-033**: Update CLAUDE.md
  - [ ] Add "Automated Archival System" section
  - [ ] Document when archival runs
  - [ ] Document how to restore from backup
  - [ ] Document configuration options
  - [ ] Add to workflow diagram

- [ ] **TASK-034**: Create README for archival system
  - [ ] `docs/archival-system/README.md`
  - [ ] Quick start guide
  - [ ] Configuration reference
  - [ ] Troubleshooting
  - [ ] FAQs

- [ ] **TASK-035**: Add JSDoc comments
  - [ ] Document all public methods
  - [ ] Add usage examples
  - [ ] Document parameters and return types
  - [ ] Add warnings for dangerous operations

### Commit & Review

- [ ] **CHECKPOINT-3**: Phase 3 complete
  - [ ] All tasks TASK-022 through TASK-035 done
  - [ ] Test suite passing
  - [ ] Documentation complete
  - [ ] Utility scripts working
  - [ ] Git commit: `feat: archival system phase 3 - testing & polish`
  - [ ] Push to branch
  - [ ] Request review from main Claude

---

## Phase 4: Git Integration (Optional)

### Hook Implementation

- [ ] **TASK-036**: Create `.claude/hooks/post-commit-archival.cjs`
  - [ ] Shebang: `#!/usr/bin/env node`
  - [ ] Import ArchivalSystem
  - [ ] Run archival in dry-run mode first
  - [ ] If tasks found, run live archival
  - [ ] Auto-commit archival changes
  - [ ] Use `[skip ci]` in commit message
  - [ ] Error handling (don't block commit)

- [ ] **TASK-037**: Create `.claude/hooks/install-hooks.cjs`
  - [ ] Check if `.git/hooks` directory exists
  - [ ] Copy `post-commit-archival.cjs` to `.git/hooks/post-commit`
  - [ ] Set executable permissions (chmod 755)
  - [ ] Log installation success

- [ ] **TASK-038**: Update package.json
  ```json
  {
    "scripts": {
      "postinstall": "node .claude/hooks/install-hooks.cjs"
    }
  }
  ```

### Testing

- [ ] **TASK-039**: Manual testing - git hook
  ```bash
  # 1. Install hook
  npm run postinstall

  # 2. Verify hook installed
  ls -la .git/hooks/post-commit

  # 3. Mark a task as done in MASTER_PLAN.md
  # (change TASK-XXX status to ✅ DONE and add ~~strikethrough~~)

  # 4. Commit
  git add docs/MASTER_PLAN.md
  git commit -m "feat: complete TASK-XXX"

  # 5. Verify hook ran
  git log -1  # Should show auto-commit for archival

  # 6. Verify archival happened
  git diff HEAD~1 docs/MASTER_PLAN.md
  git diff HEAD~1 docs/archive/
  ```
  - [ ] Hook installs correctly
  - [ ] Hook runs after commit
  - [ ] Auto-commit created
  - [ ] Archival executed correctly

- [ ] **TASK-040**: Test hook disabled via config
  ```json
  // .claude/hooks/archival-config.json
  {
    "execution": {
      "gitHookEnabled": false
    }
  }
  ```
  - [ ] Hook respects config setting
  - [ ] No auto-archival when disabled

### Commit & Review

- [ ] **CHECKPOINT-4**: Phase 4 complete
  - [ ] All tasks TASK-036 through TASK-040 done
  - [ ] Git hook working
  - [ ] Auto-commit functional
  - [ ] Configuration toggle working
  - [ ] Git commit: `feat: archival system phase 4 - git integration`
  - [ ] Push to branch
  - [ ] Request review from main Claude

---

## Production Rollout

### Pre-Deployment

- [ ] **TASK-041**: Final review checklist
  - [ ] All tests passing
  - [ ] Documentation complete
  - [ ] Configuration validated
  - [ ] Backup system verified
  - [ ] Rollback tested
  - [ ] No outstanding bugs

- [ ] **TASK-042**: Create rollout plan
  - [ ] Day 1: Deploy to test branch
  - [ ] Day 2: Run manual archival once
  - [ ] Day 3-7: Monitor for issues
  - [ ] Day 8+: Enable git hook (optional)

### Deployment

- [ ] **TASK-043**: Merge to main branch
  - [ ] Squash commits or keep history? (decide with team)
  - [ ] Update CHANGELOG.md
  - [ ] Create git tag: `v1.0.0-archival-system`
  - [ ] Merge PR

- [ ] **TASK-044**: First production run
  ```bash
  # Manual backup first
  cp docs/MASTER_PLAN.md docs/MASTER_PLAN.manual-backup.md

  # Dry run
  npm run archive:dry-run

  # Review output carefully

  # Live run
  npm run archive

  # Verify results
  git diff docs/MASTER_PLAN.md
  git diff docs/archive/
  ```
  - [ ] Review dry-run output
  - [ ] Execute live archival
  - [ ] Verify results
  - [ ] Commit archival changes

### Post-Deployment

- [ ] **TASK-045**: Monitor for 1 week
  - [ ] Check audit logs daily
  - [ ] Verify no regressions in dev-manager
  - [ ] Verify git hooks working (if enabled)
  - [ ] Address any issues immediately

- [ ] **TASK-046**: Gather feedback
  - [ ] Does archival run at right frequency?
  - [ ] Are validation warnings useful?
  - [ ] Should any thresholds be adjusted?
  - [ ] Document lessons learned

---

## Maintenance Tasks

### Weekly
- [ ] Review audit log for failures
- [ ] Check backup disk usage
- [ ] Verify archive file integrity

### Monthly
- [ ] Prune old backups (>90 days)
- [ ] Review archive file organization
- [ ] Update configuration if needed

### Quarterly
- [ ] Test restore from backup
- [ ] Review completed tasks distribution
- [ ] Optimize if MASTER_PLAN growing too fast

---

## Estimated Timeline

| Phase | Duration | Complexity | Risk |
|-------|----------|------------|------|
| **Pre-Implementation** | 1-2 days | Low | Low (just review) |
| **Phase 1: Foundation** | 3-5 days | Medium | Low (dry-run only) |
| **Phase 2: Live Archival** | 5-7 days | High | Medium (file modifications) |
| **Phase 3: Testing & Polish** | 5-7 days | Medium | Low (safety nets) |
| **Phase 4: Git Integration** | 2-3 days | Low | Low (optional) |
| **Production Rollout** | 1-2 weeks | Low | Low (incremental) |

**Total Estimate**: 3-4 weeks for complete implementation and rollout

---

## Decision Log

### Decisions Made

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-15 | Use remark for parsing | AST manipulation safer than regex |
| 2026-01-15 | Monthly archive files | Balance between granularity and file count |
| 2026-01-15 | Dry-run by default initially | Safety first, users opt-in to automation |
| 2026-01-15 | 90-day backup retention | Balance between safety and disk usage |

### Pending Decisions (Awaiting Review)

| Question | Options | Recommendation |
|----------|---------|----------------|
| Archive organization | Monthly / Quarterly / Single file | Monthly (current proposal) |
| Git hook default | Enabled / Disabled / Opt-in | Disabled (safer) |
| Validation strictness | Strict / Relaxed / Configurable | Configurable (flexible) |
| Backup retention | 30 / 90 / 180 days | 90 days (balance) |
| Dev-manager integration | Transparent / Aware / Enhanced | Transparent (simple) |

---

## Notes for Implementer

### Critical Paths

1. **AST Parsing** is foundation - get this right first
2. **Atomic writes** are non-negotiable for safety
3. **Rollback mechanism** must be tested thoroughly
4. **Validation** catches 80% of issues before they happen

### Common Pitfalls to Avoid

- ❌ Don't use regex for markdown parsing (too fragile)
- ❌ Don't skip backup creation (always create backup first)
- ❌ Don't modify files in dry-run mode (defeats the purpose)
- ❌ Don't assume git is available (gracefully degrade)
- ❌ Don't block on warnings (only blocking issues should prevent archival)

### Testing Strategy

- Unit tests for isolated logic (parsing, validation)
- Integration tests for full flow (end-to-end)
- Manual tests on real data (confidence check)
- Rollback tests (intentionally fail operations)

### When in Doubt

- ✅ Create a backup before ANY file modification
- ✅ Use atomic operations (write-file-atomic)
- ✅ Log everything (audit trail)
- ✅ Fail safe (rollback on error)
- ✅ Ask for review (don't guess on critical decisions)

---

## Success Criteria

### Phase 1
- ✅ Dry-run mode works
- ✅ Detects completed tasks correctly
- ✅ Shows preview without modifying files

### Phase 2
- ✅ Live archival works
- ✅ Creates backups before operation
- ✅ Rollback on failure works

### Phase 3
- ✅ Tests passing (>80% coverage)
- ✅ Documentation complete
- ✅ Utility scripts working

### Phase 4 (Optional)
- ✅ Git hook installs correctly
- ✅ Auto-commit works
- ✅ Configuration toggle works

### Production
- ✅ MASTER_PLAN.md <3,000 lines
- ✅ Archive files well-organized
- ✅ Zero data loss incidents
- ✅ Positive user feedback

---

**Checklist Version**: 1.0
**Last Updated**: 2026-01-15
**Status**: Ready for Implementation (pending approval)

# 💡 Idea-Issue Creator - Enhanced Ideas & Issues Management

**Status**: Production Ready + Enhanced Features + Skill Integration

**Enhanced Version**: Restored and improved from original issue-creator with modern integration

---

## 🛡️ Safety Features

Every operation is **protected**:

- ✅ Automatic backups before changes
- ✅ Automatic rollback on errors
- ✅ Corruption detection
- ✅ Data loss prevention

### If Something Goes Wrong

```bash
# Check safety
idea-issue-creator check-safety

# Show backups
idea-issue-creator show-backups

# Recover
idea-issue-creator recover-backups
```

---

## 🤖 Smart Code Scanner

Scans your codebase and suggests:

- **Features**: What to build next
- **Issues**: Bugs and problems
- **Improvements**: Performance and quality
- **Next Steps**: Based on git history

### Run Scanner

```bash
@issue-creator scan-project
```

**Output**: Suggestions you can turn into ideas/tasks

---

## 📋 Core Commands

### Capture & Promote
```bash
idea-issue-creator capture-idea --title "X" --thought "Y"
idea-issue-creator capture-issue --title "X" --description "Y"
idea-issue-creator promote --id IDEA-XXX --to "master-plan"
```

### Safety
```bash
idea-issue-creator check-safety        # Verify system is safe
idea-issue-creator show-backups        # See recent backups
idea-issue-creator recover-backups     # Show how to restore
idea-issue-creator cleanup-backups     # Remove old backups
```

### Intelligence
```bash
idea-issue-creator scan-project        # Scan code & suggest features
idea-issue-creator analyze-app-state   # Analyze Pomo-Flow app state
```

### Management
```bash
idea-issue-creator list-ideas          # Show ideas by stage
idea-issue-creator list-issues         # Show issues by priority
idea-issue-creator start-watcher       # Start file monitoring
idea-issue-creator sync-with-master-plan # Update MASTER_PLAN.md
```

---

## 🚀 Enhanced Workflow

1. **Discover**: Scan codebase & analyze app state for issues/ideas
2. **Capture**: Turn findings into structured ideas/issues with metadata
3. **Classify**: Automatic priority scoring and categorization
4. **Integrate**: Hand off to chief-architect for complex decisions
5. **Promote**: Update MASTER_PLAN.md via master-plan-manager
6. **Track**: Monitor progress through existing Pomo-Flow systems

All protected. All integrated. All smart.

---

## 🔄 Skill Ecosystem Integration

**Chief-Architect Integration**:
- Delegates architectural decisions to `🎯 chief-architect`
- Receives processed ideas from chief-architect auto-processing
- Coordinates on complex technical decisions

**Master-Plan-Manager Integration**:
- Uses `📋 master-plan-manager` for safe document updates
- Coordinates backup and rollback procedures
- Ensures document consistency across the skill ecosystem

**Modern File Structure Integration**:
- `planning-ideas-issues` - Raw input capture (main ideas & issues file)
- `docs/MASTER_PLAN.md` - Strategic planning updates
- `docs/archives/ideas-issues/` - Weekly archiving system

---

## 🔗 Modern System Integration

**What Each Command Triggers**:
- `capture-idea` → planning-ideas-issues + auto-backup + classification
- `capture-issue` → planning-ideas-issues + priority scoring + auto-backup
- `promote` → Delegates to 📋 master-plan-manager for safe MASTER_PLAN.md updates
- `scan-project` → Vue analysis + TypeScript analysis + performance analysis + app state analysis
- `analyze-app-state` → Pomo-Flow store analysis + sync status + performance bottlenecks
- `check-safety` → Corruption detection + backup verification + skill ecosystem health

**All Systems Stay in Sync**:
- ✅ planning-ideas-issues (raw input capture)
- ✅ docs/MASTER_PLAN.md (strategic planning via master-plan-manager)
- ✅ docs/archives/ideas-issues/ (weekly archiving system)
- ✅ Skill ecosystem coordination (chief-architect + master-plan-manager)
- ✅ Pomo-Flow app integration (store analysis, sync status)
- ✅ Enhanced backup system (modern paths + skill integration)

---

## 🛡️ Safety System Details

### Automatic Backups

Every operation creates backups of critical files:
- ideas.md (idea pipeline)
- kanban.md (task execution)
- ROADMAP.md (strategic planning)

Backup files stored in `task-management/.meta/backups/` with timestamp and hash.

### Corruption Detection

System automatically checks for:
- Null bytes in files
- Empty markdown files
- Invalid JSON syntax
- File access issues

### Rollback Protection

If any operation fails:
- Automatic rollback to previous state
- No data loss guaranteed
- All changes reverted
- Error details logged

### Backup Management

- Backups kept for 30 days
- Automatic cleanup of old files
- Manual recovery options
- List recent backups anytime

---

## 🤖 Code Scanner Features

### Vue Component Analysis

- Missing `:key` in v-for loops
- Unused computed properties
- Console statements in production
- Performance opportunities

### TypeScript Analysis

- `any` type usage
- Untyped function parameters
- TODO/FIXME comments
- Type safety improvements

### Performance Analysis

- Large file detection
- Inline object optimization
- Code complexity suggestions
- Refactoring opportunities

### Git History Analysis

- Bug fixing patterns
- Refactoring frequency
- Commit frequency
- Development trends

---

## 🚀 Complete Example

```bash
# 1. Scan project for insights
@issue-creator scan-project
# Output: 3 features, 2 bugs, 4 improvements, 2 next steps

# 2. Capture findings as ideas
@issue-creator capture-idea --title "Fix missing :key in v-for" --thought "Performance issue found in Vue components"

# 3. Capture another finding
@issue-creator capture-idea --title "Add TypeScript types" --thought "Replace any types with specific types"

# 4. Promote to execution (SAFE with auto-backup)
@issue-creator promote --id IDEA-050
# Process:
#   🔒 Automatic backup of ideas.md, kanban.md, ROADMAP.md
#   ✅ TASK-095 created in kanban.md
#   ✅ All systems updated
#   ✅ Backups retained for recovery

# 5. Check system safety
@issue-creator check-safety
# Output: ✅ All systems safe

# 6. Monitor with visual interface
npm run kanban
# Opens: task-management/kanban-ui.html
```

---

## 📊 Enhanced Command Reference

| Command | Purpose | Safety | Integration |
|---------|---------|--------|-------------|
| `capture-idea` | Add new idea | ✅ Auto-backup | planning-ideas-issues |
| `capture-issue` | Add new issue | ✅ Auto-backup | planning-ideas-issues |
| `expand-idea` | Add details | ✅ Auto-backup | planning-ideas-issues |
| `mark-ready` | Flag for review | ✅ Auto-backup | planning-ideas-issues |
| `promote` | Create task/master-plan update | ✅ Full protection | 📋 master-plan-manager |
| `scan-project` | Analyze code | ✅ Read-only | Code analysis |
| `analyze-app-state` | Analyze Pomo-Flow state | ✅ Read-only | App integration |
| `check-safety` | Verify system | ✅ Safe | Skill ecosystem |
| `show-backups` | List backups | ✅ Safe | Safety system |
| `cleanup-backups` | Remove old | ✅ Safe | Safety system |
| `start-watcher` | Monitor files | ✅ Safe | File monitoring |
| `sync-with-master-plan` | Update MASTER_PLAN.md | ✅ Delegated | 📋 master-plan-manager |

---

## 🔧 Technical Implementation

### Safety Architecture
- **Backup Strategy**: File-level backup before any modification
- **Rollback Mechanism**: Automatic restore on failure detection
- **Corruption Detection**: Multi-layer validation
- **Error Handling**: Graceful degradation with detailed logging

### Scanner Architecture
- **Multi-Language Support**: Vue, TypeScript, JavaScript
- **Pattern Recognition**: Regex-based analysis
- **Git Integration**: History analysis via git commands
- **Performance Metrics**: File size, complexity analysis

### Integration Points
- **File System**: Direct fs operations with safety checks
- **Git Operations**: Safe execSync with error handling
- **Backup Storage**: Organized by timestamp and content hash
- **Monitoring**: Real-time file watching for changes

---

## 🎯 Best Practices

### Before Major Operations
1. Run `idea-issue-creator check-safety` to verify system health
2. Review recent backups with `idea-issue-creator show-backups`
3. Ensure no corrupted files detected
4. Verify skill ecosystem integration (chief-architect, master-plan-manager)

### After Operations
1. Verify successful completion
2. Check system status and skill coordination
3. Clean up old backups periodically
4. Confirm MASTER_PLAN.md updates (if promotion occurred)

### Regular Maintenance
- Run code scanner weekly for new insights
- Analyze app state for performance bottlenecks
- Clean up backups monthly with `idea-issue-creator cleanup-backups`
- Monitor file watcher for automatic archiving
- Coordinate with chief-architect for complex architectural decisions

---

**Status**: ✅ Production Ready with Enhanced Features + Skill Integration

**Usage**: Complete ideas/issues management orchestration with zero data loss risk, smart code analysis, and modern skill ecosystem integration.

**Enhanced Features**:
- 🔄 Integration with 🎯 chief-architect and 📋 master-plan-manager
- 📱 Modern Pomo-Flow app state analysis
- 🎯 Direct MASTER_PLAN.md updates via safe delegation
- 🗂️ Weekly archiving system integration
- 🛡️ Enhanced safety and backup systems

**One skill. Complete ideas workflow. Fully integrated. Totally safe. Enhanced smart.**

---

## MANDATORY USER VERIFICATION REQUIREMENT

### Policy: No Fix Claims Without User Confirmation

**CRITICAL**: Before claiming ANY issue, bug, or problem is "fixed", "resolved", "working", or "complete", the following verification protocol is MANDATORY:

#### Step 1: Technical Verification
- Run all relevant tests (build, type-check, unit tests)
- Verify no console errors
- Take screenshots/evidence of the fix

#### Step 2: User Verification Request
**REQUIRED**: Use the `AskUserQuestion` tool to explicitly ask the user to verify the fix:

```
"I've implemented [description of fix]. Before I mark this as complete, please verify:
1. [Specific thing to check #1]
2. [Specific thing to check #2]
3. Does this fix the issue you were experiencing?

Please confirm the fix works as expected, or let me know what's still not working."
```

#### Step 3: Wait for User Confirmation
- **DO NOT** proceed with claims of success until user responds
- **DO NOT** mark tasks as "completed" without user confirmation
- **DO NOT** use phrases like "fixed", "resolved", "working" without user verification

#### Step 4: Handle User Feedback
- If user confirms: Document the fix and mark as complete
- If user reports issues: Continue debugging, repeat verification cycle

### Prohibited Actions (Without User Verification)
- Claiming a bug is "fixed"
- Stating functionality is "working"
- Marking issues as "resolved"
- Declaring features as "complete"
- Any success claims about fixes

### Required Evidence Before User Verification Request
1. Technical tests passing
2. Visual confirmation via Playwright/screenshots
3. Specific test scenarios executed
4. Clear description of what was changed

**Remember: The user is the final authority on whether something is fixed. No exceptions.**

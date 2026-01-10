# Cleanup Skills Merge Archive

**Date**: 2026-01-10
**Merged Into**: `safe-project-organizer`

## Archived Skills

### 1. root-project-cleaner (392 lines)
**Unique Capabilities Merged:**
- Root directory-focused cleanup (not source files)
- Pattern-based file matching with include/exclude rules
- Size-based and age-based filtering
- Git-aware cleanup (never deletes tracked files)
- Backup system with timestamped backups
- Interactive confirmation prompts
- Configuration via `.claude/root-cleaner.config.js`

**Categories Handled:**
- Build artifacts (dist/, build/, .vite/)
- Development caches (node_modules/.cache/, .cache/)
- Temporary files (*.tmp, *.temp, *.swp)
- System files (.DS_Store, Thumbs.db)
- Logs and debug files (*.log, logs/)

### 2. legacy-tech-remover (337 lines)
**Unique Capabilities Merged:**
- 4-phase legacy detection and removal process
- Multi-language dependency analysis (JS, Python, Java, Ruby, PHP, Go, Rust)
- Deprecated pattern detection (AngularJS, jQuery, Grunt, Gulp, etc.)
- Risk scoring system (SAFE/CAUTION/RISKY)
- Git history analysis for last-touched dates
- Migration planning with modern replacements
- Configuration via `.claude/legacy-remover-config.yml`

**Scripts Copied to safe-project-organizer:**
- `run_legacy_removal.py` - Full audit orchestrator
- `phase1_detection.py` - Legacy detection and inventory
- `phase2_assessment.py` - Impact assessment and risk analysis
- `phase3_execution.py` - Execution automation
- `phase4_documentation.py` - Documentation generation

**Additional Files Copied:**
- `references/deprecated-patterns.md`
- `references/migration-strategies.md`
- `assets/config_schemas/legacy-remover-config-schema.json`
- `package_info.json`

## Reason for Merge

These three skills had significant overlap in purpose (project cleanup and organization) and shared safety principles (dry-run, user confirmation, backup capabilities). Consolidating them:

1. **Reduces cognitive load** - One skill to remember for all cleanup tasks
2. **Eliminates confusion** - Clear single entry point for cleanup operations
3. **Shares safety infrastructure** - Common safety checks and confirmation flows
4. **Simplifies maintenance** - One skill to update instead of three

## How to Use the Merged Skill

The `safe-project-organizer` skill now handles all three use cases:

```bash
# Project structure reorganization (original capability)
python3 scripts/project_organizer.py /path/to/project --preview

# Root directory cleanup (from root-project-cleaner)
# Use the root cleanup configuration patterns

# Legacy tech removal (from legacy-tech-remover)
python3 scripts/run_legacy_removal.py --full-audit
```

## Rollback Instructions

If you need to restore these skills:

```bash
# Copy archived skills back to active skills directory
cp -r ".claude/skills-archive/cleanup-merge-20260110/root-project-cleaner" ".claude/skills/"
cp -r ".claude/skills-archive/cleanup-merge-20260110/legacy-tech-remover" ".claude/skills/"
```

---
*Archived by Claude Code during skills consolidation*

# SOP-012: Skills Configuration Auto-Sync System

**Category**: Skills
**Status**: Active
**Last Updated**: January 19, 2026
**Created From**: TASK-315 Documentation & Skills Consolidation

---

## Overview

The Skills Configuration Auto-Sync system ensures `.claude/config/skills.json` stays synchronized with actual skills on the filesystem (`.claude/skills/`). This prevents configuration drift where skills exist but aren't registered in the config.

## Problem Solved

- **Config Drift**: skills.json had 10 skills while filesystem had 27+ active skills
- **Manual Updates**: Required manual editing of skills.json when adding new skills
- **Orphaned Skills**: No detection of skills removed from filesystem but still in config
- **Staleness**: No way to detect outdated or deprecated skills

## Scripts Created

| Script | Purpose | npm Command |
|--------|---------|-------------|
| `scripts/sync-skills-config.cjs` | Auto-discover and sync skills to config | `npm run skills:sync` |
| `scripts/check-skill-staleness.cjs` | Detect stale/broken/deprecated skills | `npm run skills:staleness` |
| `scripts/validate-doc-refs.cjs` | Validate markdown links in all docs | `npm run docs:validate` |

---

## Usage

### Sync Skills Config

```bash
# Dry run - see what would change
npm run skills:sync -- --dry-run

# Actually sync
npm run skills:sync
```

**What it does:**
1. Scans `.claude/skills/` for directories with `SKILL.md`
2. Parses YAML frontmatter for `name` and `description`
3. Compares with existing `skills.json`
4. Adds missing skills with inferred category
5. Flags removed skills (doesn't auto-delete)
6. Reports all changes

### Check Skill Staleness

```bash
# Console output
npm run skills:staleness

# Generate markdown report
npm run skills:staleness -- --report
```

**Detects:**
- **Stale Skills**: Modified >180 days ago AND never activated
- **Broken References**: Skills referencing non-existent files
- **Deprecated Keywords**: Skills mentioning removed technologies (PouchDB, SQLite, etc.)

### Validate Documentation Links

```bash
# Check all links
npm run docs:validate

# Show fix suggestions
npm run docs:validate -- --fix

# Generate report
npm run docs:validate -- --report
```

---

## Skill YAML Frontmatter Format

Every skill must have YAML frontmatter at the top of `SKILL.md`:

```markdown
---
name: skill-name
description: A clear description of what this skill does and when to use it
---

# Skill Title

Rest of skill content...
```

**Fields:**
- `name` (required): The skill identifier (kebab-case)
- `description` (required): Description used for matching and config

---

## Category Inference

The sync script infers categories from skill name and description:

| Keywords | Category |
|----------|----------|
| debug, fix | `debug` or `fix` |
| test, qa | `test` |
| architect, plan | `design` |
| audit | `audit` |
| create, implement, dev- | `create` or `implement` |
| doc, manager | `resolve` |
| Default | `implement` |

---

## Skill Boundaries

Two skills manage different domains:

| Skill | Manages | Don't Use For |
|-------|---------|---------------|
| `smart-doc-manager` | `docs/`, MASTER_PLAN.md, SOPs | `.claude/skills/` |
| `skill-creator-doctor` | `.claude/skills/`, skills.json | `docs/` |

---

## Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Sync skills config | After adding/removing skills | `npm run skills:sync` |
| Check staleness | Monthly | `npm run skills:staleness -- --report` |
| Validate doc links | Before releases | `npm run docs:validate` |

---

## Related Files

- `.claude/config/skills.json` - Skills configuration
- `.claude/skills/*/SKILL.md` - Individual skill definitions
- `docs/sop/canvas/README.md` - Canvas documentation index (created in TASK-315)

---

## Verification

After running sync:

```bash
# Count skills in config
jq '.skills | keys | length' .claude/config/skills.json

# List all skill IDs
jq '.skills | keys[]' .claude/config/skills.json
```

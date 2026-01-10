# Archived: skills-manager

**Archive Date:** 2026-01-10
**Reason:** Merged into skill-creator-doctor
**Original Location:** `.claude/skills/🎛️ skills-manager/`

## Archive Reason

This skill was archived because it had 70% capability overlap with `skill-creator-doctor`. The unique features from skills-manager have been merged into skill-creator-doctor:

### Merged Features
- **Project Tech Stack Detection** - Analyze project dependencies and structure
- **Necessity Scoring Algorithm** - 0-100 scoring for skill importance
- **Configuration System** - `skills-manager-config.yml` for customization

### Scripts Merged
- `analyze_skills.py`
- `detect_redundancies.py`
- `merge_skills.py`

### References Merged
- `skills_taxonomy.md`
- `merge_best_practices.md`

### Config Merged
- `skills-manager-config.yml`

## Restoration Instructions

To restore this skill (if needed):

1. Move directory from `skills-archive/` back to `skills/`:
   ```bash
   mv ".claude/skills-archive/🎛️ skills-manager-merged-20260110" ".claude/skills/🎛️ skills-manager"
   ```

2. Update any references if needed

3. Test skill loading:
   ```bash
   # Restart Claude Code and verify skill appears in list
   ```

## Related Skills

- **skill-creator-doctor** - The skill that absorbed this skill's capabilities
- **skill-creator** - Original skill creation functionality

## Backup Location

A full backup was also created at:
`.claude/skills-backup/🎛️ skills-manager-20260110/`

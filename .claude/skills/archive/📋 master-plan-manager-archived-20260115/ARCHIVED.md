# Archived: master-plan-manager

**Archive Date:** 2026-01-15
**Reason:** Consolidated into smart-doc-manager
**Original Description:** SAFE MASTER-PLAN MAINTENANCE - Intelligent master-plan file management with comprehensive analysis, backup, and validation.

## Archive Reason

This skill was merged into `smart-doc-manager` as part of skill consolidation to reduce overhead. The MASTER_PLAN.md management functionality now exists as a dedicated section within smart-doc-manager, providing:

- All domain-specific workflows (Executive Summary, Phase Progress, ADRs, Skills Tracking, Success Criteria)
- Chief-architect delegation interfaces
- Safe update operations with backup capabilities

## Restoration Instructions

To restore this skill:
1. Move directory from `archive/` back to `skills/`
2. Remove "MASTER_PLAN.md Management" section from smart-doc-manager
3. Update routing references to point to master-plan-manager
4. Test skill loading

## Merged Into

`smart-doc-manager` - See "MASTER_PLAN.md Management" section

## Related Skills

- `chief-architect` (delegates to this skill for plan updates)
- `smart-doc-manager` (now contains this functionality)

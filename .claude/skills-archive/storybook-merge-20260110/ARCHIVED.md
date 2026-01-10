# Storybook Skills Merge Archive

**Date**: 2026-01-10
**Merge Operation**: Consolidated 3 Storybook skills into 1 comprehensive skill

## Skills Merged

### Primary Skill (Kept and Enhanced)
- **Name**: `dev-storybook`
- **Location**: `.claude/skills/📚 dev-storybook/`
- **Original Size**: 740 lines
- **New Size**: ~1160 lines (with merged content)

### Skills Archived

1. **storybook-audit** (930 lines)
   - Original location: `.claude/skills/storybook-audit/`
   - Unique capabilities merged:
     - User Clarification Protocol with decision tree
     - 8 Audit Checks with bash detection commands
     - Self-Learning Protocol for skill updates
     - Component-Specific Guidelines (TaskContextMenu, ContextMenu, Modal, Auth)
     - Full audit workflow bash script
   - Example files preserved in: `📚 dev-storybook/examples/`

2. **storybook-master** (422 lines)
   - Original location: `.claude/skills/📚 storybook-master/`
   - Unique capabilities merged:
     - 4-Phase workflow (Discovery, Autodocs, Testing, CI Integration)
     - Multi-framework support (React, Vue, Svelte, Web Components)
     - Configuration file format (`.storybook/skill-config.yml`)
   - Scripts preserved in: `📚 dev-storybook/scripts/`
   - Best practices reference preserved in: `📚 dev-storybook/references/`

## Merged Skill Structure

```
📚 dev-storybook/
├── SKILL.md                 # Main skill file (3 parts)
│   ├── PART 1: Story Creation (original dev-storybook content)
│   ├── PART 2: Story Auditing (from storybook-audit)
│   └── PART 3: Component Discovery & Automation (from storybook-master)
├── scripts/
│   ├── run_storybook_master.py
│   ├── phase1_discovery.py
│   └── phase2_generation.py
├── examples/
│   ├── before-after-modal-iframe.md
│   ├── before-after-contextmenu-height.md
│   ├── before-after-store-dependency.md
│   ├── before-after-template-style.md
│   ├── before-after-props-mismatch.md
│   ├── before-after-missing-imports.md
│   └── before-after-event-handlers.md
└── references/
    └── storybook-best-practices.md
```

## Unique Capabilities Merged

### From storybook-audit:
- **Audit Checks** (8 comprehensive checks):
  1. Iframe Height detection and guidelines
  2. Store Dependencies (Pinia) detection
  3. Template Validation
  4. Props Mismatch detection
  5. Layout Parameter verification
  6. Design Token Enforcement
  7. Missing Vue Imports detection
  8. Event Handlers verification

- **User Clarification Protocol**: Decision tree for diagnosing issues
- **Full Audit Workflow**: Complete bash script for auditing
- **Component-Specific Guidelines**: TaskContextMenu, ContextMenu, Modal, Auth components

### From storybook-master:
- **4-Phase Workflow**:
  1. Component Discovery & Inventory
  2. Autodocs & Story Automation
  3. Automated Visual & Interaction Testing
  4. CI/CD Integration

- **Python Scripts** for automated component discovery
- **Configuration Format** for `.storybook/skill-config.yml`
- **Multi-framework Support**: React, Vue, Svelte, Web Components

## Reason for Merge

The three skills had overlapping functionality and were causing confusion:
- All dealt with Storybook story creation and maintenance
- `storybook-audit` focused on fixing issues
- `storybook-master` focused on automation and CI
- `dev-storybook` was the primary story creation skill

Consolidating them provides:
1. Single entry point for all Storybook-related tasks
2. No duplication of core patterns and rules
3. Easier maintenance and updates
4. Clear skill routing (one skill covers all Storybook needs)

## Rollback Instructions

If you need to restore the original skills:

```bash
# Restore storybook-audit
mv ".claude/skills-archive/storybook-merge-20260110/storybook-audit" ".claude/skills/"

# Restore storybook-master
mv ".claude/skills-archive/storybook-merge-20260110/📚 storybook-master" ".claude/skills/"
```

Note: The merged `dev-storybook` skill should be reverted to its original state if rolling back.

# Skill Consolidation Audit Report
**Generated:** January 10, 2026
**Total Skills:** 78 (excluding archived)
**Target:** 40 visible skills + 5-10 buffer = **45-50 total**
**Required Reduction:** 78 → 45 skills (42% reduction, remove ~33 skills)

> **Why 40-50?** Claude Code truncates skill list at ~56 skills due to token limits.
> Keeping under 50 ensures ALL skills are visible and matchable.

---

## Executive Summary

| Category | Count | Reduction |
|----------|-------|-----------|
| Exact duplicates (emoji vs non-emoji) | 10 pairs | **-10** |
| Obsolete tech skills (PouchDB/IndexedDB) | 4 | **-4** |
| Backup files to delete | 1 | **-1** |
| Consolidation merges | 4 groups (12→4) | **-8** |
| Broken metadata (review for removal) | 10+ | **-10** |
| **Total removals** | | **-33** |
| **Final count** | | **~45** |

---

## Current Tech Stack (Reference)

From `CLAUDE.md`:
- **Frontend:** Vue 3 + TypeScript + Vite + Pinia
- **UI:** Tailwind CSS + Naive UI + Glass morphism
- **Canvas:** Vue Flow for canvas, Vuedraggable for drag-drop
- **Database:** **Supabase** (Postgres + Auth + Realtime) ← Current
- **Editor:** TipTap for rich text editing

**Obsolete/Migrated Technologies:**
- ~~PouchDB~~ → Migrated to Supabase
- ~~IndexedDB (as primary storage)~~ → Migrated to Supabase
- ~~LocalStorage (as primary storage)~~ → Migrated to Supabase

---

## PRIORITY 0: Obsolete Technology Skills (CRITICAL)

These skills reference **PouchDB** or **IndexedDB** as primary storage, which has been replaced by **Supabase**.

| Skill | PouchDB | IndexedDB | Recommendation |
|-------|---------|-----------|----------------|
| `💾 indexeddb-backup-debugger` | 0 | 25 | **ARCHIVE** - Entire skill is IndexedDB-focused |
| `🛡️-data-safety-auditor` | 6 | 4 | **ARCHIVE** - References PouchDB extensively |
| `📚 smart-doc-manager` | 9 | 0 | **UPDATE** - Remove PouchDB references, update for Supabase |
| `storybook-audit` | 8 | 0 | **UPDATE** - Remove PouchDB database references |

### Skills to Review (Minor References)

| Skill | PouchDB | IndexedDB | Recommendation |
|-------|---------|-----------|----------------|
| `🔧 dev-fix-task-store` | 0 | 11 | **UPDATE** - Verify references are still valid |
| `dev-debug-data-loss` | 1 | 0 | **UPDATE** - Check if still relevant |
| `📄 document-sync` | 1 | 0 | **UPDATE** - Minor, may just need cleanup |
| `🎯 chief-architect` | 0 | 3 | **REVIEW** - Check context |
| `🚨 crisis-debugging-advisor` | 0 | 5 | **REVIEW** - Check context |

### Archive Commands for Obsolete Skills
```bash
mkdir -p .claude/skills-archive/obsolete-tech-20260110

# These skills are entirely focused on obsolete technology
mv ".claude/skills/💾 indexeddb-backup-debugger" ".claude/skills-archive/obsolete-tech-20260110/"
mv ".claude/skills/🛡️-data-safety-auditor" ".claude/skills-archive/obsolete-tech-20260110/"
```

---

## PRIORITY 1: Exact Duplicates (IMMEDIATE ACTION)

These are the same skill with and without emoji prefix. **Keep the emoji version** (usually has more content).

| Keep (Emoji) | Remove (Plain) | Lines (Keep/Remove) |
|--------------|----------------|---------------------|
| `🐛 dev-debugging` | `dev-debugging` | 706 / 525 |
| `🔧 dev-fix-task-store` | `dev-fix-task-store` | 440 / 174 |
| `🎯 dev-implement-ui-ux` | `dev-implement-ui-ux` | 950 / 895 |
| `📚 dev-storybook` | `dev-storybook` | 740 / 686 |
| `🟢 dev-vue` | `dev-vue` | 164 / 78 |
| `🔌 dev-vueuse` | `dev-vueuse` | 109 / 59 |
| `🔌 ops-port-manager` | `ops-port-manager` | 120 / 70 |
| `⚖️ ai-truthfulness-enforcer` | `truthfulness-enforcer` | 285 / 247 |

**Special cases (keep the larger one):**
| Keep | Remove | Lines (Keep/Remove) |
|------|--------|---------------------|
| `meta-skill-router` | `🔄 meta-skill-router` | 287 / 98 |
| `skill-creator` | `🔧 skill-creator` | 209 / 116 |

### Removal Commands
```bash
# Archive duplicates (don't delete, archive first)
mkdir -p .claude/skills-archive/duplicates-20260110

mv ".claude/skills/dev-debugging" ".claude/skills-archive/duplicates-20260110/"
mv ".claude/skills/dev-fix-task-store" ".claude/skills-archive/duplicates-20260110/"
mv ".claude/skills/dev-implement-ui-ux" ".claude/skills-archive/duplicates-20260110/"
mv ".claude/skills/dev-storybook" ".claude/skills-archive/duplicates-20260110/"
mv ".claude/skills/dev-vue" ".claude/skills-archive/duplicates-20260110/"
mv ".claude/skills/dev-vueuse" ".claude/skills-archive/duplicates-20260110/"
mv ".claude/skills/ops-port-manager" ".claude/skills-archive/duplicates-20260110/"
mv ".claude/skills/truthfulness-enforcer" ".claude/skills-archive/duplicates-20260110/"
mv ".claude/skills/🔄 meta-skill-router" ".claude/skills-archive/duplicates-20260110/"
mv ".claude/skills/🔧 skill-creator" ".claude/skills-archive/duplicates-20260110/"
```

---

## PRIORITY 2: Backup Files to Delete

| File | Reason |
|------|--------|
| `💡 idea-issue-creator.backup-20251127-163633` | Old backup (43 days old) |

```bash
rm -rf ".claude/skills/💡 idea-issue-creator.backup-20251127-163633"
```

---

## PRIORITY 3: Skills with Broken/Missing Metadata

These skills have empty `name:` fields in their YAML frontmatter and may not load correctly.

| Skill | Lines | Issue | Recommendation |
|-------|-------|-------|----------------|
| `📆 calendar-interface-architect` | 632 | No name | Fix frontmatter |
| `🚨 crisis-debugging-advisor` | 507 | No name | Fix frontmatter |
| `dev-debug-cache` | 507 | No name | Fix frontmatter |
| `💡 idea-issue-creator` | 249 | No name | Fix frontmatter |
| `🧹 legacy-tech-remover` | 337 | No name | Fix frontmatter |
| `qa-verify` | 147 | No name | Review if needed |
| `📚 storybook-master` | 422 | No name | Fix frontmatter |
| `🧹 ts-architectural-cleanup` | 613 | No name | Fix frontmatter |
| `👤 user-flow-testing-skills` | 163 | No name | Fix frontmatter |
| `👁️ view-by-view-filter-analyzer` | 142 | No name | Fix frontmatter |

---

## PRIORITY 4: Consolidation Candidates

### Group 1: Storybook Skills (3 → 1)

| Skill | Lines | Scripts | Refs | Merge Into |
|-------|-------|---------|------|------------|
| `📚 dev-storybook` | 740 | No | No | **PRIMARY** |
| `storybook-audit` | 930 | No | No | Merge |
| `📚 storybook-master` | 422 | Yes | Yes | Merge |

**Recommendation:** Merge all into `📚 dev-storybook`

### Group 2: Auditor/Analyzer Skills (3 → 1)

| Skill | Lines | Focus | Merge Into |
|-------|-------|-------|------------|
| `📊 comprehensive-auditor` | 467 | Multi-dimensional auditing | **PRIMARY** |
| `🔍 comprehensive-system-analyzer` | 358 | System status | Merge |
| `codebase-health-auditor` | 371 | Dead code detection | Merge |

**Recommendation:** Merge into `📊 comprehensive-auditor`

### Group 3: Calendar Skills (3 → 1)

| Skill | Lines | Focus | Merge Into |
|-------|-------|-------|------------|
| `📆 calendar-interface-architect` | 632 | Interface/types | **PRIMARY** (fix metadata) |
| `📅 calendar-inbox-sync` | 343 | Inbox sync debugging | Merge |
| `⏰ calendar-scheduling-fixer` | 208 | Scheduling issues | Merge |

**Recommendation:** Merge into `📆 calendar-interface-architect`

### Group 4: Cleanup/Organizer Skills (3 → 1)

| Skill | Lines | Focus | Merge Into |
|-------|-------|-------|------------|
| `📁 safe-project-organizer` | 458 | Project structure | **PRIMARY** |
| `🧹 root-project-cleaner` | 392 | Root directory cleanup | Merge |
| `🧹 legacy-tech-remover` | 337 | Legacy code removal | Merge |

**Recommendation:** Merge into `📁 safe-project-organizer`

---

## Complete Skills Inventory

### Active Skills (78 total)

| # | Skill | Lines | Scripts | Refs | Category |
|---|-------|-------|---------|------|----------|
| 1 | `⚖️ ai-truthfulness-enforcer` | 285 | No | No | Meta |
| 2 | `arch-planning` | 211 | No | No | Architecture |
| 3 | `arch-undo-redo-systems` | 90 | No | No | Architecture |
| 4 | `📅 calendar-inbox-sync` | 343 | No | No | Calendar |
| 5 | `📆 calendar-interface-architect` | 632 | No | No | Calendar |
| 6 | `⏰ calendar-scheduling-fixer` | 208 | Yes | Yes | Calendar |
| 7 | `🎯 chief-architect` | 684 | No | No | Architecture |
| 8 | `codebase-health-auditor` | 371 | Yes | Yes | Auditing |
| 9 | `📊 comprehensive-auditor` | 467 | Yes | Yes | Auditing |
| 10 | `🔍 comprehensive-system-analyzer` | 358 | No | No | Auditing |
| 11 | `🚨 crisis-debugging-advisor` | 507 | No | No | Debugging |
| 12 | `🎨 css-design-token-enforcer` | 292 | Yes | Yes | UI/UX |
| 13 | `🛡️-data-safety-auditor` | 207 | No | No | Security |
| 14 | `🔍-detect-competing-systems` | 260 | No | No | Architecture |
| 15 | `dev-backend-master` | 28 | No | No | Backend |
| 16 | `dev-bug-fixer` | 32 | No | No | Debugging |
| 17 | `dev-debug-cache` | 507 | No | No | Debugging |
| 18 | `dev-debug-canvas-nested-groups` | 238 | Yes | Yes | Canvas |
| 19 | `dev-debug-data-loss` | 145 | No | No | Debugging |
| 20 | `🐛 dev-debugging` | 706 | No | No | Debugging |
| 21 | `dev-debugging` | 525 | No | No | **DUPLICATE** |
| 22 | `dev-debug-reactivity` | 81 | No | No | Debugging |
| 23 | `⌨️ dev-fix-keyboard` | 338 | No | No | Debugging |
| 24 | `dev-fix-pinia` | 100 | No | No | Debugging |
| 25 | `🔧 dev-fix-task-store` | 440 | No | No | Debugging |
| 26 | `dev-fix-task-store` | 174 | No | No | **DUPLICATE** |
| 27 | `⏱️ dev-fix-timer` | 193 | No | No | Debugging |
| 28 | `dev-frontend-master` | 53 | No | No | Frontend |
| 29 | `🎯 dev-implement-ui-ux` | 950 | No | No | UI/UX |
| 30 | `dev-implement-ui-ux` | 895 | No | No | **DUPLICATE** |
| 31 | `dev-lint-cleanup` | 348 | No | No | Code Quality |
| 32 | `dev-optimize-performance` | 95 | No | No | Performance |
| 33 | `⚡ dev-refactoring` | 575 | No | No | Refactoring |
| 34 | `📚 dev-storybook` | 740 | No | No | Storybook |
| 35 | `dev-storybook` | 686 | No | No | **DUPLICATE** |
| 36 | `dev-typescript` | 372 | No | Yes | TypeScript |
| 37 | `↩️ dev-undo-redo` | 255 | No | No | Architecture |
| 38 | `🟢 dev-vue` | 164 | No | Yes | Vue |
| 39 | `dev-vue` | 78 | No | No | **DUPLICATE** |
| 40 | `🔌 dev-vueuse` | 109 | No | No | Vue |
| 41 | `dev-vueuse` | 59 | No | No | **DUPLICATE** |
| 42 | `📄 document-sync` | 203 | Yes | Yes | Documentation |
| 43 | `💡 idea-issue-creator` | 249 | No | No | Workflow |
| 44 | `💡 idea-issue-creator.backup-...` | 361 | No | No | **BACKUP** |
| 45 | `💾 indexeddb-backup-debugger` | 214 | Yes | No | Database |
| 46 | `🧹 legacy-tech-remover` | 337 | Yes | Yes | Cleanup |
| 47 | `📋 master-plan-manager` | 406 | No | No | Workflow |
| 48 | `🔄 meta-skill-router` | 98 | No | No | **DUPLICATE** |
| 49 | `meta-skill-router` | 287 | No | No | Meta |
| 50 | `🔌 ops-port-manager` | 120 | No | No | DevOps |
| 51 | `ops-port-manager` | 70 | No | No | **DUPLICATE** |
| 52 | `🔧 persistence-type-fixer` | 393 | No | No | TypeScript |
| 53 | `🚀 production-debugging-framework` | 357 | Yes | Yes | Debugging |
| 54 | `qa-master` | 32 | No | No | Testing |
| 55 | `🧪 qa-testing` | 232 | No | No | Testing |
| 56 | `qa-verify` | 147 | No | No | Testing |
| 57 | `🧹 root-project-cleaner` | 392 | No | No | Cleanup |
| 58 | `📁 safe-project-organizer` | 458 | Yes | No | Cleanup |
| 59 | `🔧 skill-creator` | 116 | No | No | **DUPLICATE** |
| 60 | `skill-creator` | 209 | Yes | No | Meta |
| 61 | `🏥 skill-creator-doctor` | 1306 | Yes | Yes | Meta |
| 62 | `📚 smart-doc-manager` | 704 | Yes | Yes | Documentation |
| 63 | `storybook-audit` | 930 | No | No | Storybook |
| 64 | `📚 storybook-master` | 422 | Yes | Yes | Storybook |
| 65 | `supabase-debugger` | 640 | Yes | Yes | Database |
| 66 | `tauri-e2e-testing` | 478 | No | Yes | Testing |
| 67 | `tiptap-vue3` | 367 | No | No | Editor |
| 68 | `truthfulness-enforcer` | 247 | No | No | **DUPLICATE** |
| 69 | `🧹 ts-architectural-cleanup` | 613 | No | No | TypeScript |
| 70 | `🔧 ts-foundation-restorer` | 235 | No | No | TypeScript |
| 71 | `👤 user-flow-testing-skills` | 163 | No | No | Testing |
| 72 | `👁️ view-by-view-filter-analyzer` | 142 | No | No | Auditing |
| 73 | `🔍 visual-inconsistency-detector` | 748 | No | No | UI/UX |
| 74 | `🎛️ vue-filter-manager` | 329 | No | No | Vue |
| 75 | `vue-flow-debug` | 285 | No | No | Canvas |

---

## Stray File to Remove

```bash
# This is a .md file directly in skills/ (not a directory)
rm ".claude/skills/dev-debug-canvas.md"
```

---

## Recommended Action Plan

### Phase 1: Immediate Cleanup (10 minutes)
1. Archive 10 duplicate skills
2. Delete 1 backup file
3. Remove 1 stray .md file

**Result:** 78 → 66 skills

### Phase 2: Fix Broken Metadata (30 minutes)
1. Add missing `name:` fields to 10 skills
2. Validate YAML frontmatter

**Result:** All skills load correctly

### Phase 3: Consolidation (1-2 hours)
1. Merge 3 Storybook skills → 1
2. Merge 3 Auditor skills → 1
3. Merge 3 Calendar skills → 1
4. Merge 3 Cleanup skills → 1

**Result:** 66 → 58 skills

### Phase 4: Review Remaining Skills (ongoing)
- Identify low-usage skills via git history
- Archive skills not used in 6+ months
- Consider merging similar debugging skills

**Target:** ~50 skills (35% reduction from 78)

---

## Already Archived (This Session)

| Skill | Reason | Date |
|-------|--------|------|
| `🎛️ skills-manager` | Merged into `skill-creator-doctor` | 2026-01-10 |

---

## Token Impact Analysis

Current skill descriptions consume significant context window space. Reducing from 78 to 50 skills would:
- Reduce skill metadata tokens by ~35%
- Improve skill matching accuracy (fewer similar descriptions competing)
- Allow more skills to be visible in truncated list

---

*Report generated by skill-creator-doctor skill*

---
name: codebase-health-auditor
description: Unified dead code detection and cleanup tool combining Legacy Tech Remover + Comprehensive Auditor with Knip, depcheck, TypeScript, and Vue-specific analysis.
keywords: dead code, unused files, unused exports, unused dependencies, legacy removal, code cleanup, codebase audit
category: code-maintenance
triggers: dead code detection, unused code removal, codebase cleanup, legacy tech audit, dependency cleanup
---

# Codebase Health Auditor

Comprehensive dead code detection and safe cleanup for Vue 3 + TypeScript projects.

## Overview

A unified skill that merges the best of **Legacy Tech Remover** and **Comprehensive Auditor** while adding modern tooling:

- **Knip**: Unused files, exports, dependencies
- **depcheck**: Unused npm packages
- **TypeScript**: noUnusedLocals, noUnusedParameters
- **Vue-specific**: Unused props, emits, computed, watchers
- **Legacy patterns**: Deprecated libraries, orphaned directories

## Quick Start

```bash
# Full audit (dry-run by default)
node .claude/skills/codebase-health-auditor/scripts/orchestrator.js audit

# Execute safe removals only
node .claude/skills/codebase-health-auditor/scripts/orchestrator.js execute --safe-only

# Single detector
node .claude/skills/codebase-health-auditor/scripts/orchestrator.js detect --detector vue

# CI mode
node .claude/skills/codebase-health-auditor/scripts/orchestrator.js audit --ci
```

## Detection Capabilities

### 1. Unused Files & Exports (via Knip)
- Files never imported anywhere
- Exported functions/classes never used
- Types/interfaces never referenced

### 2. Unused Dependencies (via depcheck)
- npm packages in package.json but never imported
- Missing dependencies (imported but not in package.json)
- devDependencies in wrong section

### 3. TypeScript Dead Code
- Unused local variables
- Unused function parameters
- Detects what TypeScript would flag if `noUnusedLocals`/`noUnusedParameters` were enabled

### 4. Vue-Specific Dead Code
- Unused props (defineProps not used in template/script)
- Unused emits (defineEmits never called)
- Unused computed properties
- Unused watchers
- Unused refs/reactive
- Unused imported components

### 5. Legacy Detection (ported from legacy-tech-remover)
- Deprecated libraries (moment, request, jQuery, etc.)
- Legacy config files (Grunt, Gulp, Travis CI)
- Orphaned directories (old/, legacy/, v1/, bak/)
- Files untouched for 2+ years

## Risk Scoring

Each finding is categorized by risk level:

| Category | Score | Meaning | Action |
|----------|-------|---------|--------|
| SAFE | < 20 | Zero usage, high confidence | Auto-remove OK |
| CAUTION | 20-60 | Low/uncertain usage | Manual review |
| RISKY | > 60 | Possible indirect use | Migration needed |

### Risk Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Usage Count | 30% | How many imports reference this |
| Last Modified | 15% | Git history recency |
| Test Coverage | 20% | Is the code tested? |
| Import Depth | 15% | Transitive dependency depth |
| File Type | 10% | Config files riskier than components |
| Tool Agreement | 10% | Multiple tools agree = higher confidence |

## 4-Phase Workflow

```
┌─────────────────────────────────────────┐
│ PHASE 1: DETECTION                       │
│  - Run all detectors in parallel         │
│  - Deduplicate findings                  │
│  - Tag source (knip/depcheck/vue/etc)    │
└───────────────────┬─────────────────────┘
                    ▼
┌─────────────────────────────────────────┐
│ PHASE 2: ASSESSMENT                      │
│  - Calculate risk scores                 │
│  - Build dependency graph                │
│  - Categorize: SAFE / CAUTION / RISKY    │
└───────────────────┬─────────────────────┘
                    ▼
┌─────────────────────────────────────────┐
│ PHASE 3: ACTION (if --execute)           │
│  - Create backup branch                  │
│  - Remove SAFE items in batches          │
│  - Validate build after each batch       │
│  - Prompt for CAUTION items              │
└───────────────────┬─────────────────────┘
                    ▼
┌─────────────────────────────────────────┐
│ PHASE 4: REPORTING                       │
│  - Generate JSON report                  │
│  - Generate Markdown summary             │
│  - CI exit codes                         │
└─────────────────────────────────────────┘
```

## Configuration

Create `.claude/codebase-health-config.yml`:

```yaml
detection:
  knip:
    enabled: true
    ignore: ["**/*.test.ts", "**/*.stories.ts"]
  depcheck:
    enabled: true
    ignoreMatches: ["@types/*"]
  typescript:
    enabled: true
    noUnusedLocals: true
    noUnusedParameters: true
  vue:
    enabled: true
    detectUnusedProps: true
    detectUnusedEmits: true
    detectUnusedComputed: true
    detectUnusedWatchers: true
  legacy:
    enabled: true
    minYearsUntouched: 2

assessment:
  riskThresholds:
    safe: 20
    caution: 60
  protectedPaths:
    - "src/main.ts"
    - "src/App.vue"
    - "src/stores/**"
  protectedPackages:
    - "vue"
    - "pinia"
    - "vue-router"
    - "typescript"

actions:
  defaultMode: "dry-run"
  batchSize: 5
  validateAfterBatch: true
  gitIntegration:
    autoCommit: true
    commitPrefix: "[codebase-health]"
    createBackupBranch: true

reporting:
  formats: ["json", "markdown"]
  outputDir: "./audit-reports"
  includeBlindSpots: true
```

## Output Examples

### Console Summary
```
Codebase Health Audit Complete

Findings:
  SAFE (auto-remove OK):    23 items
  CAUTION (review needed):  18 items
  RISKY (migration needed):  6 items

By Category:
  Unused exports:     15
  Unused dependencies: 8
  Unused Vue props:   12
  Legacy patterns:     6
  Orphaned files:      6

Estimated Impact:
  Files to remove:    12
  Lines of code:   1,847
  Bundle savings: ~245KB

Run with --execute --safe-only to remove safe items.
```

### JSON Report
```json
{
  "metadata": {
    "timestamp": "2026-01-09T...",
    "version": "1.0.0",
    "executionTime": 45.2
  },
  "summary": {
    "totalFindings": 47,
    "byRisk": { "SAFE": 23, "CAUTION": 18, "RISKY": 6 },
    "byType": { "unused-export": 15, "unused-dependency": 8 }
  },
  "findings": [...]
}
```

## Safety Features

1. **Dry-run by default**: No changes without explicit `--execute`
2. **Backup branch**: Creates `backup/health-audit-YYYYMMDD` before changes
3. **Batch execution**: Removes 5 items at a time, validates between
4. **Build validation**: Runs `npm run build` after each batch
5. **Rollback commands**: Provides git revert commands in report
6. **Protected paths**: Never suggests removing core files

## False Positive Handling

### In Code
```typescript
// @codebase-health-ignore: Used dynamically
export const unusedButNeeded = ...;
```

### In Config
```yaml
detection:
  ignore:
    - "src/utils/polyfills.ts"  # Side-effect imports
    - "**/*.generated.ts"        # Generated code
```

## Known Blind Spots

- Dynamic imports: `import(variable)` cannot be statically analyzed
- Reflection/metaprogramming
- Runtime code generation
- Framework magic (e.g., Vue's `$attrs`, `$slots`)
- Side-effect-only imports

## Integration

This skill supersedes:
- `🧹 legacy-tech-remover` (patterns ported)
- `📊 comprehensive-auditor` (static analysis integrated)

Works alongside:
- `dev-lint-cleanup` - For ESLint-specific fixes
- `document-sync` - To update docs after removal

## CLI Options

| Option | Description |
|--------|-------------|
| `audit` | Run full audit (default: dry-run) |
| `execute` | Execute removal plan |
| `detect --detector <name>` | Run single detector |
| `--safe-only` | Only process SAFE items |
| `--ci` | CI mode with exit codes |
| `--config <path>` | Custom config file |
| `--output-dir <path>` | Report output directory |
| `--format json,markdown` | Report formats |

---

**Version**: 1.0.0
**Author**: Claude Code
**Category**: Code Maintenance
**Created**: January 9, 2026

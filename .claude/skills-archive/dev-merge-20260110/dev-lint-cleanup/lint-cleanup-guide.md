# 🧹 Lint Cleanup Skill

🔧 **SKILL ACTIVATED: Safe ESLint Error Fixing**

This skill provides comprehensive guidance for safely fixing ESLint errors without breaking code. Focus on unused variable fixes and safe patterns that preserve functionality.

---

## Table of Contents

1. [Pre-Flight Checklist](#pre-flight-checklist)
2. [Safe Fix Patterns](#safe-fix-patterns)
3. [ESLint Config for Underscore Pattern](#eslint-config)
4. [Fixing Unused Variables](#fixing-unused-vars)
5. [Files to Skip or Be Careful With](#dangerous-files)
6. [Verification Process](#verification-process)
7. [Error Categories](#error-categories)
8. [Common Gotchas](#common-gotchas)

---

## Pre-Flight Checklist {#pre-flight-checklist}

**BEFORE starting any lint cleanup:**

```bash
# 1. Get baseline count
npm run lint 2>&1 | tail -5

# 2. Save full output for reference
npm run lint 2>&1 > /tmp/lint-output.txt

# 3. Verify build works
npm run build

# 4. Check git status (ensure clean state)
git status
```

**Track progress in MASTER_PLAN.md:**
- Baseline count
- Current count after each batch of fixes
- Percentage reduction

---

## Safe Fix Patterns {#safe-fix-patterns}

### Pattern 1: Prefix Unused Variables with `_`

This is the SAFEST fix - it silences the error without changing logic:

```typescript
// BEFORE (error)
const unusedVar = someValue

// AFTER (no error)
const _unusedVar = someValue
```

### Pattern 2: Prefix Unused Function Parameters

```typescript
// BEFORE
const handleClick = (event: MouseEvent) => {
  // doesn't use event
}

// AFTER
const handleClick = (_event: MouseEvent) => {
  // doesn't use event
}
```

### Pattern 3: Destructuring with Rename

```typescript
// BEFORE
const { unusedProp, usedProp } = options

// AFTER
const { unusedProp: _unusedProp, usedProp } = options
```

### Pattern 4: Unused Type Imports

```typescript
// BEFORE
import { SomeType, UsedType } from '@/types'

// AFTER
import { SomeType as _SomeType, UsedType } from '@/types'

// OR for type-only imports:
import type { SomeType as _SomeType } from '@/types'
```

### Pattern 5: Remove Completely Unused Imports

```typescript
// BEFORE
import { ref, watch, computed } from 'vue'  // watch never used

// AFTER
import { ref, computed } from 'vue'
```

**⚠️ ONLY remove imports if:**
- The import is completely unused (not in template for Vue files)
- You've searched the entire file for usage
- It's not a type that might be used implicitly

---

## ESLint Config for Underscore Pattern {#eslint-config}

**CRITICAL**: The underscore pattern must be configured for BOTH `.ts` AND `.vue` files separately.

### eslint.config.js Setup

```javascript
// For TypeScript files (.ts, .tsx)
{
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }]
  }
}

// For Vue files (.vue) - MUST BE SEPARATE!
{
  files: ['**/*.vue'],
  rules: {
    // TypeScript rules for Vue files
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }]
  }
}
```

**If underscore prefix isn't working:**
1. Check eslint.config.js has the pattern for the file type
2. Restart the lint command
3. Clear any ESLint cache: `rm -rf node_modules/.cache/eslint*`

---

## Fixing Unused Variables {#fixing-unused-vars}

### Step-by-Step Process

1. **Find files with unused vars:**
```bash
grep -B5 "is assigned a value but never used" /tmp/lint-output.txt | grep "pomo-flow" | sort -u
```

2. **Check specific file errors:**
```bash
cat /tmp/lint-output.txt | grep -A30 "YourFile.vue$" | head -35
```

3. **Read the file at the error line:**
```bash
# For line 254
Read file with offset=250, limit=10
```

4. **Apply the fix using Edit tool**

5. **Verify build after each batch (every 5-10 files):**
```bash
npm run build 2>&1 | tail -5
```

### Batch Processing Order

Fix in this order (safest to most complex):

1. **Unused imports** - Remove or prefix
2. **Unused function parameters** - Prefix with `_`
3. **Unused local variables** - Prefix with `_`
4. **Unused destructured values** - Rename with `: _name`
5. **Unused computed properties** - Prefix with `_`

---

## Files to Skip or Be Careful With {#dangerous-files}

### Skip These Entirely

- **Test files** (*.test.ts, *.spec.ts) - May have intentional unused vars
- **Type definition files** (*.d.ts) - Auto-generated
- **Config files** (vite.config.ts, etc.) - May have special requirements

### Be Extra Careful With

| File Type | Reason |
|-----------|--------|
| Vue components with templates | Variables might be used in template |
| Store files | Exported functions might appear unused |
| Composables | Returned values might appear unused |
| Large files (1000+ lines) | More risk of missing context |

### Template Usage Check

**Before prefixing a variable in a Vue file:**

```bash
# Search for template usage
grep -n "variableName" src/components/YourFile.vue
```

Variables used in templates will appear in the `<template>` section but ESLint might not detect the usage.

---

## Verification Process {#verification-process}

### After Every Batch of Fixes

```bash
# 1. Run build
npm run build 2>&1 | tail -10

# 2. Check new lint count
npm run lint 2>&1 | tail -5

# 3. Calculate progress
# (baseline - current) / baseline * 100 = % fixed
```

### If Build Fails

1. **Check the error message** - Usually points to the problematic file
2. **Revert the last change** - Use Edit tool to undo
3. **Understand why** - The variable might actually be used somewhere

### Safe Rollback Pattern

If something breaks:
```bash
# Check what changed
git diff src/path/to/file.vue

# Revert single file
git checkout src/path/to/file.vue
```

---

## Error Categories {#error-categories}

### Category 1: Safe to Fix (DO FIX)

| Error | Fix |
|-------|-----|
| `'X' is assigned a value but never used` | Prefix with `_` |
| `'X' is defined but never used` (import) | Remove or prefix |
| `'X' is defined but never used` (param) | Prefix with `_` |

### Category 2: Requires Judgment (BE CAREFUL)

| Error | Consideration |
|-------|---------------|
| `Unexpected any` | Requires proper typing - skip unless confident |
| `no-explicit-any` | Skip - requires proper type research |
| `no-non-null-assertion` | Skip - requires null checking logic |

### Category 3: Skip (DON'T FIX)

| Error | Reason |
|-------|--------|
| Vue formatting warnings | Use `--fix` for these |
| `no-case-declarations` | Requires logic restructuring |
| Storybook renderer warnings | Storybook config issue |
| `NodeJS is not defined` | Requires type import |

---

## Common Gotchas {#common-gotchas}

### Gotcha 1: Multiple Matches

```
Error: Found 2 matches of the string to replace
```

**Solution**: Add more context to make the match unique:
```typescript
// Instead of just the variable line, include surrounding context
const userBackup = localStorage.getItem('pomo-flow-user-backup')
const importedTasks = localStorage.getItem('pomo-flow-imported-tasks')
```

### Gotcha 2: Variable Used in Template

**Symptom**: Build fails after prefixing
**Cause**: Variable is used in Vue template
**Solution**: Check template section before prefixing

```vue
<template>
  <!-- If myVar is used here, don't prefix it! -->
  <div>{{ myVar }}</div>
</template>

<script setup>
const myVar = ref('')  // ESLint says unused, but it's used in template
</script>
```

### Gotcha 3: Exported but Appears Unused

**Symptom**: Variable/function exported but eslint says unused
**Cause**: Used by other files importing this module
**Solution**: Don't prefix exports - they're used externally

```typescript
// Don't prefix this - it's exported for external use
export const myHelper = () => { ... }
```

### Gotcha 4: Store/Composable Return Values

```typescript
// These appear unused but are returned for consumers
const {
  tasks,        // Used by components importing this store
  createTask,   // Used by components
  _unusedInternal  // OK to prefix - truly internal
} = useTaskStore()
```

### Gotcha 5: Destructuring from Library Functions

```typescript
// Be careful with VueUse/library destructuring
const { ctrl, shift } = useMagicKeys()  // Might be used reactively
const { ctrl: _ctrl, shift: _shift } = useMagicKeys()  // Safe if truly unused
```

---

## Progress Tracking Template

Update MASTER_PLAN.md with:

```markdown
### TASK-XXX: Lint Cleanup (IN PROGRESS)

**Baseline** (Date): X,XXX problems (X,XXX errors, X,XXX warnings)
**After --fix**: X,XXX problems
**Current** (Date): X,XXX problems (X,XXX errors, X,XXX warnings)
**Progress**: XX.X% reduction (X,XXX problems fixed)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Run `npm run lint` to get baseline | ✅ DONE |
| 2 | Run `--fix` for formatting rules only | ✅ DONE |
| 3 | Add underscore pattern to eslint config | ✅ DONE |
| 4 | Manual prefix unused vars with `_` | 🔄 IN PROGRESS |
| 5 | Verify build passes | ✅ DONE |

**Files Fixed**:
- `file1.vue`: Description of fixes
- `file2.ts`: Description of fixes
```

---

## Quick Reference Commands

```bash
# Get current lint count
npm run lint 2>&1 | tail -5

# Save full lint output
npm run lint 2>&1 > /tmp/lint-output.txt

# Find files with unused vars
grep -B5 "is assigned a value but never used" /tmp/lint-output.txt | grep "pomo-flow" | sort -u

# Count remaining unused var errors
grep "is assigned a value but never used" /tmp/lint-output.txt | wc -l

# Check specific file errors
cat /tmp/lint-output.txt | grep -A20 "YourFile.vue$" | head -25

# Verify build
npm run build 2>&1 | tail -10

# Run --fix for formatting only (safe)
npm run lint -- --fix
```

---

## Related Skills

- **`dev-vue`**: Vue 3 Composition API patterns
- **`dev-debugging`**: General debugging techniques
- **`qa-testing`**: Testing after changes

---

**Last Updated**: December 16, 2025
**ESLint Version**: 8.x+ with flat config
**TypeScript ESLint**: 8.x+

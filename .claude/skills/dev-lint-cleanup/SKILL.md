---
name: Lint Cleanup
description: FIX ESLint errors safely without breaking code. Prefix unused variables with `_`, remove unused imports, and verify builds after each batch. Use when lint cleanup is needed for easier refactoring & faster Claude Code editing.
---

# Safe Lint Cleanup

## Instructions

This skill provides safe patterns for fixing ESLint errors without breaking code.

### Pre-Flight Checklist

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

### Safe Fix Patterns

#### Pattern 1: Prefix Unused Variables with `_`

This is the SAFEST fix - silences the error without changing logic:

```typescript
// BEFORE (error)
const unusedVar = someValue

// AFTER (no error)
const _unusedVar = someValue
```

#### Pattern 2: Prefix Unused Function Parameters

```typescript
// BEFORE
const handleClick = (event: MouseEvent) => {
  // doesn't use event
}

// AFTER
const _handleClick = (_event: MouseEvent) => {
  // doesn't use event
}
```

#### Pattern 3: Destructuring with Rename

```typescript
// BEFORE
const { unusedProp, usedProp } = options

// AFTER
const { unusedProp: _unusedProp, usedProp } = options
```

#### Pattern 4: Unused Type Imports

```typescript
// BEFORE
import { SomeType, UsedType } from '@/types'

// AFTER
import { SomeType as _SomeType, UsedType } from '@/types'
```

#### Pattern 5: Remove Completely Unused Imports

```typescript
// BEFORE
import { ref, watch, computed } from 'vue'  // watch never used

// AFTER
import { ref, computed } from 'vue'
```

### ESLint Config for Underscore Pattern

**CRITICAL**: The underscore pattern must be configured for BOTH `.ts` AND `.vue` files:

```javascript
// eslint.config.js

// For TypeScript files
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

// For Vue files - MUST BE SEPARATE!
{
  files: ['**/*.vue'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }]
  }
}
```

### Verification Process

After every batch of fixes:

```bash
# 1. Run build
npm run build 2>&1 | tail -10

# 2. Check new lint count
npm run lint 2>&1 | tail -5

# 3. Calculate progress
# (baseline - current) / baseline * 100 = % fixed
```

### Files to Be Careful With

| File Type | Reason |
|-----------|--------|
| Vue components with templates | Variables might be used in template |
| Store files | Exported functions might appear unused |
| Composables | Returned values might appear unused |
| Test files | May have intentional unused vars |

### Error Categories

**Safe to Fix (DO FIX):**
- `'X' is assigned a value but never used` - Prefix with `_`
- `'X' is defined but never used` (import) - Remove or prefix
- `'X' is defined but never used` (param) - Prefix with `_`

**Skip (DON'T FIX without careful analysis):**
- `Unexpected any` - Requires proper typing
- `no-explicit-any` - Requires proper type research
- `no-non-null-assertion` - Requires null checking logic
- Vue formatting warnings - Use `--fix` for these

### Common Gotchas

1. **Multiple Matches**: Add more surrounding context to make match unique
2. **Variable Used in Template**: Check `<template>` section before prefixing
3. **Exported but Appears Unused**: Don't prefix exports - used externally
4. **Store/Composable Return Values**: Check if values are returned for consumers

### Quick Reference Commands

```bash
# Get current lint count
npm run lint 2>&1 | tail -5

# Find files with unused vars
grep -B5 "is assigned a value but never used" /tmp/lint-output.txt | grep "pomo-flow" | sort -u

# Count remaining unused var errors
grep "is assigned a value but never used" /tmp/lint-output.txt | wc -l

# Check specific file errors
cat /tmp/lint-output.txt | grep -A20 "YourFile.vue$" | head -25

# Run --fix for formatting only (safe)
npm run lint -- --fix
```

See `lint-cleanup-guide.md` for complete documentation.

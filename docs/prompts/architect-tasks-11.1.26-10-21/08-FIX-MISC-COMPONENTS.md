# Fix: Miscellaneous Component TypeScript Errors

**Priority**: P2-MEDIUM
**Time Estimate**: 20 minutes
**Dependencies**: None

---

## Problem

3 TypeScript errors in other components:

| File | Line | Error | Issue |
|------|------|-------|-------|
| `TiptapEditor.vue` | 378 | TS2559 | `false` not compatible with `SetContentOptions` |
| `SignupForm.vue` | 244 | TS2345 | `string \| undefined` not assignable to `Record` |

---

## Fixes

### Fix 1: `src/components/common/TiptapEditor.vue`

**Line 378** - Fix SetContentOptions type:

```typescript
// Find the setContent call around line 378
// CHANGE from:
editor.value?.commands.setContent(content, false)

// TO (use proper options object):
editor.value?.commands.setContent(content, {
  emitUpdate: false
})

// OR if you want to emit update:
editor.value?.commands.setContent(content, {
  emitUpdate: true,
  parseOptions: {
    preserveWhitespace: 'full'
  }
})
```

**Tiptap SetContentOptions interface**:
```typescript
interface SetContentOptions {
  emitUpdate?: boolean;
  parseOptions?: ParseOptions;
}
```

### Fix 2: `src/components/auth/SignupForm.vue`

**Line 244** - Fix error handling type:

```typescript
// Find the error handling code around line 244
// CHANGE from:
function handleError(error: string | undefined): Record<string, unknown> | undefined {
  return error;  // Error: string not assignable to Record
}

// TO:
function handleError(error: string | undefined): string | undefined {
  return error;
}

// OR if Record is needed:
function handleError(error: string | undefined): Record<string, unknown> | undefined {
  if (!error) return undefined;
  return { message: error };
}

// OR fix the calling code to expect string:
const errorMessage = typeof error === 'string' ? error : error?.message;
```

---

## Verification

```bash
# After fixes:
npx vue-tsc --noEmit 2>&1 | grep -E "Tiptap|Signup"

# Expected: No errors from these components

# Manual test:
npm run dev
# Test rich text editor and signup form
```

---

## Success Criteria

- [ ] No TS2559 errors for TiptapEditor
- [ ] No TS2345 errors for SignupForm
- [ ] Rich text editor works (bold, italic, lists)
- [ ] Signup form handles errors correctly

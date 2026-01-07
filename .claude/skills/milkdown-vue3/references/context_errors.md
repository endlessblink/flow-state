# Context Errors Reference

When Milkdown doesn't initialize correctly, context errors occur. This guide explains all context error types and fixes.

## Error 1: Context "editorView" not found

**Symptoms:**
```
Error: Context "editorView" not found
```
Happens when: Pressing Enter, typing, or using any editor function

**Root Cause:**
The editorView context is unavailable. This means:
1. Theme wasn't loaded (`.use(nord)` is missing)
2. `.create()` wasn't called
3. `editor.action()` not used to access contexts

**Fix:**
```typescript
const { getEditor } = useEditor((root) =>
  Editor.make()
    .config((ctx) => ctx.set(rootCtx, root))
    .use(nord)           // Must be here
    .use(commonmark)
    .create()            // Must be here
);
```

## Error 2: editor.create is not a function

**Symptoms:**
```
TypeError: editor.create is not a function
```
Happens when: During editor initialization

**Root Cause:**
The useEditor callback doesn't call `.create()` at the end.

**Fix:**
Add `.create()` at the very end:
```typescript
const { getEditor } = useEditor((root) =>
  Editor.make()
    .config((ctx) => ctx.set(rootCtx, root))
    .use(nord)
    .use(commonmark)
    .create()          // Add this at the end
);
```

## Error 3: can't access private field or method

**Symptoms:**
```
TypeError: can't access private field or method
```
Happens when: Calling editor methods

**Root Cause:**
You extracted a method from the editor object:
```typescript
// WRONG
const { action } = editor;
action(...);  // Error!
```

**Fix:**
Call methods directly on the editor:
```typescript
// CORRECT
editor.action(...);
```

## Error 4: getEditor() is undefined

**Symptoms:**
```
TypeError: getEditor is not a function
```
Happens when: Calling `getEditor()` in `onMounted`

**Root Cause:**
getEditor is not destructured correctly from `useEditor()`.

**Fix:**
```typescript
// WRONG
const editor = useEditor(...);  // Missing destructuring

// CORRECT
const { getEditor } = useEditor(...);
```

## Error 5: Extraneous non-props attributes

**Symptoms:**
```
Vue warn: Extraneous non-props attributes were passed to component but could not be automatically inherited
```

**Root Cause:**
Props are being passed to MilkdownProvider, which doesn't accept them.

**Fix:**
```vue
<!-- WRONG -->
<MilkdownProvider :rows="4" :placeholder="text">
  <MilkdownEditorSurface />
</MilkdownProvider>

<!-- CORRECT -->
<MilkdownProvider>
  <MilkdownEditorSurface :rows="4" :placeholder="text" />
</MilkdownProvider>
```

## Error 6: Context themeManager not found

**Symptoms:**
```
Error: Context "themeManager" not found
```

**Root Cause:**
Theme wasn't loaded. Missing `.use(nord)` or similar.

**Fix:**
Same as Error 1 - add `.use(nord)`.

## Error 7: Context editorStateCtx not found

**Symptoms:**
```
Error: Context "editorStateCtx" not found
```

**Root Cause:**
Same as Error 1 - theme or `.create()` missing.

## Quick Diagnosis Checklist

When getting ANY context error, check these in order:

1. **Theme and Create**
   - Is `.use(nord)` present?
   - Is `.create()` at the end?
   - Are they in right order? (theme BEFORE preset)

2. **Provider Props**
   - Does `<MilkdownProvider>` have props?
   - Should they be on `<MilkdownEditorSurface>` instead?

3. **getEditor Destructuring**
   - Is it `const { getEditor } = useEditor(...)`?
   - Not `const editor = useEditor(...)`?

4. **Method Access**
   - Are you extracting methods? `const { action } = editor`?
   - Should be calling directly: `editor.action(...)`?

5. **Access in onMounted**
   - Is `getEditor()` being awaited?
   - Is it wrapped in `editor.action((ctx) => ...)`?

## Quick Reference Table

| Error | Quick Fix |
|-------|-----------|
| editorView not found | Add `.use(nord)` and `.create()` |
| editor.create is not a function | Add `.create()` at end |
| can't access private field | Use `editor.method()`, not extracted |
| getEditor is undefined | Use `const { getEditor }` with braces |
| Extraneous non-props | Remove props from provider, add to child |
| themeManager not found | Add `.use(nord)` |
| editorStateCtx not found | Add `.use(nord)` and `.create()` |

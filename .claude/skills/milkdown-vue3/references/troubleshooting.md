# Troubleshooting Checklist

Systematic debugging guide for Milkdown Vue 3 editors.

## Quick Diagnosis Flow

```
Editor not working?
├─ Does it render at all?
│  ├─ NO → Check installation & setup
│  └─ YES → Go to next
├─ Can you type?
│  ├─ NO → Check Milkdown component
│  └─ YES → Go to next
├─ Is there an error?
│  ├─ YES → Go to error section below
│  └─ NO → It might be working! Test more
└─ All tests pass? → You're done!
```

## Section 1: Installation & Setup

**Are dependencies installed?**
```bash
npm list @milkdown/vue
# Should show @milkdown/vue@7.18.0
```

If not, run:
```bash
npm install @milkdown/vue@7.18.0 @milkdown/core@7.18.0 @milkdown/preset-commonmark@7.18.0 @milkdown/theme-nord@7.18.0 prosemirror-state prosemirror-view prosemirror-model
```

**Are files in the right place?**
```
src/components/
├─ MarkdownEditor.vue
└─ MilkdownEditorSurface.vue
```

## Section 2: Editor Rendering

**Does the editor appear on screen?**

Check in DevTools console:
```javascript
document.querySelector('.milkdown-editor')
```

If null, check:
1. Is `MilkdownProvider` wrapping the component?
2. Is `<Milkdown />` in the template?
3. Are imports correct?

## Section 3: Critical Test - Press Enter

**This is the most important test.**

Test Procedure:
1. Click in editor
2. Type: `Line 1`
3. Press Enter
4. Type: `Line 2`

**Expected:** Two separate paragraphs

**If it stays on same line:**
This is the "Context editorView not found" error.

Fix:
1. Find the line: `.use(nord)` - if missing, add it before `.use(commonmark)`
2. Find the line: `.create()` - if missing, add it at the very end
3. Save and refresh browser

## Section 4: Markdown Rendering Tests

Test each feature:

| Test | Type This | Expected |
|------|-----------|----------|
| Heading | `# Heading` | Large heading |
| Bold | `**bold**` | Bold text |
| Italic | `*italic*` | Italic text |
| List | `- item` | Bullet point |
| Code | `` `code` `` | Code styling |
| Blockquote | `> quote` | Indented quote |

**If ALL tests fail:**
The preset isn't loading. Check:
- Is `.use(commonmark)` present?
- Is it AFTER `.use(nord)`?
- Is `.create()` at the end?

## Section 5: Data Binding (v-model)

**Test Parent to Child:**
```typescript
const content = ref('# Initial Content');
```
Does editor show this content?

**Test Child to Parent:**
Type in editor, check parent:
```typescript
watch(() => content, (newVal) => {
  console.log('Updated:', newVal);
});
```

If not updating:
- Check: Is `@update:modelValue` emitted from child?
- Check: Is emit called: `emit('update:modelValue', markdown)`?

## Section 6: Nuclear Option

If everything is broken:

1. Delete components:
```bash
rm src/components/MarkdownEditor.vue
rm src/components/MilkdownEditorSurface.vue
```

2. Clear node_modules:
```bash
rm -rf node_modules package-lock.json
npm install
```

3. Restart dev server

4. Recreate components from SKILL.md exactly

## When Something Breaks Checklist

Check in order:
1. Is `.use(nord)` present?
2. Is `.create()` present?
3. Is `.use(nord)` BEFORE `.use(commonmark)`?
4. Is onMounted using async/await?
5. Are props off MilkdownProvider?
6. Is `<Milkdown />` in template?

## Success Criteria

All must pass:
- [ ] Editor renders without errors
- [ ] Can type text
- [ ] Press Enter creates new paragraph
- [ ] Markdown renders (# heading, **bold**, etc.)
- [ ] v-model binding works
- [ ] Console is clean
- [ ] No warnings

## Performance Check

**Typing lag?**
- Close other browser tabs
- Restart dev server
- Check CPU usage

**Memory issues?**
- Open DevTools → Memory tab
- Take heap snapshot before and after typing
- Should be similar size (no leaks)

# Implementation Checklist

Step-by-step setup guide for Milkdown Vue 3 editors.

## Phase 1: Preparation (5 minutes)

- [ ] Read SKILL.md core pattern
- [ ] Understand the 5 critical rules
- [ ] Have both component templates ready

## Phase 2: Install Dependencies (5 minutes)

- [ ] Open terminal in project root
- [ ] Run npm install command:
```bash
npm install @milkdown/vue@7.18.0 @milkdown/core@7.18.0 @milkdown/preset-commonmark@7.18.0 @milkdown/theme-nord@7.18.0 prosemirror-state prosemirror-view prosemirror-model
```
- [ ] Wait for installation to complete
- [ ] Verify: `npm list @milkdown/vue` shows 7.18.0

## Phase 3: Create Parent Component (10 minutes)

- [ ] Create file: `src/components/MarkdownEditor.vue`
- [ ] Copy parent component code from SKILL.md
- [ ] Verify:
  - [ ] `<MilkdownProvider>` has NO props
  - [ ] `<MilkdownEditorSurface>` receives props
  - [ ] `@update:modelValue` emit is present
  - [ ] Interface Props is defined correctly

## Phase 4: Create Child Component (15 minutes)

- [ ] Create file: `src/components/MilkdownEditorSurface.vue`
- [ ] Copy child component code from SKILL.md
- [ ] Verify:
  - [ ] `useEditor((root) => ...)` pattern
  - [ ] `.use(nord).use(commonmark).create()` chain
  - [ ] `onMounted` is async
  - [ ] `const editor = await getEditor()` awaits
  - [ ] `editor.action((ctx) => ...)` wraps context access
  - [ ] `emit('update:modelValue', ...)` is called

## Phase 5: Test Setup (10 minutes)

- [ ] Create test component:
```vue
<template>
  <div>
    <MarkdownEditor v-model="content" placeholder="Test..." />
    <div class="preview">{{ content }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MarkdownEditor from '@/components/MarkdownEditor.vue';

const content = ref('');
</script>
```
- [ ] Add test component to your app
- [ ] Test:
  - [ ] Editor renders (no errors)
  - [ ] Can type text
  - [ ] Text appears in preview
  - [ ] No console errors

## Phase 6: Validation Tests (10 minutes)

### Critical Test 1: Press Enter
- [ ] Type text in editor
- [ ] Press Enter
- [ ] Should create new paragraph (NOT stay on same line)
- If fails: Check `.use(nord)` and `.create()`

### Critical Test 2: Markdown Rendering
- [ ] Type: `# Heading`
- [ ] Should render as large heading
- If fails: Check commonmark preset is loaded

### Critical Test 3: Bold Syntax
- [ ] Type: `**bold text**`
- [ ] Should render bold
- If fails: Check preset loading order

### Critical Test 4: v-model Binding
- [ ] Type in editor
- [ ] Parent component should receive updates
- If fails: Check emit is called in child

### Critical Test 5: Console Check
- [ ] Open DevTools → Console
- [ ] Should see: "Milkdown editor initialized successfully"
- [ ] Should NOT see:
  - Context errors
  - Prop warnings
  - Initialization errors

## Phase 7: Integration (15 minutes)

- [ ] Add to your form or modal:
```vue
<MarkdownEditor
  v-model="task.description"
  placeholder="Task description..."
  :rows="6"
/>
```
- [ ] Test in actual context
- [ ] Verify data persistence
- [ ] Verify content loads correctly

## Phase 8: Customization (Optional)

Choose customizations as needed:
- [ ] Change theme
- [ ] Add strikethrough (GFM)
- [ ] Add toolbar buttons
- [ ] Add save functionality
- [ ] Custom styling

## Phase 9: Production Readiness (10 minutes)

- [ ] Run full test suite: `npm test`
- [ ] Check: No console errors or warnings
- [ ] Verify: All 5 critical tests pass
- [ ] Check: Memory usage is stable
- [ ] Check: No TypeScript errors

## Troubleshooting During Setup

**If "Context editorView not found":**
- [ ] Check `.use(nord)` is present
- [ ] Check `.create()` is present
- [ ] Clear node_modules: `rm -rf node_modules && npm install`
- [ ] Restart dev server

**If "editor.create is not a function":**
- [ ] Check `.create()` is at end of chain
- [ ] Check spelling: `.create()` not `.init()`
- [ ] Check useEditor callback returns `Editor.make()`

**If editor doesn't render:**
- [ ] Check: Is `<Milkdown />` in template?
- [ ] Check: Is MilkdownProvider wrapping component?
- [ ] Check: Are dependencies installed?

## Success Criteria

When complete, verify ALL of these:
- [ ] Dependencies installed (npm list shows correct versions)
- [ ] MarkdownEditor.vue created and error-free
- [ ] MilkdownEditorSurface.vue created and error-free
- [ ] Test component works
- [ ] Can type text
- [ ] Press Enter creates new paragraph (CRITICAL)
- [ ] Markdown renders correctly
- [ ] v-model binding works
- [ ] Console clean (no errors)
- [ ] Integrated into your app
- [ ] Production ready

## Time Estimate

| Phase | Time |
|-------|------|
| Preparation | 5 min |
| Installation | 5 min |
| Parent component | 10 min |
| Child component | 15 min |
| Testing | 10 min |
| Validation | 10 min |
| Integration | 15 min |
| Customization | 0-20 min |
| Production check | 10 min |
| **TOTAL** | **~90 minutes** |

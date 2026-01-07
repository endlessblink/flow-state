# Improve Milkdown Markdown Editor or Replace with Alternative

**Type:** Improvement / Decision Point
**Priority:** High
**Created:** January 7, 2026
**Status:** Planning

---

## Overview

The Pomo-Flow task management app uses Milkdown v7.18.0 for markdown editing in task descriptions. Recent bug fixes (TASK-109, BUG-005) have improved functionality, but known issues persist. This plan evaluates whether to:

1. **Fix Milkdown** - Address remaining issues to achieve flawless operation
2. **Replace with Alternative** - Migrate to Tiptap or md-editor-v3

---

## Problem Statement / Motivation

### Current State
- Milkdown implemented in `MilkdownEditorSurface.vue` and `MarkdownEditor.vue`
- Used in `TaskEditModal.vue` and `QuickTaskCreateModal.vue`
- Recent fixes addressed Enter key, checkbox rendering, and plugin order issues

### Remaining Issues
| Issue | Severity | Impact |
|-------|----------|--------|
| Private field access errors on unmount | Medium | Console noise, potential memory leak |
| TaskList toolbar button inserts raw text | Medium | Checkboxes via toolbar don't render correctly |
| Potential race conditions on rapid modal open/close | Unknown | May cause editor initialization failures |

### Why This Matters
- Task descriptions are core to Pomo-Flow's value proposition
- Unreliable editor = frustrated users = abandoned app
- Technical debt accumulates if issues aren't resolved decisively

---

## Proposed Solution

### Decision Framework

**Time-box:** 8 hours maximum to fix Milkdown issues

**Success Criteria for "Working Flawlessly":**
- [ ] Zero console errors in normal usage (open modal, type, format, save, close)
- [ ] All toolbar buttons work correctly (Bold, Italic, List, TaskList, Link)
- [ ] Checkboxes render AND toggle when clicking
- [ ] < 200ms editor initialization time
- [ ] Clean unmount with no errors
- [ ] Playwright tests pass for 5 core scenarios

**If criteria not met after 8 hours:** Proceed with Tiptap migration

### Option A: Fix Milkdown (Recommended First)

**Estimated Effort:** 4-8 hours

**Tasks:**
1. Fix TaskList toolbar button to programmatically create checkbox nodes
2. Resolve private field access error on unmount
3. Add error boundary with textarea fallback
4. Write comprehensive Playwright tests
5. Performance benchmark (initialization, typing latency)

### Option B: Replace with Tiptap

**Estimated Effort:** 12-16 hours

**Tasks:**
1. Install Tiptap with markdown extension
2. Create TiptapEditor.vue matching current API
3. Migrate MarkdownEditor.vue to use Tiptap
4. Test markdown roundtrip (Milkdown format → Tiptap → storage)
5. Update TaskEditModal and QuickTaskCreateModal
6. Write migration script for any format differences

### Option C: Replace with md-editor-v3

**Estimated Effort:** 8-12 hours

**Trade-off:** Split-view instead of WYSIWYG (different UX paradigm)

---

## Technical Considerations

### Architecture
- Current: `MilkdownProvider` → `MilkdownEditorSurface` pattern
- Props API: `modelValue`, `placeholder`, `rows`
- Events: `update:modelValue`

### Key Files to Modify
```
src/components/common/
├── MarkdownEditor.vue          # Provider wrapper
├── MilkdownEditorSurface.vue   # Main editor (or replace entirely)
└── MarkdownRenderer.vue        # Read-only display (keep as-is)

src/components/tasks/
├── TaskEditModal.vue           # Uses MarkdownEditor
└── QuickTaskCreateModal.vue    # Uses MarkdownEditor
```

### Dependencies (current)
```json
"@milkdown/core": "^7.18.0",
"@milkdown/vue": "^7.18.0",
"@milkdown/preset-commonmark": "^7.18.0",
"@milkdown/preset-gfm": "^7.18.0",
"@milkdown/theme-nord": "^7.18.0",
"@milkdown/plugin-history": "^7.18.0",
"@milkdown/plugin-listener": "^7.18.0"
```

### Performance Implications
- Milkdown bundle: ~150KB gzipped
- Tiptap bundle: ~120KB gzipped (similar)
- md-editor-v3: ~200KB gzipped (larger due to preview renderer)

### Security Considerations
- **Content sanitization:** Must sanitize markdown before rendering to prevent XSS
- **Max content length:** Implement 10,000 character limit for task descriptions

---

## Acceptance Criteria

### Functional Requirements
- [ ] User can type markdown and see WYSIWYG rendering
- [ ] Bold, Italic, List, TaskList, Link toolbar buttons work
- [ ] Task checkboxes render and toggle on click
- [ ] Undo/Redo works (Ctrl+Z, Ctrl+Y)
- [ ] Content persists correctly to PouchDB
- [ ] Editor loads existing task descriptions correctly

### Non-Functional Requirements
- [ ] Initialization time < 200ms
- [ ] No console errors during normal usage
- [ ] Works in Chrome, Firefox, Safari (latest versions)
- [ ] Respects RTL text direction for Hebrew

### Quality Gates
- [ ] 5 Playwright test scenarios pass
- [ ] No TypeScript errors
- [ ] ESLint passes
- [ ] Manual testing on desktop and mobile viewport

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Console errors | 0 | Playwright console capture |
| Init time | < 200ms | Performance.now() measurement |
| Toolbar success rate | 100% | Automated test coverage |
| User satisfaction | No complaints | User feedback (post-release) |

---

## Dependencies & Prerequisites

### Blocking Dependencies
- None (self-contained feature)

### Non-Blocking Dependencies
- CouchDB sync behavior (content conflicts) - can address separately

### Prerequisites
- [ ] Dev server running on port 5546
- [ ] Playwright configured for visual testing
- [ ] Access to existing skill documentation at `.claude/skills/milkdown-vue3/`

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Milkdown issues unfixable | Medium | High | Time-box + Tiptap fallback plan ready |
| Tiptap markdown format differs | Low | Medium | Test roundtrip before migration |
| User data loss during migration | Low | High | Implement migration script with rollback |
| Performance regression | Low | Medium | Benchmark before/after |

---

## Implementation Plan

### Phase 1: Diagnose & Fix (4-8 hours)

**Tasks:**
1. **Reproduce issues** - Create Playwright tests that capture current bugs
   - File: `tests/e2e/markdown-editor.spec.ts`
2. **Fix TaskList toolbar** - Use Milkdown's command API to insert checkbox node
   - File: `src/components/common/MilkdownEditorSurface.vue:68-110`
3. **Fix unmount error** - Proper cleanup in onUnmounted hook
   - File: `src/components/common/MilkdownEditorSurface.vue`
4. **Add error boundary** - Fallback to textarea if Milkdown fails
   - File: `src/components/common/MarkdownEditor.vue`
5. **Verify all acceptance criteria**

### Phase 2: Decision Point (30 minutes)

**After Phase 1:**
- If ALL acceptance criteria pass → Document fixes, close task
- If ANY criteria fail → Proceed to Phase 3

### Phase 3: Tiptap Migration (12-16 hours, only if needed)

**Tasks:**
1. Install Tiptap packages
2. Create `TiptapEditorSurface.vue` with same API
3. Update `MarkdownEditor.vue` to use Tiptap
4. Test markdown storage compatibility
5. Update tests
6. Remove Milkdown dependencies

---

## Test Plan

### Playwright Scenarios

```typescript
// tests/e2e/markdown-editor.spec.ts

describe('Markdown Editor', () => {
  test('Scenario 1: Basic text editing', async ({ page }) => {
    // Open task modal, type text, apply bold, save, verify
  })

  test('Scenario 2: Task list creation via toolbar', async ({ page }) => {
    // Click TaskList button, verify checkbox renders, toggle checkbox
  })

  test('Scenario 3: Task list creation via syntax', async ({ page }) => {
    // Type "- [ ] item", verify checkbox renders
  })

  test('Scenario 4: Rapid modal open/close', async ({ page }) => {
    // Open modal, close immediately, open again, verify no errors
  })

  test('Scenario 5: Large content handling', async ({ page }) => {
    // Paste 5000 characters, verify performance, save successfully
  })
})
```

---

## References

### Internal References
- Current implementation: `src/components/common/MilkdownEditorSurface.vue`
- Skill documentation: `.claude/skills/milkdown-vue3/SKILL.md`
- Related tasks: TASK-109 (completed), BUG-005 (completed)
- MASTER_PLAN tracking: `docs/MASTER_PLAN.md`

### External References
- [Milkdown Vue Recipe](https://milkdown.dev/docs/recipes/vue)
- [Milkdown Editor Interaction](https://milkdown.dev/docs/guide/interacting-with-editor)
- [Tiptap Vue 3 Guide](https://tiptap.dev/docs/editor/getting-started/install/vue3)
- [Tiptap Markdown Extension](https://tiptap.dev/docs/editor/markdown)
- [2025 Rich Text Editor Comparison](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)

### Related Work
- TASK-109: Implemented Obsidian-like WYSIWYG mode (completed Jan 6, 2026)
- BUG-005: Fixed checkbox/task list rendering (completed Jan 7, 2026)

---

## Open Questions

1. **Error visibility:** Should console errors be completely eliminated, or just user-visible errors?
2. **Mobile support:** Is mobile touch editing a requirement for MVP?
3. **Collaborative editing:** Is real-time collaboration (Yjs) a future requirement that affects editor choice?
4. **Content limits:** Is 10,000 character limit acceptable, or should it be higher?

---

## MVP Code Examples

### Fix: TaskList Toolbar Button

```typescript
// src/components/common/MilkdownEditorSurface.vue

const handleToolbar = (action: string) => {
  const editor = getEditor()
  if (!editor) return

  editor.action((ctx) => {
    const commandManager = ctx.get(commandsCtx)

    switch (action) {
      case 'task':
        // Use wrapInList command with task list type instead of inserting raw text
        commandManager.call(wrapInTaskListCommand.key)
        break
      // ... other cases
    }
  })
}
```

### Fix: Error Boundary with Fallback

```vue
<!-- src/components/common/MarkdownEditor.vue -->

<template>
  <div v-if="editorError" class="editor-fallback">
    <textarea
      v-model="internalValue"
      :placeholder="placeholder"
      class="fallback-textarea"
    />
    <p class="error-notice">Rich editor unavailable. Using plain text mode.</p>
  </div>
  <MilkdownProvider v-else>
    <MilkdownEditorSurface
      :modelValue="modelValue"
      @update:modelValue="handleUpdate"
      @error="handleEditorError"
    />
  </MilkdownProvider>
</template>

<script setup lang="ts">
const editorError = ref(false)
const handleEditorError = (error: Error) => {
  console.error('Milkdown error:', error)
  editorError.value = true
}
</script>
```

### Test: Playwright Scenario

```typescript
// tests/e2e/markdown-editor.spec.ts

import { test, expect } from '@playwright/test'

test('TaskList toolbar creates interactive checkbox', async ({ page }) => {
  await page.goto('http://localhost:5546')

  // Open task creation modal
  await page.click('[data-testid="quick-add-task"]')

  // Click TaskList toolbar button
  await page.click('[data-testid="toolbar-tasklist"]')

  // Verify checkbox rendered
  const checkbox = page.locator('.milkdown input[type="checkbox"]')
  await expect(checkbox).toBeVisible()

  // Toggle checkbox
  await checkbox.click()
  await expect(checkbox).toBeChecked()

  // Verify no console errors
  const errors = await page.evaluate(() => window.__consoleErrors || [])
  expect(errors).toHaveLength(0)
})
```

---

**Generated with [Claude Code](https://claude.com/claude-code)**

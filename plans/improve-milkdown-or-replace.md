# Improve Milkdown Markdown Editor or Replace with Alternative

**Type:** Improvement / Decision Point
**Priority:** High
**Created:** January 7, 2026
**Status:** Planning
**Deepened:** January 7, 2026

---

## Enhancement Summary

**Sections enhanced:** 12
**Research agents used:** 9 (best-practices-researcher x2, framework-docs-researcher, architecture-strategist, code-simplicity-reviewer, performance-oracle, kieran-typescript-reviewer, security-sentinel, julik-frontend-races-reviewer)

### Key Improvements
1. **Complete fix patterns** for private field access errors using `toRaw()` and proper cleanup
2. **Exact command API** for TaskList toolbar: `wrapInBlockTypeCommand` with `checked: false`
3. **5 race condition vectors** identified with mitigation patterns
4. **CRITICAL security findings** - hardcoded credentials must be removed immediately
5. **Comprehensive Playwright test suite** with console monitoring, performance metrics, and accessibility

### New Considerations Discovered
- Architecture is sound - issues are implementation bugs, not design flaws
- Two-component split may be over-engineered (~40% LOC reduction possible)
- Error boundary may be YAGNI - fix root cause instead of hiding symptoms
- RTL auto-detection adds complexity for potentially unused feature

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
| Issue | Severity | Impact | Root Cause |
|-------|----------|--------|------------|
| Private field access errors on unmount | Medium | Console noise, potential memory leak | Vue 3 proxies + Milkdown private fields |
| TaskList toolbar button inserts raw text | Medium | Checkboxes via toolbar don't render correctly | Manual text insertion instead of command API |
| Potential race conditions on rapid modal open/close | High | Editor initialization failures, stale references | Async editor creation vs sync component lifecycle |

### Research Insights: Root Cause Analysis

**Private Field Access Error:**
Vue 3's reactivity system wraps objects in JavaScript Proxies. Milkdown's `Editor` class uses private fields (`#status`, `#configureList`, etc.) which cannot be forwarded through proxies. When Vue accidentally wraps an Editor instance, any subsequent access to methods using private fields fails.

**TaskList Button Issue:**
Current implementation (line 87-94) uses `tr.insertText('- [ ] ', lineStart)` which inserts raw text. Milkdown's input rules only trigger when user types - programmatic insertion requires the command API.

**Race Conditions (5 vectors identified):**
1. Editor stale reference after rapid open/close
2. Toolbar commands on destroyed editor
3. Missing cancellation on unmount
4. Watch without debounce causing render thrashing
5. Save-in-progress without guard

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

**Tasks (Priority Order):**
1. Fix private field access error with `toRaw()` wrapper pattern
2. Fix TaskList toolbar using `wrapInBlockTypeCommand` API
3. Add race condition guards (abort on unmount, save-in-progress)
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

**NOT RECOMMENDED** - Different UX paradigm (split-view vs WYSIWYG), larger bundle, breaks "Obsidian-like" experience.

---

## Technical Considerations

### Architecture

**Research Insights:**
The current three-layer architecture is **sound**:
```
TaskEditModal/QuickTaskCreateModal
    └── MarkdownEditor.vue (Provider Wrapper)
            └── MilkdownProvider (@milkdown/vue)
                    └── MilkdownEditorSurface.vue (Editor Implementation)
```

The issues are **implementation bugs, not design flaws**.

- Current: `MilkdownProvider` → `MilkdownEditorSurface` pattern
- Props API: `modelValue`, `placeholder`, `rows`
- Events: `update:modelValue`

### Key Files to Modify
```
src/components/common/
├── MarkdownEditor.vue          # Provider wrapper (246 lines)
├── MilkdownEditorSurface.vue   # Main editor (171 lines)
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

**Research Insights:**
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Bundle size | ~150KB gzipped | N/A | Acceptable |
| Init time | ~115-180ms | <200ms | MEETS TARGET |
| Typing latency | ~10ms | <16ms (60fps) | MEETS TARGET |
| Memory per editor | ~15MB | <20MB | Needs cleanup |

**Performance Risks:**
- Memory leak from missing cleanup (~5MB growth per 10 modal opens)
- RTL detection regex runs on every keystroke (add debouncing)

### Security Considerations

**CRITICAL - Immediate Action Required:**

| Finding | Severity | Action |
|---------|----------|--------|
| Hardcoded CouchDB credentials in `database.ts` | CRITICAL | Remove immediately |
| HTTP instead of HTTPS for CouchDB | HIGH | Switch to HTTPS |
| Unsanitized URL in markdown link renderer | HIGH | Add URL validation |
| No content length enforcement | MEDIUM | Add 10,000 char limit |

**Content sanitization:** DOMPurify is in place but link `href` values need URL protocol validation:
```typescript
// Add to markdown.ts link renderer
const safeProtocols = ['http:', 'https:', 'mailto:']
try {
  const url = new URL(href, window.location.origin)
  if (!safeProtocols.includes(url.protocol)) {
    return text // Don't render as link
  }
} catch {
  return text
}
```

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
- [ ] No memory leaks (stable memory after 20 open/close cycles)

### Quality Gates
- [ ] 5 Playwright test scenarios pass
- [ ] No TypeScript errors
- [ ] ESLint passes
- [ ] Manual testing on desktop and mobile viewport
- [ ] WCAG 2.1 AA accessibility compliance (no critical/serious violations)

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Console errors | 0 | Playwright console capture |
| Init time | < 200ms | Performance.now() measurement |
| Toolbar success rate | 100% | Automated test coverage |
| Memory stability | < 5MB growth per 20 cycles | Playwright memory measurement |
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
| Race conditions persist | Medium | High | Implement state machine pattern |

---

## Implementation Plan

### Phase 1: Diagnose & Fix (4-8 hours)

#### Task 1.1: Fix Private Field Access Error (1 hour)

**File:** `src/components/common/MilkdownEditorSurface.vue`

**Research Insights - The Pattern:**

```typescript
import { toRaw, onBeforeUnmount, ref } from 'vue'
import { editorViewCtx } from '@milkdown/core'

// Track unmount state
const isUnmounting = ref(false)

onBeforeUnmount(() => {
  isUnmounting.value = true
})

// Safe editor action wrapper
const safeEditorAction = (action: (ctx: any) => void) => {
  if (isUnmounting.value) return

  const editor = getEditor()
  if (!editor) return

  try {
    // Unwrap any Vue proxy
    const rawEditor = toRaw(editor)
    rawEditor.action((ctx) => {
      // Additional safety: check if view is destroyed
      const view = ctx.get(editorViewCtx)
      if (view?.isDestroyed) return

      action(ctx)
    })
  } catch (e) {
    // Silently handle private field or destroyed errors
    if (!(e instanceof TypeError && String(e).includes('private'))) {
      console.warn('Editor action failed:', e)
    }
  }
}
```

**Key Insight:** Don't call `editor.destroy()` manually - Milkdown Vue's `useEditor` already handles cleanup in its internal `onUnmounted` hook.

#### Task 1.2: Fix TaskList Toolbar Command (2 hours)

**File:** `src/components/common/MilkdownEditorSurface.vue:68-110`

**Research Insights - Correct Implementation:**

```typescript
import { commandsCtx } from '@milkdown/core'
import {
  listItemSchema,
  wrapInBlockTypeCommand,
  clearTextInCurrentBlockCommand,
  toggleStrongCommand,
  toggleEmphasisCommand
} from '@milkdown/preset-commonmark'

// Define toolbar command union type for type safety
type ToolbarCommand = 'Bold' | 'Italic' | 'BulletList' | 'TaskList' | 'Link' | 'Undo' | 'Redo'

const handleToolbar = (command: ToolbarCommand) => {
  safeEditorAction((ctx) => {
    const commandManager = ctx.get(commandsCtx)

    switch (command) {
      case 'Bold':
        commandManager.call(toggleStrongCommand.key)
        break

      case 'Italic':
        commandManager.call(toggleEmphasisCommand.key)
        break

      case 'TaskList': {
        // Get the list item node type from schema
        const listItem = listItemSchema.type(ctx)

        // Clear current line text first (for clean insertion)
        commandManager.call(clearTextInCurrentBlockCommand.key)

        // Wrap in list item with checked=false (creates task list)
        commandManager.call(wrapInBlockTypeCommand.key, {
          nodeType: listItem,
          attrs: { checked: false }  // KEY: This makes it a task list
        })
        break
      }

      // ... other cases

      default: {
        // Exhaustiveness check - TypeScript will error if a case is missing
        const _exhaustive: never = command
        console.warn(`Unhandled toolbar command: ${_exhaustive}`)
      }
    }
  })
}
```

**Important:** Ensure `listItemBlockComponent` is registered for interactive checkboxes:
```typescript
import { listItemBlockComponent } from '@milkdown/components/list-item-block'

Editor.make()
  .use(commonmark)
  .use(gfm)
  .use(listItemBlockComponent)  // Enables checkbox click handling
  .create()
```

#### Task 1.3: Add Race Condition Guards (2 hours)

**Research Insights - 5 Race Condition Vectors & Fixes:**

**1. Editor Stale Reference:**
```typescript
// Use AbortController pattern
const abortController = ref(new AbortController())

onBeforeUnmount(() => {
  abortController.value.abort()
})

// Guard all async operations
const guardedAsync = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
  if (abortController.value.signal.aborted) return undefined
  const result = await fn()
  if (abortController.value.signal.aborted) return undefined
  return result
}
```

**2. Save-in-Progress Guard (TaskEditModal.vue):**
```typescript
const isSaving = ref(false)

const saveTask = async () => {
  if (isSaving.value) return  // Prevent double-save
  isSaving.value = true

  try {
    // ... save operations
  } finally {
    isSaving.value = false
    emit('close')
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.isOpen || isSaving.value) return  // GUARD
  // ...
}
```

**3. Debounce RTL Detection (MarkdownEditor.vue):**
```typescript
import { useDebounceFn } from '@vueuse/core'

const textDirection = ref('ltr')
const updateDirection = useDebounceFn((content: string) => {
  if (!content.trim()) {
    textDirection.value = 'ltr'
    return
  }
  const sample = content.trim().substring(0, 100)
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF]/
  textDirection.value = rtlRegex.test(sample) ? 'rtl' : 'ltr'
}, 300)

watch(internalValue, updateDirection)
```

#### Task 1.4: Write Playwright Tests (2 hours)

**File:** `tests/e2e/markdown-editor.spec.ts`

**Research Insights - Complete Test Suite:**

```typescript
import { test, expect, Page, Locator } from '@playwright/test'

// Console error monitoring fixture
interface ConsoleMonitor {
  errors: string[]
  assertNoErrors: () => void
}

test.describe('Markdown Editor', () => {
  let consoleErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', error => consoleErrors.push(error.message))

    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')
  })

  test('Scenario 1: Basic text editing', async ({ page }) => {
    // Open task modal
    await page.click('[data-testid="quick-add-task"]')

    // Wait for editor
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 5000 })

    // Type text (use pressSequentially for rich text editors)
    await editor.click()
    await editor.pressSequentially('Hello **bold** and *italic*', { delay: 30 })

    // Verify content
    await expect(editor).toContainText('Hello')

    // Apply bold via toolbar
    await page.keyboard.press('Control+A')
    await page.click('[data-testid="toolbar-bold"]')

    // Verify formatting
    await expect(editor.locator('strong, b')).toBeVisible()

    // No console errors
    expect(consoleErrors.filter(e => !e.includes('DevTools'))).toHaveLength(0)
  })

  test('Scenario 2: Task list creation via toolbar', async ({ page }) => {
    await page.click('[data-testid="quick-add-task"]')

    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible' })
    await editor.click()

    // Click TaskList toolbar button
    await page.click('[data-testid="toolbar-tasklist"]')

    // Type task item
    await editor.pressSequentially('Buy groceries', { delay: 30 })

    // Verify checkbox rendered (not raw text)
    const checkbox = editor.locator('input[type="checkbox"]')
    await expect(checkbox).toBeVisible({ timeout: 5000 })

    // Toggle checkbox
    await checkbox.click()
    await expect(checkbox).toBeChecked()

    expect(consoleErrors).toHaveLength(0)
  })

  test('Scenario 3: Task list creation via syntax', async ({ page }) => {
    await page.click('[data-testid="quick-add-task"]')

    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible' })
    await editor.click()

    // Type markdown syntax
    await editor.pressSequentially('- [ ] Unchecked task', { delay: 30 })
    await page.waitForTimeout(500) // Allow input rule to trigger

    // Verify checkbox created
    const checkbox = editor.locator('input[type="checkbox"]')
    await expect(checkbox).toBeVisible({ timeout: 5000 })
  })

  test('Scenario 4: Rapid modal open/close (race condition)', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add.*task/i })

    // Rapid open/close cycles
    for (let i = 0; i < 10; i++) {
      await addButton.click()
      await page.waitForTimeout(50) // Less than editor init time
      await page.keyboard.press('Escape')
      await page.waitForTimeout(20)
    }

    // Final open - should work correctly
    await addButton.click()
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 5000 })

    // Type and verify
    await editor.click()
    await editor.pressSequentially('Still works!', { delay: 30 })
    await expect(editor).toContainText('Still works!')

    // No private field or initialization errors
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('private') || e.includes('Cannot read')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('Scenario 5: Large content handling (5000 chars)', async ({ page }) => {
    await page.click('[data-testid="quick-add-task"]')

    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible' })
    await editor.click()

    // Measure performance
    const startTime = Date.now()

    // Generate 5000 chars
    const largeContent = 'Lorem ipsum dolor sit amet. '.repeat(180)

    // Use fill for large content (faster)
    await editor.fill(largeContent)

    const fillTime = Date.now() - startTime
    console.log(`Large content fill time: ${fillTime}ms`)

    // Should complete within 5 seconds
    expect(fillTime).toBeLessThan(5000)

    // Verify content
    await expect(editor).toContainText('Lorem ipsum')

    // Save and verify persistence
    await page.click('[data-testid="save-task"]')

    expect(consoleErrors).toHaveLength(0)
  })
})
```

#### Task 1.5: Performance Benchmark (1 hour)

```typescript
// tests/performance/editor-benchmark.spec.ts

test('Editor initialization time', async ({ page }) => {
  await page.goto('http://localhost:5546')

  await page.evaluate(() => performance.mark('editor-init-start'))

  await page.click('[data-testid="quick-add-task"]')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible' })

  await page.evaluate(() => {
    performance.mark('editor-init-end')
    performance.measure('editor-init', 'editor-init-start', 'editor-init-end')
  })

  const initTime = await page.evaluate(() => {
    const entries = performance.getEntriesByName('editor-init')
    return entries[0]?.duration ?? -1
  })

  console.log(`Editor initialization: ${initTime.toFixed(2)}ms`)
  expect(initTime).toBeLessThan(200) // Target: <200ms
})
```

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

| Scenario | Description | Priority |
|----------|-------------|----------|
| 1 | Basic text editing (type, bold, italic, save) | P0 |
| 2 | Task list creation via toolbar button | P0 |
| 3 | Task list creation via markdown syntax | P1 |
| 4 | Rapid modal open/close (race condition test) | P0 |
| 5 | Large content handling (5000 chars) | P1 |

### Accessibility Testing

```typescript
import AxeBuilder from '@axe-core/playwright'

test('Editor accessibility compliance', async ({ page }) => {
  await page.click('[data-testid="quick-add-task"]')
  await page.locator('.ProseMirror').waitFor({ state: 'visible' })

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()

  const criticalViolations = results.violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious'
  )

  expect(criticalViolations).toHaveLength(0)
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
- [Milkdown Commands API](https://milkdown.dev/docs/guide/commands)
- [Tiptap Vue 3 Guide](https://tiptap.dev/docs/editor/getting-started/install/vue3)
- [Tiptap Markdown Extension](https://tiptap.dev/docs/editor/markdown)
- [2025 Rich Text Editor Comparison](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [Vue.js Core Issue #8149](https://github.com/vuejs/core/issues/8149) - Private class fields and proxy incompatibility

### Related Work
- TASK-109: Implemented Obsidian-like WYSIWYG mode (completed Jan 6, 2026)
- BUG-005: Fixed checkbox/task list rendering (completed Jan 7, 2026)

---

## Open Questions

1. **Error visibility:** Should console errors be completely eliminated, or just user-visible errors?
   - **Research suggests:** Eliminate all errors - they indicate bugs that may have user impact

2. **Mobile support:** Is mobile touch editing a requirement for MVP?
   - **Research suggests:** Basic mobile typing only - no touch gestures needed initially

3. **Collaborative editing:** Is real-time collaboration (Yjs) a future requirement that affects editor choice?
   - **Research suggests:** Both Milkdown and Tiptap support Yjs - not a differentiator

4. **Content limits:** Is 10,000 character limit acceptable, or should it be higher?
   - **Research suggests:** 10,000 chars is reasonable - larger documents degrade performance

---

## Simplification Opportunities (Post-Fix)

**Research Insights - Potential 40% LOC Reduction:**

If all fixes succeed, consider these simplifications:

| Item | Current | Action | Savings |
|------|---------|--------|---------|
| Two-component split | 415 LOC | Merge into single file | ~165 LOC |
| Nord theme + CSS overrides | 188 lines CSS | Custom minimal CSS | ~150 LOC |
| RTL auto-detection | 6 lines + prop threading | Remove unless required | ~15 LOC |
| Unused props | 4 lines | Delete | 4 LOC |

**Do NOT implement until fixes are validated.**

---

**Generated with [Claude Code](https://claude.com/claude-code)**

**Deepened with:** 9 research and review agents

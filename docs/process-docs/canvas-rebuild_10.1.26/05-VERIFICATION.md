# Canvas Rebuild - Verification

## Success Criteria

Before declaring rebuild complete, ALL must pass:

1. **Functionality**: All 15 canvas features work
2. **Performance**: No lag with 50+ nodes
3. **Persistence**: Positions survive refresh
4. **Parent-Child**: Tasks move with groups
5. **Code Quality**: <3,000 total lines
6. **No Watchers**: Zero deep watchers
7. **Testable**: Each composable has tests

---

## Manual Test Checklist

### Phase 1: Empty Canvas
- [ ] Navigate to `/canvas-new`
- [ ] Canvas renders with grid background
- [ ] Pan by dragging on background
- [ ] Zoom with mouse wheel
- [ ] Zoom buttons work
- [ ] MiniMap visible
- [ ] No console errors

### Phase 2: Groups
- [ ] Groups load from Supabase
- [ ] Groups appear at correct positions
- [ ] Group names display
- [ ] Group colors display
- [ ] Drag group to new position
- [ ] Resize group with handles
- [ ] Refresh - positions persist
- [ ] Refresh - dimensions persist

### Phase 3: Tasks
- [ ] Inbox panel visible
- [ ] Inbox shows tasks with `isInInbox: true`
- [ ] Canvas shows tasks with `isInInbox: false`
- [ ] Task titles display
- [ ] Task priority badges display

### Phase 4: Drag to Canvas
- [ ] Drag task from inbox
- [ ] Drop on canvas at any position
- [ ] Task appears at drop position (not origin)
- [ ] `isInInbox` changes to `false`
- [ ] Drag task to new canvas position
- [ ] Refresh - position persists
- [ ] Repeat 5 times - no position jumping

### Phase 5: Parent-Child
- [ ] Drag task INTO group
- [ ] Task stays at drop position (not jump)
- [ ] Task visually inside group
- [ ] Drag group - task moves with it
- [ ] Drag task OUT of group
- [ ] Task stays at new position
- [ ] Task no longer inside group
- [ ] Refresh - relationships persist
- [ ] Create group inside group (nested)
- [ ] Drag outer group - inner group and tasks move

### Phase 6: Features
- [ ] Right-click task - context menu
- [ ] Right-click group - context menu
- [ ] Right-click background - context menu
- [ ] Shift+click to multi-select
- [ ] Delete key removes selected
- [ ] Escape clears selection
- [ ] Create new group from context menu
- [ ] Edit group (rename, recolor)
- [ ] Delete group (with confirmation)
- [ ] Minimap navigation works

### Phase 7: Final
- [ ] `/canvas` uses new canvas
- [ ] All old imports removed
- [ ] Build passes
- [ ] No console errors

---

## Playwright Tests

```typescript
// tests/canvas-new.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Canvas Rebuild', () => {

  test('Phase 1: Empty canvas renders', async ({ page }) => {
    await page.goto('/canvas-new')

    // Vue Flow container visible
    await expect(page.locator('.vue-flow')).toBeVisible()

    // Background visible
    await expect(page.locator('.vue-flow__background')).toBeVisible()

    // Controls visible
    await expect(page.locator('.vue-flow__controls')).toBeVisible()

    // No console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.waitForTimeout(1000)
    expect(errors).toHaveLength(0)
  })

  test('Phase 2: Groups load and persist', async ({ page }) => {
    await page.goto('/canvas-new')

    // Wait for groups to load
    await expect(page.locator('[data-type="sectionNode"]')).toHaveCount(
      await page.evaluate(() => window.__CANVAS_GROUP_COUNT__ || 1)
    )

    // Drag group
    const group = page.locator('[data-type="sectionNode"]').first()
    const box = await group.boundingBox()
    await group.dragTo(page.locator('.vue-flow'), {
      targetPosition: { x: box!.x + 100, y: box!.y + 100 }
    })

    // Refresh
    await page.reload()

    // Verify position persisted
    const newBox = await page.locator('[data-type="sectionNode"]').first().boundingBox()
    expect(newBox!.x).toBeCloseTo(box!.x + 100, 20)
  })

  test('Phase 4: Drag task to canvas persists', async ({ page }) => {
    await page.goto('/canvas-new')

    // Get initial inbox count
    const inboxBefore = await page.locator('.inbox-task').count()

    // Drag task from inbox to canvas
    const task = page.locator('.inbox-task').first()
    await task.dragTo(page.locator('.vue-flow'), {
      targetPosition: { x: 400, y: 300 }
    })

    // Verify moved
    const inboxAfter = await page.locator('.inbox-task').count()
    expect(inboxAfter).toBe(inboxBefore - 1)

    // Get task position
    const taskNode = page.locator('[data-type="taskNode"]').last()
    const pos1 = await taskNode.boundingBox()

    // Refresh
    await page.reload()

    // Verify persisted
    await expect(page.locator('[data-type="taskNode"]')).toBeVisible()
    const pos2 = await page.locator('[data-type="taskNode"]').last().boundingBox()
    expect(pos2!.x).toBeCloseTo(pos1!.x, 20)
    expect(pos2!.y).toBeCloseTo(pos1!.y, 20)
  })

  test('Phase 5: Parent-child relationship works', async ({ page }) => {
    await page.goto('/canvas-new')

    // Get group and task
    const group = page.locator('[data-type="sectionNode"]').first()
    const task = page.locator('[data-type="taskNode"]').first()

    // Get group position
    const groupPos1 = await group.boundingBox()

    // Drag task into group
    await task.dragTo(group, { targetPosition: { x: 50, y: 50 } })

    // Drag group
    await group.dragTo(page.locator('.vue-flow'), {
      targetPosition: { x: groupPos1!.x + 200, y: groupPos1!.y }
    })

    // Verify task moved with group
    const taskPos = await task.boundingBox()
    expect(taskPos!.x).toBeGreaterThan(groupPos1!.x + 150)

    // Refresh and verify
    await page.reload()
    const groupPos2 = await page.locator('[data-type="sectionNode"]').first().boundingBox()
    expect(groupPos2!.x).toBeCloseTo(groupPos1!.x + 200, 50)
  })
})
```

---

## Performance Benchmarks

Run with 50+ nodes:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial render | < 500ms | ____ms |
| Drag response | < 16ms | ____ms |
| Pan/zoom lag | None | ____ms |
| Memory usage | < 100MB | ____MB |

---

## Code Quality Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Total lines | < 3,000 | ____ |
| CanvasView.vue | < 500 | ____ |
| Each composable | < 200 | ____ |
| Deep watchers | 0 | ____ |
| Circular deps | 0 | ____ |
| TypeScript errors | 0 | ____ |

---

## Feature Parity Matrix

| Feature | Old Canvas | New Canvas | Status |
|---------|:----------:|:----------:|:------:|
| Drag task from inbox | Y | | |
| Drag task on canvas | Y | | |
| Task position persist | Y | | |
| Group display | Y | | |
| Group drag | Y | | |
| Group resize | Y | | |
| Group position persist | Y | | |
| Parent-child attach | Y | | |
| Parent-child move | Y | | |
| Parent-child detach | Y | | |
| Task context menu | Y | | |
| Group context menu | Y | | |
| Multi-select | Y | | |
| Delete selected | Y | | |
| Minimap | Y | | |
| Zoom controls | Y | | |
| Pan canvas | Y | | |
| Create group | Y | | |
| Edit group | Y | | |
| Delete group | Y | | |
| Keyboard shortcuts | Y | | |

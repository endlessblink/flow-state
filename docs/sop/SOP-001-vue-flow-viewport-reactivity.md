# SOP-001: Vue Flow Viewport Reactivity Issues

**Created**: January 9, 2026
**Related Bug**: BUG-151
**Severity**: P1-HIGH
**Component**: TaskNode.vue, Vue Flow Integration

---

## Problem Statement

Vue Flow components that depend on viewport state (zoom, pan) may render incorrectly on initial page load because viewport values are copied once during setup instead of being tracked reactively.

### Symptoms

- Components render empty or with missing content on first page refresh
- Second refresh fixes the issue
- LOD (Level of Detail) features behave incorrectly
- Zoom-dependent styling doesn't update

### Root Cause

Vue Flow's `useVueFlow()` returns refs that need reactive access. A common anti-pattern:

```typescript
// WRONG: One-time copy, NOT reactive
const viewport = ref({ zoom: 1 })
const vf = useVueFlow()
viewport.value = vf.viewport.value  // Copies current value only

// This computed uses stale data
const zoom = computed(() => viewport.value.zoom)
```

When Vue Flow initializes, `zoom` is temporarily `0`. If a component copies this value once, it never sees subsequent updates.

---

## Detection Checklist

1. [ ] Component renders empty/broken on first refresh only
2. [ ] Second refresh fixes the issue
3. [ ] Component uses `useVueFlow()` in setup
4. [ ] Component has zoom/viewport-dependent logic (LOD, styling)
5. [ ] Viewport value is assigned to a ref (not accessed directly)

---

## Solution Pattern

### Correct Implementation

```typescript
// CORRECT: Store context reference, access reactively
let vfContext: ReturnType<typeof useVueFlow> | null = null
try {
  vfContext = useVueFlow()
} catch (_e) {
  // Not in Vue Flow context (e.g. Storybook)
}

// Access viewport REACTIVELY through the ref
const zoom = computed(() => {
  if (!vfContext) return 1  // Default for non-Vue Flow context
  const z = vfContext.viewport.value?.zoom
  // Guard against 0, undefined, NaN
  return (typeof z === 'number' && Number.isFinite(z) && z > 0) ? z : 1
})
```

### Key Points

1. **Store the context**, not the value
2. **Access through computed** for reactivity
3. **Add guards** for edge cases (0, undefined, NaN)
4. **Provide defaults** for non-Vue Flow contexts (Storybook)

---

## Files Commonly Affected

- `src/components/canvas/TaskNode.vue` - Task card rendering
- `src/components/canvas/GroupNodeSimple.vue` - Group rendering
- Any custom node component with LOD logic

---

## Testing Procedure

### Manual Testing

1. Start dev server: `npm run dev`
2. Navigate to canvas view
3. Create at least one task on canvas
4. Refresh page (F5)
5. **Expected**: Tasks render with full content immediately
6. **Bug Present**: Tasks render as empty shells

### Automated Testing

```typescript
// Playwright test
test('tasks render with content on first load', async ({ page }) => {
  await page.goto('/canvas')
  await page.waitForSelector('.task-node')

  // Should have visible title text
  const title = await page.locator('.task-node .task-title').first()
  await expect(title).toBeVisible()
  await expect(title).not.toBeEmpty()
})
```

---

## Rollback Procedure

If the fix causes issues:

1. Revert changes in `TaskNode.vue`:
   ```bash
   git checkout HEAD~1 -- src/components/canvas/TaskNode.vue
   ```

2. Alternative workaround (force re-render):
   ```typescript
   // In CanvasView.vue, after Vue Flow initializes
   onMounted(() => {
     setTimeout(() => {
       nodes.value = [...nodes.value]  // Force reactivity trigger
     }, 100)
   })
   ```

---

## Prevention

### Code Review Checklist

When reviewing Vue Flow component code:

- [ ] No direct assignment from `vf.viewport.value` to local ref
- [ ] Viewport access is through computed properties
- [ ] Guards exist for zero/undefined zoom values
- [ ] Storybook compatibility is maintained

### ESLint Rule (Future)

Consider custom ESLint rule to detect:
```
Pattern: viewport.value = vf.viewport.value
Warning: "Direct viewport assignment loses reactivity"
```

---

## References

- Vue Flow Docs: https://vueflow.dev/guide/composables.html
- Vue Reactivity: https://vuejs.org/guide/essentials/reactivity-fundamentals.html
- MASTER_PLAN.md: BUG-151

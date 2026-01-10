# Canvas Rebuild - Cleanup

**IMPORTANT**: Only execute cleanup AFTER all verification passes.

---

## Files to DELETE

### View (1 file, ~3,500 lines)
```
src/views/CanvasView.vue
```

### Store (4 files, ~1,000 lines)
```
src/stores/canvas.ts
src/stores/canvas/types.ts
src/stores/canvas/canvasInteraction.ts
src/stores/canvas/canvasUi.ts
```

### Composables (23 files, ~7,200 lines)
```
src/composables/canvas/useCanvasActions.ts
src/composables/canvas/useCanvasAlignment.ts
src/composables/canvas/useCanvasConnections.ts
src/composables/canvas/useCanvasContextMenus.ts
src/composables/canvas/useCanvasDragDrop.ts
src/composables/canvas/useCanvasEvents.ts
src/composables/canvas/useCanvasFilteredState.ts
src/composables/canvas/useCanvasFiltering.ts
src/composables/canvas/useCanvasGroupMembership.ts
src/composables/canvas/useCanvasHotkeys.ts
src/composables/canvas/useCanvasInteractionHandlers.ts
src/composables/canvas/useCanvasModals.ts
src/composables/canvas/useCanvasNavigation.ts
src/composables/canvas/useCanvasOverdueCollector.ts
src/composables/canvas/useCanvasParentChild.ts
src/composables/canvas/useCanvasResize.ts
src/composables/canvas/useCanvasResourceManager.ts
src/composables/canvas/useCanvasSelection.ts
src/composables/canvas/useCanvasSmartGroups.ts
src/composables/canvas/useCanvasSync.ts
src/composables/canvas/useCanvasZoom.ts
src/composables/canvas/useMidnightTaskMover.ts
src/composables/canvas/useNodeAttachment.ts
```

### Components (25 files, ~11,000 lines)
```
src/components/canvas/CanvasContextMenu.vue
src/components/canvas/CanvasContextMenus.vue
src/components/canvas/CanvasControls.vue
src/components/canvas/CanvasEmptyState.vue
src/components/canvas/CanvasGroup.vue
src/components/canvas/CanvasLoadingOverlay.vue
src/components/canvas/CanvasModals.vue
src/components/canvas/CanvasSelectionBox.vue
src/components/canvas/CanvasStatusBanner.vue
src/components/canvas/CanvasStatusOverlays.vue
src/components/canvas/CanvasToolbar.vue
src/components/canvas/EdgeContextMenu.vue
src/components/canvas/GroupEditModal.vue
src/components/canvas/GroupManager.vue
src/components/canvas/GroupNodeSimple.vue
src/components/canvas/GroupSettingsMenu.vue
src/components/canvas/InboxFilters.vue
src/components/canvas/InboxPanel.vue
src/components/canvas/InboxTimeFilters.vue
src/components/canvas/MultiSelectionOverlay.vue
src/components/canvas/ResizeHandle.vue
src/components/canvas/SectionSelectionModal.vue
src/components/canvas/SectionSelector.vue
src/components/canvas/TaskNode.vue
src/components/canvas/UnifiedGroupModal.vue
```

### Utilities (5 files, ~500 lines)
```
src/utils/canvasStateLock.ts
src/utils/canvasGraph.ts
src/utils/canvasBusinessLogic.ts
src/utils/canvas/positionUtils.ts
src/utils/canvas/NodeUpdateBatcher.ts
```

### Tests (update, don't delete)
```
src/stores/__tests__/canvas.test.ts
src/composables/canvas/__tests__/useMidnightTaskMover.spec.ts
tests/canvas-*.spec.ts
```

---

## Files to RENAME

After verification, rename new files to replace old:

| From | To |
|------|-----|
| `src/views/CanvasViewNew.vue` | `src/views/CanvasView.vue` |
| `src/stores/canvasNew.ts` | `src/stores/canvas.ts` |
| `src/composables/canvasNew/` | `src/composables/canvas/` |
| `src/components/canvasNew/` | `src/components/canvas/` |

---

## Files to UPDATE (remove old imports)

After renaming, update these files to use new names:

```
src/router/index.ts
src/composables/app/useAppInitialization.ts
src/composables/useBackupSystem.ts
src/composables/useCrossTabSync.ts
src/composables/useCrossTabSyncIntegration.ts
src/components/tasks/TaskContextMenu.vue
src/components/tasks/TaskEditModal.vue
src/components/tasks/edit/TaskEditMetadata.vue
src/layouts/ModalManager.vue
src/components/common/GroupModal.vue
src/components/inbox/UnifiedInboxPanel.vue
src/components/inbox/CalendarInboxPanel.vue
src/stories/helpers/mockUseCanvasStore.ts
```

---

## Cleanup Commands

```bash
# 1. Verify all tests pass
npm run test

# 2. Verify build passes
npm run build

# 3. Delete old canvas files
rm src/views/CanvasView.vue
rm -rf src/stores/canvas/
rm src/stores/canvas.ts
rm -rf src/composables/canvas/
rm -rf src/components/canvas/
rm src/utils/canvasStateLock.ts
rm src/utils/canvasGraph.ts
rm src/utils/canvasBusinessLogic.ts
rm -rf src/utils/canvas/

# 4. Rename new files
mv src/views/CanvasViewNew.vue src/views/CanvasView.vue
mv src/stores/canvasNew.ts src/stores/canvas.ts
mv src/composables/canvasNew/ src/composables/canvas/
mv src/components/canvasNew/ src/components/canvas/

# 5. Update imports (find and replace)
# - `CanvasViewNew` -> `CanvasView`
# - `canvasNew` -> `canvas`
# - `useCanvasNewStore` -> `useCanvasStore`

# 6. Re-run tests
npm run test

# 7. Re-run build
npm run build
```

---

## Total Cleanup Stats

| Category | Files Deleted | Lines Removed |
|----------|---------------|---------------|
| View | 1 | ~3,500 |
| Store | 4 | ~1,000 |
| Composables | 23 | ~7,200 |
| Components | 25 | ~11,000 |
| Utilities | 5 | ~500 |
| **Total** | **58** | **~23,200** |

| Category | Files Added | Lines Added |
|----------|-------------|-------------|
| View | 1 | ~500 |
| Store | 1 | ~400 |
| Composables | 5 | ~900 |
| Components | 3 | ~750 |
| **Total** | **10** | **~2,550** |

**Net Impact: -48 files, -20,650 lines**

---

## Pre-Cleanup Verification

Before deleting anything:

- [ ] All manual tests pass
- [ ] All Playwright tests pass
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] User tested in production-like environment
- [ ] Backup of old code exists (git)

---

## Rollback Plan

If something goes wrong:

```bash
# All old code is in git history
git checkout HEAD~1 -- src/views/CanvasView.vue
git checkout HEAD~1 -- src/stores/canvas.ts
git checkout HEAD~1 -- src/stores/canvas/
git checkout HEAD~1 -- src/composables/canvas/
git checkout HEAD~1 -- src/components/canvas/
git checkout HEAD~1 -- src/utils/canvasStateLock.ts
git checkout HEAD~1 -- src/utils/canvasGraph.ts
git checkout HEAD~1 -- src/utils/canvas/
```

Or simply:

```bash
git revert HEAD
```

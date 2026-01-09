---
status: complete
priority: p1
issue_id: 011
resolved_by: TASK-141 (commit d4350e6)
tags: [code-review, data-integrity, canvas]
dependencies: []
---

# Self-Healing Parent Relationships May Cause Data Loss

## Problem Statement

The new self-healing mechanism in `useCanvasSync.ts` automatically clears `parentGroupId` when a section's center point falls outside its parent's bounds. This can cause **permanent data loss** if:
1. The visual position is temporarily wrong due to render glitches
2. The user is mid-resize and the child briefly falls outside
3. There's no undo support for the automatic modification

**Why it matters:** Users could lose group nesting relationships that they explicitly created, with no way to recover them.

## Findings

**Source:** Architecture Strategist, Data Integrity Guardian Agents

**Affected Files:**
- `src/composables/canvas/useCanvasSync.ts` (lines 190-194)

**Problematic Code:**
```typescript
} else if (parentGroup) {
    console.warn(`⚠️ [TASK-141] Section "${section.name}" has stale parentGroupId - NOT inside "${parentGroup.name}". Auto-healing...`)
    // Self-heal: Clear the stale parent relationship to fix the data
    canvasStore.updateGroup(section.id, { parentGroupId: null })
}
```

**Issues:**
1. **No debouncing** - Clears on first detection, no threshold for "stale" determination
2. **Fire-and-forget** - `await` is missing, Supabase write is async
3. **No undo support** - Uses `updateGroup` not `updateSectionWithUndo`
4. **Center-based check too strict** - 1px outside = relationship destroyed

## Proposed Solutions

### Solution 1: Remove Auto-Healing, Log Only (Recommended)

Replace the auto-healing with warning-only logging.

```typescript
} else if (parentGroup) {
    console.warn(`⚠️ [TASK-141] Section "${section.name}" has stale parentGroupId "${parentGroup.name}" - NOT auto-healing (manual fix required)`)
    // DO NOT auto-clear: Leave data intact, let user manually fix if needed
}
```

**Pros:** Zero data loss risk, user retains control
**Cons:** Stale relationships persist until manually fixed
**Effort:** Small (remove 1 line)
**Risk:** None

### Solution 2: Add Debounce Threshold

Only clear after N consecutive sync cycles show the same stale state.

```typescript
const staleParentDetections = new Map<string, number>()

if (!isInside && parentGroup) {
    const count = (staleParentDetections.get(section.id) || 0) + 1
    staleParentDetections.set(section.id, count)

    if (count >= 5) { // Only after 5 consecutive detections
        await canvasStore.updateSectionWithUndo(section.id, { parentGroupId: null })
        staleParentDetections.delete(section.id)
    }
}
```

**Pros:** Reduces false positives, still auto-heals persistent issues
**Cons:** Added complexity, still potential for data loss
**Effort:** Medium
**Risk:** Low-Medium

### Solution 3: Add Tolerance Margin

Expand the containment check to include a tolerance margin.

```typescript
const CONTAINMENT_MARGIN = 30 // pixels
const isInside = childCenterX >= parentX - CONTAINMENT_MARGIN &&
    childCenterX <= parentX + parentW + CONTAINMENT_MARGIN &&
    childCenterY >= parentY - CONTAINMENT_MARGIN &&
    childCenterY <= parentY + parentH + CONTAINMENT_MARGIN
```

**Pros:** Reduces accidental triggering during resize
**Cons:** Doesn't address the core auto-modification risk
**Effort:** Small
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/canvas/useCanvasSync.ts

**Components:** Canvas sync, nested group handling

**Database Changes:** None (but affects data stored in Supabase groups table)

## Acceptance Criteria

- [ ] Self-healing does NOT automatically modify data without user consent
- [ ] Existing nested group relationships are preserved on refresh
- [ ] Clear warning is logged when stale relationship is detected
- [ ] If auto-healing is kept, it goes through undo system

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Architecture and Data Integrity review |

## Resources

- Related Tasks: TASK-141 (nested group handling)
- Affected Area: Canvas position persistence

# Design Decision: Primary Brand Color

**Date:** 2025-10-26
**Status:** ✅ DECIDED
**Decision:** TEAL (#4ECDC4)

## Context

During comprehensive UI/UX audit, discovered inconsistent primary color usage:
- **Canvas View**: TEAL (#4ECDC4) - 60% of usage
- **All Tasks View**: BLUE (#4A90E2) - 30% of usage
- **Mixed usage** creating visual discontinuity across views

## Options Considered

### Option 1: TEAL (#4ECDC4)
- **Storybook:** Design System/Colors/Brand Primary Decision - TEAL
- **Pros:**
  - Already used in Canvas + Settings (60% coverage)
  - Distinctive, modern, energetic feel
  - Excellent contrast on dark backgrounds
  - Matches glass morphism aesthetic
  - Minimal migration (already majority usage)
- **Cons:**
  - Requires changing All Tasks view
  - Less "professional" than traditional blue

### Option 2: BLUE (#4A90E2)
- **Storybook:** Design System/Colors/Brand Primary Decision - BLUE
- **Pros:**
  - Traditional, professional appearance
  - Used in some modals currently
- **Cons:**
  - Would require changing 60% of existing components
  - Doesn't match glass morphism aesthetic as well
  - Less distinctive in dark theme

## Decision

**Chosen:** TEAL (#4ECDC4)

**Rationale:**
1. **Minimal migration effort** - Already 60% coverage in codebase
2. **Visual consistency** - Matches existing Canvas (primary view) aesthetic
3. **User feedback** - User chose TEAL after Storybook comparison
4. **Modern aesthetic** - Better fits glass morphism design system

**User Quote:**
> "this is a great way of showcasing design options or issues, update the skill to follow this in the future"

## Implementation

**Affected Components:**

### Files with Hardcoded TEAL (#4ECDC4):
1. `/src/components/base/BaseNavItem.vue` - Drag target states
2. `/src/components/kanban/KanbanSwimlane.vue` - Swimlane styling
3. `/src/components/EmojiPicker.vue` - Selection states
4. `/src/components/DateDropZone.vue` - Drop zone highlights
5. `/src/components/ProjectDropZone.vue` - Drop zone highlights

### Files with Hardcoded Colors (Background):
6. `/src/components/MultiSelectToggle.vue` - Background colors
7. `/src/components/DragHandle.vue` - Handle colors
8. `/src/components/DoneToggle.vue` - Toggle states

**Design Tokens to Update:**

Already configured correctly:
```css
/* design-tokens.css */
--teal-500: 174, 62%, 58%;   /* #4ECDC4 */
--teal-400: 174, 62%, 68%;   /* Lighter for hover */
--brand-primary: hsl(var(--teal-500));
--brand-hover: hsl(var(--teal-400));
--brand-active: hsl(174, 62%, 53%);
```

**Migration Pattern:**

Replace hardcoded TEAL:
```css
/* BEFORE */
border-color: #4ECDC4;
background: rgba(78, 205, 196, 0.15);

/* AFTER */
border-color: var(--brand-primary);
background: color-mix(in srgb, var(--brand-primary) 15%, transparent);
```

**Migration Checklist:**
- [x] Design tokens already configured with TEAL
- [x] Created Storybook comparison stories
- [x] User decision recorded
- [x] Replace #4ECDC4 with var(--brand-primary) in 5 components
- [x] Replace rgba(78, 205, 196, X) with color-mix patterns
- [x] Fix hardcoded backgrounds in 3 additional components
- [ ] Update Storybook example components
- [ ] Verify with Playwright visual tests
- [ ] Document in CHANGELOG

## Verification

**Storybook:** Design System/Colors/Brand Primary Decision
- ✅ RECOMMENDED: TEAL (#4ECDC4)
- 🔵 ALTERNATIVE: BLUE (#4A90E2)
- ⚖️ Side-by-Side Comparison

**Playwright Tests:**
- Will be created: `tests/design-system/teal-color-consistency.spec.ts`

**Screenshots:**
- Before: `/docs/debug/image.png` (shows color inconsistency)
- After: Will capture post-implementation

## Related Decisions

- See: `docs/plans/visual-design-specification.md`
- See: `docs/plans/design-system-unification.md`

---

**Implementation Log:**

- **2025-10-26 14:00**: User chose TEAL via Storybook comparison
- **2025-10-26 14:15**: Decision documented
- **2025-10-26 14:20**: Component migration completed
  - BaseNavItem.vue: Replaced 9 instances (drag states, keyframes, drop labels)
  - KanbanSwimlane.vue: Replaced 5 instances (drag-over gradients, shadows)
  - DateDropZone.vue: Replaced 9 instances (drop states, keyframes, indicators)
  - ProjectDropZone.vue: Replaced 3 instances (valid drop states)
  - **Total replaced**: 26 hardcoded TEAL color values with design token references
  - **Pattern used**: `color-mix(in srgb, var(--brand-primary) X%, transparent)`

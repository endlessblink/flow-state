# Design Token Consistency - Comprehensive Fix

## Problem
Components like TaskContextMenu.vue have 60+ hardcoded CSS values that bypass the existing design token system in `src/assets/design-tokens.css`. This causes visual inconsistency and makes theming/maintenance difficult.

## Goals
1. Refactor TaskContextMenu.vue to use existing design tokens
2. Audit other overlay/menu components for similar issues
3. Add prevention measures to catch future drift

## Key Files

- **Token Source:** `src/assets/design-tokens.css` (1,220 lines of comprehensive tokens)
- **Target:** `src/components/tasks/TaskContextMenu.vue`

## Token Mapping

### Context Menu Container
| Current (Hardcoded) | Replace With |
|---------------------|--------------|
| `rgba(18, 18, 20, 0.98)` | `var(--overlay-component-bg)` |
| `blur(20px)` | `var(--overlay-component-backdrop)` |
| `1px solid rgba(255, 255, 255, 0.12)` | `var(--overlay-component-border)` |
| `border-radius: 12px` | `var(--radius-xl)` |
| `box-shadow: 0 12px 40px rgba(0,0,0,0.5)` | `var(--overlay-component-shadow)` |
| `padding: 8px 0` | `var(--space-2) 0` |
| `animation: 0.15s ease-out` | `var(--duration-fast) var(--ease-out)` |

### Menu Items
| Current | Replace With |
|---------|--------------|
| `padding: 8px 12px` | `var(--space-2) var(--space-3)` |
| `font-size: 13px` | `var(--text-sm)` |
| `gap: 8px` | `var(--gap-sm)` |
| `transition: background 0.1s` | `var(--duration-fast)` |

### Pill Buttons
| Current | Replace With |
|---------|--------------|
| `rgba(255, 255, 255, 0.06)` | `var(--glass-bg-light)` |
| `rgba(255, 255, 255, 0.1)` | `var(--glass-border)` |
| `border-radius: 14px` | `var(--radius-full)` |
| `font-size: 11px` | `var(--text-xs)` |

### Spacing
| Current | Replace With |
|---------|--------------|
| `6px` | `var(--space-1-5)` |
| `8px` | `var(--space-2)` |
| `10px` | `var(--space-2-5)` |
| `12px` | `var(--space-3)` |

### Colors (Status/Priority)
Already using tokens like `var(--color-priority-high)` - keep these.

## Implementation Steps

1. **Replace container styles** - Update `.context-menu` class
2. **Replace menu-item styles** - Update `.menu-item` and variants
3. **Replace section styles** - Update `.menu-section`, `.section-header`
4. **Replace pill button styles** - Update `.pill-btn` and variants
5. **Replace inline-select styles** - Update `.inline-select`, `.inline-row`
6. **Replace action-bar styles** - Update `.action-bar`, `.action-btn`
7. **Replace submenu styles** - Update `.submenu` class
8. **Replace divider styles** - Update `.menu-divider`

---

## Phase 2: Audit Other Components

### Components to Check
- `src/components/canvas/CanvasContextMenus.vue`
- `src/components/canvas/GroupSettingsMenu.vue`
- `src/components/tasks/TaskEditModal.vue`
- `src/components/common/CustomSelect.vue`
- Any other overlay/dropdown components

### Audit Process
1. Search for hardcoded `rgba(` patterns
2. Search for hardcoded pixel values in padding/margin/gap
3. Search for hardcoded border-radius values
4. Replace with appropriate design tokens

---

## Phase 3: Prevention Measures

### Option A: CLAUDE.md Guidelines (Recommended)
Add section to CLAUDE.md with design token rules:
- Always use `var(--*)` for colors, not `rgba()` or hex
- Always use `var(--space-*)` for spacing
- Always use `var(--radius-*)` for border-radius
- Always use `var(--duration-*)` for transitions

### Option B: ESLint/Stylelint Rule
Create custom rule to flag:
- `rgba(` in scoped styles
- Hardcoded pixel values for common properties
- Direct hex colors

### Option C: Pre-commit Hook
Add hook that warns about hardcoded values in `.vue` files

---

## Verification

### Phase 1 Verification
1. Run `npm run dev`
2. Right-click on a task to open context menu
3. Verify visual appearance matches current design
4. Test hover states on all interactive elements
5. Test submenus (Status, Duration, More)
6. Verify dark theme consistency

### Phase 2 Verification
1. Check audited components visually
2. Ensure no regressions in other menus/modals

### Phase 3 Verification
1. Test prevention measure catches violations
2. Document in CLAUDE.md for future reference

---

## Rollback

### Phase 1 Rollback
If TaskContextMenu styling breaks:
```bash
git checkout HEAD -- src/components/tasks/TaskContextMenu.vue
```

### Phase 2 Rollback
If other components break:
```bash
git checkout HEAD -- src/components/canvas/CanvasContextMenus.vue
git checkout HEAD -- src/components/canvas/GroupSettingsMenu.vue
# etc.
```

### Full Rollback
Revert all design token changes:
```bash
git stash  # or git checkout HEAD -- <files>
```

All original implementations preserved in git history.

# Color Token Mapping Guide

## Complete Mapping for Pomo-Flow Design System

This document provides the definitive mapping between hardcoded hex values and their corresponding CSS design tokens for the Pomo-Flow application.

## Priority Color System

### Current Design Tokens
```css
--color-priority-high: #ef4444;    /* Red - Urgent */
--color-priority-medium: #f59e0b;  /* Orange/Amber - Default */
--color-priority-low: #3b82f6;     /* Blue - Low priority */
--color-work: #10b981;           /* Green - Active work */
```

### Background Variants
```css
--priority-high-bg: rgba(239, 68, 68, 0.3);
--priority-medium-bg: rgba(245, 158, 11, 0.3);
--priority-low-bg: rgba(59, 130, 246, 0.3);
```

### Alpha Variants
```css
--color-warning-alpha-10: rgba(245, 158, 11, 0.1);
--color-error-alpha-10: rgba(239, 68, 68, 0.1);
--color-priority-medium-bg-subtle: rgba(245, 158, 11, 0.05);
--color-priority-medium-border-medium: rgba(245, 158, 11, 0.3);
```

### Glow Effects
```css
--priority-high-glow: 0 4px 8px rgba(239, 68, 68, 0.3), 0 0 12px rgba(239, 68, 68, 0.2);
--priority-medium-glow: 0 4px 8px rgba(245, 158, 11, 0.3), 0 0 12px rgba(245, 158, 11, 0.2);
--priority-low-glow: 0 4px 8px rgba(59, 130, 246, 0.3), 0 0 12px rgba(59, 130, 246, 0.2);
```

## Comprehensive Replacement Mapping

### Critical Priority Colors (URGENT)

| Hex Value | CSS Token | Context | Alpha Variant |
|-----------|-----------|---------|----------------|
| `#f59e0b` | `var(--color-priority-medium)` | Direct color | N/A |
| `#feca57` | `var(--color-priority-medium)` | Yellow variant | N/A |
| `#fbbf24` | `var(--color-priority-medium)` | Yellow variant | N/A |
| `#10b981` | `var(--color-work)` | Work color | N/A |
| `#ef4444` | `var(--color-priority-high)` | High priority | N/A |
| `#3b82f6` | `var(--color-priority-low)` | Low priority | N/A |

### RGBA Values with Opacity

| RGBA Value | CSS Token | Opacity | Use Case |
|-------------|-----------|---------|---------|
| `rgba(245, 158, 11, 0.3)` | `var(--color-priority-medium-bg)` | 30% | Standard background |
| `rgba(245, 158, 11, 0.1)` | `var(--color-warning-alpha-10)` | 10% | Light background |
| `rgba(245, 158, 11, 0.05)` | `var(--color-priority-medium-bg-subtle)` | 5% | Subtle background |
| `rgba(245, 158, 11, 0.2)` | `var(--color-priority-medium-border-medium)` | 20% | Border color |

### High Priority RGBA Values

| RGBA Value | CSS Token | Opacity | Use Case |
|-------------|-----------|---------|---------|
| `rgba(239, 68, 68, 0.3)` | `var(--priority-high-bg)` | 30% | High priority background |
| `rgba(239, 68, 68, 0.1)` | `var(--color-error-alpha-10)` | 10% | Error background |

### Low Priority RGBA Values

| RGBA Value | CSS Token | Opacity | Use Case |
|-------------|-----------|---------|---------|
| `rgba(59, 130, 246, 0.3)` | `var(--priority-low-bg)` | 30% | Low priority background |

## Problematic Patterns Found in Codebase

### 1. Gradient Definitions (URGENT)
```css
/* ❌ FOUND - Creates color inconsistency */
background: linear-gradient(180deg, var(--color-priority-medium) 0%, #feca57 100%);

/* ✅ REPLACEMENT */
background: var(--color-priority-medium);
```

### 2. Hard-coded Background Colors
```css
/* ❌ FOUND */
background: rgba(245, 158, 11, 0.1);
border: 1px solid rgba(245, 158, 11, 0.2);

/* ✅ REPLACEMENT */
background: var(--color-warning-alpha-10);
border: 1px solid var(--color-priority-medium-border-medium);
```

### 3. Shadow Effects
```css
/* ❌ FOUND */
box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);

/* ✅ REPLACEMENT */
box-shadow: var(--priority-medium-glow);
```

## Component-Specific Issues

### TaskCard.vue Issues
- Line 493: `background: rgba(245, 158, 11, 0.1)` → `var(--color-warning-alpha-10)`
- Line 660: `background: rgba(245, 158, 11, 0.1)` → `var(--color-warning-alpha-10)`
- Line 661: `border: 1px solid rgba(245, 158, 11, 0.2)` → `var(--color-priority-medium-border-medium)`

### CalendarView.vue Issues
- Multiple gradient definitions with `#feca57` endpoint
- Should use solid `var(--color-priority-medium)` instead

### BaseModal.vue Issues
- Line 408: `box-shadow: 0 0 20px rgba(245, 158, 11, 0.2)` → `var(--priority-medium-glow)`

### Mobile Component Issues
- `--accent-blue` should be replaced with `--color-priority-medium`
- Found in: QuickCapture.vue, TaskList.vue

## Replacement Priority

### Priority 1: Color Consistency Critical
1. All `#feca57` values (yellow variant causing inconsistency)
2. All `rgba(245, 158, 11, ...)` values with wrong opacity
3. All gradient definitions ending in `#feca57`

### Priority 2: Standard Compliance
1. Remaining `#f59e0b` hex values
2. `rgba()` values with correct colors but hardcoded
3. Shadow effects using hardcoded rgba

### Priority 3: Enhancement
1. Other color hardcoded values
2. Inconsistent naming patterns
3. Missing alpha variants

## Validation Rules

### Must Pass
- No `#feca57` values anywhere in codebase
- No `rgba(245, 158, 11, ...)` values with wrong opacity
- All medium priority indicators use `var(--color-priority-medium)`
- Consistent color across all views (Board, Calendar, Canvas, Table)

### Should Pass
- No other hardcoded priority color hex values
- All alpha values use appropriate CSS variables
- Consistent use of glow effects

### Nice to Have
- All colors use design tokens where applicable
- Consistent naming patterns
- No hardcoded colors in inline styles

## Quick Reference Commands

### Find All Issues
```bash
python scripts/find_hardcoded_hex.py --verbose
```

### Preview Replacements
```bash
python scripts/replace_with_tokens.py --dry-run
```

### Execute Replacements
```bash
python scripts/replace_with_tokens.py
```

### Validate Results
```bash
python scripts/validate_consistency.py
```

## Files Known to Need Updates

1. **src/components/kanban/TaskCard.vue** - Multiple hex values
2. **src/views/CalendarView.vue** - Gradient definitions
3. **src/components/base/BaseModal.vue** - Shadow effects
4. **src/mobile/components/QuickCapture.vue** - Wrong color variable
5. **src/mobile/components/TaskList.vue** - Wrong color variable

## Expected Outcome

After applying all replacements:
- **Medium priority color**: Consistent `#f59e0b` (orange/amber) everywhere
- **No more yellow vs orange discrepancy**
- **All views show identical colors**
- **CSS design token compliance**: 100%**
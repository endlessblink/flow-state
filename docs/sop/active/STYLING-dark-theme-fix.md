# SOP: CSS Dark Theme Fix

**Date:** 2025-11-27
**Severity:** Critical (UI completely broken)
**Time to Fix:** ~30 minutes

---

## Problem Description

The Pomo-Flow application UI was completely broken with:
- Sidebar navigation items (Today, This Week, All Tasks) nearly invisible
- Dark text on dark background throughout the app
- Empty rectangles appearing in the sidebar
- Blue square artifact under the Board tab
- "chrome is not defined" console errors (unrelated but visible)

### Visual Evidence
See `docs/🐛 debug/images/image copy 7.png` for the broken state.

---

## Root Causes Identified

### 1. Missing CSS Import in main.ts (PRIMARY CAUSE)

**What happened:** The line `import './assets/styles.css'` was removed from `src/main.ts`

**Why it matters:**
- `styles.css` contains Tailwind directives: `@tailwind base; @tailwind components; @tailwind utilities;`
- These directives MUST be processed by Vite's build system
- Without the JavaScript import, Vite doesn't process these directives
- Result: No Tailwind utility classes are generated

**Evidence found via git diff:**
```diff
- import './assets/styles.css'
```

### 2. Missing dark-theme Class on HTML Element (SECONDARY CAUSE)

**What happened:** The `<html>` element was missing `class="dark-theme"`

**Why it matters:**
- `design-tokens.css` defines CSS custom properties for theming
- Dark mode is the DEFAULT in `:root` selector
- Light mode OVERRIDES dark mode via `:root:not(.dark-theme)` selector
- Without the class, the light mode override kicks in
- Result: Light mode colors (dark text: `hsl(220, 13%, 18%)`) on dark background = invisible text

**CSS selector logic in design-tokens.css:**
```css
:root {
  /* Dark mode values (default) */
  --text-secondary: hsl(var(--gray-200)); /* Light text: hsl(0, 0%, 91%) */
}

:root:not(.dark-theme) {
  /* Light mode values (override when class missing) */
  --text-secondary: hsl(220, 13%, 18%); /* Dark text - INVISIBLE on dark bg! */
}
```

### 3. Debug Button Left in Production Code (MINOR)

**What happened:** A "Test Context Menu" debug button was visible in the top-right corner

**Location:** `src/views/BoardView.vue` lines 61-69

---

## Fix Applied

### Fix 1: Restore CSS Import in main.ts

**File:** `src/main.ts`

**Change:** Ensure this line exists:
```typescript
// Design system - Tailwind CSS must be imported here for Vite to process @tailwind directives
import './assets/styles.css'
```

### Fix 2: Add dark-theme Class to HTML Element

**File:** `index.html`

**Before:**
```html
<html lang="en">
```

**After:**
```html
<html lang="en" class="dark-theme">
```

### Fix 3: Remove Debug Button

**File:** `src/views/BoardView.vue`

**Removed:**
```vue
<!-- DEBUG: Manual Context Menu Trigger -->
<div style="position: fixed; top: 10px; right: 10px; z-index: 1000;">
  <button
    @click="manualTriggerContextMenu"
    class="px-4 py-2 bg-blue-500 text-white rounded"
  >
    Test Context Menu
  </button>
</div>
```

Also removed the `manualTriggerContextMenu` function (~60 lines of debug code).

---

## Verification Steps

1. **Check CSS variables in browser:**
   ```javascript
   // In browser console
   getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
   // Should return: hsl(0, 0%, 91%) for dark mode (light text)
   // NOT: hsl(220, 13%, 18%) which is dark text
   ```

2. **Check HTML class:**
   ```javascript
   document.documentElement.classList.contains('dark-theme')
   // Should return: true
   ```

3. **Visual verification:**
   - Sidebar text should be light gray on dark background
   - Task cards should have visible text
   - No debug buttons visible

---

## Prevention Measures

### 1. Never Remove CSS Imports Without Understanding Impact
- The `import './assets/styles.css'` in main.ts is CRITICAL
- It's not a "static import" - it triggers Vite's CSS processing pipeline
- Adding `<link>` tags in index.html does NOT process `@tailwind` directives

### 2. Always Include dark-theme Class in index.html
- The theme system expects this class to be present by default
- Theme toggling can remove/add it, but it must start with the class
- App.vue had theme initialization DISABLED with comment claiming "Dark mode set by default in index.html" - but the class wasn't there!

### 3. Remove Debug Code Before Committing
- Use `git diff` to review changes
- Search for "DEBUG", "Test", "TODO" comments
- Remove any fixed-position debug buttons

---

## Related Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Application entry point, must import CSS |
| `index.html` | HTML template, must have dark-theme class |
| `src/assets/styles.css` | CSS entry point with Tailwind directives |
| `src/assets/design-tokens.css` | CSS custom properties for theming |
| `src/stores/theme.ts` | Theme store (initialization was disabled) |
| `src/App.vue` | Main component (theme init disabled at line 512) |

---

## Diagnostic Commands

```bash
# Check if CSS import exists in main.ts
grep -n "import.*styles.css" src/main.ts

# Check if dark-theme class is in index.html
grep -n "dark-theme" index.html

# Find debug buttons in codebase
grep -rn "Test Context Menu" src/

# Check git diff for removed lines
git diff HEAD~10 src/main.ts | grep -A2 -B2 "styles.css"
```

---

## Lessons Learned

1. **CSS processing in Vite requires JavaScript imports** - Static `<link>` tags don't trigger Tailwind processing
2. **CSS custom properties with negation selectors (`:not()`) can cause unexpected behavior** - Missing a class can trigger the wrong theme
3. **Always verify UI visually after CSS changes** - Automated tests may not catch styling issues
4. **Debug code should be behind feature flags or removed** - Fixed-position debug buttons are easy to miss in code review

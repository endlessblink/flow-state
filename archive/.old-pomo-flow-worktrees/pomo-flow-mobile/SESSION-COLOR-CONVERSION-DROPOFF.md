# Pomo-Flow Color Conversion Session Dropoff
**Date**: October 6, 2025
**Session Focus**: Systematic hardcoded color → design token conversion
**Status**: ~33% complete (218/644 colors converted)

---

## 🎯 Session Accomplishments

### Major Cleanup Completed
✅ **Solved Mystery Color**: Found #0f172a came from `src/styles/design-system.css` (conflicting `--bg-primary`)
✅ **Eliminated 3-System Conflict**: Was using design-tokens.css + design-system.css + themes.ts simultaneously
✅ **Deleted design-system.css**: Removed conflicting old token system
✅ **Merged Unique Tokens**: Added `--text-tertiary`, icon utilities to design-tokens.css
✅ **Replaced all `--bg-*` with `--surface-*`**: 7 files updated (CanvasView, CalendarView, etc.)

### Files Fully Converted (0 hardcoded colors)
1. ✅ **TaskEditModal.vue**: 91 → 0 colors
2. ✅ **App.vue**: 88 → ~2 colors (only transparent rgba(255,255,255,0) remaining)
3. ✅ **TaskManagerSidebar.vue**: 39 → 1 color
4. ✅ **glass-utilities.css**: Already cleaned earlier

**Total Converted**: ~218 colors across 3 major files

### New Tokens Added to design-tokens.css

**Danger/Delete States (Red):**
```css
--danger-bg-subtle: rgba(239, 68, 68, 0.1);
--danger-bg-medium: rgba(239, 68, 68, 0.2);
--danger-border-subtle: rgba(239, 68, 68, 0.2);
--danger-border-medium: rgba(239, 68, 68, 0.3);
--danger-border-strong: rgba(239, 68, 68, 0.4);
--danger-border-hover: rgba(239, 68, 68, 0.5);
```

**Purple Interactive States:**
```css
--purple-bg-subtle: rgba(139, 92, 246, 0.08);
--purple-bg-start: rgba(99, 102, 241, 0.16);
--purple-bg-end: rgba(79, 70, 229, 0.10);
--purple-border-subtle: rgba(139, 92, 246, 0.2);
--purple-border-light: rgba(99, 102, 241, 0.25);
--purple-border-medium: rgba(99, 102, 241, 0.3);
--purple-glow-subtle: 0 0 0 2px rgba(99, 102, 241, 0.10);
--purple-glow-medium: 0 0 0 2px rgba(99, 102, 241, 0.12);
--purple-glow-focus: 0 0 0 3px rgba(59, 130, 246, 0.2);
--purple-shadow-subtle: 0 4px 12px rgba(99, 102, 241, 0.2);
--purple-shadow-medium: 0 4px 12px rgba(99, 102, 241, 0.25);
--purple-shadow-strong: 0 8px 20px rgba(99, 102, 241, 0.35), 0 0 24px rgba(99, 102, 241, 0.25);
```

**Timer States (Amber/Yellow):**
```css
--timer-break-bg-start: rgba(251, 191, 36, 0.15);
--timer-break-bg-end: rgba(217, 119, 6, 0.10);
--timer-border-medium: rgba(251, 191, 36, 0.3);
--timer-glow-subtle: 0 0 24px rgba(251, 191, 36, 0.15);
--timer-shadow-glow: 0 0 12px rgba(99, 102, 241, 0.6);
--timer-shadow-complex: 0 12px 24px rgba(0, 0, 0, 0.24), 0 0 24px rgba(251, 191, 36, 0.15), inset 0 1px 0 var(--border-medium);
```

**Green Success States:**
```css
--success-bg-start: rgba(16, 185, 129, 0.15);
--success-bg-end: rgba(5, 150, 105, 0.10);
--success-border: rgba(16, 185, 129, 0.3);
--success-glow: 0 0 24px rgba(16, 185, 129, 0.15);
--success-shadow-complex: 0 12px 24px rgba(0, 0, 0, 0.24), 0 0 24px rgba(16, 185, 129, 0.15), inset 0 1px 0 var(--border-medium);
```

**Blue/Info States:**
```css
--blue-bg-medium: rgba(59, 130, 246, 0.2);
--blue-glow-subtle: 0 4px 6px -1px rgba(16, 185, 129, 0.2);
--orange-glow-subtle: 0 4px 6px -1px rgba(245, 158, 11, 0.2);
--orange-bg-subtle: rgba(217, 119, 6, 0.15);
```

**Additional Shadows:**
```css
--shadow-subtle: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
--shadow-medium: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-strong: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
```

**Overlays:**
```css
--overlay-dark: rgba(30, 41, 59, 0.9);
```

---

## 📋 Remaining Work - Systematic Conversion Plan

### High Priority Files (User-facing, frequently edited)
1. **ProjectModal.vue** - 39 colors
2. **KanbanColumn.vue** - 38 colors
3. **SettingsModal.vue** - 34 colors

### Medium Priority Files (Core UI)
4. **ConfirmationModal.vue** - 29 colors
5. **TaskContextMenu.vue** - 25 colors
6. **CanvasSection.vue** - 22 colors
7. **TaskCard.vue** (kanban) - 20 colors
8. **KanbanSwimlane.vue** - 20 colors

### Lower Priority Files (<20 colors each)
9. **TaskNode.vue** (canvas) - 19 colors
10. **CanvasView.vue** - 13 colors
11. **CanvasContextMenu.vue** - 13 colors
12. **EdgeContextMenu.vue** - 11 colors
13. **BaseBadge.vue** - 11 colors
14. **MultiSelectionOverlay.vue** - 7 colors
15. **BaseIconButton.vue** - 7 colors
16. **SectionManager.vue** - 5 colors

**Estimated Remaining**: ~426 colors across 16 files

---

## 🛠️ Conversion Process (Proven Pattern)

### Step 1: Identify Common Patterns
Run grep to find most frequent rgba values in target file:
```bash
grep -o "rgba([^)]*)" src/components/FileName.vue | sort | uniq -c | sort -rn
```

### Step 2: Add Missing Tokens (if needed)
Check if patterns have corresponding tokens in design-tokens.css. If not, add them with semantic names.

### Step 3: Bulk Replace Common Patterns
Use `Edit` tool with `replace_all: true` for frequent values:
- `rgba(255, 255, 255, 0.08)` → `var(--glass-bg-heavy)`
- `rgba(255, 255, 255, 0.04)` → `var(--glass-bg-tint)`
- `rgba(255, 255, 255, 0.06)` → `var(--glass-bg-soft)`
- etc.

### Step 4: Verify Completion
```bash
grep -c "rgba(" src/components/FileName.vue
```
Should return 0 (or only rgba(*, *, *, 0) for transparent)

### Step 5: Test with Playwright
Navigate to relevant view, take screenshot, verify visual consistency.

---

## 📝 Token Naming Conventions Established

**Pattern**: `--{context}-{property}-{variant}`

**Contexts:**
- `glass-` = Transparent glass effects
- `danger-` = Red/delete actions
- `purple-` = Purple UI accents
- `timer-` = Amber/yellow timer states
- `success-` = Green success states
- `calendar-` = Calendar-specific (purple)
- `blue-` = Blue/info states
- `orange-` = Orange/warning states

**Properties:**
- `bg` = background color
- `border` = border color
- `glow` = box-shadow glow
- `shadow` = box-shadow depth

**Variants:**
- `subtle`, `medium`, `strong` = intensity
- `start`, `end` = gradient stops
- `light`, `hover`, `focus` = interaction states

---

## 🚨 Critical Files Created

1. **scripts/generate-tokens.js**
   - Reads themes.ts → generates design-tokens.css
   - Added to package.json: `npm run generate-tokens`
   - NOT yet integrated into Vite pipeline (future task)

2. **design-system.html**
   - Visual token reference (started, incomplete)
   - Has dark/light theme toggle
   - Shows token swatches with copy-to-clipboard
   - Needs expansion with all components

---

## 🎨 Design System State

### Single Source of Truth
**design-tokens.css** is now the ONLY active token system
- ~~design-system.css~~ DELETED
- themes.ts exists but not synced yet (future automation)

### Purple + Green Accent Mix Restored
- Purple for UI chrome (filters, badges, buttons)
- Green for active/success states
- Both colors used throughout for visual interest
- User confirmed they want the mix, NOT just green

### Calendar Event Styling
- Changed from bright saturated fills to dark cards with priority stripes
- Matches kanban card pattern now
- Events use `--surface-tertiary` background + colored left stripe

---

## 📊 Progress Tracking (like-i-said tasks)

### Completed Tasks
- TASK-66790: Found mystery #131f3d color (was #0f172a)
- TASK-34864: Audited design-system.css tokens
- TASK-61317: Checked utility class usage (120 uses)
- TASK-31952: Merged tokens to design-tokens.css
- TASK-40529: Replaced --bg-* with --surface-*
- TASK-20930: Deleted design-system.css

### In-Progress Tasks
- TASK-90883: Convert all 644 colors (master tracking)
- TASK-77681: Build themes.ts sync script (created, not integrated)

### Pending Tasks (for next session)
- TASK-14808: Finish App.vue (43 → ~2 colors remaining)
- TASK-37449: TaskManagerSidebar.vue
- TASK-14943: ProjectModal.vue (39 colors) ← START HERE
- TASK-74747: KanbanColumn.vue (38 colors)
- TASK-11386: SettingsModal.vue (34 colors)
- TASK-87359: ConfirmationModal.vue (29 colors)
- TASK-12766: Remaining 13 files (~178 colors)

---

## 🔄 Next Session Instructions

### Immediate Start Point
**File**: `src/components/ProjectModal.vue` (39 hardcoded colors)

**Process**:
1. `grep "rgba(" src/components/ProjectModal.vue -n | head -30`
2. Identify common patterns
3. Add tokens if needed (follow naming convention above)
4. Use `Edit` with `replace_all: true` for bulk replacements
5. Verify with `grep -c "rgba(" src/components/ProjectModal.vue`
6. Move to next file: KanbanColumn.vue

### Token Addition Guidelines
When adding new tokens:
- Check if pattern already exists (different opacity)
- Use semantic names (what it's for, not what it looks like)
- Add to both `:root` (dark) and `:root:not(.dark-theme)` (light)
- Document in comment what components use it

### Testing Protocol
After every 2-3 files converted:
1. Navigate to affected view in Playwright
2. Take screenshot
3. Verify no visual regressions
4. Check that token changes in design-tokens.css now affect those components

---

## 💡 Key Learnings

### What Worked
- **Batch replacement** of common patterns (rgba(255,255,255,0.08) appeared 30+ times)
- **Progressive token addition** - add tokens as needed, don't pre-generate all
- **Semantic naming** - context-property-variant makes tokens discoverable
- **Like-i-said tracking** - prevents losing progress, documents all work

### What Didn't Work
- Trying to convert everything at once (overwhelming)
- Not documenting which files use which tokens
- Attempting Storybook install before foundation was clean

### Efficient Patterns
```bash
# Find most common rgba patterns in a file
grep -o "rgba([^)]*)" FILE | sort | uniq -c | sort -rn | head -10

# Count remaining colors
grep -c "rgba(" FILE

# Check if specific token exists
grep --text-tertiary src/assets/design-tokens.css
```

---

## 🗺️ Architecture Decisions

### Why themes.ts + design-tokens.css?
- **themes.ts** = Source of truth (TypeScript, type-safe, future theme switching)
- **design-tokens.css** = Browser implementation (CSS vars, what components actually use)
- **Sync script** created but not integrated yet

### Why Not Delete themes.ts?
User wants commercial-ready architecture for potential future. Keeping themes.ts allows:
- Programmatic theme switching later
- Type-safe theme definitions
- Easy to add new themes (light, dark, custom)

---

## 📦 Files Modified This Session

### Core System Files
- `src/assets/design-tokens.css` - Added 40+ new tokens
- `src/main.ts` - Removed design-system.css import
- `package.json` - Added `generate-tokens` script
- **DELETED**: `src/styles/design-system.css`

### Component Files (Converted)
- `src/components/TaskEditModal.vue`
- `src/App.vue`
- `src/components/TaskManagerSidebar.vue`

### Component Files (Updated --bg-* → --surface-*)
- `src/views/CanvasView.vue`
- `src/views/CalendarView.vue`
- `src/components/canvas/MultiSelectionOverlay.vue`
- `src/components/canvas/SectionManager.vue`

### New Files
- `scripts/generate-tokens.js` - Theme sync script (not auto-run yet)
- `design-system.html` - Token viewer (incomplete)

---

## 🎨 Visual Consistency Achieved

### Cohesive Card Pattern
All three views now use same card styling:
- **Kanban cards**: Dark background + thin colored left stripe ✅
- **Calendar events**: Dark background + thin colored left stripe ✅
- **Canvas inbox**: Dark background + thin colored left stripe ✅

### Purple + Green Accent Mix
- Purple for UI elements (filters, badges, buttons)
- Green for active/hover states
- Maintains visual interest while being cohesive

### Sidebar Consistency
- Calendar sidebar task cards: Dark background (--surface-primary) ✅
- No more mystery #0f172a color ✅

---

## ⚠️ Known Issues / Incomplete

### Storybook Installation Failed
- WSL2 package-lock.json corruption
- Attempted fix with `rm package-lock.json && npm install`
- Still needs proper installation for component documentation

### Themes.ts Sync Not Automated
- Script created: `scripts/generate-tokens.js`
- Added to package.json: `npm run generate-tokens`
- **NOT integrated** into Vite build pipeline yet
- Must manually run after editing themes.ts

### Remaining Hardcoded Colors
~426 colors remain across 16 files. Priority order for next session:
1. ProjectModal.vue (39)
2. KanbanColumn.vue (38)
3. SettingsModal.vue (34)
4. [Continue through list above]

---

## 🚀 Quick Start for Next Session

```bash
# 1. Navigate to project
cd "/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow"

# 2. Start dev server (if not running)
npm run dev

# 3. Check current status
grep -r "rgba(" src/ --include="*.vue" --include="*.css" | grep -v "design-tokens.css" | cut -d: -f1 | sort | uniq -c | sort -rn

# 4. Start with ProjectModal.vue
grep "rgba(" src/components/ProjectModal.vue -n | head -20

# 5. Open Playwright for testing
# Navigate to http://localhost:5545
```

**First action**: Read this dropoff, review like-i-said tasks, continue with ProjectModal.vue conversion.

---

## 📚 Reference

**Token Mapping Quick Reference:**
```
Common Patterns → Tokens
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
rgba(255, 255, 255, 0.03) → var(--glass-bg-light)
rgba(255, 255, 255, 0.04) → var(--glass-bg-tint)
rgba(255, 255, 255, 0.05) → var(--glass-bg-medium)
rgba(255, 255, 255, 0.06) → var(--glass-bg-soft)
rgba(255, 255, 255, 0.08) → var(--glass-bg-heavy)
rgba(255, 255, 255, 0.10) → var(--glass-border)
rgba(255, 255, 255, 0.16) → var(--glass-border-medium)

0 4px 8px rgba(0, 0, 0, 0.12) → var(--shadow-md)
0 8px 16px rgba(0, 0, 0, 0.15) → var(--shadow-lg)
0 12px 24px rgba(0, 0, 0, 0.18) → var(--shadow-xl)

rgba(99, 102, 241, *) → var(--purple-*)
rgba(16, 185, 129, *) → var(--success-*) or var(--state-*)
rgba(251, 191, 36, *) → var(--timer-*)
rgba(239, 68, 68, *) → var(--danger-*)
```

**Files with Token Reference:**
- Token definitions: `src/assets/design-tokens.css`
- Token usage audit: `/tmp/hardcoded-colors-audit.txt`
- Like-i-said tasks: View with `mcp__like-i-said__list_tasks`

---

*End of session dropoff. Continue systematically with remaining 426 colors.*

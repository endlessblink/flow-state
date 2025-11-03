---
id: mgt21ew05vf22zf3ab
timestamp: 2025-10-16T06:44:31.776Z
project: pomo-flow
category: technical
tags: ["gradient-fix","calendar-inbox","css-issues","ui-correction","git-restore"]
priority: medium
---

# SESSION DROPOFF: Pomo-Flow Calendar Inbox Gradient Issue

## Context
User reported that the calendar view's left sidebar panel (CalendarInboxPanel) still shows unwanted blue gradients despite multiple attempts to fix the issue. The user wants the inbox panel to match the clean design shown in reference image `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/docs/debug/image copy 28.png`.

## Problem Analysis
The issue involves **CalendarInboxPanel.vue** component showing blue gradient backgrounds instead of clean solid backgrounds. I mistakenly worked on the wrong components:

1. ❌ First attempted to fix TaskManagerSidebar (main app sidebar)
2. ❌ Then attempted to fix App.vue (main app container)
3. ✅ Finally identified the correct component: CalendarInboxPanel.vue (calendar view left panel)

## Current Status
- **Component Identified**: CalendarInboxPanel.vue (calendar inbox panel)
- **Action Taken**: `git restore src/components/CalendarInboxPanel.vue` 
- **Result**: Issue persists - gradients still showing in calendar inbox panel
- **User Feedback**: "the issue is still there" - gradients not removed

## Technical Details Found
The CalendarInboxPanel.vue currently has these gradient styles that need to be removed:

```css
.calendar-inbox-panel {
  background: linear-gradient(
    219deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(20px) saturate(150%);
}

.inbox-header {
  background: linear-gradient(
    180deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-weak) 100%
  );
}
```

## Required Fixes (Next Session)
1. **Locate exact gradient styles** in CalendarInboxPanel.vue causing blue appearance
2. **Replace with solid backgrounds** using appropriate design tokens:
   - `.calendar-inbox-panel` → `background: var(--surface-secondary)`
   - `.inbox-header` → `background: var(--surface-tertiary)`
3. **Remove backdrop-filter effects** that may be causing blue tint
4. **Test with Playwright** to verify visual changes match reference image
5. **Check if other components** in calendar view also have conflicting gradients

## Key Files Involved
- `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/src/components/CalendarInboxPanel.vue` (main target)
- `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/docs/debug/image copy 28.png` (reference)
- Calendar view components that might be affecting the inbox panel

## User Requirements
- Remove ALL blue gradient backgrounds from calendar inbox panel
- Match the clean design shown in reference image
- Use solid backgrounds with navy-dark theme
- Maintain existing functionality and interactions

## Debugging Notes
- Multiple development servers running (check for port conflicts)
- Git history shows CalendarInboxPanel was restored but issue persists
- Need to verify which specific CSS properties are causing the blue gradient appearance
- May need to check parent container styles in calendar view

## Next Session Priority
1. **First**: Use Playwright to inspect current state and identify exact gradient sources
2. **Second**: Target specific gradient styles in CalendarInboxPanel.vue
3. **Third**: Test and verify visual changes match reference design
4. **Fourth**: Ensure no other components are causing gradient bleed-through

## Session End Reason
User requested detailed dropoff for new chat session due to persistent issue despite multiple fix attempts.
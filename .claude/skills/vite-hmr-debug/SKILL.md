---
name: vite-hmr-debug
description: MANDATORY diagnostic skill for any UI component editing workflow. Use PROACTIVELY whenever editing Vue SFC templates, CSS, or card/list components and the user reports changes aren't visible, cards look wrong, hover isn't working, icons won't hide, layout feels cramped despite edits, or "nothing changed". Also triggers on Vite HMR issues, stale cache, "changes not showing", "browser not updating", "edits have no effect", "still the same", "looks the same". CRITICAL — before spending more than 5 minutes debugging a visual/CSS issue, run the test marker from this skill to prove changes are being served. This prevents hours wasted on phantom bugs that are actually cache problems.
---

# Vite HMR & Stale Cache Debugging

When template or CSS changes don't appear in the browser, the problem is almost always **stale dev server output or browser cache** — not a Vue, CSS, or framework bug.

This skill encodes a systematic diagnostic sequence learned from real debugging sessions where hours were lost chasing CSS specificity and Vue reactivity issues that turned out to be cache problems.

## The Golden Rule

**Before debugging any visual/behavioral issue, PROVE that your changes are being served.** Never assume HMR delivered your edit. Verify first, debug second.

## Step 1: The Test Marker (Do This First, Every Time)

Add a visually unmistakable element to the component you're editing:

```html
<!-- Add this anywhere in the template -->
<div style="background: red; color: white; font-size: 14px; padding: 4px 8px; position: absolute; top: 0; right: 0; z-index: 9999;">MARKER</div>
```

Then hard-refresh the browser (Ctrl+Shift+R).

- **Marker appears** → Your changes ARE being served. The bug is real — proceed to debug the actual issue.
- **Marker doesn't appear** → Stale cache. Go to Step 2.

This takes 10 seconds and saves hours. Skip it at your peril.

## Step 2: Nuclear Cache Reset

When the test marker doesn't appear, run this sequence:

```bash
# 1. Kill all dev processes
npm run kill  # or: pkill -f vite; pkill -f "npm run dev"

# 2. Nuke Vite's transform cache and build output
rm -rf node_modules/.vite dist

# 3. Restart with forced re-optimization
npx vite --host --port 5546 --strictPort --force
```

The `--force` flag tells Vite to discard all cached dependency pre-bundles and recompile from scratch. Look for this line in the output to confirm it worked:

```
[vite] Forced re-optimization of dependencies
```

Then open an **incognito/private window** (guarantees zero browser cache) and load the app.

## Step 3: The Identity Test (Is This Even the Right Component?)

If your changes appear to have no effect even after cache reset, you may be editing the wrong file. Vue apps often have multiple similar components (e.g., `TaskCard.vue`, `InboxTaskCard.vue`, `CalendarTaskCard.vue`).

**Brute-force identity test:** Replace the entire `<template>` with a giant red block:

```html
<template>
  <div style="background: red; color: white; padding: 20px; margin: 8px; border-radius: 8px; font-size: 16px; font-weight: bold;">
    TEST CARD: {{ task.title || 'unknown' }}
  </div>
</template>
```

- **Red blocks appear** → Correct component confirmed. Restore the template and debug the real issue.
- **No red blocks** → You're editing the wrong file. Search for the actual component:

```bash
# Find which component actually renders this UI element
grep -rn "YourComponentName" src/ --include="*.vue" | grep -v "import.*from"
```

## Step 4: The v-if="false" Test

When `v-if` or `v-show` appears to not work (elements stay visible despite being bound to `false`):

1. Temporarily set `v-if="false"` (literal false, not a variable)
2. Hard-refresh

- **Element disappears** → The reactive binding is the issue (variable stuck at `true`, wrong ref, event handler problem)
- **Element still visible** → Either cache (go to Step 2), wrong component (go to Step 3), or a completely different DOM element that looks the same

## Common Traps

### Metadata badges look like action buttons

Inbox/task cards often have both:
- **Metadata badges** (project emoji, calendar icon, clock icon) — always visible, part of the card content
- **Action buttons** (edit, play, delete) — shown on hover only

These look similar, especially at small sizes. Before spending time on hover logic, inspect carefully to determine WHICH icons you're actually seeing. Use colored outlines to distinguish:

```html
<div class="task-metadata" style="outline: 2px dashed red;">...</div>
<div class="task-actions" style="outline: 3px solid lime;">...</div>
```

### HMR WebSocket disconnects after server restart

After killing and restarting the dev server, the browser's HMR WebSocket connection is broken. Subsequent file saves won't trigger updates. **Always Ctrl+Shift+R after a server restart.**

### Linux inotify watch limits

On Linux, if the project has many files, Vite's file watcher may silently stop receiving events:

```bash
cat /proc/sys/fs/inotify/max_user_watches
# Should be >100,000. If low:
sudo sysctl fs.inotify.max_user_watches=524288
```

### Vite serves old transforms despite file changes

Some editors (vim, CLI tools) use atomic saves (write temp file + rename). Vite's watcher may miss rename events. Workaround:

```ts
// vite.config.ts
export default defineConfig({
  server: {
    watch: {
      usePolling: true,  // Fallback to polling instead of inotify
      interval: 300,
    }
  }
})
```

### Scoped CSS specificity

Vue scoped styles add `[data-v-xxxxx]` attribute selectors. A global CSS rule with `!important` or higher specificity can override scoped styles. Check for:

```bash
grep -rn "task-actions.*important\|\.task-actions" src/assets/ --include="*.css"
```

## Quick Reference: Diagnostic Decision Tree

```
Change not visible?
├── Add test marker → visible?
│   ├── YES → Bug is real, debug normally
│   └── NO → Cache problem
│       ├── rm -rf node_modules/.vite && vite --force
│       ├── Open incognito window
│       └── Still no? Check inotify / try polling
│
├── v-if="false" → element gone?
│   ├── YES → Reactive binding issue (ref stuck, wrong variable)
│   └── NO → Wrong component or cache
│       └── Replace entire template with red block
│           ├── Red block appears → Restore, debug real issue
│           └── No red block → WRONG FILE. Find the real component.
│
└── Icons visible that shouldn't be?
    └── Are they metadata badges or action buttons?
        ├── Add colored outlines to distinguish
        └── Metadata is SUPPOSED to be visible
```

## Cleanup

After debugging, always remove:
- Test markers (red divs)
- Debug outlines (style attributes)
- `v-if="false"` (restore to actual binding)
- Polling config (if only used for debugging)

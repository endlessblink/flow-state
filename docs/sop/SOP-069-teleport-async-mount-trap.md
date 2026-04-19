# SOP-069: Teleport + Async-Mount Event Chain Trap

**Status**: Active
**Created**: 2026-04-19
**Related Task**: TASK-1756 (v5 fix)
**Related SOPs**: [SOP-024](./SOP-024-teleported-menu-patterns.md) (Tauri pointer-events + scoped styles)

---

## TL;DR

**Never use `<Teleport to="body">` on an interactive component whose click handler emits back to its parent.** When the parent's mount races with async chunk loading (or with a Suspense activeBranch swap, or with a route transition with `mode="out-in"`), Vue can end up in a state where:

- The teleported DOM is still attached to `<body>`.
- The button's `_vei.onClick` cache still contains a click-to-emit handler.
- The component instance captured in that handler's closure has a **severed parent link**.
- `$emit` silently succeeds (no throw) but routes nowhere — the parent listener doesn't exist anymore.

Result: user clicks the button, nothing happens, and **no console error or log fires** to explain why. The debug experience is uniquely brutal because every surface-level check (DOM present, click listener present, component "mounted") reports healthy.

If the UX requires escaping a transformed ancestor (Vue Flow pane, drag overlay, etc.), prefer **rendering as a sibling to the transformed subtree + `position: fixed`** over Teleport. See the "Fix Recipe" below.

---

## How to recognize it

All of these symptoms together:

1. Clicking a button in the affected component does nothing user-visible.
2. Console shows **zero** output from the click — no error, no log, no network call.
3. DOM inspection: the button is present in `<body>` (via Teleport target), with no duplicates, looking fine.
4. `btn.dispatchEvent(new MouseEvent('click'))` behaves the same as a real click — still nothing.
5. Navigating to a different route and back "fixes" it until the next bad mount.
6. `document.getElementById('app').__vue_app__._instance` may read as `null` even though the app is clearly rendering (Vue 3 keeps the live root under `_container._vnode.component` instead — see Debug Snippet below).

## Debug snippet (paste into DevTools console)

```js
// 1. Is your component actually in Vue's live tree?
const root = document.getElementById('app').__vue_app__._container._vnode.component
function find(c, name, d = 0) {
  if (!c || d > 25) return null
  const n = c.type?.__name || c.type?.name
  if (n === name) return c
  const sub = c.subTree
  if (sub?.component) { const f = find(sub.component, name, d + 1); if (f) return f }
  if (sub?.suspense?.activeBranch) { const f = find(sub.suspense.activeBranch, name, d + 1); if (f) return f }
  if (Array.isArray(sub?.children)) for (const ch of sub.children) if (ch?.component) { const f = find(ch.component, name, d + 1); if (f) return f }
  return null
}
console.log('CanvasToolbar in tree:', !!find(root, 'CanvasToolbar'))

// 2. What does the button's click handler actually reference?
const btn = document.querySelector('button[aria-label="Rotate day groups"]')
const vei = btn[Object.getOwnPropertySymbols(btn).find(s => s.toString().includes('_vei'))]
console.log('Click handler source:', vei?.onClick?.value?.toString())
// A dead chain looks like: `s=>n.$emit("foo")` — `n` is the ghost component in the closure.
```

If `find` returns `null` but the button DOM exists in `<body>`, you've hit this bug.

## Fix recipe

### 1. Remove the Teleport

The simplest, most reliable fix. Replace:

```vue
<template>
  <Teleport to="body">
    <div class="my-toolbar">...</div>
  </Teleport>
</template>
```

with:

```vue
<template>
  <div>
    <div class="my-toolbar">...</div>
  </div>
</template>
```

(Wrap with a bare `<div>` if the component needs a single root, or use `<Fragment>`/inline if not.)

### 2. Ensure the parent renders you OUTSIDE any transformed ancestor

If you added Teleport originally because `position: fixed` got trapped by a `transform`/`will-change:transform` ancestor (common with Vue Flow, framer-motion layouts, CSS anchor positioning): look for a mount point in the parent that is **a sibling to the transformed subtree**, not a descendant. In FlowState's CanvasView, `<CanvasToolbar />` is already a sibling to `<VueFlow>`, not a child — so `position: fixed` escapes to the viewport without Teleport.

Verify:

```js
// Walk up the ancestor chain and find any transformed ancestor
let el = document.querySelector('.my-toolbar')
while (el) {
  const s = getComputedStyle(el)
  if (s.transform !== 'none' || s.willChange.includes('transform') || s.filter !== 'none') {
    console.log('⚠️ Transformed ancestor:', el, { transform: s.transform, filter: s.filter })
    break
  }
  el = el.parentElement
}
```

If no transformed ancestor, `position: fixed` is relative to the viewport — Teleport isn't needed.

### 3. If Teleport is truly unavoidable

If you MUST teleport (e.g. the component needs to live across multiple unrelated parents, or render inside a shadow DOM host), avoid `$emit`-based parent communication. Options in decreasing order of preference:

1. **Pinia store action** — the component calls the store directly; no parent-child chain involved.
2. **Provide/inject of a bare function** — `provide('onAction', fn)` in a high-level ancestor, `inject('onAction')` in the Teleported child. Requires the ancestor to stay mounted, but survives Teleport because Pinia-style injection uses the app-level context, not the vnode chain.
3. **Custom event bus** — module-level `mitt()` emitter. Works but adds global coupling.

Never rely on `$emit` across a Teleport boundary if there's any chance of async mount or Suspense in the ancestor chain.

## Why Vue's Teleport fails this way

Vue's Teleport vnode lives in the parent's subTree, but its rendered DOM is inserted into the teleport target at mount. When the parent unmounts, Vue walks the subTree and unmounts Teleport, which removes the DOM from the target.

The edge case: if the parent mount **aborts mid-flight** (async chunk throws, Suspense swap happens, route transition races), the Teleport may have already inserted DOM but Vue skips the cleanup. The click handler's `_vei` cache still holds a function that closes over the unmounted component instance. Vue's `emit()` implementation walks up `parent.vnode.props` to find listeners — on a detached component, `parent` is dangling and emit is a silent no-op. No error, no warning, no observable failure.

This is fundamentally a consequence of how `$emit`'s routing works: it's resolved via the Vue vnode tree, not the DOM tree. Teleport deliberately breaks the coupling between DOM and vnode tree — in the happy path it works, in races it doesn't.

## Real incident: TASK-1756 (April 2026)

- Reported: "Rotate day groups button does nothing, groups don't move."
- Wrong hypotheses tried and shipped in sequence: xSpread-based preserve-user-layout gate (v1.3.56), isVueFlowReady wiring (v1.3.57), onBeforeMount/onBeforeUnmount DOM cleanup in CanvasToolbar (v1.3.58). None fixed the user-visible symptom.
- Root cause diagnosis required CDP-attach to the running Electron and walking Vue's component tree; the DOM + event handler + "mounted" all looked healthy.
- Fix shipped in v1.3.59: delete the `<Teleport to="body">` wrapper in `CanvasToolbar.vue`. Single commit, 3 lines changed.

## Rule of thumb

> Before adding `<Teleport to="body">` to any component that emits events, ask: "Is there a sibling-to-the-transformed-ancestor mount point I could use instead with `position: fixed`?" 90% of the time, yes. Take it.

/**
 * Regression tests for Board drag-between-lanes behavior.
 *
 * Locks in the fixes shipped in v1.4.28 (drop-target hover state) and
 * v1.4.30 (real card-gliding during cross-column drag).
 *
 * These are static-file assertions on purpose: jsdom can't observe SortableJS
 * transform animations, and a Playwright drag would be slow and flaky. The
 * regressions we care about are CSS / vuedraggable-config drift, which
 * a content-level test catches reliably.
 *
 * If any assertion here fails, read the comment above it — it explains the
 * exact bug that comment is preventing.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '../..')

const KANBAN_COLUMN_CSS = readFileSync(
  join(projectRoot, 'src/components/kanban/KanbanColumn.css'),
  'utf8'
)
const KANBAN_COLUMN_VUE = readFileSync(
  join(projectRoot, 'src/components/kanban/KanbanColumn.vue'),
  'utf8'
)

describe('Board drag — card gliding regression', () => {
  it('.task-item must NOT use `transition: all` (hijacks SortableJS transform glide)', () => {
    // Bug: `transition: all` on `.task-item` competes with SortableJS's inline
    // `transition: transform`, causing siblings to snap/jitter when the ghost
    // is inserted into a column instead of smoothly opening a slot.
    // Fixed by transitioning only paint properties.
    const taskItemBlock = KANBAN_COLUMN_CSS.match(
      /\.task-item\s*\{[\s\S]*?\}/
    )?.[0] ?? ''
    expect(taskItemBlock).not.toMatch(/transition:\s*all\b/)
    // Sanity: the rule should still transition *something* (paint properties).
    expect(taskItemBlock).toMatch(/transition:/)
  })

  it('.task-item transition must explicitly exclude `transform`', () => {
    const taskItemBlock = KANBAN_COLUMN_CSS.match(
      /\.task-item\s*\{[\s\S]*?\}/
    )?.[0] ?? ''
    // Whatever properties are listed, `transform` must not be one of them.
    expect(taskItemBlock).not.toMatch(/transition:[^;}]*\btransform\b/)
  })

  it('vuedraggable must keep `:animation` set so siblings glide', () => {
    // SortableJS only animates sibling translations when `animation` > 0.
    // Removing this attribute would silently disable the slot-opening glide.
    const animationMatch = KANBAN_COLUMN_VUE.match(/:animation="(\d+)"/)
    expect(animationMatch, 'expected :animation="<ms>" prop on <draggable>').not.toBeNull()
    const animationMs = Number(animationMatch![1])
    expect(animationMs).toBeGreaterThanOrEqual(150)
    expect(animationMs).toBeLessThanOrEqual(320)
  })

  it('vuedraggable must keep an explicit `easing` curve (no default linear)', () => {
    // Default SortableJS easing is empty (linear). Linear sibling slides feel
    // mechanical; the project uses a calm cubic-bezier for Linear/Vercel-style
    // layout choreography. Strip the easing and the glide reads as cheap.
    expect(KANBAN_COLUMN_VUE).toMatch(/easing="cubic-bezier\(/)
  })
})

describe('Board drag — drop-target hover state regression', () => {
  it('destination column must light up via `:has(.ghost-card)` selector', () => {
    // Cross-column drags use SortableJS which never sets a class on the
    // destination column. The `:has(.ghost-card)` selector is the only hook
    // that gives the user feedback about which lane they're dropping into.
    // (The placeholder element with `.ghost-card` lives inside the destination
    // `.tasks-container` even when `fallback-on-body` is true.)
    expect(KANBAN_COLUMN_CSS).toMatch(
      /\.tasks-container:has\(\.ghost-card\)/
    )
  })

  it('drop-target rule must use brand teal tokens, not just a faint outline', () => {
    // Previous version (pre-1.4.28) only had `outline: 2px dashed` with
    // `--glass-bg-soft`, which was nearly invisible against the dark board.
    // The upgraded rule must reference the active-state tokens.
    const dropTargetBlock = KANBAN_COLUMN_CSS.match(
      /\.tasks-container:has\(\.ghost-card\)[\s\S]*?\}/
    )?.[0] ?? ''
    expect(dropTargetBlock).toMatch(/--state-active-bg/)
    expect(dropTargetBlock).toMatch(/--state-active-border/)
  })

  it('non-target columns must dim while `body.is-board-dragging` is set', () => {
    // The dim-others rule is what directs the user's eye to the active drop
    // target. Removing it would leave every column looking equally inviting.
    expect(KANBAN_COLUMN_CSS).toMatch(
      /body\.is-board-dragging\s+\.tasks-container:not\(:has\(\.ghost-card\)\)/
    )
  })

  it('ghost-card placeholder must be full opacity, not the old faded 0.4', () => {
    // The pre-1.4.28 ghost was `opacity: 0.4` with a faded grey dashed border —
    // it read like a half-deleted card. The slot should read as a clear,
    // teal-tinted insertion area at full opacity.
    const ghostBlock = KANBAN_COLUMN_CSS.match(
      /\.tasks-container\s+\.ghost-card\s*\{[\s\S]*?\}/
    )?.[0] ?? ''
    expect(ghostBlock, 'expected scoped .tasks-container .ghost-card rule').not.toBe('')
    expect(ghostBlock).toMatch(/opacity:\s*1\b/)
    // Also confirm it isn't transparent (regression to invisible ghost)
    expect(ghostBlock).not.toMatch(/background:\s*transparent/)
  })

  it('KanbanColumn must toggle `body.is-board-dragging` on drag start AND drag end', () => {
    // Without the body-class toggle, the "dim non-target columns" CSS rule
    // never fires and the user can't tell which column is the drop target.
    expect(KANBAN_COLUMN_VUE).toMatch(
      /document\.body\.classList\.add\(['"]is-board-dragging['"]\)/
    )
    expect(KANBAN_COLUMN_VUE).toMatch(
      /document\.body\.classList\.remove\(['"]is-board-dragging['"]\)/
    )
  })

  it('text selection must be suppressed during board drag', () => {
    // force-fallback="true" bypasses native HTML5 DnD, so the browser still
    // selects text as the cursor moves with the button held. Without a
    // `user-select: none` rule scoped to `body.is-board-dragging`, card titles
    // (especially RTL Hebrew) get highlighted mid-drag — see bug screenshot.
    expect(KANBAN_COLUMN_CSS).toMatch(
      /body\.is-board-dragging[\s\S]*?user-select:\s*none/
    )
  })

  it('KanbanColumn must clear existing text selection on drag start', () => {
    // If the user had text selected before grabbing a card, native DnD would
    // auto-clear it. force-fallback drag does not — so we clear it manually.
    expect(KANBAN_COLUMN_VUE).toMatch(
      /window\.getSelection\?\.\(\)\?\.removeAllRanges/
    )
  })

  it('KanbanColumn must clean up `is-board-dragging` on unmount (no stuck dim state)', () => {
    // Defensive: if the component unmounts mid-drag (route change, view
    // toggle), the body class must be cleared or the entire board stays
    // permanently dimmed.
    const onUnmountedBlock = KANBAN_COLUMN_VUE.match(
      /onUnmounted\(\(\)\s*=>\s*\{[\s\S]*?\}\)/
    )?.[0] ?? ''
    expect(onUnmountedBlock).toMatch(
      /classList\.remove\(['"]is-board-dragging['"]\)/
    )
  })
})

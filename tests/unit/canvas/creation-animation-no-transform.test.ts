/**
 * BUG-1807 regression: the task-node creation entrance animation must NOT use
 * a `transform` (e.g. scale()).
 *
 * Scaling a backdrop-filter (glass) task card forces the GPU compositor to
 * re-sample the backdrop every frame, with sub-pixel rounding. On Electron this
 * made the whole canvas appear to shift/shimmer when an inbox task was dropped
 * onto the canvas ("the nudge"). It also violated the BUG-1328 invariant that
 * the node root must carry no transform (it conflicts with Vue Flow's
 * transform: translate positioning).
 *
 * The entrance must therefore animate opacity/box-shadow/brightness only.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('BUG-1807: creation animation must be transform-free', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../src/components/canvas/TaskNode.vue'),
    'utf-8'
  )

  // Extract the @keyframes animate-creation block.
  const match = source.match(/@keyframes\s+animate-creation\s*\{([\s\S]*?)\n\}/)

  it('defines the animate-creation keyframes', () => {
    expect(match, 'animate-creation keyframes not found in TaskNode.vue').not.toBeNull()
  })

  it('does not animate scale() / transform / filter inside the keyframes', () => {
    const body = match?.[1] ?? ''
    expect(body, 'creation animation must not use scale() — it shifts the canvas on Electron').not.toMatch(/scale\s*\(/)
    expect(body, 'creation animation must not animate transform on the node root (BUG-1328/BUG-1807)').not.toMatch(/\btransform\s*:/)
    // filter on a backdrop-filter (glass) card re-composites the backdrop each
    // frame — same Electron shimmer class as transform. Keep the entrance opacity-only.
    expect(body, 'creation animation must not animate filter on a glass card (BUG-1807)').not.toMatch(/\bfilter\s*:/)
  })
})

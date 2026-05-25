import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Canvas Tidy Vue Flow application', () => {
  it('uses one atomic setNodes pass instead of updateNode/applyNodeChanges stale overwrites', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/CanvasView.vue'), 'utf8')
    const applyCanonicalMoves = source.slice(
      source.indexOf('function applyCanonicalMoves'),
      source.indexOf('const dayRotation = useDayGroupRotation')
    )

    expect(applyCanonicalMoves).toContain('setNodes(updatedNodes as any)')
    expect(applyCanonicalMoves).not.toContain('updateNode(')
    expect(applyCanonicalMoves).not.toContain('applyNodeChanges(')
    expect(applyCanonicalMoves).not.toContain('setNodes(nodes.value)')
  })
})

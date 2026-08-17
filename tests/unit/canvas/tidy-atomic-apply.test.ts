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

    expect(applyCanonicalMoves).toContain('setNodes(updatedNodes.map(toPublicVueFlowNode) as Parameters<typeof setNodes>[0])')
    expect(applyCanonicalMoves).not.toContain('nodes.value = updatedNodes')
    expect(applyCanonicalMoves).not.toContain('updateNode(')
    expect(applyCanonicalMoves).not.toContain('applyNodeChanges(')
    expect(applyCanonicalMoves).not.toContain('setNodes(nodes.value)')
  })

  it('forces a store-to-vueflow sync after tidy writes settle', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/CanvasView.vue'), 'utf8')
    const handleTidyLayout = source.slice(
      source.indexOf('function handleTidyLayout'),
      source.indexOf('function getCanvasNodeSnapshot')
    )

    expect(handleTidyLayout).toContain('applyCanonicalMoves(groupMoves, taskMoves)')
    expect(handleTidyLayout).toContain('releaseOnDoubleNextTick(release, () => {')
    expect(handleTidyLayout).toContain('syncNodes(undefined, { force: true })')
    expect(handleTidyLayout).toContain('}, pendingWrites)')
  })

  it('waits for group persistence as part of the Tidy completion barrier', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/composables/canvas/useTidyLayout.ts'), 'utf8')
    const tidy = source.slice(source.indexOf('function tidyDayGroups'), source.indexOf('function planReorderColumn'))

    expect(tidy).toContain('pendingWrites.push(canvasStore.updateGroup')
    expect(tidy).toContain('const pendingWritesWithUndo = Promise.all(pendingWrites)')
  })

  it('publishes a new controlled nodes array after Vue Flow applies node changes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/composables/canvas/useCanvasOrchestrator.ts'), 'utf8')
    const handleNodesChange = source.slice(
      source.indexOf('handleNodesChange:'),
      source.indexOf('handleEdgesChange:')
    )

    expect(handleNodesChange).toContain('const nextNodes = applyNodeChanges(')
    expect(handleNodesChange).toContain('nodes.value = [...nextNodes]')
  })

  it('preserves group dimensions on the forced sync after tidy', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/composables/canvas/useCanvasSync.ts'), 'utf8')
    const groupNodeCreation = source.slice(
      source.indexOf('const groupWidth ='),
      source.indexOf('// ================================================================\n            // PROCESS TASKS')
    )

    expect(groupNodeCreation).toContain('const groupWidth = group.position?.width || CANVAS.DEFAULT_GROUP_WIDTH')
    expect(groupNodeCreation).toContain('width: groupWidth')
    expect(groupNodeCreation).toContain('height: groupHeight')
    expect(groupNodeCreation).toContain('dimensions: {')
    expect(groupNodeCreation).toContain('width: `${groupWidth}px`')
    expect(groupNodeCreation).toContain('height: `${groupHeight}px`')
  })

  it('keeps cached group data dimensions aligned with rendered bounds', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/CanvasView.vue'), 'utf8')
    const applyCanonicalMoves = source.slice(
      source.indexOf('function applyCanonicalMoves'),
      source.indexOf('const dayRotation = useDayGroupRotation')
    )

    expect(applyCanonicalMoves).toContain('data: {')
    expect(applyCanonicalMoves).toContain('node.data?.dimensions')
    expect(applyCanonicalMoves).toContain('width: groupMove.size.width')
    expect(applyCanonicalMoves).toContain('height: groupMove.size.height')
  })
})

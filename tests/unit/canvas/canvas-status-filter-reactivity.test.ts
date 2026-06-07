import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Canvas status filter banner reactivity', () => {
  it('passes a computed status filter wrapper to CanvasStatusBanner', () => {
    const canvasView = source('src/views/CanvasView.vue')

    expect(canvasView).toContain("import { computed, ref, markRaw")
    expect(canvasView).toContain('const activeStatusFilter = computed(() => taskStore.activeStatusFilter)')
    expect(canvasView).toContain(':active-status-filter="activeStatusFilter"')
    expect(canvasView).not.toContain(':active-status-filter="taskStore.activeStatusFilter"')
  })
})

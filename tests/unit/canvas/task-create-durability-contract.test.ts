import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Canvas task create durability contract', () => {
  it('lets the async owner close the create modal only after durable creation succeeds', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../src/components/canvas/CanvasModals.vue'),
      'utf8'
    )
    const handler = source.match(
      /const handleQuickTaskCreate = \(data: QuickTaskData\) => \{([\s\S]*?)\n\}/
    )?.[1]

    expect(handler).toBeDefined()
    expect(handler).toContain("emit('handleQuickTaskCreate', data)")
    expect(handler).not.toContain('modals.closeQuickTaskCreate()')
  })
})

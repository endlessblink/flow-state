import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('canvas inbox collapsed hit target', () => {
  it('keeps the right-side panel and collapse control pointer-active above Vue Flow', () => {
    const source = readFileSync(resolve(__dirname, '../../../src/assets/canvas-view-layout.css'), 'utf8')
    const header = readFileSync(resolve(__dirname, '../../../src/components/inbox/unified/UnifiedInboxHeader.vue'), 'utf8')

    expect(source).toMatch(/\.unified-inbox-panel\.is-right-side\)[\s\S]*?z-index:\s*1100[\s\S]*?pointer-events:\s*auto/)
    expect(source).toContain('.unified-inbox-panel.is-right-side .inbox-header')
    expect(source).toContain('.unified-inbox-panel.is-right-side .collapse-btn')
    expect(header).toContain("$emit('toggle-collapse')")
    expect(header).not.toContain("$emit('toggleCollapse')")
  })
})

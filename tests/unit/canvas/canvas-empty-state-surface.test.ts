import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Canvas empty-state surface', () => {
  it('stays opaque when global flat mode disables backdrop blur', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/canvas/CanvasEmptyState.vue'),
      'utf8',
    )
    const block = source.match(/\.empty-card\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

    expect(block).toContain('background: var(--overlay-component-bg)')
    expect(block).toContain('border: var(--overlay-component-border)')
    expect(block).toContain('box-shadow: var(--overlay-component-shadow)')
    expect(block).not.toContain('background: var(--glass-bg-soft)')
  })
})

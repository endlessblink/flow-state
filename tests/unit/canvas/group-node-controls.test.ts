import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = resolve(__dirname, '../../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

describe('canvas group node controls', () => {
  it('keeps the collapse button isolated from Vue Flow drag and pan handling', () => {
    const source = readSource('src/components/canvas/GroupNodeSimple.vue')
    const buttonStart = source.indexOf('<button\n        class="collapse-btn nodrag nopan"')
    const buttonEnd = source.indexOf('>', buttonStart)
    const button = source.slice(buttonStart, buttonEnd)

    expect(buttonStart).toBeGreaterThan(-1)
    expect(button).toContain('@pointerdown.stop')
    expect(button).toContain('@mousedown.stop')
    expect(button).toContain('@touchstart.stop')
    expect(button).toContain('@click.stop.prevent="toggleCollapse"')
  })
})

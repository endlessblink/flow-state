import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Catalog desktop layout regression', () => {
  it('keeps Catalog controls out of the global application header', () => {
    const header = read('src/layouts/AppHeader.vue')

    expect(header).not.toContain('CatalogViewSummary')
    expect(header).not.toContain('global-order-summary')
    expect(header).not.toContain('catalog-view-summary')
  })

  it('uses one shared column track contract with enough room between priority and due date', () => {
    const rows = read('src/components/tasks/HierarchicalTaskRow.css')
    const list = read('src/components/tasks/TaskList.vue')

    expect(list).toContain('--catalog-task-columns:')
    expect(rows).toMatch(/priority[^\n]*96px[^\n]*due[^\n]*104px/)
    expect(list).toContain('grid-template-columns: var(--catalog-task-columns)')
  })
})

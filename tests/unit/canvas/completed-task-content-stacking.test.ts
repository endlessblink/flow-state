import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const taskNodeSource = readFileSync(
  resolve(__dirname, '../../../src/components/canvas/TaskNode.vue'),
  'utf8',
)

describe('completed Canvas task rendering', () => {
  it('keeps task content above the completed-state overlay', () => {
    const contentRule = taskNodeSource.match(/\.task-node-content\s*\{([\s\S]*?)\}/)?.[1]
    const overlayRule = taskNodeSource.match(/\.task-node::before\s*\{([\s\S]*?)\}/)?.[1]

    expect(contentRule).toBeDefined()
    expect(overlayRule).toBeDefined()
    expect(contentRule).toMatch(/z-index:\s*2\s*;/)
    expect(overlayRule).toMatch(/z-index:\s*1\s*;/)
  })
})

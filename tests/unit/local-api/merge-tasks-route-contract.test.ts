import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../../../server/local-api/server.cjs'), 'utf8')

describe('Local API duplicate merge route contract', () => {
  it('keeps the preview/apply merge route behind signed-in bearer protection', () => {
    const tokenBoundary = source.indexOf('if (TOKEN)')
    const route = source.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)\\/merge$/)")
    expect(route).toBeGreaterThan(tokenBoundary)
    expect(source).toContain('return await handleMergeTasks(decodeURIComponent(mergeTasksMatch[1]), req, res)')
  })

  it('uses the active workspace context and renderer mutation reconciliation', () => {
    expect(source).toContain('executeMergeTasks(ctx, survivorId, body, notifyTaskMutation)')
    expect(source).toContain("const { executeMergeTasks } = require('./merge-tasks.cjs')")
  })
})

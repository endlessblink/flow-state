import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../../../server/local-api/server.cjs'), 'utf8')

describe('Local API non-recurring completion route contract', () => {
  it('keeps the preview/apply completion route behind signed-in bearer protection', () => {
    const tokenBoundary = source.indexOf('if (TOKEN)')
    const route = source.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)\\/complete$/)")
    expect(route).toBeGreaterThan(tokenBoundary)
    expect(source).toContain('return await handleCompleteTask(decodeURIComponent(completeTaskMatch[1]), req, res)')
  })

  it('uses the active workspace context and renderer mutation reconciliation', () => {
    expect(source).toContain('executeCompleteTask(ctx, id, body, notifyTaskMutation)')
    expect(source).toContain("const { executeCompleteTask } = require('./complete-task.cjs')")
  })
})

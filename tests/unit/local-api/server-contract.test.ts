import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SERVER_CJS = readFileSync(
  resolve(__dirname, '../../../server/local-api/server.cjs'),
  'utf-8',
)

function functionBody(name: string): string {
  const start = SERVER_CJS.indexOf(`function ${name}(`)
  const asyncStart = SERVER_CJS.indexOf(`async function ${name}(`)
  const fnStart = start === -1 ? asyncStart : start
  expect(fnStart, `${name} not found`).toBeGreaterThan(-1)

  const nextSection = SERVER_CJS.indexOf('\n// ---', fnStart + name.length)
  return SERVER_CJS.slice(fnStart, nextSection === -1 ? undefined : nextSection)
}

describe('Local API sidecar timer endpoint regression contract', () => {
  it('exposes GET /api/timer/current before Life OS bearer-token protected task routes', () => {
    const timerRoute = SERVER_CJS.indexOf("path === '/api/timer/current'")
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')
    const tasksRoute = SERVER_CJS.indexOf("path === '/api/tasks'")

    expect(timerRoute, 'timer route not found').toBeGreaterThan(-1)
    expect(tokenCheck, 'token check not found').toBeGreaterThan(-1)
    expect(tasksRoute, 'tasks route not found').toBeGreaterThan(-1)
    expect(timerRoute).toBeLessThan(tokenCheck)
    expect(tasksRoute).toBeGreaterThan(tokenCheck)
  })

  it('serves a renderer-owned KDE timer snapshot before requiring Supabase auth context', () => {
    const ctxCheck = SERVER_CJS.indexOf("if (!ctx) return send(res, 503, { error: 'not signed in' })")
    const timerRoute = SERVER_CJS.indexOf("path === '/api/timer/current'")
    const localSnapshotCheck = SERVER_CJS.indexOf('const localTimer = getLocalTimerResponse()')

    expect(ctxCheck, 'auth context check not found').toBeGreaterThan(-1)
    expect(timerRoute, 'timer route not found').toBeGreaterThan(-1)
    expect(localSnapshotCheck, 'local timer snapshot check not found').toBeGreaterThan(-1)
    expect(timerRoute).toBeLessThan(ctxCheck)
    expect(localSnapshotCheck).toBeGreaterThan(timerRoute)
    expect(localSnapshotCheck).toBeLessThan(ctxCheck)
  })

  it('queries only the current user active timer session and returns an inactive payload when absent', () => {
    const body = functionBody('handleGetCurrentTimer')

    expect(body).toContain(".from('timer_sessions')")
    expect(body).toContain(".eq('user_id', userId)")
    expect(body).toContain(".eq('is_active', true)")
    expect(body).toContain(".order('updated_at', { ascending: false })")
    expect(body).toContain('.limit(1)')
    expect(body).toContain('.maybeSingle()')
    expect(body).toContain('return send(res, 200, { active: false, session: null })')
    expect(body).toContain('send(res, 200, { active: true, session: data })')
  })

  it('exposes signed-in local timer controls before the external-app bearer token boundary', () => {
    const controlRoute = SERVER_CJS.indexOf("path === '/api/timer/control'")
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')

    expect(controlRoute, 'timer control route not found').toBeGreaterThan(-1)
    expect(controlRoute).toBeLessThan(tokenCheck)

    const body = functionBody('handlePostTimerControl')
    expect(body).toContain("action === 'toggle'")
    expect(body).toContain("action === 'start'")
    expect(body).toContain(".from('timer_sessions')")
    expect(body).toContain(".eq('user_id', userId)")
    expect(body).toContain("device_leader_id: 'kde-widget'")
    expect(body).toContain("send(res, 400, { error: 'action must be toggle|start' })")
  })

  it('keeps task endpoints behind the bearer token used by external local apps', () => {
    const tokenBlockStart = SERVER_CJS.indexOf('if (TOKEN)')
    const tokenBlock = SERVER_CJS.slice(tokenBlockStart, tokenBlockStart + 220)

    expect(tokenBlock).toContain('req.headers.authorization')
    expect(tokenBlock).toContain('Bearer ${TOKEN}')
    expect(tokenBlock).toContain('return send(res, 401')
  })

  it('keeps AI clarification runtime endpoints behind the same signed-in and bearer-token boundary', () => {
    const ctxCheck = SERVER_CJS.indexOf("if (!ctx) return send(res, 503, { error: 'not signed in' })")
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')
    const startRoute = SERVER_CJS.indexOf("path === '/api/ai/clarifications/start'")
    const resumeRoute = SERVER_CJS.indexOf("path.match(/^\\/api\\/ai\\/clarifications\\/([^/]+)\\/resume$/)")

    expect(startRoute, 'AI clarification start route not found').toBeGreaterThan(-1)
    expect(resumeRoute, 'AI clarification resume route not found').toBeGreaterThan(-1)
    expect(ctxCheck).toBeLessThan(startRoute)
    expect(tokenCheck).toBeLessThan(startRoute)
    expect(tokenCheck).toBeLessThan(resumeRoute)
  })

  it('creates the Mastra AI runtime from the configured local API data directory', () => {
    expect(SERVER_CJS).toContain("const DATA_DIR = process.env.FLOW_STATE_API_DATA_DIR || join(process.cwd(), '.flowstate-local-api')")
    expect(SERVER_CJS).toContain('createAIMastraRuntime({ dataDir: DATA_DIR })')
  })
})

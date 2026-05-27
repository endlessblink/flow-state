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

  it('still requires a signed-in auth context before serving the KDE timer snapshot', () => {
    const ctxCheck = SERVER_CJS.indexOf("if (!ctx) return send(res, 503, { error: 'not signed in' })")
    const timerRoute = SERVER_CJS.indexOf("path === '/api/timer/current'")

    expect(ctxCheck, 'auth context check not found').toBeGreaterThan(-1)
    expect(timerRoute, 'timer route not found').toBeGreaterThan(-1)
    expect(ctxCheck).toBeLessThan(timerRoute)
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

  it('keeps task endpoints behind the bearer token used by external local apps', () => {
    const tokenBlockStart = SERVER_CJS.indexOf('if (TOKEN)')
    const tokenBlock = SERVER_CJS.slice(tokenBlockStart, tokenBlockStart + 220)

    expect(tokenBlock).toContain('req.headers.authorization')
    expect(tokenBlock).toContain('Bearer ${TOKEN}')
    expect(tokenBlock).toContain('return send(res, 401')
  })
})

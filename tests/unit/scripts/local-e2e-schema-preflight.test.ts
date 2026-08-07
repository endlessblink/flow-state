import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'scripts/check-local-e2e-canonical-schema.cjs')

describe('local E2E canonical schema preflight', () => {
  it('accepts a readable canonical change log', () => {
    const { evaluateCanonicalSchemaResponse } = require(modulePath) as {
      evaluateCanonicalSchemaResponse: (status: number, body: string) => { ok: boolean; reason?: string }
    }

    expect(evaluateCanonicalSchemaResponse(200, '[]')).toEqual({ ok: true })
  })

  it('rejects schema-cache responses where the canonical change log is absent', () => {
    const { evaluateCanonicalSchemaResponse } = require(modulePath) as {
      evaluateCanonicalSchemaResponse: (status: number, body: string) => { ok: boolean; reason?: string }
    }

    expect(evaluateCanonicalSchemaResponse(
      404,
      '{"code":"PGRST205","message":"Could not find the table public.canonical_change_log"}'
    )).toEqual({
      ok: false,
      reason: 'Local Supabase is missing public.canonical_change_log; apply current migrations before E2E'
    })
  })

  it('rejects a stale done-for-now receipt signature', () => {
    const { evaluateCanonicalSchemaResponse } = require(modulePath) as {
      evaluateCanonicalSchemaResponse: (status: number, body: string, surface?: string) => { ok: boolean; reason?: string }
    }

    expect(evaluateCanonicalSchemaResponse(
      404,
      '{"code":"PGRST202","message":"Could not find the function public.flowstate_done_for_now with parameter p_request_hash"}',
      'done-for-now receipt'
    )).toEqual({
      ok: false,
      reason: 'Local Supabase has a stale done-for-now receipt contract; apply current migrations before E2E'
    })
  })

  it('marks transient schema-cache responses as retryable by the preflight', () => {
    const source = require('node:fs').readFileSync(modulePath, 'utf8') as string

    expect(source).toContain("body.includes('PGRST205')")
    expect(source).toContain('attempt <= 10')
    expect(source).toContain('setTimeout(resolve, 1000)')
  })
})

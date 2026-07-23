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
})

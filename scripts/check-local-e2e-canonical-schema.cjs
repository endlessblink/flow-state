#!/usr/bin/env node

function evaluateCanonicalSchemaResponse(status, body, surface = 'canonical change log') {
  if (status >= 200 && status < 300) return { ok: true }
  if (surface === 'done-for-now receipt' && body.includes('PGRST202')) {
    return {
      ok: false,
      reason: 'Local Supabase has a stale done-for-now receipt contract; apply current migrations before E2E'
    }
  }
  if (body.includes('canonical_change_log') || body.includes('PGRST205')) {
    return {
      ok: false,
      reason: 'Local Supabase is missing public.canonical_change_log; apply current migrations before E2E'
    }
  }
  return {
    ok: false,
    reason: `Local canonical schema preflight failed with HTTP ${status}`
  }
}

async function main() {
  const baseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const response = await fetch(
    `${baseUrl}/rest/v1/canonical_change_log?select=change_sequence&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      }
    }
  )
  const body = await response.text()
  const result = evaluateCanonicalSchemaResponse(response.status, body)
  if (!result.ok) throw new Error(result.reason)

  const doneForNowResponse = await fetch(
    `${baseUrl}/rest/v1/rpc/flowstate_done_for_now`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_next_due_date: null,
        p_preview: true,
        p_preview_version: null,
        p_request_hash: null,
        p_request_id: null,
        p_task_id: '00000000-0000-4000-8000-000000000000',
        p_workspace_id: null
      })
    }
  )
  const doneForNowBody = await doneForNowResponse.text()
  const doneForNowResult = evaluateCanonicalSchemaResponse(
    doneForNowResponse.status,
    doneForNowBody,
    'done-for-now receipt'
  )
  if (!doneForNowResult.ok) throw new Error(doneForNowResult.reason)
  process.stdout.write('Local canonical E2E schema is ready.\n')
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

module.exports = { evaluateCanonicalSchemaResponse }

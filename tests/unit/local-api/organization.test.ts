import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/organization.cjs')
const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')) as {
  canonicalHash: (value: unknown) => string
}

type HandlerResult = { status: number; body: Record<string, any> }
type OrganizationModule = {
  readOrganizationInventory: (context: Record<string, any>, deps?: Record<string, any>) => Promise<HandlerResult>
  executeOrganizationCommand: (
    context: Record<string, any>,
    action: 'assign_project' | 'set_canvas_group',
    taskId: string,
    body: Record<string, unknown>,
    notifyTaskMutation: ReturnType<typeof vi.fn>,
  ) => Promise<HandlerResult>
}

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const taskId = '11111111-1111-4111-8111-111111111111'
const projectId = '22222222-2222-4222-8222-222222222222'
const groupId = '33333333-3333-4333-8333-333333333333'
const operationId = 'organization-operation-1'
const requestHash = 'a'.repeat(64)
const previewDigest = 'b'.repeat(64)
const previewExpiresAt = '2026-07-16T12:15:00.000Z'

function loadModule(): OrganizationModule {
  return require(modulePath) as OrganizationModule
}

function context(rpc = vi.fn(), activeWorkspaceId: string | null = workspaceId) {
  return {
    supabase: { rpc },
    userId: '00000000-0000-4000-8000-000000000001',
    activeWorkspaceId,
    signedUser: true,
  }
}

function target(action: 'assign_project' | 'set_canvas_group') {
  return action === 'assign_project' ? { projectId } : { groupId }
}

function previewFor(action: 'assign_project' | 'set_canvas_group', overrides: Record<string, unknown> = {}) {
  const position = {
    x: 120,
    y: 48,
    width: 320,
    parentId: action === 'set_canvas_group' ? groupId : 'old-group',
  }
  return {
    ok: true,
    result: 'preview',
    preview: true,
    contractVersion: 'task-v1',
    operationId,
    action,
    taskId,
    baseRevision: 7,
    requestHash,
    previewDigest,
    previewExpiresAt,
    normalizedPayload: { taskId, ...target(action) },
    readBack: {
      id: taskId,
      workspaceId,
      canonicalRevision: 7,
      canonicalUpdatedAt: '2026-07-16T12:00:00.000Z',
      projectId: action === 'assign_project' ? projectId : null,
      position,
      isInInbox: action === 'set_canvas_group' ? false : true,
    },
    ...overrides,
  }
}

function committedFor(action: 'assign_project' | 'set_canvas_group', overrides: Record<string, unknown> = {}) {
  const readBack = {
    id: taskId,
    workspaceId,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-16T12:01:00.000Z',
    projectId: action === 'assign_project' ? projectId : null,
    isInInbox: action === 'set_canvas_group' ? false : true,
    position: {
      x: 120,
      y: 48,
      width: 320,
      custom: { locked: true },
      parentId: action === 'set_canvas_group' ? groupId : 'old-group',
    },
  }
  const receipt = {
    ok: true,
    status: 'committed',
    replayed: false,
    operationId,
    requestHash,
    contractVersion: 'task-v1',
    source: 'local-api',
    entityType: 'task',
    action,
    entityId: taskId,
    canonicalRevision: 8,
    canonicalUpdatedAt: readBack.canonicalUpdatedAt,
    changeSequence: 71,
    committedAt: '2026-07-16T12:01:00.010Z',
    readBack,
    readBackHash: canonicalHash(readBack),
    affected: [
      {
        entityType: 'task',
        entityId: taskId,
        action: 'update',
        canonicalRevision: 8,
        changeSequence: 71,
        readBack,
        readBackHash: canonicalHash(readBack),
      },
    ],
    operationContext: {
      action,
      taskId,
      baseRevision: 7,
      ...target(action),
      workspaceId,
    },
    ...overrides,
  }
  return { ok: true, result: 'committed', requestHash, receipt }
}

const applyBody = {
  preview: false,
  operationId,
  baseRevision: 7,
  previewDigest,
  previewExpiresAt,
  requestHash,
}

describe('canonical organization inventory', () => {
  it('returns exact personal project and group identities without crossing scope', async () => {
    const fetchProjects = vi.fn().mockResolvedValue({
      data: [
        {
          id: projectId,
          name: 'Personal launch',
          parent_id: null,
          color: '#abcdef',
          color_type: 'hex',
          workspace_id: null,
          updated_at: '2026-07-16T11:00:00.000Z',
        },
      ],
      error: null,
    })
    const fetchGroups = vi.fn().mockResolvedValue({
      data: [
        {
          id: groupId,
          name: 'Writing',
          type: 'custom',
          parent_group_id: null,
          workspace_id: null,
          is_power_mode: false,
          auto_collect: false,
          filters_json: null,
          power_keyword_json: null,
          assign_on_drop_json: null,
          collect_filter_json: null,
          updated_at: '2026-07-16T11:01:00.000Z',
        },
      ],
      error: null,
    })

    const result = await loadModule().readOrganizationInventory(context(vi.fn(), null), { fetchProjects, fetchGroups })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      ok: true,
      fresh: true,
      contractVersion: 'organization-inventory-v1',
      scopeKind: 'personal',
      workspaceId: null,
      projects: [
        {
          id: projectId,
          name: 'Personal launch',
          parentId: null,
          color: '#abcdef',
          colorType: 'hex',
          workspaceId: null,
          updatedAt: '2026-07-16T11:00:00.000Z',
        },
      ],
      groups: [
        {
          id: groupId,
          name: 'Writing',
          type: 'custom',
          parentGroupId: null,
          workspaceId: null,
          assignmentMode: 'plain',
          updatedAt: '2026-07-16T11:01:00.000Z',
        },
      ],
    })
    expect(fetchProjects).toHaveBeenCalledWith(expect.objectContaining({ activeWorkspaceId: null }))
    expect(fetchGroups).toHaveBeenCalledWith(expect.objectContaining({ activeWorkspaceId: null }))
  })

  it('verifies active workspace read authority and marks smart groups unsupported', async () => {
    const verifyWorkspaceAccess = vi.fn().mockResolvedValue({ data: true, error: null })
    const workspaceContext = context()
    const result = await loadModule().readOrganizationInventory(workspaceContext, {
      verifyWorkspaceAccess,
      fetchProjects: async () => ({ data: [], error: null }),
      fetchGroups: async () => ({
        data: [
          {
            id: groupId,
            name: 'Today',
            type: 'timeline',
            parent_group_id: null,
            workspace_id: workspaceId,
            is_power_mode: true,
            auto_collect: true,
            filters_json: { due: 'today' },
            power_keyword_json: { kind: 'today' },
            assign_on_drop_json: { dueDate: 'today' },
            collect_filter_json: { due: 'today' },
            updated_at: '2026-07-16T11:01:00.000Z',
          },
        ],
        error: null,
      }),
    })

    expect(result.status).toBe(200)
    expect(verifyWorkspaceAccess).toHaveBeenCalledWith(workspaceContext.supabase, workspaceId)
    expect(result.body.groups[0].assignmentMode).toBe('unsupported_smart')
  })

  it('treats unknown smart-group flags as unsupported instead of guessing', async () => {
    const result = await loadModule().readOrganizationInventory(context(), {
      verifyWorkspaceAccess: async () => ({ data: true, error: null }),
      fetchProjects: async () => ({ data: [], error: null }),
      fetchGroups: async () => ({
        data: [
          {
            id: groupId,
            name: 'Unknown semantics',
            type: 'custom',
            parent_group_id: null,
            workspace_id: workspaceId,
            is_power_mode: null,
            auto_collect: false,
            filters_json: null,
            power_keyword_json: null,
            assign_on_drop_json: null,
            collect_filter_json: null,
            updated_at: '2026-07-16T11:01:00.000Z',
          },
        ],
        error: null,
      }),
    })

    expect(result.status).toBe(200)
    expect(result.body.groups[0].assignmentMode).toBe('unsupported_smart')
  })

  it('fails closed before inventory reads when workspace authority is absent', async () => {
    const fetchProjects = vi.fn()
    const fetchGroups = vi.fn()
    const result = await loadModule().readOrganizationInventory(context(), {
      verifyWorkspaceAccess: async () => ({ data: false, error: null }),
      fetchProjects,
      fetchGroups,
    })

    expect(result.status).toBe(403)
    expect(result.body.error.code).toBe('scope_denied')
    expect(fetchProjects).not.toHaveBeenCalled()
    expect(fetchGroups).not.toHaveBeenCalled()
  })
})

describe.each(['assign_project', 'set_canvas_group'] as const)('canonical organization command %s', (action) => {
  it('forwards exact identity, revision, scope, and preview bindings', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: previewFor(action), error: null })
    const result = await loadModule().executeOrganizationCommand(
      context(rpc),
      action,
      taskId,
      { operationId, baseRevision: 7, ...target(action) },
      vi.fn(),
    )

    expect(result.status).toBe(200)
    expect(result.body.result).toBe('preview')
    expect(rpc).toHaveBeenCalledWith('flowstate_organization_task_v1', {
      p_action: action,
      p_base_revision: 7,
      p_contract_version: 'task-v1',
      p_operation_id: operationId,
      p_preview: true,
      p_preview_digest: null,
      p_preview_expires_at: null,
      p_request_hash: null,
      p_source: 'local-api',
      p_target_id: action === 'assign_project' ? projectId : groupId,
      p_task_id: taskId,
      p_workspace_id: workspaceId,
    })
  })

  it('accepts only a canonical receipt bound to the exact approved target', async () => {
    const payload = committedFor(action)
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null })
    const notify = vi.fn()
    const result = await loadModule().executeOrganizationCommand(
      context(rpc),
      action,
      taskId,
      { ...applyBody, ...target(action) },
      notify,
    )

    expect(result).toEqual({ status: 200, body: payload })
    expect(notify).toHaveBeenCalledWith('update', taskId)
    expect(payload.receipt.readBack.position).toMatchObject({
      x: 120,
      y: 48,
      width: 320,
      custom: { locked: true },
    })
    if (action === 'set_canvas_group') expect(payload.receipt.readBack.isInInbox).toBe(false)
  })

  it('does not notify renderer again for a durable response-loss replay', async () => {
    const payload = committedFor(action)
    payload.receipt.status = 'replayed'
    payload.receipt.replayed = true
    const notify = vi.fn()

    const result = await loadModule().executeOrganizationCommand(
      context(vi.fn().mockResolvedValue({ data: payload, error: null })),
      action,
      taskId,
      { ...applyBody, ...target(action) },
      notify,
    )

    expect(result.status).toBe(200)
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects forged receipt identity before renderer notification', async () => {
    const payload = committedFor(action)
    payload.receipt.operationContext = {
      ...payload.receipt.operationContext,
      ...(action === 'assign_project'
        ? { projectId: '44444444-4444-4444-8444-444444444444' }
        : { groupId: '44444444-4444-4444-8444-444444444444' }),
    }
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null })
    const notify = vi.fn()

    const result = await loadModule().executeOrganizationCommand(
      context(rpc),
      action,
      taskId,
      { ...applyBody, ...target(action) },
      notify,
    )

    expect(result.status).toBe(502)
    expect(result.body.error.code).toBe('invalid_canonical_receipt')
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects a preview whose exact target readback does not match', async () => {
    const wrongTarget = '44444444-4444-4444-8444-444444444444'
    const payload = previewFor(action)
    if (action === 'assign_project') payload.readBack.projectId = wrongTarget
    else payload.readBack.position.parentId = wrongTarget
    const result = await loadModule().executeOrganizationCommand(
      context(vi.fn().mockResolvedValue({ data: payload, error: null })),
      action,
      taskId,
      { operationId, baseRevision: 7, ...target(action) },
      vi.fn(),
    )

    expect(result.status).toBe(502)
    expect(result.body.error.code).toBe('invalid_canonical_response')
  })
})

describe('organization validation and fail-closed errors', () => {
  it('requires signed-user identity, exact target ID, and apply approval bindings', async () => {
    const notify = vi.fn()
    const module = loadModule()

    const unsigned = await module.executeOrganizationCommand(
      { ...context(), signedUser: false },
      'assign_project',
      taskId,
      { operationId, baseRevision: 7, projectId },
      notify,
    )
    const missingTarget = await module.executeOrganizationCommand(
      context(),
      'set_canvas_group',
      taskId,
      { operationId, baseRevision: 7 },
      notify,
    )
    const missingApproval = await module.executeOrganizationCommand(
      context(),
      'assign_project',
      taskId,
      { preview: false, operationId, baseRevision: 7, projectId },
      notify,
    )
    const invalidScope = await module.executeOrganizationCommand(
      { ...context(), activeWorkspaceId: '' },
      'assign_project',
      taskId,
      { operationId, baseRevision: 7, projectId },
      notify,
    )

    expect(unsigned.status).toBe(401)
    expect(missingTarget.body.error.code).toBe('invalid_request')
    expect(missingApproval.body.error.code).toBe('approval_receipt_required')
    expect(invalidScope.body.error.code).toBe('invalid_request')
  })

  it('rejects ambiguous target fields and unknown request fields', async () => {
    const module = loadModule()
    const bothTargets = await module.executeOrganizationCommand(
      context(),
      'assign_project',
      taskId,
      { operationId, baseRevision: 7, projectId, groupId },
      vi.fn(),
    )
    const unknownField = await module.executeOrganizationCommand(
      context(),
      'set_canvas_group',
      taskId,
      { operationId, baseRevision: 7, groupId, guessedName: 'Writing' },
      vi.fn(),
    )

    expect(bothTargets.body.error.code).toBe('invalid_request')
    expect(unknownField.body.error.code).toBe('invalid_request')
  })

  it.each([
    ['task_not_found', 404],
    ['project_not_found', 404],
    ['group_not_found', 404],
    ['scope_denied', 403],
    ['unsupported_smart_group', 409],
    ['invalid_task_position', 409],
    ['stale_revision', 409],
    ['preview_mismatch', 409],
  ])('preserves typed domain error %s', async (code, status) => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: false,
        result: 'rejected',
        error: { code, message: 'fail closed' },
      },
      error: null,
    })
    const result = await loadModule().executeOrganizationCommand(
      context(rpc),
      'assign_project',
      taskId,
      { operationId, baseRevision: 7, projectId },
      vi.fn(),
    )

    expect(result.status).toBe(status)
    expect(result.body.error.code).toBe(code)
  })
})

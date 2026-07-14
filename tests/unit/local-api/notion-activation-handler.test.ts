import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(
  process.cwd(),
  'server/local-api/notion-activation.cjs',
)
const serverPath = resolve(process.cwd(), 'server/local-api/server.cjs')
const moduleExists = existsSync(modulePath)
const serverSource = readFileSync(serverPath, 'utf8')

const request = {
  operationId: 'notion-operation-1',
  notion: {
    pageId: 'notion-page-1',
    dataSourceId: 'notion-database-1',
    url: 'https://www.notion.so/notion-page-1',
    lastEditedAt: '2026-07-14T08:00:00.000Z',
  },
  task: {
    title: 'Clarify Bina landing page',
    description: 'Define the next concrete action',
    priority: 'high',
    dueDate: '2026-07-15T12:00:00.000Z',
    projectId: null,
  },
  workBlock: {
    scheduledDate: '2026-07-14',
    scheduledTime: '10:30',
    duration: 25,
  },
}

const preview = {
  ok: true,
  result: 'preview',
  contractVersion: 'notion-activation-v1',
  operationId: request.operationId,
  previewDigest: 'a'.repeat(64),
  previewExpiresAt: '2026-07-14T08:15:00.000Z',
  alreadyActivated: false,
  normalizedPayload: {
    operationId: request.operationId,
    notionPageId: request.notion.pageId,
    notionDataSourceId: request.notion.dataSourceId,
    notionUrl: request.notion.url,
    notionLastEditedAt: request.notion.lastEditedAt,
    task: request.task,
    workBlock: request.workBlock,
  },
  readBack: null,
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

function receipt(overrides: Record<string, unknown> = {}) {
  const readBack = {
    id: 'task-notion-1',
    title: request.task.title,
    description: request.task.description,
    priority: request.task.priority,
    dueDate: request.task.dueDate,
    projectId: request.task.projectId,
    canonicalRevision: 1,
    canonicalUpdatedAt: '2026-07-14T08:01:00.000Z',
    externalSource: 'notion',
    externalId: request.notion.pageId,
    externalDataSourceId: request.notion.dataSourceId,
    externalUrl: request.notion.url,
    externalLastEditedAt: request.notion.lastEditedAt,
    provenance: {
      source: 'notion',
      externalId: request.notion.pageId,
      dataSourceId: request.notion.dataSourceId,
      url: request.notion.url,
      lastEditedAt: request.notion.lastEditedAt,
    },
    instances: [request.workBlock],
  }
  return {
    contractVersion: 'notion-activation-v1',
    operationId: request.operationId,
    source: 'notion',
    entityType: 'task',
    action: 'activate',
    entityId: 'task-notion-1',
    externalId: request.notion.pageId,
    canonicalRevision: 1,
    canonicalUpdatedAt: '2026-07-14T08:01:00.000Z',
    changeSequence: 52,
    committedAt: '2026-07-14T08:01:00.010Z',
    replayed: false,
    provenance: {
      source: 'notion',
      externalId: request.notion.pageId,
      dataSourceId: request.notion.dataSourceId,
      url: request.notion.url,
      lastEditedAt: request.notion.lastEditedAt,
    },
    readBack,
    readBackHash: canonicalHash(readBack),
    ...overrides,
  }
}

function harness(data: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null })
  const notifyTaskMutation = vi.fn()
  const { executeNotionActivation } = require(modulePath)
  return { executeNotionActivation, notifyTaskMutation, rpc }
}

const context = (rpc: ReturnType<typeof vi.fn>) => ({
  supabase: { rpc },
  signedUser: true,
  activeWorkspaceId: null,
})

describe('TASK-1948 canonical Notion activation Local API', () => {
  it('ships a dedicated adapter and bearer-protected route', () => {
    expect(moduleExists).toBe(true)
    expect(serverSource).toContain("require('./notion-activation.cjs')")
    const auth = serverSource.indexOf('if (TOKEN)')
    const route = serverSource.indexOf(
      "path === '/api/integrations/notion/activations'",
    )
    expect(route).toBeGreaterThan(auth)
  })

  describe.skipIf(!moduleExists)('adapter contract', () => {
    it('defaults to preview and forwards the exact normalized request', async () => {
      const { executeNotionActivation, notifyTaskMutation, rpc } =
        harness(preview)

      await expect(
        executeNotionActivation(context(rpc), request, notifyTaskMutation),
      ).resolves.toEqual({ status: 200, body: preview })

      expect(rpc).toHaveBeenCalledWith('flowstate_activate_notion_task_v1', {
        p_operation_id: request.operationId,
        p_notion: request.notion,
        p_task: request.task,
        p_work_block: request.workBlock,
        p_preview: true,
        p_preview_digest: null,
        p_preview_expires_at: null,
      })
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('requires exact approval fields before apply', async () => {
      const { executeNotionActivation, notifyTaskMutation, rpc } = harness(null)
      const apply = {
        ...request,
        preview: false,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-14T08:15:00.000Z',
      }

      for (const field of [
        'operationId',
        'previewDigest',
        'previewExpiresAt',
      ]) {
        const body = { ...apply }
        delete body[field as keyof typeof body]
        const result = await executeNotionActivation(
          context(rpc),
          body,
          notifyTaskMutation,
        )
        expect(result.status).toBe(400)
      }
      expect(rpc).not.toHaveBeenCalled()
    })

    it('rejects a preview whose normalized identity or work block changed', async () => {
      for (const normalizedPayload of [
        { ...preview.normalizedPayload, notionPageId: 'another-page' },
        {
          ...preview.normalizedPayload,
          workBlock: { ...request.workBlock, duration: 60 },
        },
      ]) {
        const { executeNotionActivation, notifyTaskMutation, rpc } = harness({
          ...preview,
          normalizedPayload,
        })
        const result = await executeNotionActivation(
          context(rpc),
          request,
          notifyTaskMutation,
        )
        expect(result.status).toBe(502)
        expect(notifyTaskMutation).not.toHaveBeenCalled()
      }
    })

    it('rejects invalid task fields and unknown top-level intent before the RPC', async () => {
      for (const body of [
        { ...request, unexpectedMutation: true },
        { ...request, task: { ...request.task, priority: 'urgent' } },
        {
          ...request,
          notion: { ...request.notion, url: 'http://unsafe.example' },
        },
      ]) {
        const { executeNotionActivation, notifyTaskMutation, rpc } =
          harness(null)
        const result = await executeNotionActivation(
          context(rpc),
          body,
          notifyTaskMutation,
        )
        expect(result.status).toBe(400)
        expect(rpc).not.toHaveBeenCalled()
      }
    })

    it('accepts only a complete identity-bound receipt before notifying', async () => {
      const response = { ok: true, result: 'committed', receipt: receipt() }
      const { executeNotionActivation, notifyTaskMutation, rpc } =
        harness(response)

      const result = await executeNotionActivation(
        context(rpc),
        {
          ...request,
          preview: false,
          previewDigest: 'a'.repeat(64),
          previewExpiresAt: '2026-07-14T08:15:00.000Z',
        },
        notifyTaskMutation,
      )

      expect(result).toEqual({ status: 200, body: response })
      expect(notifyTaskMutation).toHaveBeenCalledWith('create', 'task-notion-1')
    })

    it.each([
      ['contractVersion', 'task-v1'],
      ['operationId', 'other-operation'],
      ['source', 'local-api'],
      ['entityType', 'project'],
      ['action', 'patch'],
      ['canonicalRevision', null],
      ['canonicalUpdatedAt', null],
      ['changeSequence', null],
      ['committedAt', null],
      ['readBack', null],
      ['readBackHash', 'bad'],
      ['provenance', null],
    ])(
      'rejects an incomplete or mismatched %s receipt',
      async (field, value) => {
        const response = {
          ok: true,
          result: 'committed',
          receipt: receipt({ [field]: value }),
        }
        const { executeNotionActivation, notifyTaskMutation, rpc } =
          harness(response)
        const result = await executeNotionActivation(
          context(rpc),
          {
            ...request,
            preview: false,
            previewDigest: 'a'.repeat(64),
            previewExpiresAt: '2026-07-14T08:15:00.000Z',
          },
          notifyTaskMutation,
        )

        expect(result.status).toBe(502)
        expect(notifyTaskMutation).not.toHaveBeenCalled()
      },
    )

    it('rejects changed direct read-back provenance fields', async () => {
      const canonicalReceipt = receipt()
      canonicalReceipt.readBack.externalUrl = 'https://www.notion.so/other-page'
      const response = {
        ok: true,
        result: 'committed',
        receipt: canonicalReceipt,
      }
      const { executeNotionActivation, notifyTaskMutation, rpc } =
        harness(response)
      const result = await executeNotionActivation(
        context(rpc),
        {
          ...request,
          preview: false,
          previewDigest: 'a'.repeat(64),
          previewExpiresAt: '2026-07-14T08:15:00.000Z',
        },
        notifyTaskMutation,
      )

      expect(result.status).toBe(502)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('rejects a changed task projection even with its matching hash', async () => {
      const canonicalReceipt = receipt()
      canonicalReceipt.readBack.title = 'Different task'
      canonicalReceipt.readBackHash = canonicalHash(canonicalReceipt.readBack)
      const { executeNotionActivation, notifyTaskMutation, rpc } = harness({
        ok: true,
        result: 'committed',
        receipt: canonicalReceipt,
      })
      const result = await executeNotionActivation(
        context(rpc),
        {
          ...request,
          preview: false,
          previewDigest: 'a'.repeat(64),
          previewExpiresAt: '2026-07-14T08:15:00.000Z',
        },
        notifyTaskMutation,
      )

      expect(result.status).toBe(502)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('rejects a read-back projection whose hash no longer matches', async () => {
      const canonicalReceipt = receipt()
      canonicalReceipt.readBack.description = 'Changed after hashing'
      const { executeNotionActivation, notifyTaskMutation, rpc } = harness({
        ok: true,
        result: 'committed',
        receipt: canonicalReceipt,
      })
      const result = await executeNotionActivation(
        context(rpc),
        {
          ...request,
          preview: false,
          previewDigest: 'a'.repeat(64),
          previewExpiresAt: '2026-07-14T08:15:00.000Z',
        },
        notifyTaskMutation,
      )

      expect(result.status).toBe(502)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('refuses service-role mode and redacts connector failures', async () => {
      const { executeNotionActivation, notifyTaskMutation, rpc } =
        harness(preview)
      const denied = await executeNotionActivation(
        { ...context(rpc), signedUser: false },
        request,
        notifyTaskMutation,
      )
      expect(denied.status).toBe(401)
      expect(rpc).not.toHaveBeenCalled()

      rpc.mockRejectedValueOnce(
        new Error('private database and credential detail'),
      )
      const failed = await executeNotionActivation(
        context(rpc),
        request,
        notifyTaskMutation,
      )
      expect(failed.status).toBe(500)
      expect(JSON.stringify(failed)).not.toContain('private database')
    })
  })
})

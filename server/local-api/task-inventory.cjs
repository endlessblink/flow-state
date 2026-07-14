'use strict'

const crypto = require('crypto')
const { scopeTaskQuery } = require('./task-scope.cjs')

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 100
const MAX_PAGES = 1000
const MAX_CONSISTENCY_RETRIES = 3
const INVENTORY_SCOPE = 'all open tasks visible to the authenticated user'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function scopeKey(context) {
  return context.activeWorkspaceId == null
    ? `personal:${context.userId}`
    : `workspace:${context.activeWorkspaceId}`
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function decodeCursor(value, context) {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'))
    if (
      parsed?.v !== 1
      || parsed.scope !== scopeKey(context)
      || typeof parsed.capturedAt !== 'string'
      || typeof parsed.createdAt !== 'string'
      || !UUID_RE.test(parsed.id)
      || Number.isNaN(Date.parse(parsed.capturedAt))
      || Number.isNaN(Date.parse(parsed.createdAt))
    ) return null
    return parsed
  } catch {
    return null
  }
}

function parseTaskInventoryParams(searchParams) {
  const rawLimit = searchParams.get('limit')
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, error: `limit must be an integer from 1 to ${MAX_LIMIT}` }
  }
  const mode = searchParams.get('mode') || 'full'
  if (!['full', 'page'].includes(mode)) {
    return { ok: false, error: 'mode must be full|page' }
  }
  const cursor = searchParams.get('cursor') || null
  if (cursor && mode !== 'page') {
    return { ok: false, error: 'cursor requires mode=page' }
  }
  return { ok: true, limit, mode, cursor }
}

function buildTaskInventoryQuery(context, input) {
  let query = context.supabase
    .from('tasks')
    .select('id,title,status,priority,due_date,project_id,created_at,updated_at,canonical_revision')
    .eq('is_deleted', false)
    .eq('is_completion_record', false)
    .neq('status', 'done')
  query = scopeTaskQuery(context, query)
  if (input.cursor) {
    query = query.or(
      `created_at.gt.${input.cursor.createdAt},and(created_at.eq.${input.cursor.createdAt},id.gt.${input.cursor.id})`,
    )
  }
  return query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(input.limit + 1)
}

async function fetchTaskInventoryPage(input) {
  return await buildTaskInventoryQuery(input.context, input)
}

function scopeChangeQuery(context, query) {
  if (context.activeWorkspaceId == null) {
    return query.eq('user_id', context.userId).is('workspace_id', null)
  }
  return query.eq('workspace_id', context.activeWorkspaceId)
}

async function readScopeChangeSequence(context) {
  let query = context.supabase
    .from('canonical_change_log')
    .select('change_sequence')
    .eq('entity_type', 'task')
  query = scopeChangeQuery(context, query)
  const { data, error } = await query
    .order('change_sequence', { ascending: false })
    .limit(1)
  if (error) return { value: null, error }
  return { value: Number(data?.[0]?.change_sequence) || 0, error: null }
}

async function findInvalidInventoryRow(context) {
  let query = context.supabase
    .from('tasks')
    .select('id')
    .or('is_deleted.is.null,is_completion_record.is.null,status.is.null,created_at.is.null,updated_at.is.null')
  query = scopeTaskQuery(context, query)
  const { data, error } = await query.limit(1)
  return { data: data?.[0] || null, error }
}

function mapTask(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status === 'done' ? 'done' : 'todo',
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
    priority: row.priority ?? null,
    projectId: row.project_id ?? null,
    updatedAt: row.updated_at,
    revision: Number(row.canonical_revision) || 1,
  }
}

function receiptBase(context, input) {
  const rawScope = scopeKey(context)
  return {
    source: 'flowstate',
    scope: INVENTORY_SCOPE,
    scopeKind: context.activeWorkspaceId == null ? 'personal' : 'workspace',
    scopeFingerprint: crypto.createHash('sha256').update(rawScope).digest('hex').slice(0, 16),
    capturedAt: input.capturedAt,
    appVersion: input.appVersion,
    fresh: true,
  }
}

async function readTaskInventoryPage(context, input, deps = {}) {
  const fetchPage = deps.fetchPage || fetchTaskInventoryPage
  const cursor = typeof input.cursor === 'string'
    ? decodeCursor(input.cursor, context)
    : (input.cursor || null)
  if (input.cursor && !cursor) {
    return {
      ...receiptBase(context, input),
      complete: false,
      items: [],
      page: { limit: input.limit, nextCursor: null, hasMore: false },
      error: { code: 'invalid_inventory_cursor', message: 'inventory cursor is invalid or out of scope' },
    }
  }
  const effectiveInput = cursor?.capturedAt
    ? { ...input, capturedAt: cursor.capturedAt }
    : input
  const { data, error } = await fetchPage({
    context,
    limit: effectiveInput.limit,
    capturedAt: effectiveInput.capturedAt,
    cursor,
  })
  if (error) {
    return {
      ...receiptBase(context, effectiveInput),
      complete: false,
      items: [],
      page: {
        limit: effectiveInput.limit,
        nextCursor: cursor ? encodeCursor(cursor) : null,
        hasMore: true,
      },
      error: { code: 'inventory_page_failed', message: 'inventory page could not be read' },
    }
  }

  const invalidRow = (data || []).find((row) => (
    !UUID_RE.test(String(row?.id || ''))
    || typeof row?.created_at !== 'string'
    || Number.isNaN(Date.parse(row.created_at))
    || typeof row?.updated_at !== 'string'
    || Number.isNaN(Date.parse(row.updated_at))
  ))
  if (invalidRow) {
    return {
      ...receiptBase(context, effectiveInput),
      complete: false,
      items: [],
      page: { limit: effectiveInput.limit, nextCursor: null, hasMore: false },
      error: { code: 'invalid_inventory_row', message: 'inventory contained an invalid task identity or timestamp' },
    }
  }

  const unique = []
  const seen = new Set()
  for (const row of data || []) {
    if (!row?.id || seen.has(row.id)) continue
    seen.add(row.id)
    unique.push(row)
  }
  const hasMore = (data || []).length > effectiveInput.limit || unique.length > effectiveInput.limit
  const pageRows = unique.slice(0, effectiveInput.limit)
  const last = pageRows.at(-1)
  const nextCursor = hasMore && last
    ? encodeCursor({
        v: 1,
        scope: scopeKey(context),
        capturedAt: effectiveInput.capturedAt,
        createdAt: last.created_at,
        id: last.id,
      })
    : null
  const result = {
    ...receiptBase(context, effectiveInput),
    complete: false,
    items: pageRows.map(mapTask),
    page: { limit: effectiveInput.limit, nextCursor, hasMore },
  }
  return result
}

async function readCompleteTaskInventory(context, input, deps = {}) {
  const readSequence = deps.readSequence || readScopeChangeSequence
  const findInvalidRow = deps.findInvalidRow || findInvalidInventoryRow

  for (let attempt = 0; attempt < MAX_CONSISTENCY_RETRIES; attempt += 1) {
    const before = await readSequence(context)
    if (before.error || !Number.isSafeInteger(before.value) || before.value < 0) {
      return {
        ...receiptBase(context, input),
        complete: false,
        items: [],
        page: { limit: input.limit, nextCursor: null, hasMore: false },
        error: { code: 'inventory_consistency_unavailable', message: 'inventory change sequence is unavailable' },
      }
    }
    const invalid = await findInvalidRow(context)
    if (invalid.error || invalid.data) {
      return {
        ...receiptBase(context, input),
        complete: false,
        items: [],
        page: { limit: input.limit, nextCursor: null, hasMore: false },
        error: {
          code: invalid.error ? 'inventory_consistency_unavailable' : 'invalid_inventory_row',
          message: invalid.error
            ? 'inventory validity check is unavailable'
            : 'inventory contains legacy rows with missing membership fields',
        },
      }
    }

    const itemsById = new Map()
    let cursor = null
    const seenCursors = new Set()
    let terminalPage = null

    for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber += 1) {
      const page = await readTaskInventoryPage(context, { ...input, cursor }, deps)
      for (const item of page.items) itemsById.set(item.id, item)
      if (page.error) {
        return {
          ...receiptBase(context, input),
          complete: false,
          items: [...itemsById.values()],
          page: page.page,
          error: page.error,
        }
      }
      if (!page.page.hasMore) {
        terminalPage = page
        break
      }
      cursor = page.page.nextCursor
      if (!cursor || seenCursors.has(cursor)) break
      seenCursors.add(cursor)
    }

    if (!terminalPage) {
      return {
        ...receiptBase(context, input),
        complete: false,
        items: [...itemsById.values()],
        page: { limit: input.limit, nextCursor: cursor, hasMore: true },
        error: { code: 'inventory_pagination_stalled', message: 'inventory pagination did not complete' },
      }
    }

    const after = await readSequence(context)
    if (after.error || !Number.isSafeInteger(after.value) || after.value < 0) {
      return {
        ...receiptBase(context, input),
        complete: false,
        items: [...itemsById.values()],
        page: terminalPage.page,
        error: { code: 'inventory_consistency_unavailable', message: 'inventory change sequence is unavailable' },
      }
    }
    if (before.value !== after.value) continue

    const items = [...itemsById.values()]
    return {
      ...receiptBase(context, input),
      changeSequence: after.value,
      complete: true,
      total: items.length,
      items,
      page: { limit: input.limit, nextCursor: null, hasMore: false },
    }
  }

  return {
    ...receiptBase(context, input),
    complete: false,
    items: [],
    page: { limit: input.limit, nextCursor: null, hasMore: true },
    error: { code: 'inventory_changed_during_read', message: 'inventory changed while it was being read; retry' },
  }
}

module.exports = {
  buildTaskInventoryQuery,
  decodeCursor,
  parseTaskInventoryParams,
  readScopeChangeSequence,
  readCompleteTaskInventory,
  readTaskInventoryPage,
}

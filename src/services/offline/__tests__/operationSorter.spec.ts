import { describe, it, expect } from 'vitest'
import {
  sortOperations,
  sortDeleteOperations,
  groupIntoBatches,
  splitByEntityType,
  operationDependsOn,
  buildDependencyGraph,
} from '@/services/offline/operationSorter'
import type { WriteOperation } from '@/types/sync'

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

let _idCounter = 1

function makeOp(
  overrides: Partial<WriteOperation> & Pick<WriteOperation, 'entityType' | 'operation'>
): WriteOperation {
  return {
    id: _idCounter++,
    entityId: 'test-id',
    payload: {},
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// sortOperations
// ---------------------------------------------------------------------------

describe('sortOperations', () => {
  it('returns an empty array for empty input', () => {
    expect(sortOperations([])).toEqual([])
  })

  it('returns the same single-item array (structurally)', () => {
    const op = makeOp({ entityType: 'task', operation: 'create' })
    const result = sortOperations([op])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(op)
  })

  it('places creates before updates before deletes', () => {
    const del = makeOp({ entityType: 'task', operation: 'delete' })
    const upd = makeOp({ entityType: 'task', operation: 'update' })
    const cre = makeOp({ entityType: 'task', operation: 'create' })

    const result = sortOperations([del, upd, cre])

    expect(result[0].operation).toBe('create')
    expect(result[1].operation).toBe('update')
    expect(result[2].operation).toBe('delete')
  })

  it('within the same operation type, orders by entity priority: project → group → task → timer_session', () => {
    const timer = makeOp({ entityType: 'timer_session', operation: 'create' })
    const task  = makeOp({ entityType: 'task',          operation: 'create' })
    const group = makeOp({ entityType: 'group',         operation: 'create' })
    const proj  = makeOp({ entityType: 'project',       operation: 'create' })

    const result = sortOperations([timer, task, group, proj])

    expect(result[0].entityType).toBe('project')
    expect(result[1].entityType).toBe('group')
    expect(result[2].entityType).toBe('task')
    expect(result[3].entityType).toBe('timer_session')
  })

  it('within the same operation + entity type, earlier createdAt comes first (FIFO)', () => {
    const now = Date.now()
    const first  = makeOp({ entityType: 'task', operation: 'update', entityId: 'a', createdAt: now })
    const second = makeOp({ entityType: 'task', operation: 'update', entityId: 'b', createdAt: now + 100 })
    const third  = makeOp({ entityType: 'task', operation: 'update', entityId: 'c', createdAt: now + 200 })

    const result = sortOperations([third, first, second])

    expect(result[0]).toEqual(first)
    expect(result[1]).toEqual(second)
    expect(result[2]).toEqual(third)
  })

  it('does not mutate the original array', () => {
    const ops = [
      makeOp({ entityType: 'task',    operation: 'delete' }),
      makeOp({ entityType: 'project', operation: 'create' }),
    ]
    const original = [...ops]
    sortOperations(ops)
    expect(ops).toEqual(original)
  })

  it('combines operation-type and entity-type ordering correctly', () => {
    const timerDel  = makeOp({ entityType: 'timer_session', operation: 'delete' })
    const projUpd   = makeOp({ entityType: 'project',       operation: 'update' })
    const taskCre   = makeOp({ entityType: 'task',          operation: 'create' })
    const projCre   = makeOp({ entityType: 'project',       operation: 'create' })

    const result = sortOperations([timerDel, projUpd, taskCre, projCre])

    // Creates first: project create, task create
    expect(result[0]).toEqual(projCre)
    expect(result[1]).toEqual(taskCre)
    // Updates next: project update
    expect(result[2]).toEqual(projUpd)
    // Deletes last: timer_session delete
    expect(result[3]).toEqual(timerDel)
  })
})

// ---------------------------------------------------------------------------
// sortDeleteOperations
// ---------------------------------------------------------------------------

describe('sortDeleteOperations', () => {
  it('returns empty array for empty input', () => {
    expect(sortDeleteOperations([])).toEqual([])
  })

  it('filters out non-delete operations', () => {
    const del = makeOp({ entityType: 'task', operation: 'delete' })
    const cre = makeOp({ entityType: 'task', operation: 'create' })
    const upd = makeOp({ entityType: 'task', operation: 'update' })

    const result = sortDeleteOperations([del, cre, upd])

    expect(result).toHaveLength(1)
    expect(result[0].operation).toBe('delete')
  })

  it('reverses entity priority: timer_session first, project last', () => {
    const projDel  = makeOp({ entityType: 'project',       operation: 'delete' })
    const groupDel = makeOp({ entityType: 'group',         operation: 'delete' })
    const taskDel  = makeOp({ entityType: 'task',          operation: 'delete' })
    const timerDel = makeOp({ entityType: 'timer_session', operation: 'delete' })

    const result = sortDeleteOperations([projDel, groupDel, taskDel, timerDel])

    expect(result[0].entityType).toBe('timer_session')
    expect(result[1].entityType).toBe('task')
    expect(result[2].entityType).toBe('group')
    expect(result[3].entityType).toBe('project')
  })

  it('respects FIFO within the same entity type', () => {
    const now = Date.now()
    const first  = makeOp({ entityType: 'task', operation: 'delete', entityId: 'a', createdAt: now })
    const second = makeOp({ entityType: 'task', operation: 'delete', entityId: 'b', createdAt: now + 50 })

    const result = sortDeleteOperations([second, first])

    expect(result[0]).toEqual(first)
    expect(result[1]).toEqual(second)
  })

  it('returns only delete ops even when all entity types are mixed with non-deletes', () => {
    const ops = [
      makeOp({ entityType: 'project',       operation: 'create' }),
      makeOp({ entityType: 'timer_session', operation: 'delete' }),
      makeOp({ entityType: 'group',         operation: 'update' }),
      makeOp({ entityType: 'project',       operation: 'delete' }),
    ]

    const result = sortDeleteOperations(ops)

    expect(result).toHaveLength(2)
    expect(result.every(op => op.operation === 'delete')).toBe(true)
    // timer_session comes before project in reverse priority
    expect(result[0].entityType).toBe('timer_session')
    expect(result[1].entityType).toBe('project')
  })
})

// ---------------------------------------------------------------------------
// groupIntoBatches
// ---------------------------------------------------------------------------

describe('groupIntoBatches', () => {
  it('returns empty array for empty input', () => {
    expect(groupIntoBatches([])).toEqual([])
  })

  it('returns a single batch when all operations have the same type', () => {
    const ops = [
      makeOp({ entityType: 'task', operation: 'create' }),
      makeOp({ entityType: 'group', operation: 'create' }),
    ]
    const batches = groupIntoBatches(ops)
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(2)
    expect(batches[0].every(op => op.operation === 'create')).toBe(true)
  })

  it('returns three batches for mixed operations in correct order', () => {
    const ops = [
      makeOp({ entityType: 'task', operation: 'delete' }),
      makeOp({ entityType: 'task', operation: 'update' }),
      makeOp({ entityType: 'task', operation: 'create' }),
    ]

    const batches = groupIntoBatches(ops)

    expect(batches).toHaveLength(3)
    expect(batches[0].every(op => op.operation === 'create')).toBe(true)
    expect(batches[1].every(op => op.operation === 'update')).toBe(true)
    expect(batches[2].every(op => op.operation === 'delete')).toBe(true)
  })

  it('keeps all operations belonging to the same op-type together in one batch', () => {
    const ops = [
      makeOp({ entityType: 'project', operation: 'create' }),
      makeOp({ entityType: 'task',    operation: 'create' }),
      makeOp({ entityType: 'group',   operation: 'update' }),
      makeOp({ entityType: 'task',    operation: 'delete' }),
    ]

    const batches = groupIntoBatches(ops)

    // create batch has 2 items (project + task)
    const createBatch = batches.find(b => b[0]?.operation === 'create')
    expect(createBatch).toHaveLength(2)

    // update batch has 1 item
    const updateBatch = batches.find(b => b[0]?.operation === 'update')
    expect(updateBatch).toHaveLength(1)

    // delete batch has 1 item
    const deleteBatch = batches.find(b => b[0]?.operation === 'delete')
    expect(deleteBatch).toHaveLength(1)
  })

  it('preserves the sorted entity order within a batch', () => {
    const timerCre = makeOp({ entityType: 'timer_session', operation: 'create' })
    const projCre  = makeOp({ entityType: 'project',       operation: 'create' })
    const taskCre  = makeOp({ entityType: 'task',          operation: 'create' })

    const batches = groupIntoBatches([timerCre, projCre, taskCre])

    expect(batches).toHaveLength(1)
    expect(batches[0][0].entityType).toBe('project')
    expect(batches[0][1].entityType).toBe('task')
    expect(batches[0][2].entityType).toBe('timer_session')
  })
})

// ---------------------------------------------------------------------------
// splitByEntityType
// ---------------------------------------------------------------------------

describe('splitByEntityType', () => {
  it('returns an empty Map for empty input', () => {
    const result = splitByEntityType([])
    expect(result.size).toBe(0)
  })

  it('groups operations by entity type', () => {
    const t1 = makeOp({ entityType: 'task',  operation: 'create', entityId: 'task-1' })
    const t2 = makeOp({ entityType: 'task',  operation: 'create', entityId: 'task-2' })
    const g1 = makeOp({ entityType: 'group', operation: 'create', entityId: 'group-1' })

    const result = splitByEntityType([t1, t2, g1])

    expect(result.size).toBe(2)
    expect(result.get('task')).toHaveLength(2)
    expect(result.get('group')).toHaveLength(1)
    expect(result.has('project')).toBe(false)
    expect(result.has('timer_session')).toBe(false)
  })

  it('returns correct keys for all four entity types', () => {
    const ops = [
      makeOp({ entityType: 'project',       operation: 'update' }),
      makeOp({ entityType: 'group',         operation: 'update' }),
      makeOp({ entityType: 'task',          operation: 'update' }),
      makeOp({ entityType: 'timer_session', operation: 'update' }),
    ]

    const result = splitByEntityType(ops)

    expect(result.size).toBe(4)
    expect(result.has('project')).toBe(true)
    expect(result.has('group')).toBe(true)
    expect(result.has('task')).toBe(true)
    expect(result.has('timer_session')).toBe(true)
  })

  it('preserves insertion order within each entity type bucket', () => {
    const now = Date.now()
    const a = makeOp({ entityType: 'task', operation: 'update', entityId: 'a', createdAt: now })
    const b = makeOp({ entityType: 'task', operation: 'update', entityId: 'b', createdAt: now + 10 })
    const c = makeOp({ entityType: 'task', operation: 'update', entityId: 'c', createdAt: now + 20 })

    const result = splitByEntityType([a, b, c])

    const tasks = result.get('task')!
    expect(tasks[0]).toEqual(a)
    expect(tasks[1]).toEqual(b)
    expect(tasks[2]).toEqual(c)
  })
})

// ---------------------------------------------------------------------------
// operationDependsOn
// ---------------------------------------------------------------------------

describe('operationDependsOn', () => {
  it('update of an entity depends on create of the same entity', () => {
    const cre = makeOp({ entityType: 'task', operation: 'create', entityId: 'task-abc' })
    const upd = makeOp({ entityType: 'task', operation: 'update', entityId: 'task-abc' })

    expect(operationDependsOn(upd, cre)).toBe(true)
  })

  it('update does NOT depend on create of a different entity', () => {
    const cre = makeOp({ entityType: 'task', operation: 'create', entityId: 'task-111' })
    const upd = makeOp({ entityType: 'task', operation: 'update', entityId: 'task-222' })

    expect(operationDependsOn(upd, cre)).toBe(false)
  })

  it('task depends on parent group create when payload.parentId matches', () => {
    const groupCre = makeOp({ entityType: 'group', operation: 'create', entityId: 'group-1' })
    const taskCre  = makeOp({
      entityType: 'task',
      operation: 'create',
      entityId: 'task-1',
      payload: { parentId: 'group-1' },
    })

    expect(operationDependsOn(taskCre, groupCre)).toBe(true)
  })

  it('task does NOT depend on a group create when parentId does not match', () => {
    const groupCre = makeOp({ entityType: 'group', operation: 'create', entityId: 'group-1' })
    const taskCre  = makeOp({
      entityType: 'task',
      operation: 'create',
      entityId: 'task-1',
      payload: { parentId: 'group-999' },
    })

    expect(operationDependsOn(taskCre, groupCre)).toBe(false)
  })

  it('task depends on project create when payload.projectId matches', () => {
    const projCre = makeOp({ entityType: 'project', operation: 'create', entityId: 'proj-1' })
    const taskCre = makeOp({
      entityType: 'task',
      operation: 'create',
      entityId: 'task-1',
      payload: { projectId: 'proj-1' },
    })

    expect(operationDependsOn(taskCre, projCre)).toBe(true)
  })

  it('task does NOT depend on project create when projectId does not match', () => {
    const projCre = makeOp({ entityType: 'project', operation: 'create', entityId: 'proj-1' })
    const taskCre = makeOp({
      entityType: 'task',
      operation: 'create',
      entityId: 'task-1',
      payload: { projectId: 'proj-999' },
    })

    expect(operationDependsOn(taskCre, projCre)).toBe(false)
  })

  it('timer_session depends on task create when payload.taskId matches', () => {
    const taskCre  = makeOp({ entityType: 'task',          operation: 'create', entityId: 'task-1' })
    const timerCre = makeOp({
      entityType: 'timer_session',
      operation: 'create',
      entityId: 'timer-1',
      payload: { taskId: 'task-1' },
    })

    expect(operationDependsOn(timerCre, taskCre)).toBe(true)
  })

  it('timer_session does NOT depend on task create when taskId does not match', () => {
    const taskCre  = makeOp({ entityType: 'task', operation: 'create', entityId: 'task-1' })
    const timerCre = makeOp({
      entityType: 'timer_session',
      operation: 'create',
      entityId: 'timer-1',
      payload: { taskId: 'task-999' },
    })

    expect(operationDependsOn(timerCre, taskCre)).toBe(false)
  })

  it('delete does NOT depend on create of the same entity', () => {
    const cre = makeOp({ entityType: 'task', operation: 'create', entityId: 'task-del' })
    const del = makeOp({ entityType: 'task', operation: 'delete', entityId: 'task-del' })

    expect(operationDependsOn(del, cre)).toBe(false)
  })

  it('delete does NOT depend on update of the same entity', () => {
    const upd = makeOp({ entityType: 'task', operation: 'update', entityId: 'task-del' })
    const del = makeOp({ entityType: 'task', operation: 'delete', entityId: 'task-del' })

    expect(operationDependsOn(del, upd)).toBe(false)
  })

  it('completely unrelated operations return false', () => {
    const projCre  = makeOp({ entityType: 'project',       operation: 'create', entityId: 'proj-x' })
    const timerDel = makeOp({ entityType: 'timer_session', operation: 'delete', entityId: 'timer-y' })

    expect(operationDependsOn(projCre, timerDel)).toBe(false)
    expect(operationDependsOn(timerDel, projCre)).toBe(false)
  })

  it('task update depends on parent group create when payload.parentId matches', () => {
    const groupCre = makeOp({ entityType: 'group', operation: 'create', entityId: 'group-2' })
    const taskUpd  = makeOp({
      entityType: 'task',
      operation: 'update',
      entityId: 'task-2',
      payload: { parentId: 'group-2' },
    })

    expect(operationDependsOn(taskUpd, groupCre)).toBe(true)
  })

  it('task with no parentId/projectId does not depend on group or project creates', () => {
    const groupCre = makeOp({ entityType: 'group',   operation: 'create', entityId: 'group-3' })
    const projCre  = makeOp({ entityType: 'project', operation: 'create', entityId: 'proj-3' })
    const taskCre  = makeOp({ entityType: 'task',    operation: 'create', entityId: 'task-3', payload: {} })

    expect(operationDependsOn(taskCre, groupCre)).toBe(false)
    expect(operationDependsOn(taskCre, projCre)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildDependencyGraph
// ---------------------------------------------------------------------------

describe('buildDependencyGraph', () => {
  it('returns an empty Map for empty input', () => {
    const graph = buildDependencyGraph([])
    expect(graph.size).toBe(0)
  })

  it('returns a graph where every op with an id is a key', () => {
    const a = makeOp({ entityType: 'task', operation: 'create' })
    const b = makeOp({ entityType: 'task', operation: 'update' })
    const graph = buildDependencyGraph([a, b])

    expect(graph.has(a.id!)).toBe(true)
    expect(graph.has(b.id!)).toBe(true)
  })

  it('independent operations have empty dependency sets', () => {
    const projCre = makeOp({ entityType: 'project', operation: 'create', entityId: 'p1' })
    const taskCre = makeOp({ entityType: 'task',    operation: 'create', entityId: 't1', payload: {} })

    const graph = buildDependencyGraph([projCre, taskCre])

    expect(graph.get(projCre.id!)!.size).toBe(0)
    expect(graph.get(taskCre.id!)!.size).toBe(0)
  })

  it('update depends on create of same entity in the graph', () => {
    const cre = makeOp({ entityType: 'task', operation: 'create', entityId: 'task-graph' })
    const upd = makeOp({ entityType: 'task', operation: 'update', entityId: 'task-graph' })

    const graph = buildDependencyGraph([cre, upd])

    // upd depends on cre → cre.id is in upd's dependency set
    expect(graph.get(upd.id!)!.has(cre.id!)).toBe(true)
    // cre has no dependencies
    expect(graph.get(cre.id!)!.size).toBe(0)
  })

  it('builds correct transitive chain: project → task → timer_session', () => {
    const projCre  = makeOp({ entityType: 'project',       operation: 'create', entityId: 'proj-chain' })
    const taskCre  = makeOp({
      entityType: 'task',
      operation: 'create',
      entityId: 'task-chain',
      payload: { projectId: 'proj-chain' },
    })
    const timerCre = makeOp({
      entityType: 'timer_session',
      operation: 'create',
      entityId: 'timer-chain',
      payload: { taskId: 'task-chain' },
    })

    const graph = buildDependencyGraph([projCre, taskCre, timerCre])

    // project has no deps
    expect(graph.get(projCre.id!)!.size).toBe(0)
    // task depends on project create
    expect(graph.get(taskCre.id!)!.has(projCre.id!)).toBe(true)
    // timer depends on task create
    expect(graph.get(timerCre.id!)!.has(taskCre.id!)).toBe(true)
    // timer does NOT directly depend on project (no direct relationship)
    expect(graph.get(timerCre.id!)!.has(projCre.id!)).toBe(false)
  })

  it('operations without an id are not added to the graph', () => {
    const withId    = makeOp({ entityType: 'task', operation: 'create', entityId: 'has-id' })
    const withoutId = { ...makeOp({ entityType: 'task', operation: 'update', entityId: 'has-id' }), id: undefined }

    const graph = buildDependencyGraph([withId, withoutId])

    // Only the op with an id appears as a key
    expect(graph.has(withId.id!)).toBe(true)
    // withoutId.id is undefined — no key for undefined
    expect(graph.has(undefined as unknown as number)).toBe(false)
    expect(graph.size).toBe(1)
  })

  it('does not add a self-dependency edge', () => {
    const cre = makeOp({ entityType: 'task', operation: 'create', entityId: 'self-check' })
    const graph = buildDependencyGraph([cre])

    expect(graph.get(cre.id!)!.has(cre.id!)).toBe(false)
  })

  it('task depending on group create appears correctly', () => {
    const groupCre = makeOp({ entityType: 'group', operation: 'create', entityId: 'grp-dep' })
    const taskCre  = makeOp({
      entityType: 'task',
      operation: 'create',
      entityId: 'task-dep',
      payload: { parentId: 'grp-dep' },
    })

    const graph = buildDependencyGraph([groupCre, taskCre])

    expect(graph.get(taskCre.id!)!.has(groupCre.id!)).toBe(true)
    expect(graph.get(groupCre.id!)!.size).toBe(0)
  })
})

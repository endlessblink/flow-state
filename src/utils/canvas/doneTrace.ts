import type { Task } from '@/types/tasks'

declare const __APP_VERSION__: string

type CanvasTraceNode = {
  id?: string
  type?: string
  position?: { x?: number; y?: number }
  computedPosition?: { x?: number; y?: number }
  parentNode?: string
  hidden?: boolean
  data?: {
    task?: Task
    id?: string
  }
}

const TRACE_PREFIX = '[CANVAS-DONE-TRACE]'
const TRACE_WINDOW_MS = 10_000

let activeTrace:
  | {
      startedAt: number
      taskIds: string[]
      affectedTaskId: string
      traceId: string
    }
  | null = null

function isElectronRuntime() {
  const runtimeWindow = typeof window !== 'undefined'
    ? window as Window & { electronAPI?: { isElectron?: boolean } }
    : null
  return !!runtimeWindow?.electronAPI?.isElectron
}

function hasExplicitTraceFlag() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('flowstate:canvasDoneTrace') === '1'
  } catch {
    return false
  }
}

export function isCanvasDoneTraceEnabled() {
  if (import.meta.env.MODE === 'test') return false
  if (import.meta.env.DEV) return true
  return hasExplicitTraceFlag()
}

function getBuildInfo() {
  return {
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown',
    mode: import.meta.env.MODE,
    electron: isElectronRuntime(),
  }
}

function compactTask(task: Task | undefined) {
  if (!task) return null
  return {
    id: task.id,
    title: task.title?.slice(0, 60),
    status: task.status,
    canvasPosition: task.canvasPosition
      ? { x: Math.round(task.canvasPosition.x), y: Math.round(task.canvasPosition.y) }
      : null,
    parentId: task.parentId ?? null,
    hidden: undefined,
    isInInbox: task.isInInbox,
    positionVersion: task.positionVersion ?? null,
    updatedAt: task.updatedAt,
  }
}

function compactNode(node: CanvasTraceNode | undefined) {
  if (!node) return null
  return {
    id: node.id,
    type: node.type,
    position: node.position
      ? { x: Math.round(node.position.x ?? 0), y: Math.round(node.position.y ?? 0) }
      : null,
    computedPosition: node.computedPosition
      ? { x: Math.round(node.computedPosition.x ?? 0), y: Math.round(node.computedPosition.y ?? 0) }
      : null,
    parentNode: node.parentNode ?? null,
    hidden: node.hidden === true,
    task: compactTask(node.data?.task),
  }
}

function pickTraceTaskIds(affectedTaskId: string, tasks: Task[]) {
  const affected = tasks.find((task) => task.id === affectedTaskId)
  const siblingIds = tasks
    .filter((task) => task.id !== affectedTaskId && task.parentId === affected?.parentId && task.canvasPosition)
    .slice(0, 2)
    .map((task) => task.id)
  return [affectedTaskId, ...siblingIds]
}

export function beginCanvasDoneTrace(affectedTaskId: string, tasks: Task[]) {
  activeTrace = {
    startedAt: Date.now(),
    taskIds: pickTraceTaskIds(affectedTaskId, tasks),
    affectedTaskId,
    traceId: `${Date.now().toString(36)}-${affectedTaskId.slice(0, 8)}`,
  }
  if (!isCanvasDoneTraceEnabled()) return
  traceCanvasDone('mark-done:before-update', {
    source: 'updateTask',
    tasks: tasks
      .filter((task) => activeTrace?.taskIds.includes(task.id))
      .map(compactTask),
  })
}

export function getCanvasDoneTraceTaskIds() {
  if (!activeTrace) return []
  if (Date.now() - activeTrace.startedAt > TRACE_WINDOW_MS) {
    activeTrace = null
    return []
  }
  return activeTrace.taskIds
}

export function traceCanvasDone(
  stage: string,
  payload: Record<string, unknown> = {}
) {
  if (!isCanvasDoneTraceEnabled()) return
  if (activeTrace && Date.now() - activeTrace.startedAt > TRACE_WINDOW_MS) {
    activeTrace = null
  }
  if (!activeTrace && !hasExplicitTraceFlag()) return
  const event = {
    stage,
    traceId: activeTrace?.traceId ?? null,
    affectedTaskId: activeTrace?.affectedTaskId ?? null,
    taskIds: activeTrace?.taskIds ?? [],
    build: getBuildInfo(),
    ...payload,
  }
  console.warn(TRACE_PREFIX, JSON.stringify(event))
}

export function traceCanvasDoneTasks(stage: string, tasks: Task[]) {
  const taskIds = getCanvasDoneTraceTaskIds()
  if (!taskIds.length) return
  traceCanvasDone(stage, {
    tasks: tasks
      .filter((task) => taskIds.includes(task.id))
      .map(compactTask),
  })
}

export function traceCanvasDoneNodes(stage: string, nodes: CanvasTraceNode[]) {
  const taskIds = getCanvasDoneTraceTaskIds()
  if (!taskIds.length) return
  traceCanvasDone(stage, {
    nodes: nodes
      .filter((node) => node.id && taskIds.includes(node.id))
      .map(compactNode),
  })
}

export function traceCanvasDoneDragStop(nodes: CanvasTraceNode[]) {
  const taskIds = getCanvasDoneTraceTaskIds()
  if (!taskIds.length) return
  traceCanvasDone('drag-stop:start', {
    involvedNodes: nodes.map(compactNode),
    tracedNodes: nodes
      .filter((node) => node.id && taskIds.includes(node.id))
      .map(compactNode),
  })
}

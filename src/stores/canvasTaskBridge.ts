/**
 * TASK-1158: Canvas-Task Bridge
 *
 * Neutral module that breaks the circular dependency between tasks.ts and canvas.ts.
 * Both stores import from here — neither imports the other.
 *
 * - sharedTasksRef: tasks array published by tasks.ts, consumed by canvas/canvasGroups.ts
 * - canvasSyncTrigger: incremented by tasks.ts on sync changes, watched by canvas orchestrator
 * - canvasUiSyncRequest: incremented by taskOperations.ts on create, watched by canvasUi.ts
 */
import { ref } from 'vue'
import type { Task } from '@/types/tasks'

/** Live tasks array — written by tasks.ts, read by canvasGroups.ts
 *  MUST be ref (not shallowRef) so that in-place mutations (push, splice,
 *  index assignment) on the shared reactive proxy are visible to consumers
 *  like canvasGroups.taskCountByGroupId computed. */
export const sharedTasksRef = ref<Task[]>([])

/** Sync trigger — incremented by tasks.ts when a relevant task change comes from sync */
export const canvasSyncTrigger = ref(0)

/** UI sync request — incremented by taskOperations.ts after task creation */
export const canvasUiSyncRequest = ref(0)

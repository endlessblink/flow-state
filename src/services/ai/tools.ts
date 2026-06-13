/**
 * AI Tool Definitions and Execution
 *
 * Defines tools the AI can call and executes them against stores.
 * This enables the AI assistant to create groups, tasks, query data,
 * manage timers, projects, and perform bulk operations.
 *
 * @see TASK-1120 in MASTER_PLAN.md
 * @see TASK-1186 for expansion from 5 to 20 tools
 */

import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useProjectStore } from '@/stores/projects'
import { useMoveToCanvasGroup } from '@/composables/canvas/useMoveToCanvasGroup'
import type { Task } from '@/types/tasks'
import type { OpenAITool } from './types'
import { resolveTask } from './entityResolver'
import { decideAISubtaskCreate, decideAITaskCreate, normalizeAIActionText, type AITaskUpdateFields } from './actionGuardrails'
import * as aiActionCommands from './actionCommands'

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of tool calls the AI can make in a single response */
export const MAX_TOOLS_PER_RESPONSE = 5

/** Valid task statuses */
const VALID_STATUSES: Task['status'][] = ['todo', 'done']

/** Valid task priorities */
const VALID_PRIORITIES: Array<Task['priority']> = ['low', 'medium', 'high', null]

// ============================================================================
// Localization Helper
// ============================================================================

type Lang = 'he' | 'en'

/**
 * Tool message helper — returns the Hebrew string when lang='he', English otherwise.
 * Used to localize all ToolResult.message strings so the LLM responds in the
 * user's language (TASK-1329 Gap 6).
 */
function tm(lang: Lang, en: string, he: string): string {
  return lang === 'he' ? he : en
}

// ============================================================================
// Tool Definitions
// ============================================================================

export interface ToolParam {
  type: string
  description: string
  enum?: string[]
  items?: { type: string; properties?: Record<string, ToolParam>; required?: string[] }
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParam>
    required: string[]
  }
  requiresConfirmation?: boolean
  category: 'read' | 'write' | 'destructive'
}

export const AI_TOOLS: ToolDefinition[] = [
  // ── Existing 5 tools ──────────────────────────────────────────────────────
  {
    name: 'create_group',
    description: 'Create a new group on the canvas to organize tasks',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name of the group' },
        color: { type: 'string', description: 'Optional color for the group (hex color like "#3b82f6")' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The title of the task' },
        priority: { type: 'string', description: 'Priority level', enum: ['low', 'medium', 'high'] },
        description: { type: 'string', description: 'Optional description for the task' },
        dueDate: { type: 'string', description: 'Optional due date in YYYY-MM-DD format' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_groups',
    description: 'List all groups on the canvas',
    category: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_tasks',
    description: 'List active tasks (excludes done by default). Pass status="done" to see completed tasks, or status="all" for everything. Use dueDate filter for date-specific queries like "tasks for today" or "what\'s due this week". Use sortBy to control ordering.',
    category: 'read',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status. Default excludes done tasks. Use "all" to include done.', enum: ['todo', 'done', 'all'] },
        dueDate: { type: 'string', description: 'Filter by due date. "today" = due today only, "tomorrow" = due tomorrow, "this_week" = due this week (Mon-Sun), or exact YYYY-MM-DD date.' },
        projectId: { type: 'string', description: 'Filter tasks by project ID. Use list_projects to get project IDs first.' },
        sortBy: { type: 'string', description: 'Sort results before applying limit. Default: "priority" (critical > high > medium > low > none).', enum: ['priority', 'dueDate', 'title'] },
        limit: { type: 'number', description: 'Maximum number of tasks to return (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task by exact ID. PREFER mark_task_done when the user says "done" or "complete" — it accepts title fragments. Only use this tool when you have an exact task ID and need to set a non-done status.',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to update' },
        status: { type: 'string', description: 'The new status', enum: ['todo', 'done'] },
      },
      required: ['taskId', 'status'],
    },
  },

  // ── HIGH PRIORITY: 6 new tools ────────────────────────────────────────────
  {
    name: 'update_task',
    description: 'Update one or more fields of a task by exact ID (title, description, priority, dueDate, status, estimatedDuration). For marking tasks done, PREFER mark_task_done (accepts title fragments). Use this tool when updating non-status fields or when you have the exact task ID.',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to update' },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        priority: { type: 'string', description: 'New priority', enum: ['low', 'medium', 'high'] },
        dueDate: { type: 'string', description: 'New due date in YYYY-MM-DD format' },
        status: { type: 'string', description: 'New status', enum: ['todo', 'done'] },
        estimatedDuration: { type: 'number', description: 'Estimated duration in minutes' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'search_tasks',
    description: 'Search active tasks by text query (excludes done by default). Pass status="done" to search completed tasks. Use dueDate to narrow results by date.',
    category: 'read',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for in task titles and descriptions' },
        priority: { type: 'string', description: 'Filter by priority', enum: ['low', 'medium', 'high'] },
        status: { type: 'string', description: 'Filter by status. Only set this if user explicitly asks for done/completed tasks.', enum: ['todo', 'done'] },
        dueDate: { type: 'string', description: 'Filter by due date. "today" = due today only, "tomorrow" = due tomorrow, "this_week" = due this week (Mon-Sun), or exact YYYY-MM-DD date.' },
        limit: { type: 'number', description: 'Maximum results (default 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_task_details',
    description: 'Get full details of a specific task including subtasks, project, and dates',
    category: 'read',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'start_timer',
    description: 'Start a Pomodoro timer for a specific task',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to focus on' },
        duration: { type: 'number', description: 'Duration in minutes (default 25)' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'stop_timer',
    description: 'Stop the currently running Pomodoro timer',
    category: 'write',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_timer_status',
    description: 'Get the current timer status including remaining time and active task',
    category: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
  },

  // ── MEDIUM PRIORITY: 6 new tools ──────────────────────────────────────────
  {
    name: 'delete_task',
    description: 'Delete a task permanently. Requires confirmed=true to execute.',
    category: 'destructive',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to delete' },
        confirmed: { type: 'boolean', description: 'Must be true to confirm deletion' },
      },
      required: ['taskId', 'confirmed'],
    },
  },
  {
    name: 'move_task_to_group',
    description: 'Move a task into a canvas group',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to move' },
        groupId: { type: 'string', description: 'The ID of the target group' },
      },
      required: ['taskId', 'groupId'],
    },
  },
  {
    name: 'list_projects',
    description: 'List all projects with their names, colors, and task counts',
    category: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'assign_task_to_project',
    description: 'Assign a task to a project',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task' },
        projectId: { type: 'string', description: 'The ID of the project to assign to' },
      },
      required: ['taskId', 'projectId'],
    },
  },
  {
    name: 'get_daily_summary',
    description: 'Get a summary of tasks and activity for a specific date',
    category: 'read',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format (default: today)' },
      },
      required: [],
    },
  },
  {
    name: 'create_subtasks',
    description: 'Create multiple subtasks under a parent task',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        parentTaskId: { type: 'string', description: 'The ID of the parent task' },
        subtasks: {
          type: 'array',
          description: 'Array of subtask objects with title and optional priority',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Subtask title' },
            },
            required: ['title'],
          },
        },
      },
      required: ['parentTaskId', 'subtasks'],
    },
  },

  // ── NICE-TO-HAVE: 3 new tools ────────────────────────────────────────────
  {
    name: 'set_task_due_date',
    description: 'Set or change the due date of a task',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task' },
        dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        dueTime: { type: 'string', description: 'Optional due time in HH:MM format' },
      },
      required: ['taskId', 'dueDate'],
    },
  },
  {
    name: 'get_overdue_tasks',
    description: 'Get all tasks that are past their due date and not done',
    category: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'collect_overdue_to_group',
    description: 'Collect all overdue tasks and arrange them in an orderly grid next to a specific group on the canvas. Use when user says "get overdue tasks", "collect overdue", "organize overdue near group".',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'The group ID to place overdue tasks next to. If not provided, uses the first available group.' },
      },
      required: [],
    },
  },
  {
    name: 'bulk_update_status',
    description: 'Update the status of multiple tasks at once. Requires confirmed=true to execute.',
    category: 'destructive',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        taskIds: { type: 'array', description: 'Array of task IDs to update', items: { type: 'string' } },
        status: { type: 'string', description: 'The new status for all tasks', enum: ['todo', 'done'] },
        confirmed: { type: 'boolean', description: 'Must be true to confirm bulk operation' },
      },
      required: ['taskIds', 'status', 'confirmed'],
    },
  },

  // ── GAMIFICATION & PRODUCTIVITY TOOLS ────────────────────────────────────
  {
    name: 'get_productivity_stats',
    description: 'Get productivity statistics: total tasks, tasks completed today, overdue count, pomodoros completed today, and task breakdown by status',
    category: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'suggest_next_task',
    description: 'Suggest the best task to work on next based on priority, due dates, and overdue status',
    category: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_weekly_summary',
    description: 'Get a weekly productivity summary: the list of tasks completed in the last 7 days plus total focus time. Use for "weekly summary" / "סיכום שבועי" requests.',
    category: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'mark_task_done',
    description: 'Mark a task as done by its title or ID. Accepts a title fragment — no need for exact UUID. Most convenient way to complete a task.',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task title (or partial title) or UUID. Examples: "marketing video", "weekly report"' },
      },
      required: ['task'],
    },
  },
]

// ============================================================================
// Tool Call Types
// ============================================================================

export interface ToolCall {
  tool: string
  parameters: Record<string, unknown>
}

export interface ToolResult {
  success: boolean
  message: string
  data?: unknown
  undoAction?: { toolName: string; params: Record<string, unknown> }
}

// ============================================================================
// Validation Helpers
// ============================================================================

function isValidISODate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const d = new Date(str + 'T00:00:00')
  return !isNaN(d.getTime())
}

function isValidTimeString(str: string): boolean {
  return /^\d{2}:\d{2}$/.test(str)
}

/**
 * Find a task by ID or title fragment (TASK-1396).
 * First tries exact ID match, then falls through to uFuzzy title resolution.
 */
function validateTaskExists(taskStore: ReturnType<typeof useTaskStore>, taskId: string): Task | null {
  // Strategy 1: Direct ID lookup
  const task = taskStore.getTask(taskId)
  if (task) return task

  // Strategy 2: Fuzzy title resolution via entityResolver (TASK-1396)
  const resolved = resolveTask(taskId, taskStore.tasks)
  if (resolved && resolved.confidence !== 'low') {
    return taskStore.getTask(resolved.task.id) || null
  }

  // Strategy 3 (TASK-1814): unambiguous case-insensitive substring match. Handles
  // short fragments the fuzzy resolver scores 'low' (e.g. a single Hebrew name like
  // "רויטל") — only resolves when exactly ONE active task contains the fragment,
  // so it never guesses between candidates.
  const q = (taskId || '').trim().toLowerCase()
  if (q.length >= 2) {
    const matches = taskStore.tasks.filter(
      (t: Task) => t.status !== 'done' && (t.title || '').toLowerCase().includes(q),
    )
    if (matches.length === 1) return matches[0]
  }

  return null
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getToolSourceMessageId(call: ToolCall): string {
  const sourceMessageId = call.parameters.sourceMessageId
  return typeof sourceMessageId === 'string' && sourceMessageId.trim()
    ? sourceMessageId.trim()
    : `tool:${call.tool}`
}

async function applyAITaskUpdateToolCommand(input: {
  call: ToolCall
  taskStore: ReturnType<typeof useTaskStore>
  taskId: string
  updates: Partial<AITaskUpdateFields>
  dataUsed?: Record<string, unknown>
}) {
  const sourceMessageId = getToolSourceMessageId(input.call)
  const command: aiActionCommands.AICommand = {
    id: `${input.call.tool}:${input.taskId}:task-update`,
    kind: 'task.update',
    taskId: input.taskId,
    updates: input.updates,
    impact: 'low',
  }
  const batch = aiActionCommands.buildAICommandBatchPreview({
    sourcePrompt: `AI tool ${input.call.tool}`,
    sourceRunId: `tool:${input.call.tool}`,
    sourceMessageId,
    dataUsed: {
      tool: input.call.tool,
      taskId: input.taskId,
      ...input.dataUsed,
    },
    commands: [command],
    tasks: input.taskStore.tasks,
  })
  const result = await aiActionCommands.applyAICommandBatch(batch, {
    selectedCommandIds: [command.id],
    taskStore: input.taskStore,
  })
  return result.appliedCommands[0]
}

async function applyAITaskDeleteToolCommand(input: {
  call: ToolCall
  taskStore: ReturnType<typeof useTaskStore>
  taskId: string
}) {
  const sourceMessageId = getToolSourceMessageId(input.call)
  const command: aiActionCommands.AICommand = {
    id: `${input.call.tool}:${input.taskId}:task-delete`,
    kind: 'task.delete',
    taskId: input.taskId,
    impact: 'medium',
  }
  const batch = aiActionCommands.buildAICommandBatchPreview({
    sourcePrompt: `AI tool ${input.call.tool}`,
    sourceRunId: `tool:${input.call.tool}`,
    sourceMessageId,
    dataUsed: {
      tool: input.call.tool,
      taskId: input.taskId,
      confirmed: true,
    },
    commands: [command],
    tasks: input.taskStore.tasks,
  })
  const result = await aiActionCommands.applyAICommandBatch(batch, {
    selectedCommandIds: [command.id],
    taskStore: input.taskStore,
  })
  return result.appliedCommands[0]
}

async function applyAITaskCreateToolCommand(input: {
  call: ToolCall
  taskStore: ReturnType<typeof useTaskStore>
  title: string
  priority?: Task['priority']
  description?: string
  dueDate?: string
  projectId?: string | null
  parentTaskId?: string | null
}) {
  const sourceMessageId = getToolSourceMessageId(input.call)
  const command: aiActionCommands.AICommand = {
    id: `${input.call.tool}:task-create`,
    kind: 'task.create',
    title: input.title,
    priority: input.priority,
    description: input.description,
    dueDate: input.dueDate,
    projectId: input.projectId,
    parentTaskId: input.parentTaskId,
    impact: 'low',
  }
  const batch = aiActionCommands.buildAICommandBatchPreview({
    sourcePrompt: `AI tool ${input.call.tool}`,
    sourceRunId: `tool:${input.call.tool}`,
    sourceMessageId,
    dataUsed: {
      tool: input.call.tool,
      title: input.title,
      dueDate: input.dueDate || null,
      projectId: input.projectId || null,
      parentTaskId: input.parentTaskId || null,
    },
    commands: [command],
    tasks: input.taskStore.tasks,
  })
  const result = await aiActionCommands.applyAICommandBatch(batch, {
    selectedCommandIds: [command.id],
    taskStore: input.taskStore,
  })
  return result.appliedCommands[0]
}

async function applyAICanvasGroupCreateToolCommand(input: {
  call: ToolCall
  taskStore: ReturnType<typeof useTaskStore>
  canvasStore: ReturnType<typeof useCanvasStore>
  name: string
  color: string
  position: { x: number; y: number; width: number; height: number }
}) {
  const sourceMessageId = getToolSourceMessageId(input.call)
  const command: aiActionCommands.AICommand = {
    id: `${input.call.tool}:canvas-group-create`,
    kind: 'canvas.group.create',
    name: input.name,
    groupType: 'custom',
    position: input.position,
    color: input.color,
    layout: 'freeform',
    impact: 'low',
  }
  const batch = aiActionCommands.buildAICommandBatchPreview({
    sourcePrompt: `AI tool ${input.call.tool}`,
    sourceRunId: `tool:${input.call.tool}`,
    sourceMessageId,
    dataUsed: {
      tool: input.call.tool,
      name: input.name,
      color: input.color,
      position: input.position,
    },
    commands: [command],
    tasks: input.taskStore.tasks,
    canvasGroups: input.canvasStore.groups,
  })
  const result = await aiActionCommands.applyAICommandBatch(batch, {
    selectedCommandIds: [command.id],
    taskStore: input.taskStore,
    canvasStore: input.canvasStore,
  })
  return result.appliedCommands[0]
}

async function applyAIFocusTimerStartToolCommand(input: {
  call: ToolCall
  taskStore: ReturnType<typeof useTaskStore>
  timerStore: ReturnType<typeof useTimerStore>
  taskId: string
  durationMinutes: number
}) {
  const sourceMessageId = getToolSourceMessageId(input.call)
  const command: aiActionCommands.AICommand = {
    id: `${input.call.tool}:${input.taskId}:focus-timer-start`,
    kind: 'focus.timer.start',
    taskId: input.taskId,
    durationMinutes: input.durationMinutes,
    impact: 'low',
  }
  const batch = aiActionCommands.buildAICommandBatchPreview({
    sourcePrompt: `AI tool ${input.call.tool}`,
    sourceRunId: `tool:${input.call.tool}`,
    sourceMessageId,
    dataUsed: {
      tool: input.call.tool,
      taskId: input.taskId,
      durationMinutes: input.durationMinutes,
    },
    commands: [command],
    tasks: input.taskStore.tasks,
    timerSession: input.timerStore.currentSession,
  })
  const result = await aiActionCommands.applyAICommandBatch(batch, {
    selectedCommandIds: [command.id],
    taskStore: input.taskStore,
    timerStore: input.timerStore,
  })
  return result.appliedCommands[0]
}

async function applyAIFocusTimerStopToolCommand(input: {
  call: ToolCall
  taskStore: ReturnType<typeof useTaskStore>
  timerStore: ReturnType<typeof useTimerStore>
}) {
  const sourceMessageId = getToolSourceMessageId(input.call)
  const command: aiActionCommands.AICommand = {
    id: `${input.call.tool}:focus-timer-stop`,
    kind: 'focus.timer.stop',
    impact: 'low',
  }
  const batch = aiActionCommands.buildAICommandBatchPreview({
    sourcePrompt: `AI tool ${input.call.tool}`,
    sourceRunId: `tool:${input.call.tool}`,
    sourceMessageId,
    dataUsed: {
      tool: input.call.tool,
      currentTaskId: input.timerStore.currentSession?.taskId ?? null,
      currentSessionId: input.timerStore.currentSession?.id ?? null,
    },
    commands: [command],
    tasks: input.taskStore.tasks,
    timerSession: input.timerStore.currentSession,
  })
  const result = await aiActionCommands.applyAICommandBatch(batch, {
    selectedCommandIds: [command.id],
    taskStore: input.taskStore,
    timerStore: input.timerStore,
  })
  return result.appliedCommands[0]
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Execute a tool call and return the result.
 * @param call - The tool call to execute.
 * @param language - Language for ToolResult.message strings ('en' or 'he'). Defaults to 'en'.
 */
export async function executeTool(call: ToolCall, language: Lang = 'en'): Promise<ToolResult> {
  // Lazy store access - these are Pinia stores and are safe to call here
  // because executeTool is only invoked from UI context (useAIChat) where
  // the Pinia instance is already active.
  let canvasStore: ReturnType<typeof useCanvasStore>
  let taskStore: ReturnType<typeof useTaskStore>
  let timerStore: ReturnType<typeof useTimerStore>
  let projectStore: ReturnType<typeof useProjectStore>

  try {
    taskStore = useTaskStore()
    canvasStore = useCanvasStore()
  } catch {
    return { success: false, message: tm(language, 'Core stores not available. Please try again after the app is fully loaded.', 'המערכת לא זמינה. נסה שוב לאחר טעינה מלאה.') }
  }

  try {
    switch (call.tool) {
      // ── Existing 5 tools (preserved) ────────────────────────────────────
      case 'create_group': {
        const name = call.parameters.name as string
        const color = (call.parameters.color as string) || '#3b82f6'

        const existingGroups = canvasStore.groups
        let xPos = 100
        const yPos = 100

        if (existingGroups.length > 0) {
          const maxX = Math.max(
            ...existingGroups.map((g) => (g.position?.x || 0) + (g.position?.width || 400))
          )
          xPos = maxX + 50
        }

        const position = { x: xPos, y: yPos, width: 400, height: 300 }
        const applied = await applyAICanvasGroupCreateToolCommand({
          call,
          taskStore,
          canvasStore,
          name,
          color,
          position,
        })

        return {
          success: true,
          message: tm(language, `Created group "${name}"`, `נוצרה קבוצה "${name}"`),
          data: { id: applied.entityId, name },
          undoAction: { toolName: 'delete_group', params: { groupId: applied.entityId, confirmed: true } },
        }
      }

      case 'create_task': {
        const title = call.parameters.title as string
        const priority = (call.parameters.priority as Task['priority']) || 'medium'
        const description = call.parameters.description as string | undefined
        const dueDate = call.parameters.dueDate as string | undefined
        const projectId = call.parameters.projectId as string | undefined
        const parentTaskId = call.parameters.parentTaskId as string | undefined

        if (dueDate && !isValidISODate(dueDate)) {
          return { success: false, message: tm(language, `Invalid date format "${dueDate}". Use YYYY-MM-DD.`, `פורמט תאריך לא תקין "${dueDate}". השתמש ב-YYYY-MM-DD.`) }
        }

        const duplicateDecision = decideAITaskCreate({
          tasks: taskStore.tasks,
          title,
          dueDate,
          projectId,
          parentTaskId,
          sourceMessageId: call.parameters.sourceMessageId,
        })
        if (duplicateDecision.existing) {
          return {
            success: true,
            message: tm(language, `Task "${duplicateDecision.existing.title}" already exists; reused it instead of creating a duplicate.`, `המשימה "${duplicateDecision.existing.title}" כבר קיימת; השתמשתי בה במקום ליצור כפילות.`),
            data: {
              id: duplicateDecision.existing.id,
              title: duplicateDecision.existing.title,
              priority: duplicateDecision.existing.priority,
              aiAction: {
                decision: duplicateDecision.decision,
                duplicateOf: duplicateDecision.existing.id,
                identity: duplicateDecision.identity,
              },
            },
          }
        }

        const applied = await applyAITaskCreateToolCommand({
          call,
          taskStore,
          title,
          priority,
          description,
          dueDate,
          projectId,
          parentTaskId,
        })
        const task = taskStore.tasks.find(task => task.id === applied.entityId) ?? {
          id: applied.entityId,
          title,
          priority,
        }

        return {
          success: true,
          message: tm(language, `Created task "${title}"`, `נוצרה משימה "${title}"`),
          data: {
            id: task.id,
            title: task.title,
            priority: task.priority,
            aiAction: {
              decision: duplicateDecision.decision,
              identity: duplicateDecision.identity,
            },
          },
        }
      }

      case 'list_groups': {
        const groups = canvasStore.groups
        const groupList = groups.map((g) => ({
          id: g.id,
          name: g.name,
          taskCount: canvasStore.getAggregatedTaskCountForGroup(g.id),
        }))

        return {
          success: true,
          message: tm(language, `Found ${groups.length} groups`, `נמצאו ${groups.length} קבוצות`),
          data: groupList,
        }
      }

      case 'list_tasks': {
        const status = call.parameters.status as string | undefined
        const dueDateFilter = call.parameters.dueDate as string | undefined
        const projectIdFilter = call.parameters.projectId as string | undefined
        const sortBy = (call.parameters.sortBy as string) || 'priority'
        const limit = (call.parameters.limit as number) || 50

        let tasks = taskStore.tasks

        // Project filter (TASK-1393)
        if (projectIdFilter) {
          tasks = tasks.filter((t: Task) => t.projectId === projectIdFilter)
        }

        if (status === 'all') {
          // Explicit 'all' — include everything
        } else if (status === 'done') {
          tasks = tasks.filter((t: Task) => t.status === 'done')
        } else if (status) {
          tasks = tasks.filter((t: Task) => t.status === status)
        } else {
          // Default: exclude done tasks (most useful for user-facing queries)
          tasks = tasks.filter((t: Task) => t.status !== 'done')
        }

        // Date filtering
        if (dueDateFilter) {
          const today = new Date()
          const todayStr = today.toISOString().split('T')[0]
          const normDate = (d: string) => d.includes('T') ? d.split('T')[0] : d

          if (dueDateFilter === 'today') {
            tasks = tasks.filter((t: Task) => t.dueDate && normDate(t.dueDate) === todayStr)
          } else if (dueDateFilter === 'tomorrow') {
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)
            const tomorrowStr = tomorrow.toISOString().split('T')[0]
            tasks = tasks.filter((t: Task) => t.dueDate && normDate(t.dueDate) === tomorrowStr)
          } else if (dueDateFilter === 'this_week') {
            const dayOfWeek = today.getDay() // 0=Sun
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
            const monday = new Date(today)
            monday.setDate(today.getDate() + mondayOffset)
            const sunday = new Date(monday)
            sunday.setDate(monday.getDate() + 6)
            const mondayStr = monday.toISOString().split('T')[0]
            const sundayStr = sunday.toISOString().split('T')[0]
            tasks = tasks.filter((t: Task) => {
              if (!t.dueDate) return false
              const d = normDate(t.dueDate)
              return d >= mondayStr && d <= sundayStr
            })
          } else if (isValidISODate(dueDateFilter)) {
            tasks = tasks.filter((t: Task) => t.dueDate && normDate(t.dueDate) === dueDateFilter)
          }
        }

        // Sorting
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        if (sortBy === 'priority') {
          tasks = [...tasks].sort((a, b) => {
            const ap = priorityOrder[a.priority || ''] ?? 4
            const bp = priorityOrder[b.priority || ''] ?? 4
            if (ap !== bp) return ap - bp
            // Secondary sort by dueDate ascending
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
            if (a.dueDate) return -1
            if (b.dueDate) return 1
            return 0
          })
        } else if (sortBy === 'dueDate') {
          tasks = [...tasks].sort((a, b) => {
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
            if (a.dueDate) return -1
            if (b.dueDate) return 1
            return 0
          })
        } else if (sortBy === 'title') {
          tasks = [...tasks].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
        }

        tasks = tasks.slice(0, limit)

        // Enrich task data so the AI can reason about WHY tasks matter
        const today = new Date().toISOString().split('T')[0]
        const projectMap = new Map(
          (taskStore.projects || []).map((p: { id: string; name: string }) => [p.id, p.name])
        )

        const taskList = tasks.map((t: Task) => {
          const daysOverdue = t.dueDate && t.dueDate < today
            ? Math.floor((Date.now() - new Date(t.dueDate).getTime()) / 86400000)
            : 0
          const subtotalSubs = t.subtasks?.length ?? 0
          const completedSubs = t.subtasks?.filter(s => s.isCompleted).length ?? 0
          const projName = t.projectId ? projectMap.get(t.projectId) : undefined

          const enriched: Record<string, unknown> = {
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate || null,
          }
          if (daysOverdue > 0) enriched.daysOverdue = daysOverdue
          if (t.estimatedDuration) enriched.estimatedMinutes = t.estimatedDuration
          if (projName) enriched.project = projName
          if (subtotalSubs > 0) enriched.subtasks = `${completedSubs}/${subtotalSubs}`
          if (t.completedPomodoros > 0) enriched.pomodorosCompleted = t.completedPomodoros
          if (t.description && t.description.length > 0) enriched.hasDescription = true
          if (t.tags && t.tags.length > 0) enriched.tags = t.tags

          return enriched
        })

        return {
          success: true,
          message: tm(language, `Found ${taskList.length} tasks`, `נמצאו ${taskList.length} משימות`),
          data: taskList,
        }
      }

      case 'update_task_status': {
        const taskId = call.parameters.taskId as string
        const status = call.parameters.status as Task['status']

        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: tm(language, `Task with ID "${taskId}" not found`, `משימה עם מזהה "${taskId}" לא נמצאה`) }
        }

        if (!VALID_STATUSES.includes(status)) {
          return { success: false, message: tm(language, `Invalid status "${status}". Valid: ${VALID_STATUSES.join(', ')}`, `סטטוס לא תקין "${status}". אפשרויות: ${VALID_STATUSES.join(', ')}`) }
        }

        const previousStatus = task.status
        await applyAITaskUpdateToolCommand({
          call,
          taskStore,
          taskId,
          updates: { status },
          dataUsed: { status },
        })

        return {
          success: true,
          message: tm(language, `Updated task "${task.title}" status to "${status}"`, `עודכן סטטוס משימה "${task.title}" ל-"${status}"`),
          data: { id: taskId, status },
          undoAction: { toolName: 'update_task_status', params: { taskId, status: previousStatus } },
        }
      }

      // ── HIGH PRIORITY: 6 new tools ──────────────────────────────────────
      case 'update_task': {
        const taskId = call.parameters.taskId as string
        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: tm(language, `Task with ID "${taskId}" not found`, `משימה עם מזהה "${taskId}" לא נמצאה`) }
        }

        const updates: Partial<AITaskUpdateFields> = {}
        const updatedFields: string[] = []
        // Capture previous values for undo
        const previousValues: Record<string, unknown> = {}

        if (call.parameters.title !== undefined) {
          previousValues.title = task.title
          updates.title = call.parameters.title as string
          updatedFields.push('title')
        }
        if (call.parameters.description !== undefined) {
          previousValues.description = task.description
          updates.description = call.parameters.description as string
          updatedFields.push('description')
        }
        if (call.parameters.priority !== undefined) {
          const p = call.parameters.priority as Task['priority']
          if (!VALID_PRIORITIES.includes(p)) {
            return { success: false, message: tm(language, `Invalid priority "${p}". Valid: low, medium, high`, `עדיפות לא תקינה "${p}". אפשרויות: low, medium, high`) }
          }
          previousValues.priority = task.priority
          updates.priority = p
          updatedFields.push('priority')
        }
        if (call.parameters.dueDate !== undefined) {
          const dd = call.parameters.dueDate as string
          if (!isValidISODate(dd)) {
            return { success: false, message: tm(language, `Invalid date format "${dd}". Use YYYY-MM-DD.`, `פורמט תאריך לא תקין "${dd}". השתמש ב-YYYY-MM-DD.`) }
          }
          previousValues.dueDate = task.dueDate
          updates.dueDate = dd
          updatedFields.push('dueDate')
        }
        if (call.parameters.status !== undefined) {
          const s = call.parameters.status as Task['status']
          if (!VALID_STATUSES.includes(s)) {
            return { success: false, message: tm(language, `Invalid status "${s}". Valid: ${VALID_STATUSES.join(', ')}`, `סטטוס לא תקין "${s}". אפשרויות: ${VALID_STATUSES.join(', ')}`) }
          }
          previousValues.status = task.status
          updates.status = s
          updatedFields.push('status')
        }
        if (call.parameters.estimatedDuration !== undefined) {
          previousValues.estimatedDuration = task.estimatedDuration
          updates.estimatedDuration = call.parameters.estimatedDuration as number
          updatedFields.push('estimatedDuration')
        }

        if (updatedFields.length === 0) {
          return { success: false, message: tm(language, 'No valid fields to update. Provide at least one of: title, description, priority, dueDate, status, estimatedDuration.', 'אין שדות תקינים לעדכון. ספק לפחות אחד מ: title, description, priority, dueDate, status, estimatedDuration.') }
        }

        await applyAITaskUpdateToolCommand({
          call,
          taskStore,
          taskId,
          updates,
          dataUsed: { updatedFields },
        })

        return {
          success: true,
          message: tm(language, `Updated task "${task.title}": ${updatedFields.join(', ')}`, `עודכנה משימה "${task.title}": ${updatedFields.join(', ')}`),
          data: { id: taskId, updatedFields },
          undoAction: { toolName: 'update_task', params: { taskId, ...previousValues } },
        }
      }

      case 'search_tasks': {
        const query = (call.parameters.query as string).toLowerCase()
        const filterPriority = call.parameters.priority as Task['priority'] | undefined
        const filterStatus = call.parameters.status as Task['status'] | undefined
        const dueDateFilter = call.parameters.dueDate as string | undefined
        const limit = (call.parameters.limit as number) || 20

        let results = taskStore.tasks.filter((t: Task) => {
          // Exclude done tasks by default unless explicitly searching for them
          if (!filterStatus && t.status === 'done') return false
          const titleMatch = t.title?.toLowerCase().includes(query)
          const descMatch = t.description?.toLowerCase().includes(query)
          return titleMatch || descMatch
        })

        if (filterPriority) {
          results = results.filter((t: Task) => t.priority === filterPriority)
        }
        if (filterStatus) {
          results = results.filter((t: Task) => t.status === filterStatus)
        }

        // Date filtering
        if (dueDateFilter) {
          const today = new Date()
          const todayStr = today.toISOString().split('T')[0]
          const normDate = (d: string) => d.includes('T') ? d.split('T')[0] : d

          if (dueDateFilter === 'today') {
            results = results.filter((t: Task) => t.dueDate && normDate(t.dueDate) === todayStr)
          } else if (dueDateFilter === 'tomorrow') {
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)
            const tomorrowStr = tomorrow.toISOString().split('T')[0]
            results = results.filter((t: Task) => t.dueDate && normDate(t.dueDate) === tomorrowStr)
          } else if (dueDateFilter === 'this_week') {
            const dayOfWeek = today.getDay()
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
            const monday = new Date(today)
            monday.setDate(today.getDate() + mondayOffset)
            const sunday = new Date(monday)
            sunday.setDate(monday.getDate() + 6)
            const mondayStr = monday.toISOString().split('T')[0]
            const sundayStr = sunday.toISOString().split('T')[0]
            results = results.filter((t: Task) => {
              if (!t.dueDate) return false
              const d = normDate(t.dueDate)
              return d >= mondayStr && d <= sundayStr
            })
          } else if (isValidISODate(dueDateFilter)) {
            results = results.filter((t: Task) => t.dueDate && normDate(t.dueDate) === dueDateFilter)
          }
        }

        results = results.slice(0, limit)

        return {
          success: true,
          message: tm(language, `Found ${results.length} tasks matching "${call.parameters.query}"`, `נמצאו ${results.length} משימות התואמות ל-"${call.parameters.query}"`),
          data: results.map((t: Task) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate || null,
          })),
        }
      }

      case 'get_task_details': {
        const taskId = call.parameters.taskId as string
        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: tm(language, `Task with ID "${taskId}" not found`, `משימה עם מזהה "${taskId}" לא נמצאה`) }
        }

        let projectName = 'Uncategorized'
        if (task.projectId) {
          try {
            projectStore = useProjectStore()
            projectName = projectStore.getProjectDisplayName(task.projectId)
          } catch { /* project store not available */ }
        }

        // Find parent group name if in a canvas group
        let groupName: string | null = null
        if (task.parentId) {
          try {
            const group = canvasStore.groups.find(g => g.id === task.parentId)
            groupName = group?.name || null
          } catch { /* canvas store might not have the group */ }
        }

        return {
          success: true,
          message: tm(language, `Details for task "${task.title}"`, `פרטי משימה "${task.title}"`),
          data: {
            id: task.id,
            title: task.title,
            description: task.description || '',
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate || null,
            dueTime: task.dueTime || null,
            estimatedDuration: task.estimatedDuration || null,
            progress: task.progress,
            completedPomodoros: task.completedPomodoros,
            estimatedPomodoros: task.estimatedPomodoros || null,
            subtasks: (task.subtasks || []).map(s => ({
              id: s.id,
              title: s.title,
              isCompleted: s.isCompleted,
            })),
            project: projectName,
            group: groupName,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            tags: task.tags || [],
          },
        }
      }

      case 'start_timer': {
        try {
          timerStore = useTimerStore()
        } catch {
          return { success: false, message: tm(language, 'Timer store not available.', 'מערכת הטיימר לא זמינה.') }
        }

        const taskId = call.parameters.taskId as string
        const durationMinutes = (call.parameters.duration as number) || 25
        const durationSeconds = durationMinutes * 60

        // Verify the task exists (unless it's 'general')
        if (taskId !== 'general') {
          const task = validateTaskExists(taskStore, taskId)
          if (!task) {
            return { success: false, message: tm(language, `Task with ID "${taskId}" not found`, `משימה עם מזהה "${taskId}" לא נמצאה`) }
          }
        }

        if (timerStore.isTimerActive) {
          return { success: false, message: tm(language, 'A timer is already running. Stop it first with stop_timer.', 'יש כבר טיימר פעיל. עצור אותו קודם.') }
        }

        await applyAIFocusTimerStartToolCommand({
          call,
          taskStore,
          timerStore,
          taskId,
          durationMinutes,
        })

        const taskName = taskId === 'general' ? 'Focus Session' : (validateTaskExists(taskStore, taskId)?.title || taskId)
        return {
          success: true,
          message: tm(language, `Started ${durationMinutes}-minute timer for "${taskName}"`, `הופעל טיימר של ${durationMinutes} דקות עבור "${taskName}"`),
          data: { taskId, durationMinutes },
        }
      }

      case 'stop_timer': {
        try {
          timerStore = useTimerStore()
        } catch {
          return { success: false, message: tm(language, 'Timer store not available.', 'מערכת הטיימר לא זמינה.') }
        }

        if (!timerStore.isTimerActive) {
          return { success: false, message: tm(language, 'No timer is currently running.', 'אין טיימר פעיל כרגע.') }
        }

        const taskName = timerStore.currentTaskName || 'Unknown'
        const remaining = timerStore.currentSession?.remainingTime || 0
        await applyAIFocusTimerStopToolCommand({
          call,
          taskStore,
          timerStore,
        })

        return {
          success: true,
          message: tm(language, `Stopped timer for "${taskName}" (${formatTime(remaining)} remaining)`, `הטיימר נעצר עבור "${taskName}" (נותרו ${formatTime(remaining)})`),
          data: { stoppedTask: taskName, remainingTime: formatTime(remaining) },
        }
      }

      case 'get_timer_status': {
        try {
          timerStore = useTimerStore()
        } catch {
          return { success: false, message: tm(language, 'Timer store not available.', 'מערכת הטיימר לא זמינה.') }
        }

        const session = timerStore.currentSession
        if (!session || !timerStore.isTimerActive) {
          return {
            success: true,
            message: tm(language, 'No timer is currently running', 'אין טיימר פעיל כרגע'),
            data: { isActive: false },
          }
        }

        return {
          success: true,
          message: tm(language, `Timer active: ${timerStore.currentTaskName} (${formatTime(session.remainingTime)} remaining)`, `טיימר פעיל: ${timerStore.currentTaskName} (נותרו ${formatTime(session.remainingTime)})`),
          data: {
            isActive: true,
            isPaused: session.isPaused,
            isBreak: session.isBreak,
            currentTaskName: timerStore.currentTaskName,
            remainingTime: formatTime(session.remainingTime),
            remainingSeconds: session.remainingTime,
            totalDuration: session.duration,
            sessionsCompleted: timerStore.completedSessions.length,
          },
        }
      }

      // ── MEDIUM PRIORITY: 6 new tools ────────────────────────────────────
      case 'delete_task': {
        const taskId = call.parameters.taskId as string
        const confirmed = call.parameters.confirmed as boolean

        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: tm(language, `Task with ID "${taskId}" not found`, `משימה עם מזהה "${taskId}" לא נמצאה`) }
        }

        if (!confirmed) {
          return {
            success: false,
            message: tm(language, `Deletion of "${task.title}" requires confirmation. Set confirmed=true to proceed.`, `מחיקת "${task.title}" דורשת אישור. הגדר confirmed=true להמשך.`),
          }
        }

        await applyAITaskDeleteToolCommand({
          call,
          taskStore,
          taskId,
        })

        return {
          success: true,
          message: tm(language, `Deleted task "${task.title}"`, `נמחקה משימה "${task.title}"`),
          data: { id: taskId, title: task.title },
        }
      }

      case 'move_task_to_group': {
        const taskId = call.parameters.taskId as string
        const groupId = call.parameters.groupId as string

        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: tm(language, `Task with ID "${taskId}" not found`, `משימה עם מזהה "${taskId}" לא נמצאה`) }
        }

        // Use _rawGroups (unfiltered) to find the group — consistent with useMoveToCanvasGroup
        const group = canvasStore._rawGroups.find(g => g.id === groupId)
        if (!group) {
          return { success: false, message: tm(language, `Group with ID "${groupId}" not found`, `קבוצה עם מזהה "${groupId}" לא נמצאה`) }
        }

        // Delegate to the dedicated composable which computes a valid canvasPosition
        // (relative to the group) and calls updateTaskWithUndo — respecting geometry invariants.
        const previousParentId = task.parentId
        const { moveTaskToGroup } = useMoveToCanvasGroup()
        const moved = await moveTaskToGroup(taskId, groupId)
        if (!moved) {
          return { success: false, message: tm(language, `Failed to move task "${task.title}" to group "${group.name}"`, `העברת משימה "${task.title}" לקבוצה "${group.name}" נכשלה`) }
        }

        return {
          success: true,
          message: tm(language, `Moved task "${task.title}" to group "${group.name}"`, `הועברה משימה "${task.title}" לקבוצה "${group.name}"`),
          data: { taskId, groupId, groupName: group.name },
          undoAction: { toolName: 'move_task_to_group', params: { taskId, groupId: previousParentId || '' } },
        }
      }

      case 'list_projects': {
        try {
          projectStore = useProjectStore()
        } catch {
          return { success: false, message: tm(language, 'Project store not available.', 'מערכת הפרויקטים לא זמינה.') }
        }

        const projects = projectStore.projects
        const tasks = taskStore.tasks

        const projectList = projects.map(p => ({
          id: p.id,
          name: p.name,
          color: typeof p.color === 'string' ? p.color : undefined,
          emoji: p.emoji || undefined,
          taskCount: tasks.filter((t: Task) => t.projectId === p.id).length,
        }))

        return {
          success: true,
          message: tm(language, `Found ${projects.length} projects`, `נמצאו ${projects.length} פרויקטים`),
          data: projectList,
        }
      }

      case 'assign_task_to_project': {
        const taskId = call.parameters.taskId as string
        const projectId = call.parameters.projectId as string

        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: tm(language, `Task with ID "${taskId}" not found`, `משימה עם מזהה "${taskId}" לא נמצאה`) }
        }

        try {
          projectStore = useProjectStore()
        } catch {
          return { success: false, message: tm(language, 'Project store not available.', 'מערכת הפרויקטים לא זמינה.') }
        }

        const project = projectStore.getProjectById(projectId)
        if (!project) {
          return { success: false, message: tm(language, `Project with ID "${projectId}" not found`, `פרויקט עם מזהה "${projectId}" לא נמצא`) }
        }

        const previousProjectId = task.projectId
        await applyAITaskUpdateToolCommand({
          call,
          taskStore,
          taskId,
          updates: { projectId },
          dataUsed: { projectId, projectName: project.name },
        })

        return {
          success: true,
          message: tm(language, `Assigned task "${task.title}" to project "${project.name}"`, `שויכה משימה "${task.title}" לפרויקט "${project.name}"`),
          data: { taskId, projectId, projectName: project.name },
          undoAction: { toolName: 'assign_task_to_project', params: { taskId, projectId: previousProjectId } },
        }
      }

      case 'get_daily_summary': {
        const dateStr = (call.parameters.date as string) || new Date().toISOString().split('T')[0]
        if (!isValidISODate(dateStr)) {
          return { success: false, message: tm(language, `Invalid date format "${dateStr}". Use YYYY-MM-DD.`, `פורמט תאריך לא תקין "${dateStr}". השתמש ב-YYYY-MM-DD.`) }
        }

        const allTasks = taskStore.tasks
        const today = dateStr

        // Normalize dueDate: extract YYYY-MM-DD from either "2026-02-07" or "2026-02-07T22:00:00+00:00"
        const normDate = (d: string) => d.includes('T') ? d.split('T')[0] : d
        const dueToday = allTasks.filter((t: Task) => t.dueDate && normDate(t.dueDate) === today && t.status !== 'done')
        const completedToday = allTasks.filter((t: Task) => {
          if (t.status !== 'done') return false
          // Check if completedAt matches today
          if (t.completedAt) {
            const completedDate = new Date(t.completedAt).toISOString().split('T')[0]
            return completedDate === today
          }
          // Fallback: check updatedAt for tasks marked done today
          const updatedDate = new Date(t.updatedAt).toISOString().split('T')[0]
          return updatedDate === today
        })
        const overdue = allTasks.filter((t: Task) => {
          if (!t.dueDate || t.status === 'done') return false
          return normDate(t.dueDate) < today
        })

        // Timer sessions info
        let sessionsCompleted = 0
        try {
          timerStore = useTimerStore()
          sessionsCompleted = timerStore.completedSessions.length
        } catch { /* timer not available */ }

        return {
          success: true,
          message: tm(language, `Daily summary for ${dateStr}`, `סיכום יומי ל-${dateStr}`),
          data: {
            date: dateStr,
            dueToday: dueToday.length,
            dueTodayTasks: dueToday.map((t: Task) => ({ id: t.id, title: t.title, priority: t.priority })),
            completedToday: completedToday.length,
            overdueCount: overdue.length,
            overdueTasks: overdue.slice(0, 10).map((t: Task) => ({ id: t.id, title: t.title, dueDate: t.dueDate })),
            timerSessionsCompleted: sessionsCompleted,
            totalTasks: allTasks.length,
            inProgress: allTasks.filter((t: Task) => t.status === 'todo').length,
          },
        }
      }

      case 'create_subtasks': {
        const parentTaskId = call.parameters.parentTaskId as string
        const subtaskDefs = call.parameters.subtasks as Array<{ title: string }>

        const parentTask = validateTaskExists(taskStore, parentTaskId)
        if (!parentTask) {
          return { success: false, message: tm(language, `Parent task with ID "${parentTaskId}" not found`, `משימת אב עם מזהה "${parentTaskId}" לא נמצאה`) }
        }

        if (!Array.isArray(subtaskDefs) || subtaskDefs.length === 0) {
          return { success: false, message: tm(language, 'subtasks must be a non-empty array of objects with title.', 'תת-משימות חייבות להיות מערך לא ריק של אובייקטים עם כותרת.') }
        }

        const sourceMessageId = getToolSourceMessageId(call)
        const commands: aiActionCommands.AICommand[] = subtaskDefs
          .filter((sub): sub is { title: string } => Boolean(sub.title && typeof sub.title === 'string'))
          .map((sub, index) => ({
            id: `${call.tool}:${parentTaskId}:subtask-create:${index}`,
            kind: 'task.subtask.create',
            parentTaskId,
            title: sub.title,
            impact: 'low',
          }))
        const batch = aiActionCommands.buildAICommandBatchPreview({
          sourcePrompt: `AI tool ${call.tool}`,
          sourceRunId: `tool:${call.tool}`,
          sourceMessageId,
          dataUsed: {
            tool: call.tool,
            parentTaskId,
            subtaskCount: commands.length,
          },
          commands,
          tasks: taskStore.tasks,
        })
        const result = await aiActionCommands.applyAICommandBatch(batch, {
          selectedCommandIds: commands.map(command => command.id),
          taskStore,
        })
        const commandsById = new Map(commands.map(command => [command.id, command]))
        const currentParent = validateTaskExists(taskStore, parentTaskId) || parentTask
        const created: Array<{ id: string; title: string }> = []
        const skippedExisting: Array<{ id: string; title: string }> = []
        let reusedAny = false
        let lastIdentity = null as ReturnType<typeof decideAISubtaskCreate>['identity'] | null
        for (const applied of result.appliedCommands) {
          const command = commandsById.get(applied.id)
          if (applied.identity) lastIdentity = applied.identity
          if (applied.result === 'reused_existing') {
            reusedAny = true
            const commandTitle = command && 'title' in command ? command.title : applied.entityId
            const existing = currentParent.subtasks?.find(subtask =>
              normalizeAIActionText(subtask.title) === normalizeAIActionText(commandTitle),
            ) ?? currentParent.subtasks?.find(subtask => subtask.id === applied.entityId)
            skippedExisting.push({
              id: applied.entityId,
              title: existing?.title || commandTitle,
            })
            continue
          }
          created.push({
            id: applied.entityId,
            title: command && 'title' in command ? command.title : applied.entityId,
          })
        }

        return {
          success: true,
          message: tm(language, `Created ${created.length} subtasks under "${parentTask.title}"${skippedExisting.length ? `; reused ${skippedExisting.length} existing` : ''}`, `נוצרו ${created.length} תת-משימות תחת "${parentTask.title}"${skippedExisting.length ? `; נעשה שימוש ב-${skippedExisting.length} קיימות` : ''}`),
          data: {
            parentTaskId,
            subtasks: created,
            skippedExisting,
            aiAction: {
              decision: reusedAny && created.length === 0 ? 'reuse_existing' : 'create',
              identity: lastIdentity,
            },
          },
        }
      }

      // ── NICE-TO-HAVE: 3 new tools ──────────────────────────────────────
      case 'set_task_due_date': {
        const taskId = call.parameters.taskId as string
        const dueDate = call.parameters.dueDate as string
        const dueTime = call.parameters.dueTime as string | undefined

        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: tm(language, `Task with ID "${taskId}" not found`, `משימה עם מזהה "${taskId}" לא נמצאה`) }
        }

        if (!isValidISODate(dueDate)) {
          return { success: false, message: tm(language, `Invalid date format "${dueDate}". Use YYYY-MM-DD.`, `פורמט תאריך לא תקין "${dueDate}". השתמש ב-YYYY-MM-DD.`) }
        }
        if (dueTime && !isValidTimeString(dueTime)) {
          return { success: false, message: tm(language, `Invalid time format "${dueTime}". Use HH:MM.`, `פורמט שעה לא תקין "${dueTime}". השתמש ב-HH:MM.`) }
        }

        const updates: Partial<AITaskUpdateFields> = { dueDate }
        if (dueTime) updates.dueTime = dueTime

        const previousDueDate = task.dueDate
        await applyAITaskUpdateToolCommand({
          call,
          taskStore,
          taskId,
          updates,
          dataUsed: { dueDate, dueTime: dueTime || null },
        })

        return {
          success: true,
          message: tm(language, `Set due date for "${task.title}" to ${dueDate}${dueTime ? ' at ' + dueTime : ''}`, `נקבע תאריך יעד ל-"${task.title}": ${dueDate}${dueTime ? ' בשעה ' + dueTime : ''}`),
          data: { taskId, dueDate, dueTime: dueTime || null },
          undoAction: { toolName: 'set_task_due_date', params: { taskId, dueDate: previousDueDate } },
        }
      }

      case 'get_overdue_tasks': {
        const now = new Date()
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const overdue = taskStore.tasks.filter((t: Task) => {
          if (!t.dueDate || t.status === 'done') return false
          // Normalize: extract YYYY-MM-DD from either "2026-02-07" or "2026-02-07T22:00:00+00:00"
          const dueDateKey = t.dueDate.includes('T') ? t.dueDate.split('T')[0] : t.dueDate
          return dueDateKey < todayKey
        })

        return {
          success: true,
          message: tm(language, `Found ${overdue.length} overdue tasks`, `נמצאו ${overdue.length} משימות באיחור`),
          data: overdue.map((t: Task) => {
            const dueDateKey = t.dueDate.includes('T') ? t.dueDate.split('T')[0] : t.dueDate
            const [y, m, d] = dueDateKey.split('-').map(Number)
            const dueMs = new Date(y, m - 1, d).getTime()
            return {
              id: t.id,
              title: t.title,
              dueDate: t.dueDate,
              priority: t.priority,
              status: t.status,
              daysOverdue: Math.max(1, Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24))),
            }
          }),
        }
      }

      case 'bulk_update_status': {
        const taskIds = call.parameters.taskIds as string[]
        const status = call.parameters.status as Task['status']
        const confirmed = call.parameters.confirmed as boolean

        if (!confirmed) {
          return {
            success: false,
            message: tm(language, `Bulk status update of ${taskIds.length} tasks requires confirmation. Set confirmed=true to proceed.`, `עדכון סטטוס מרוכז של ${taskIds.length} משימות דורש אישור. הגדר confirmed=true להמשך.`),
          }
        }

        if (!VALID_STATUSES.includes(status)) {
          return { success: false, message: tm(language, `Invalid status "${status}". Valid: ${VALID_STATUSES.join(', ')}`, `סטטוס לא תקין "${status}". אפשרויות: ${VALID_STATUSES.join(', ')}`) }
        }

        if (!Array.isArray(taskIds) || taskIds.length === 0) {
          return { success: false, message: tm(language, 'taskIds must be a non-empty array.', 'רשימת מזהי המשימות חייבת להיות לא ריקה.') }
        }

        const results: Array<{ id: string; title: string; success: boolean }> = []
        for (const id of taskIds) {
          const task = validateTaskExists(taskStore, id)
          if (task) {
            try {
              await applyAITaskUpdateToolCommand({
                call,
                taskStore,
                taskId: id,
                updates: { status },
                dataUsed: { bulk: true, status },
              })
              results.push({ id, title: task.title, success: true })
            } catch {
              results.push({ id, title: task.title, success: false })
            }
          } else {
            results.push({ id, title: '(not found)', success: false })
          }
        }

        const successCount = results.filter(r => r.success).length
        return {
          success: successCount > 0,
          message: tm(language, `Updated ${successCount}/${taskIds.length} tasks to "${status}"`, `עודכנו ${successCount}/${taskIds.length} משימות ל-"${status}"`),
          data: { status, results },
        }
      }

      case 'collect_overdue_to_group': {
        let groupId = call.parameters.groupId as string | undefined

        // If no groupId provided, find the first group
        if (!groupId) {
          const groups = canvasStore.groups
          if (groups.length === 0) {
            return {
              success: false,
              message: tm(language, 'No groups found on the canvas. Create a group first.', 'לא נמצאו קבוצות בקנבס. צור קבוצה תחילה.'),
            }
          }
          groupId = groups[0].id
        }

        // Find overdue tasks for reporting (normalize dates with T timestamps)
        const now = new Date()
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const normDate = (d: string) => d.includes('T') ? d.split('T')[0] : d
        const overdueTasks = taskStore.tasks.filter((t: Task) => {
          if (!t.dueDate || t.status === 'done') return false
          if (normDate(t.dueDate) >= todayKey) return false
          if (t.parentId === groupId) return false
          return true
        })

        if (overdueTasks.length === 0) {
          return {
            success: true,
            message: tm(language, 'No overdue tasks found outside this group.', 'לא נמצאו משימות באיחור מחוץ לקבוצה.'),
            data: { overdueCount: 0 },
          }
        }

        // Import and call the collect function dynamically
        // The actual positioning logic lives in useCanvasTaskActions
        // We trigger it via a custom event that CanvasView listens to
        window.dispatchEvent(new CustomEvent('collect-overdue-tasks', {
          detail: { groupId }
        }))

        return {
          success: true,
          message: tm(language, `Collecting ${overdueTasks.length} overdue tasks and arranging them near the group`, `אוסף ${overdueTasks.length} משימות באיחור ומסדר ליד הקבוצה`),
          data: {
            groupId,
            overdueCount: overdueTasks.length,
            tasks: overdueTasks.slice(0, 10).map((t: Task) => ({
              id: t.id,
              title: t.title,
              dueDate: t.dueDate,
              daysOverdue: Math.max(1, Math.floor((new Date(todayKey).getTime() - new Date(normDate(t.dueDate)).getTime()) / (1000 * 60 * 60 * 24))),
            })),
          },
        }
      }

      // ── GAMIFICATION & PRODUCTIVITY TOOLS ────────────────────────────────
      case 'get_productivity_stats': {
        const allTasks = taskStore.tasks
        const todayStr = new Date().toISOString().split('T')[0]
        const normDate = (d: string) => d.includes('T') ? d.split('T')[0] : d

        const byStatus = { todo: 0, done: 0 }
        let overdueCount = 0
        let completedToday = 0

        for (const t of allTasks) {
          if (t.status === 'todo') byStatus.todo++
          else if (t.status === 'done') byStatus.done++
          if (t.dueDate && normDate(t.dueDate) < todayStr && t.status !== 'done') {
            overdueCount++
          }
          if (t.status === 'done') {
            const completedDate = t.completedAt
              ? new Date(t.completedAt).toISOString().split('T')[0]
              : new Date(t.updatedAt).toISOString().split('T')[0]
            if (completedDate === todayStr) completedToday++
          }
        }

        // Timer sessions
        let sessionsToday = 0
        try {
          timerStore = useTimerStore()
          sessionsToday = timerStore.completedSessions.length
        } catch { /* timer not available */ }

        return {
          success: true,
          message: tm(language, 'Productivity statistics', 'סטטיסטיקות פרודוקטיביות'),
          data: {
            totalTasks: allTasks.length,
            completedToday,
            overdueCount,
            byStatus,
            pomodorosToday: sessionsToday,
          },
        }
      }

      case 'suggest_next_task': {
        const allTasks = taskStore.tasks
        const todayStr = new Date().toISOString().split('T')[0]
        const normDate = (d: string) => d.includes('T') ? d.split('T')[0] : d

        // Filter actionable tasks (not done)
        const actionable = allTasks.filter((t: Task) =>
          t.status !== 'done'
        )

        if (actionable.length === 0) {
          return { success: true, message: tm(language, 'No actionable tasks found. Everything is done!', 'לא נמצאו משימות פעילות. הכל הושלם!'), data: { suggestion: null } }
        }

        // Score tasks: overdue high-priority first, then due today, then by priority
        const scored = actionable.map((t: Task) => {
          let score = 0
          const dueDateKey = t.dueDate ? normDate(t.dueDate) : null

          // Overdue tasks get highest priority
          if (dueDateKey && dueDateKey < todayStr) score += 100
          // Due today
          if (dueDateKey && dueDateKey === todayStr) score += 50
          // Priority scoring
          if (t.priority === 'high') score += 30
          else if (t.priority === 'medium') score += 15
          else if (t.priority === 'low') score += 5
          // Active tasks get a small boost
          if (t.status === 'todo') score += 10

          return { task: t, score }
        })

        scored.sort((a, b) => b.score - a.score)

        const top = scored.slice(0, 3)
        return {
          success: true,
          message: tm(language, `Suggested ${top.length} tasks to work on next`, `הוצעו ${top.length} משימות להמשך עבודה`),
          data: top.map(({ task, score }) => ({
            id: task.id,
            title: task.title,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate || null,
            score,
            reason: score >= 100 ? 'overdue' : score >= 50 ? 'due today' : score >= 30 ? 'high priority' : 'next up',
          })),
        }
      }

      case 'get_weekly_summary': {
        const allTasks = taskStore.tasks
        const now = new Date()
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        const weekAgoMs = weekAgo.getTime()
        const weekAgoStr = weekAgo.toISOString().split('T')[0]

        // TASK-1820: return the ACTUAL completed-this-week tasks (array with
        // titles) so the AI chat renders real, clickable task cards and grounds
        // the count in real data. Previously this returned only integers, which
        // the card pipeline can't use — so the model fabricated task names.
        const completedThisWeek = allTasks
          .filter((t: Task) => {
            if (t.status !== 'done') return false
            const completedDate = t.completedAt
              ? new Date(t.completedAt).toISOString().split('T')[0]
              : new Date(t.updatedAt).toISOString().split('T')[0]
            return completedDate >= weekAgoStr
          })
          .sort((a: Task, b: Task) => {
            const at = new Date(a.completedAt ?? a.updatedAt).getTime()
            const bt = new Date(b.completedAt ?? b.updatedAt).getTime()
            return bt - at // most recent first
          })

        // Real focus minutes this week from completed (non-break) timer sessions.
        // PomodoroSession.duration is in SECONDS (workDuration default 25*60).
        // Omit entirely if there are no sessions — never fabricate "0h 0m".
        let focusMinutes = 0
        try {
          timerStore = useTimerStore()
          for (const s of timerStore.completedSessions) {
            if (s.isBreak) continue
            if (!s.completedAt) continue
            if (new Date(s.completedAt).getTime() < weekAgoMs) continue
            focusMinutes += Math.round((s.duration || 0) / 60)
          }
        } catch { /* timer not available */ }

        const focusHrs = Math.floor(focusMinutes / 60)
        const focusRem = focusMinutes % 60
        const focusClauseEn = focusMinutes > 0 ? `, ${focusHrs}h ${focusRem}m focus` : ''
        const focusClauseHe = focusMinutes > 0 ? `, ${focusHrs} שעות ${focusRem} דקות פוקוס` : ''

        return {
          success: true,
          message: tm(
            language,
            `Weekly summary: ${completedThisWeek.length} tasks completed${focusClauseEn}`,
            `סיכום שבועי: הושלמו ${completedThisWeek.length} משימות${focusClauseHe}`,
          ),
          data: completedThisWeek.map((t: Task) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            projectId: t.projectId,
            status: t.status,
            completedAt: t.completedAt ?? t.updatedAt,
          })),
        }
      }

      case 'mark_task_done': {
        const taskRef = call.parameters.task as string
        if (!taskRef) {
          return { success: false, message: tm(language, 'Please specify which task to mark as done (title or ID).', 'נא לציין איזו משימה לסמן כהושלמה (כותרת או מזהה).') }
        }

        const task = validateTaskExists(taskStore, taskRef)
        if (!task) {
          return { success: false, message: tm(language, `No task found matching "${taskRef}". Try a more specific title.`, `לא נמצאה משימה התואמת ל-"${taskRef}". נסה כותרת ספציפית יותר.`) }
        }

        if (task.status === 'done') {
          return { success: true, message: tm(language, `"${task.title}" is already marked as done.`, `"${task.title}" כבר מסומנת כהושלמה.`) }
        }

        await applyAITaskUpdateToolCommand({
          call,
          taskStore,
          taskId: task.id,
          updates: { status: 'done' },
          dataUsed: { taskRef },
        })
        return {
          success: true,
          message: tm(language, `Marked "${task.title}" as done!`, `"${task.title}" סומנה כהושלמה!`),
          data: { id: task.id, title: task.title, previousStatus: task.status },
        }
      }

      default:
        return {
          success: false,
          message: tm(language, `Unknown tool: ${call.tool}`, `כלי לא מוכר: ${call.tool}`),
        }
    }
  } catch (error) {
    return {
      success: false,
      message: tm(language, `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, `הפעלת כלי נכשלה: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`),
    }
  }
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse tool calls from AI response.
 * Looks for JSON blocks with tool calls.
 */
export function parseToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = []

  // 1. Look for ```tool or ```json blocks containing tool calls (preferred format)
  const toolBlockRegex = /```(?:tool|json)?\s*\n?([\s\S]*?)\n?```/g
  let match

  while ((match = toolBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())

      // Handle single tool call or array
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.tool && typeof item.tool === 'string') {
            calls.push(item as ToolCall)
          }
        }
      } else if (parsed.tool && typeof parsed.tool === 'string') {
        calls.push(parsed as ToolCall)
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  // 2. Fallback: detect bare JSON tool calls without code fences
  //    Models (especially Ollama/small) often output { "tool": "...", "parameters": {...} } as plain text
  if (calls.length === 0) {
    const bareJsonRegex = /\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"parameters"\s*:\s*(\{[^}]*\})\s*\}/g
    let bareMatch
    while ((bareMatch = bareJsonRegex.exec(content)) !== null) {
      try {
        const fullMatch = bareMatch[0]
        const parsed = JSON.parse(fullMatch)
        if (parsed.tool && typeof parsed.tool === 'string') {
          calls.push(parsed as ToolCall)
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  // Enforce rate limit
  if (calls.length > MAX_TOOLS_PER_RESPONSE) {
    console.warn(`[AI Tools] Truncating tool calls from ${calls.length} to ${MAX_TOOLS_PER_RESPONSE}`)
    return calls.slice(0, MAX_TOOLS_PER_RESPONSE)
  }

  return calls
}

/**
 * Parse TEXT-based tool calls of the form `tool_name({...})` (TASK-1814).
 * Used for bridge brains (claude/codex CLIs) that emit tool calls as text rather
 * than native function-calls. Falls back to parseToolCalls() for JSON-style calls.
 * Exported so it can be unit-tested against real brain output.
 */
export function parseTextToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = []
  const toolNames = AI_TOOLS.map(t => t.name)

  for (const name of toolNames) {
    // Match: tool_name() or tool_name({...}) or tool_name(anything-without-paren)
    const pattern = new RegExp(`\\b${name}\\s*\\(([^)]*)\\)`, 'g')
    let match
    while ((match = pattern.exec(content)) !== null) {
      let parameters: Record<string, unknown> = {}
      const argsStr = match[1].trim()
      if (argsStr) {
        try { parameters = JSON.parse(argsStr) } catch { /* defaults */ }
      }
      if (!calls.some(c => c.tool === name)) {
        calls.push({ tool: name, parameters })
      }
    }
  }

  // Fallback: JSON-format tool calls ({ "tool": ..., "parameters": ... })
  if (calls.length === 0) {
    calls.push(...parseToolCalls(content))
  }

  return calls.slice(0, MAX_TOOLS_PER_RESPONSE)
}

/**
 * Build the tools description for the system prompt.
 */
export function buildToolsPrompt(): string {
  const lines = [
    '## Tools (use when user asks to CREATE, MODIFY, DELETE, or QUERY something)',
    '',
    'When the user asks you to create a task, update something, check status, or manage their workflow,',
    'you can execute actions by including a hidden JSON block. The user will NOT see this block.',
    '',
    'Format (hidden from user):',
    '```json',
    '{"tool": "tool_name", "parameters": {"param1": "value1"}}',
    '```',
    '',
    'IMPORTANT RULES:',
    '- ALWAYS use READ tools when user asks about their tasks, overdue items, schedule, timer, projects, or any data. Read tools show rich interactive results the user can click. Never guess or answer task questions from context alone — use the tool.',
    '- Use WRITE tools when user says things like "create", "add", "make", "change", "start timer", "stop timer".',
    '- Use DESTRUCTIVE tools (delete, bulk) only when explicitly asked. These need confirmed=true.',
    '- For normal chat, greetings, or general questions unrelated to their data - respond naturally without tools.',
    `- Maximum ${MAX_TOOLS_PER_RESPONSE} tool calls per response.`,
    '- After using a READ tool, write intro sentence + 2-4 bullet points max. Each bullet: **bold task name** — key fact. Tool results render as interactive cards below — do not repeat the task list.',
    '',
    'Available tools:',
    '',
  ]

  // Group tools by category for clearer prompt
  const readTools = AI_TOOLS.filter(t => t.category === 'read')
  const writeTools = AI_TOOLS.filter(t => t.category === 'write')
  const destructiveTools = AI_TOOLS.filter(t => t.category === 'destructive')

  const renderTools = (tools: ToolDefinition[], header: string) => {
    lines.push(`### ${header}`)
    lines.push('')
    for (const tool of tools) {
      lines.push(`**${tool.name}**: ${tool.description}`)
      if (tool.requiresConfirmation) {
        lines.push('  ⚠️ Requires confirmed=true')
      }

      const params = Object.entries(tool.parameters.properties)
      if (params.length > 0) {
        for (const [name, schema] of params) {
          const required = tool.parameters.required.includes(name) ? '(required)' : '(optional)'
          const enumStr = schema.enum ? ` - options: ${schema.enum.join(', ')}` : ''
          lines.push(`  - ${name}: ${schema.description} ${required}${enumStr}`)
        }
      } else {
        lines.push('  - No parameters')
      }
      lines.push('')
    }
  }

  renderTools(readTools, 'Read Operations (ALWAYS use these for data queries — they show clickable interactive results)')
  renderTools(writeTools, 'Write Operations (create or modify data)')
  renderTools(destructiveTools, 'Destructive Operations (require confirmation)')

  lines.push(
    'When you use a WRITE tool, say something natural like "Done!" or "Created!" in the user\'s language.',
    'When you use a READ tool, write ONE short sentence like "Here are your overdue tasks:" — the tool data renders as clickable cards below your message automatically. Do NOT list the tasks in your text.'
  )

  return lines.join('\n')
}

/**
 * Build OpenAI-compatible tools array for native function calling.
 * Used with cloud providers (Groq, OpenRouter) that support the tools[] API parameter.
 */
export function buildOpenAITools(): OpenAITool[] {
  return AI_TOOLS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description + (tool.requiresConfirmation ? ' (requires confirmed=true parameter)' : ''),
      parameters: {
        type: 'object',
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      }
    }
  }))
}

/**
 * Build a minimal tool behavior prompt for native function calling mode.
 * When native tools[] are sent via API, the model already knows tool definitions,
 * so we only need behavioral rules.
 */
export function buildNativeToolsBehaviorPrompt(): string {
  return [
    '## Tool Usage Rules',
    '',
    'You have access to tools via function calling. Use them as follows:',
    '',
    'IMPORTANT RULES:',
    '- ALWAYS use read tools when user asks about their tasks, overdue items, schedule, timer, projects, or any data. Read tools show rich interactive results the user can click.',
    '- Use write tools when user says "create", "add", "make", "change", "start timer", "stop timer".',
    '- Use destructive tools only when explicitly asked. Pass confirmed=true for destructive operations.',
    '- For normal chat, greetings, or general questions — respond naturally without tools.',
    `- Maximum ${MAX_TOOLS_PER_RESPONSE} tool calls per response.`,
    '- list_tasks and search_tasks EXCLUDE done/completed tasks by default. Only pass status="done" if user explicitly asks about completed tasks.',
    '',
    '## Response Format Rules (CRITICAL):',
    '',
    'After READ tools:',
    '- Write a SHORT analytical summary: intro sentence + 2-4 bullet points max.',
    '- Each bullet: **bold task name** — key fact.',
    '- Tool results render as interactive cards below — do NOT repeat the task list.',
    '- NEVER include task IDs (UUIDs) in your text response.',
    '- Focus on INSIGHTS (priorities, urgency, patterns) — not descriptions of the data.',
    '',
    'After WRITE tools:',
    '- Say something natural like "Done!" or "Created!" in the user\'s language',
    '- Keep it to 1 sentence',
    '',
    'General formatting:',
    '- Use bullet points (•) or numbered lists for any list of recommendations',
    '- Bold (**text**) for emphasis on key points',
    '- Keep responses concise — never more than 2-3 short sentences for analytical responses. No generic productivity advice.',
    '- NEVER show raw IDs, JSON, or technical details to the user',
  ].join('\n')
}

/**
 * Build a tool-usage prompt for TEXT-based tool calling (TASK-1814).
 * Used for the subscription bridge brains (claude/codex CLIs) which cannot do
 * native/MCP function-calling — they must emit `tool_name({...})` as text, which
 * the ReAct loop parses via parseTextToolCalls(). Lists every tool + its params
 * so the model emits correct calls instead of narrating ("MCP tools should...").
 */
export function buildTextToolsBehaviorPrompt(): string {
  const toolList = AI_TOOLS.map(tool => {
    const props = (tool.parameters?.properties || {}) as Record<string, unknown>
    const required = tool.parameters?.required || []
    const params = Object.keys(props)
      .map(p => (required.includes(p) ? p : `${p}?`))
      .join(', ')
    const conf = tool.requiresConfirmation ? ' [add "confirmed": true]' : ''
    const desc = (tool.description || '').split('.')[0]
    return `- ${tool.name}(${params})${conf} — ${desc}`
  }).join('\n')

  return [
    '## TOOL USE — you act THROUGH the FlowState app (no native/MCP tools).',
    '',
    'You are wired into FlowState: every tool call you emit IS executed against the user\'s REAL task database, and the results are returned to you. You DO have full access to the user\'s tasks through these tool calls. NEVER claim you lack access, NEVER ask where tasks are stored, NEVER suggest other apps (Google Tasks, Obsidian, etc.) — the tasks are right here and your calls reach them.',
    '',
    'To act, output a line containing EXACTLY one tool call in this format (and nothing else):',
    'tool_name({"param": "value"})',
    '',
    'STRICT RULES:',
    '- When the user asks about their tasks / overdue / schedule / projects, OR asks to create, change, complete, or delete something — your FIRST output MUST be the tool-call line and NOTHING else. Do NOT explain, do NOT say "let me check" / "I will", do NOT mention "MCP" or "tools". Just emit the call.',
    '- After the tool results are returned to you, write your final answer in the user\'s language. Do not call more tools unless clearly needed.',
    '- Arguments must be valid JSON with double quotes.',
    '- To complete/finish a task, use mark_task_done with a title fragment (no UUID needed).',
    '- For destructive tools, add "confirmed": true.',
    `- At most ${MAX_TOOLS_PER_RESPONSE} tool calls.`,
    '- For greetings or general questions, just answer normally — no tool call.',
    '',
    'Available tools (param? = optional):',
    toolList,
    '',
    'EXAMPLES:',
    'User: "what are my overdue tasks?"  ->  get_overdue_tasks({})',
    'User: "show my tasks"  ->  list_tasks({})',
    'User: "find the task about Reuital"  ->  search_tasks({"query": "Reuital"})',
    'User: "mark the Reuital task done"  ->  mark_task_done({"task": "Reuital"})',
    'User: "create a task to call the bank tomorrow"  ->  create_task({"title": "Call the bank", "dueDate": "tomorrow"})',
  ].join('\n')
}

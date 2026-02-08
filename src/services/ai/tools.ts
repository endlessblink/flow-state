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
import type { Task } from '@/types/tasks'

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of tool calls the AI can make in a single response */
export const MAX_TOOLS_PER_RESPONSE = 5

/** Valid task statuses */
const VALID_STATUSES: Task['status'][] = ['planned', 'in_progress', 'done', 'backlog', 'on_hold']

/** Valid task priorities */
const VALID_PRIORITIES: Array<Task['priority']> = ['low', 'medium', 'high', null]

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
    description: 'List tasks, optionally filtered by status',
    category: 'read',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status', enum: ['planned', 'in_progress', 'done', 'backlog', 'all'] },
        limit: { type: 'number', description: 'Maximum number of tasks to return (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to update' },
        status: { type: 'string', description: 'The new status', enum: ['planned', 'in_progress', 'done', 'backlog'] },
      },
      required: ['taskId', 'status'],
    },
  },

  // ── HIGH PRIORITY: 6 new tools ────────────────────────────────────────────
  {
    name: 'update_task',
    description: 'Update one or more fields of a task (title, description, priority, dueDate, status, estimatedDuration)',
    category: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to update' },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        priority: { type: 'string', description: 'New priority', enum: ['low', 'medium', 'high'] },
        dueDate: { type: 'string', description: 'New due date in YYYY-MM-DD format' },
        status: { type: 'string', description: 'New status', enum: ['planned', 'in_progress', 'done', 'backlog'] },
        estimatedDuration: { type: 'number', description: 'Estimated duration in minutes' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'search_tasks',
    description: 'Search tasks by text query across titles and descriptions',
    category: 'read',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for in task titles and descriptions' },
        priority: { type: 'string', description: 'Filter by priority', enum: ['low', 'medium', 'high'] },
        status: { type: 'string', description: 'Filter by status', enum: ['planned', 'in_progress', 'done', 'backlog'] },
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
    name: 'bulk_update_status',
    description: 'Update the status of multiple tasks at once. Requires confirmed=true to execute.',
    category: 'destructive',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        taskIds: { type: 'array', description: 'Array of task IDs to update', items: { type: 'string' } },
        status: { type: 'string', description: 'The new status for all tasks', enum: ['planned', 'in_progress', 'done', 'backlog'] },
        confirmed: { type: 'boolean', description: 'Must be true to confirm bulk operation' },
      },
      required: ['taskIds', 'status', 'confirmed'],
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

function validateTaskExists(taskStore: ReturnType<typeof useTaskStore>, taskId: string): Task | null {
  const task = taskStore.getTask(taskId)
  return task || null
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Execute a tool call and return the result.
 */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
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
    return { success: false, message: 'Core stores not available. Please try again after the app is fully loaded.' }
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

        const group = await canvasStore.createGroup({
          name,
          type: 'custom',
          position: { x: xPos, y: yPos, width: 400, height: 300 },
          color,
          layout: 'freeform',
          isVisible: true,
          isCollapsed: false,
        })

        return {
          success: true,
          message: `Created group "${name}"`,
          data: { id: group.id, name: group.name },
        }
      }

      case 'create_task': {
        const title = call.parameters.title as string
        const priority = (call.parameters.priority as Task['priority']) || 'medium'
        const description = call.parameters.description as string | undefined
        const dueDate = call.parameters.dueDate as string | undefined

        if (dueDate && !isValidISODate(dueDate)) {
          return { success: false, message: `Invalid date format "${dueDate}". Use YYYY-MM-DD.` }
        }

        const task = await taskStore.createTask({ title, priority, description, dueDate })

        return {
          success: true,
          message: `Created task "${title}"`,
          data: { id: task.id, title: task.title, priority: task.priority },
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
          message: `Found ${groups.length} groups`,
          data: groupList,
        }
      }

      case 'list_tasks': {
        const status = call.parameters.status as string | undefined
        const limit = (call.parameters.limit as number) || 50

        let tasks = taskStore.tasks

        if (status && status !== 'all') {
          tasks = tasks.filter((t: Task) => t.status === status)
        }

        tasks = tasks.slice(0, limit)

        const taskList = tasks.map((t: Task) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate || null,
        }))

        return {
          success: true,
          message: `Found ${taskList.length} tasks`,
          data: taskList,
        }
      }

      case 'update_task_status': {
        const taskId = call.parameters.taskId as string
        const status = call.parameters.status as Task['status']

        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: `Task with ID "${taskId}" not found` }
        }

        if (!VALID_STATUSES.includes(status)) {
          return { success: false, message: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(', ')}` }
        }

        const previousStatus = task.status
        await taskStore.updateTask(taskId, { status })

        return {
          success: true,
          message: `Updated task "${task.title}" status to "${status}"`,
          data: { id: taskId, status },
          undoAction: { toolName: 'update_task_status', params: { taskId, status: previousStatus } },
        }
      }

      // ── HIGH PRIORITY: 6 new tools ──────────────────────────────────────
      case 'update_task': {
        const taskId = call.parameters.taskId as string
        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: `Task with ID "${taskId}" not found` }
        }

        const updates: Partial<Task> = {}
        const updatedFields: string[] = []

        if (call.parameters.title !== undefined) {
          updates.title = call.parameters.title as string
          updatedFields.push('title')
        }
        if (call.parameters.description !== undefined) {
          updates.description = call.parameters.description as string
          updatedFields.push('description')
        }
        if (call.parameters.priority !== undefined) {
          const p = call.parameters.priority as Task['priority']
          if (!VALID_PRIORITIES.includes(p)) {
            return { success: false, message: `Invalid priority "${p}". Valid: low, medium, high` }
          }
          updates.priority = p
          updatedFields.push('priority')
        }
        if (call.parameters.dueDate !== undefined) {
          const dd = call.parameters.dueDate as string
          if (!isValidISODate(dd)) {
            return { success: false, message: `Invalid date format "${dd}". Use YYYY-MM-DD.` }
          }
          updates.dueDate = dd
          updatedFields.push('dueDate')
        }
        if (call.parameters.status !== undefined) {
          const s = call.parameters.status as Task['status']
          if (!VALID_STATUSES.includes(s)) {
            return { success: false, message: `Invalid status "${s}". Valid: ${VALID_STATUSES.join(', ')}` }
          }
          updates.status = s
          updatedFields.push('status')
        }
        if (call.parameters.estimatedDuration !== undefined) {
          updates.estimatedDuration = call.parameters.estimatedDuration as number
          updatedFields.push('estimatedDuration')
        }

        if (updatedFields.length === 0) {
          return { success: false, message: 'No valid fields to update. Provide at least one of: title, description, priority, dueDate, status, estimatedDuration.' }
        }

        await taskStore.updateTask(taskId, updates)

        return {
          success: true,
          message: `Updated task "${task.title}": ${updatedFields.join(', ')}`,
          data: { id: taskId, updatedFields },
        }
      }

      case 'search_tasks': {
        const query = (call.parameters.query as string).toLowerCase()
        const filterPriority = call.parameters.priority as Task['priority'] | undefined
        const filterStatus = call.parameters.status as Task['status'] | undefined
        const limit = (call.parameters.limit as number) || 20

        let results = taskStore.tasks.filter((t: Task) => {
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

        results = results.slice(0, limit)

        return {
          success: true,
          message: `Found ${results.length} tasks matching "${call.parameters.query}"`,
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
          return { success: false, message: `Task with ID "${taskId}" not found` }
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
          message: `Details for task "${task.title}"`,
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
          return { success: false, message: 'Timer store not available.' }
        }

        const taskId = call.parameters.taskId as string
        const durationMinutes = (call.parameters.duration as number) || 25
        const durationSeconds = durationMinutes * 60

        // Verify the task exists (unless it's 'general')
        if (taskId !== 'general') {
          const task = validateTaskExists(taskStore, taskId)
          if (!task) {
            return { success: false, message: `Task with ID "${taskId}" not found` }
          }
        }

        if (timerStore.isTimerActive) {
          return { success: false, message: 'A timer is already running. Stop it first with stop_timer.' }
        }

        await timerStore.startTimer(taskId, durationSeconds)

        const taskName = taskId === 'general' ? 'Focus Session' : (validateTaskExists(taskStore, taskId)?.title || taskId)
        return {
          success: true,
          message: `Started ${durationMinutes}-minute timer for "${taskName}"`,
          data: { taskId, durationMinutes },
        }
      }

      case 'stop_timer': {
        try {
          timerStore = useTimerStore()
        } catch {
          return { success: false, message: 'Timer store not available.' }
        }

        if (!timerStore.isTimerActive) {
          return { success: false, message: 'No timer is currently running.' }
        }

        const taskName = timerStore.currentTaskName || 'Unknown'
        const remaining = timerStore.currentSession?.remainingTime || 0
        await timerStore.stopTimer()

        return {
          success: true,
          message: `Stopped timer for "${taskName}" (${formatTime(remaining)} remaining)`,
          data: { stoppedTask: taskName, remainingTime: formatTime(remaining) },
        }
      }

      case 'get_timer_status': {
        try {
          timerStore = useTimerStore()
        } catch {
          return { success: false, message: 'Timer store not available.' }
        }

        const session = timerStore.currentSession
        if (!session || !timerStore.isTimerActive) {
          return {
            success: true,
            message: 'No timer is currently running',
            data: { isActive: false },
          }
        }

        return {
          success: true,
          message: `Timer active: ${timerStore.currentTaskName} (${formatTime(session.remainingTime)} remaining)`,
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
          return { success: false, message: `Task with ID "${taskId}" not found` }
        }

        if (!confirmed) {
          return {
            success: false,
            message: `Deletion of "${task.title}" requires confirmation. Set confirmed=true to proceed.`,
          }
        }

        await taskStore.deleteTask(taskId)

        return {
          success: true,
          message: `Deleted task "${task.title}"`,
          data: { id: taskId, title: task.title },
        }
      }

      case 'move_task_to_group': {
        const taskId = call.parameters.taskId as string
        const groupId = call.parameters.groupId as string

        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: `Task with ID "${taskId}" not found` }
        }

        const group = canvasStore.groups.find(g => g.id === groupId)
        if (!group) {
          return { success: false, message: `Group with ID "${groupId}" not found` }
        }

        // Update task's parentId to move it into the group
        const previousParentId = task.parentId
        await taskStore.updateTask(taskId, { parentId: groupId })

        return {
          success: true,
          message: `Moved task "${task.title}" to group "${group.name}"`,
          data: { taskId, groupId, groupName: group.name },
          undoAction: { toolName: 'move_task_to_group', params: { taskId, groupId: previousParentId || '' } },
        }
      }

      case 'list_projects': {
        try {
          projectStore = useProjectStore()
        } catch {
          return { success: false, message: 'Project store not available.' }
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
          message: `Found ${projects.length} projects`,
          data: projectList,
        }
      }

      case 'assign_task_to_project': {
        const taskId = call.parameters.taskId as string
        const projectId = call.parameters.projectId as string

        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: `Task with ID "${taskId}" not found` }
        }

        try {
          projectStore = useProjectStore()
        } catch {
          return { success: false, message: 'Project store not available.' }
        }

        const project = projectStore.getProjectById(projectId)
        if (!project) {
          return { success: false, message: `Project with ID "${projectId}" not found` }
        }

        const previousProjectId = task.projectId
        await taskStore.updateTask(taskId, { projectId })

        return {
          success: true,
          message: `Assigned task "${task.title}" to project "${project.name}"`,
          data: { taskId, projectId, projectName: project.name },
          undoAction: { toolName: 'assign_task_to_project', params: { taskId, projectId: previousProjectId } },
        }
      }

      case 'get_daily_summary': {
        const dateStr = (call.parameters.date as string) || new Date().toISOString().split('T')[0]
        if (!isValidISODate(dateStr)) {
          return { success: false, message: `Invalid date format "${dateStr}". Use YYYY-MM-DD.` }
        }

        const allTasks = taskStore.tasks
        const today = dateStr

        const dueToday = allTasks.filter((t: Task) => t.dueDate === today && t.status !== 'done')
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
          return t.dueDate < today
        })

        // Timer sessions info
        let sessionsCompleted = 0
        try {
          timerStore = useTimerStore()
          sessionsCompleted = timerStore.completedSessions.length
        } catch { /* timer not available */ }

        return {
          success: true,
          message: `Daily summary for ${dateStr}`,
          data: {
            date: dateStr,
            dueToday: dueToday.length,
            dueTodayTasks: dueToday.map((t: Task) => ({ id: t.id, title: t.title, priority: t.priority })),
            completedToday: completedToday.length,
            overdueCount: overdue.length,
            overdueTasks: overdue.slice(0, 10).map((t: Task) => ({ id: t.id, title: t.title, dueDate: t.dueDate })),
            timerSessionsCompleted: sessionsCompleted,
            totalTasks: allTasks.length,
            inProgress: allTasks.filter((t: Task) => t.status === 'in_progress').length,
          },
        }
      }

      case 'create_subtasks': {
        const parentTaskId = call.parameters.parentTaskId as string
        const subtaskDefs = call.parameters.subtasks as Array<{ title: string }>

        const parentTask = validateTaskExists(taskStore, parentTaskId)
        if (!parentTask) {
          return { success: false, message: `Parent task with ID "${parentTaskId}" not found` }
        }

        if (!Array.isArray(subtaskDefs) || subtaskDefs.length === 0) {
          return { success: false, message: 'subtasks must be a non-empty array of objects with title.' }
        }

        const created: Array<{ id: string; title: string }> = []
        for (const sub of subtaskDefs) {
          if (!sub.title || typeof sub.title !== 'string') continue
          const result = taskStore.createSubtask(parentTaskId, { title: sub.title })
          if (result) {
            created.push({ id: result.id, title: result.title })
          }
        }

        return {
          success: true,
          message: `Created ${created.length} subtasks under "${parentTask.title}"`,
          data: { parentTaskId, subtasks: created },
        }
      }

      // ── NICE-TO-HAVE: 3 new tools ──────────────────────────────────────
      case 'set_task_due_date': {
        const taskId = call.parameters.taskId as string
        const dueDate = call.parameters.dueDate as string
        const dueTime = call.parameters.dueTime as string | undefined

        const task = validateTaskExists(taskStore, taskId)
        if (!task) {
          return { success: false, message: `Task with ID "${taskId}" not found` }
        }

        if (!isValidISODate(dueDate)) {
          return { success: false, message: `Invalid date format "${dueDate}". Use YYYY-MM-DD.` }
        }
        if (dueTime && !isValidTimeString(dueTime)) {
          return { success: false, message: `Invalid time format "${dueTime}". Use HH:MM.` }
        }

        const updates: Partial<Task> = { dueDate }
        if (dueTime) updates.dueTime = dueTime

        const previousDueDate = task.dueDate
        await taskStore.updateTask(taskId, updates)

        return {
          success: true,
          message: `Set due date for "${task.title}" to ${dueDate}${dueTime ? ' at ' + dueTime : ''}`,
          data: { taskId, dueDate, dueTime: dueTime || null },
          undoAction: { toolName: 'set_task_due_date', params: { taskId, dueDate: previousDueDate } },
        }
      }

      case 'get_overdue_tasks': {
        const today = new Date().toISOString().split('T')[0]
        const overdue = taskStore.tasks.filter((t: Task) => {
          if (!t.dueDate || t.status === 'done') return false
          return t.dueDate < today
        })

        return {
          success: true,
          message: `Found ${overdue.length} overdue tasks`,
          data: overdue.map((t: Task) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            priority: t.priority,
            status: t.status,
            daysOverdue: Math.floor((new Date(today).getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
          })),
        }
      }

      case 'bulk_update_status': {
        const taskIds = call.parameters.taskIds as string[]
        const status = call.parameters.status as Task['status']
        const confirmed = call.parameters.confirmed as boolean

        if (!confirmed) {
          return {
            success: false,
            message: `Bulk status update of ${taskIds.length} tasks requires confirmation. Set confirmed=true to proceed.`,
          }
        }

        if (!VALID_STATUSES.includes(status)) {
          return { success: false, message: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(', ')}` }
        }

        if (!Array.isArray(taskIds) || taskIds.length === 0) {
          return { success: false, message: 'taskIds must be a non-empty array.' }
        }

        const results: Array<{ id: string; title: string; success: boolean }> = []
        for (const id of taskIds) {
          const task = validateTaskExists(taskStore, id)
          if (task) {
            try {
              await taskStore.updateTask(id, { status })
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
          message: `Updated ${successCount}/${taskIds.length} tasks to "${status}"`,
          data: { status, results },
        }
      }

      default:
        return {
          success: false,
          message: `Unknown tool: ${call.tool}`,
        }
    }
  } catch (error) {
    return {
      success: false,
      message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  // Look for ```tool or ```json blocks containing tool calls
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

  // Enforce rate limit
  if (calls.length > MAX_TOOLS_PER_RESPONSE) {
    console.warn(`[AI Tools] Truncating tool calls from ${calls.length} to ${MAX_TOOLS_PER_RESPONSE}`)
    return calls.slice(0, MAX_TOOLS_PER_RESPONSE)
  }

  return calls
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
    '- After using a READ tool, keep your text response to 1 SHORT sentence. The tool results render as interactive cards below your message — do not repeat the data in text.',
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

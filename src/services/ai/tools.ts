/**
 * AI Tool Definitions and Execution
 *
 * Defines tools the AI can call and executes them against stores.
 * This enables the AI assistant to create groups, tasks, and query data.
 *
 * @see TASK-1120 in MASTER_PLAN.md
 */

import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'

// ============================================================================
// Tool Definitions
// ============================================================================

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<
      string,
      {
        type: string
        description: string
        enum?: string[]
      }
    >
    required: string[]
  }
}

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'create_group',
    description: 'Create a new group on the canvas to organize tasks',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the group',
        },
        color: {
          type: 'string',
          description: 'Optional color for the group (hex color like "#3b82f6")',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title of the task',
        },
        priority: {
          type: 'string',
          description: 'Priority level',
          enum: ['low', 'medium', 'high'],
        },
        description: {
          type: 'string',
          description: 'Optional description for the task',
        },
        dueDate: {
          type: 'string',
          description: 'Optional due date in YYYY-MM-DD format',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_groups',
    description: 'List all groups on the canvas',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['planned', 'in_progress', 'done', 'backlog', 'all'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return',
        },
      },
      required: [],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to update',
        },
        status: {
          type: 'string',
          description: 'The new status',
          enum: ['planned', 'in_progress', 'done', 'backlog'],
        },
      },
      required: ['taskId', 'status'],
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
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Execute a tool call and return the result.
 */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()

  try {
    switch (call.tool) {
      case 'create_group': {
        const name = call.parameters.name as string
        const color = (call.parameters.color as string) || '#3b82f6'

        // Find a reasonable position for the new group
        // Place it to the right of existing groups or at origin
        const existingGroups = canvasStore.groups
        let xPos = 100
        let yPos = 100

        if (existingGroups.length > 0) {
          // Find the rightmost group and place new one to its right
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

        const task = await taskStore.createTask({
          title,
          priority,
          description,
          dueDate,
        })

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
        const limit = call.parameters.limit as number | undefined

        let tasks = taskStore.tasks

        if (status && status !== 'all') {
          tasks = tasks.filter((t: Task) => t.status === status)
        }

        if (limit) {
          tasks = tasks.slice(0, limit)
        }

        const taskList = tasks.map((t: Task) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
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

        const task = taskStore.getTask(taskId)
        if (!task) {
          return {
            success: false,
            message: `Task with ID "${taskId}" not found`,
          }
        }

        await taskStore.updateTask(taskId, { status })

        return {
          success: true,
          message: `Updated task "${task.title}" status to "${status}"`,
          data: { id: taskId, status },
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

  return calls
}

/**
 * Build the tools description for the system prompt.
 */
export function buildToolsPrompt(): string {
  const lines = [
    '## Tools (only use when user asks to CREATE or MODIFY something)',
    '',
    'When the user explicitly asks you to create a task, create a group, or modify something,',
    'you can execute the action by including a hidden JSON block. The user will NOT see this block.',
    '',
    'Format (hidden from user):',
    '```json',
    '{"tool": "tool_name", "parameters": {"param1": "value1"}}',
    '```',
    '',
    'IMPORTANT: Only use tools when user says things like "create", "add", "make", "delete", "change".',
    'For normal chat, questions, or greetings - just respond naturally without any tools.',
    '',
    'Available tools:',
    '',
  ]

  for (const tool of AI_TOOLS) {
    lines.push(`### ${tool.name}`)
    lines.push(tool.description)
    lines.push('Parameters:')

    for (const [name, schema] of Object.entries(tool.parameters.properties)) {
      const required = tool.parameters.required.includes(name) ? '(required)' : '(optional)'
      const enumStr = schema.enum ? ` - options: ${schema.enum.join(', ')}` : ''
      lines.push(`- ${name}: ${schema.description} ${required}${enumStr}`)
    }
    lines.push('')
  }

  lines.push(
    'When you use a tool, just say something natural like "Done!" or "Created!" in the user\'s language. Keep it brief.'
  )

  return lines.join('\n')
}

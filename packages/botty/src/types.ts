export interface ParsedTask {
  title: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: string // YYYY-MM-DD
  duration?: number // minutes
  status: 'planned'
  notes?: string
}

export interface ParseResult {
  isTask: boolean
  title?: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string | null
  duration?: number
  notes?: string
}

export interface WAHAMessage {
  event: string
  session: string
  payload: {
    id: string
    from: string
    to: string
    body: string
    timestamp: number
    fromMe: boolean
    hasMedia: boolean
    isForwarded?: boolean
  }
}

export interface GroqResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/** Matches FlowState's SupabaseTask schema (snake_case DB columns) */
export interface SupabaseTaskInsert {
  id: string
  user_id: string
  title: string
  description: string
  status: string // 'planned' in DB
  priority: string | null
  due_date: string | null
  estimated_duration: number | null
  is_in_inbox: boolean
  is_deleted: boolean
  progress: number
  completed_pomodoros: number
  order: number
  subtasks: never[]
  tags: never[]
  instances: never[]
  recurring_instances: never[]
  created_at: string
  updated_at: string
}

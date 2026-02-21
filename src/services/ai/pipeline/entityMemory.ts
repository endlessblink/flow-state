/**
 * Conversation Entity Memory
 *
 * Tracks recently-mentioned task IDs in conversation context so the LLM
 * can resolve pronouns like "it", "that task", "the last one", "the first one".
 *
 * Pattern: after each tool call that returns task data, extract and record
 * the mentioned task IDs. Inject recent entity context into the system prompt
 * so the LLM knows what pronouns refer to.
 *
 * @see TASK-1398 in MASTER_PLAN.md
 */

/** A tracked entity with recency info */
export interface TrackedEntity {
  id: string
  title: string
  /** When this entity was last mentioned */
  mentionedAt: number
  /** How it was mentioned (tool result, user reference, etc.) */
  source: 'tool_result' | 'user_mention' | 'action_target'
}

/** Maximum entities to track per conversation */
const MAX_TRACKED = 20

/** How long entities remain relevant (15 minutes) */
const ENTITY_TTL_MS = 15 * 60 * 1000

/**
 * Extract task entities from tool result data.
 * Handles both array results (task lists) and single-task results.
 */
export function extractEntitiesFromToolResult(data: unknown): Array<{ id: string; title: string }> {
  const entities: Array<{ id: string; title: string }> = []

  if (!data) return entities

  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object' && 'id' in item && 'title' in item) {
        entities.push({ id: String(item.id), title: String(item.title) })
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if ('id' in obj && 'title' in obj) {
      entities.push({ id: String(obj.id), title: String(obj.title) })
    }
  }

  return entities
}

/**
 * Manages entity memory for a single conversation.
 */
export class EntityMemory {
  private entities: TrackedEntity[] = []

  /**
   * Record entities from a tool result.
   * Most recently mentioned entities go to the front.
   */
  trackFromToolResult(data: unknown): void {
    const extracted = extractEntitiesFromToolResult(data)
    const now = Date.now()

    for (const entity of extracted) {
      this.upsert(entity.id, entity.title, now, 'tool_result')
    }

    this.prune()
  }

  /**
   * Record a single entity that was explicitly acted on (e.g., marked as done).
   */
  trackActionTarget(id: string, title: string): void {
    this.upsert(id, title, Date.now(), 'action_target')
    this.prune()
  }

  /**
   * Get the most recently mentioned entities (most recent first).
   * Filters out expired entities.
   */
  getRecent(limit: number = 5): TrackedEntity[] {
    this.prune()
    return this.entities.slice(0, limit)
  }

  /**
   * Get the single most recently mentioned entity, or null.
   */
  getLastMentioned(): TrackedEntity | null {
    this.prune()
    return this.entities[0] || null
  }

  /**
   * Format entity context for injection into the system prompt.
   * Returns empty string if no recent entities.
   */
  formatForPrompt(): string {
    const recent = this.getRecent(5)
    if (recent.length === 0) return ''

    const lines = [
      '',
      '## RECENTLY MENTIONED TASKS (for pronoun resolution):',
      'When the user says "it", "that task", "the last one" — they mean the most recent task below.',
      'When they say "the first one", "the second one" — they refer to order in the last shown list.',
    ]

    for (let i = 0; i < recent.length; i++) {
      const e = recent[i]
      const label = i === 0 ? '(most recent)' : ''
      lines.push(`${i + 1}. "${e.title}" [ID: ${e.id}] ${label}`)
    }

    return lines.join('\n')
  }

  /**
   * Clear all tracked entities.
   */
  clear(): void {
    this.entities = []
  }

  // -- Internal --

  private upsert(id: string, title: string, now: number, source: TrackedEntity['source']): void {
    // Remove existing entry for this ID
    this.entities = this.entities.filter(e => e.id !== id)

    // Add to front (most recent)
    this.entities.unshift({ id, title, mentionedAt: now, source })
  }

  private prune(): void {
    const cutoff = Date.now() - ENTITY_TTL_MS

    // Remove expired
    this.entities = this.entities.filter(e => e.mentionedAt > cutoff)

    // Cap at MAX_TRACKED
    if (this.entities.length > MAX_TRACKED) {
      this.entities = this.entities.slice(0, MAX_TRACKED)
    }
  }
}

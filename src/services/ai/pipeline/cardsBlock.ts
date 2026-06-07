/**
 * TASK-1814 — the model's ```cards``` block: parse it into grouped tasks-with-reasons
 * and strip it (and leaked [N] markers / de-fenced JSON) from the displayed prose.
 *
 * Pure + unit-tested (tests/unit/ai-cards-block.test.ts) so the "raw JSON leaked into
 * the chat" and "wrong tasks shown" regressions can never come back silently.
 */

/** Minimal shape of a tool result that carries a task list (structural subset of ToolResult). */
export interface CardToolResult {
  success: boolean
  data?: unknown
  message?: string
}

export interface CardGroup {
  name: string
  tasks: Array<Record<string, unknown> & { reason: string }>
  newTasks?: Array<{ title: string; priority?: string; reason?: string }>
}

export interface ParsedCards {
  groups: CardGroup[]
  total: number
  rawBlock: string
  kind?: 'day_plan' | 'smart_lanes' | 'weekly_review'
}

/**
 * Parse a ```cards JSON block into grouped tasks. Each item references a task by its
 * [N] index (1-based) into the tool result's task list (same order the model saw).
 * Returns null if there's no block, it's unparseable, or nothing maps to a real task.
 */
export function parseCardGroups(text: string, toolResults: CardToolResult[]): ParsedCards | null {
  const m = text.match(/```+\s*cards\s*\n?([\s\S]*?)```+/i)
  if (!m) return null
  let parsed: {
    kind?: string
    groups?: Array<{
      name?: string
      items?: Array<{ i?: number; reason?: string }>
      newTasks?: Array<{ title?: string; priority?: string; reason?: string }>
    }>
  }
  try { parsed = JSON.parse(m[1].trim()) } catch { return null }
  if (!Array.isArray(parsed?.groups) || !parsed.groups.length) return null

  const taskResult = toolResults.find(r =>
    r.success && Array.isArray(r.data) && (r.data[0] as Record<string, unknown>)?.title !== undefined,
  )
  const indexedTasks = (taskResult?.data as Array<Record<string, unknown>>) || []
  if (!indexedTasks.length) return null

  const groups = parsed.groups
    .map(g => {
      const groupTasks = (Array.isArray(g.items) ? g.items : [])
        .map(it => {
          const t = indexedTasks[(Number(it.i) || 0) - 1]
          return t ? { ...t, reason: String(it.reason || '').trim() } : null
        })
        .filter((t): t is Record<string, unknown> & { reason: string } => t !== null)
      const newTasks = (Array.isArray(g.newTasks) ? g.newTasks : [])
        .map(item => ({
          title: String(item.title || '').trim(),
          priority: typeof item.priority === 'string' ? item.priority : undefined,
          reason: typeof item.reason === 'string' ? item.reason.trim() : undefined,
        }))
        .filter(item => item.title.length > 0)
      return {
        name: String(g.name || '').trim(),
        tasks: groupTasks,
        ...(newTasks.length ? { newTasks } : {}),
      }
    })
    .filter(g => g.tasks.length > 0 || (g.newTasks?.length ?? 0) > 0)

  const kind = parsed.kind === 'day_plan' || parsed.kind === 'smart_lanes' || parsed.kind === 'weekly_review' ? parsed.kind : undefined
  return groups.length ? { groups, total: indexedTasks.length, rawBlock: m[0], kind } : null
}

/**
 * Remove the cards block (and leaked [N] markers) from displayed prose. The block is
 * always appended LAST, so strip from its start to end-of-string — this survives
 * cleanResponse() mangling the fence (which caused raw JSON to leak as a code block).
 * Handles fenced (```cards) and de-fenced (bare {"groups":…}) variants.
 */
export function stripCardsBlock(text: string): string {
  return text
    .replace(/```+\s*cards[\s\S]*$/i, '')
    .replace(/\{\s*(?:"kind"\s*:\s*"[^"]+"\s*,\s*)?"groups"\s*:[\s\S]*$/, '')
    .replace(/\s*\[\d+(?:\s*(?:→|->|,)\s*\d+)*\]/g, '')
    .trim()
}

/**
 * Streaming-safe variant for visible partial output. `stripCardsBlock` removes a
 * complete cards block; this also hides the dangling prefix while streamed
 * chunks are still building the marker (for example "```ca" before "rds").
 */
export function stripStreamingCardsBlock(text: string): string {
  return stripCardsBlock(text)
    .replace(/`{1,}\s*(?:c(?:a(?:r(?:d(?:s)?)?)?)?)?$/i, '')
    .trim()
}

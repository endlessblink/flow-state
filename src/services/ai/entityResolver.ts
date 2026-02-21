/**
 * entityResolver.ts
 *
 * TASK-1395: Fuzzy title-based task resolution
 *
 * Provides `resolveTask(idOrTitle, tasks)` to match a user's natural-language
 * reference to a task via three strategies:
 *   1. Exact UUID match
 *   2. TASK-XXX ID format guard (returns null — runtime IDs are UUIDs)
 *   3. uFuzzy fuzzy title search
 */

import uFuzzy from '@leeoniya/ufuzzy'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskLike {
  id: string
  title: string
}

export interface ResolvedTask {
  task: { id: string; title: string }
  confidence: 'exact' | 'high' | 'medium' | 'low'
  /** Top 3 candidates when the match is ambiguous */
  candidates?: Array<{ id: string; title: string; score: number }>
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns true when the string looks like a UUID (contains hyphens and is 32+ chars). */
function looksLikeUUID(value: string): boolean {
  return value.length >= 32 && value.includes('-')
}

/** Returns true when the string looks like a TASK-XXX reference. */
function looksLikeTaskRef(value: string): boolean {
  return /^task-/i.test(value)
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Attempt to resolve `idOrTitle` against `tasks` using three strategies.
 *
 * @param idOrTitle - UUID, TASK-XXX ref, or natural-language title fragment
 * @param tasks     - The current list of tasks to search
 * @returns A `ResolvedTask` on success, or `null` when no match can be found
 */
export function resolveTask(idOrTitle: string, tasks: TaskLike[]): ResolvedTask | null {
  if (!idOrTitle || tasks.length === 0) return null

  const query = idOrTitle.trim()

  // ── Strategy 1: Exact UUID match ─────────────────────────────────────────
  if (looksLikeUUID(query)) {
    const found = tasks.find((t) => t.id === query)
    if (found) {
      return { task: { id: found.id, title: found.title }, confidence: 'exact' }
    }
    // If it looked like a UUID but nothing matched, don't fall through to fuzzy.
    return null
  }

  // ── Strategy 2: TASK-XXX guard ───────────────────────────────────────────
  // Runtime task IDs are UUIDs, not TASK-XXX strings. Fuzzy-matching "TASK-42"
  // against titles would be meaningless, so bail out early.
  if (looksLikeTaskRef(query)) {
    return null
  }

  // ── Strategy 3: uFuzzy title search ──────────────────────────────────────
  const uf = new uFuzzy({ intraMode: 1, intraIns: 1 })
  const haystack = tasks.map((t) => t.title)

  const [idxs, info, order] = uf.search(haystack, query)

  // No matches at all
  if (!idxs || idxs.length === 0) return null

  // Exactly one match — `order` will be null in this case
  if (order === null) {
    const matched = tasks[idxs[0]]
    return {
      task: { id: matched.id, title: matched.title },
      confidence: 'high',
    }
  }

  // Multiple matches — `order` is sorted best-first
  const matchCount = order.length

  if (matchCount <= 3) {
    // 2-3 results: return the best with the rest as candidates
    const [best, ...rest] = order.map((o, rank) => {
      const task = tasks[idxs[o]]
      // Use rank as a proxy score (0 = best); expose as an inverse score for callers
      return { id: task.id, title: task.title, score: matchCount - rank }
    })

    return {
      task: { id: best.id, title: best.title },
      confidence: 'medium',
      candidates: [best, ...rest],
    }
  }

  // 4+ results: too ambiguous — return top result at 'low' confidence with top 3 candidates
  const topCandidates = order.slice(0, 3).map((o, rank) => {
    const task = tasks[idxs[o]]
    return { id: task.id, title: task.title, score: matchCount - rank }
  })

  return {
    task: { id: topCandidates[0].id, title: topCandidates[0].title },
    confidence: 'low',
    candidates: topCandidates,
  }
}

// ---------------------------------------------------------------------------
// Throwing variant
// ---------------------------------------------------------------------------

/**
 * Like `resolveTask` but throws a descriptive error instead of returning null
 * or a low-confidence result.
 *
 * @param idOrTitle - UUID, TASK-XXX ref, or natural-language title fragment
 * @param tasks     - The current list of tasks to search
 * @returns `{ id, title }` of the matched task
 * @throws Error when nothing matches or the match is ambiguous (`confidence === 'low'`)
 */
export function resolveTaskOrThrow(
  idOrTitle: string,
  tasks: TaskLike[],
): { id: string; title: string } {
  const result = resolveTask(idOrTitle, tasks)

  if (!result) {
    throw new Error(
      `No task found matching "${idOrTitle}". ` +
        `Try using a more specific title or the task's UUID.`,
    )
  }

  if (result.confidence === 'low') {
    const suggestions = result.candidates
      ? result.candidates.map((c) => `"${c.title}"`).join(', ')
      : 'none'
    throw new Error(
      `"${idOrTitle}" is ambiguous — ${result.candidates?.length ?? 'multiple'} tasks matched. ` +
        `Did you mean one of: ${suggestions}? Please be more specific.`,
    )
  }

  return result.task
}

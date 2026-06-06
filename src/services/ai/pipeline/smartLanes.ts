/**
 * TASK-1816: explicit smart-lane routing helpers.
 *
 * Keep this narrow: generic "break down this task" remains the existing
 * subtask flow. This mode only activates when the user asks for lane/sprint
 * organization or asks to break work into a lane.
 */

export function isSmartLaneRequest(message: string): boolean {
  const lower = message.toLowerCase()
  const hasLaneWord =
    /\bsmart\s+lanes?\b/.test(lower) ||
    /\blanes?\b/.test(lower) ||
    /\bsprint\s+(lane|bucket|track|plan)s?\b/.test(lower) ||
    /\bwork\s+(lane|track|stream)s?\b/.test(lower) ||
    /מסלול/.test(message) ||
    /נתיב/.test(message) ||
    /ליינים?/.test(message)

  if (!hasLaneWord) return false

  return (
    /\bsuggest\b/.test(lower) ||
    /\brecommend\b/.test(lower) ||
    /\bcreate\b/.test(lower) ||
    /\bmake\b/.test(lower) ||
    /\bbreak\b/.test(lower) ||
    /\bbreakdown\b/.test(lower) ||
    /\borganize\b/.test(lower) ||
    /\bgroup\b/.test(lower) ||
    /תציע/.test(message) ||
    /תיצור/.test(message) ||
    /פרק/.test(message) ||
    /תחלק/.test(message) ||
    /ארגן/.test(message)
  )
}

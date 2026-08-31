import type { RoutedIntent } from './intentRouter'

export interface TaskOrganizerDraft {
  id: string
  title: string
  draft: true
  needsClarification: boolean
}

const ORGANIZER_PATTERN = /\b(?:organize|organise|group|cluster|sort|clean\s*up)\b.*\b(?:task|tasks|inbox|list|selected)\b|\b(?:task|tasks|inbox|list|selected)\b.*\b(?:organize|organise|group|cluster|sort|clean\s*up)\b|(?:ארג(?:ן|ני)|סדר|קבץ).*(?:משימ|תיבה|מסומנ)/i
const LINE_PREFIX = /^\s*(?:[-*•]|\d+[.)]|\[(?: |x|X)\])\s*/
const GENERIC_DRAFT = /^(?:website|site|email|call|meeting|project|research|admin|follow\s*up|אתר|מייל|פגישה|פרויקט)$/i

function pastedTaskLineCount(message: string): number {
  return message
    .split(/\r?\n/)
    .filter(line => LINE_PREFIX.test(line) && line.replace(LINE_PREFIX, '').trim().length > 0)
    .length
}

export function isTaskOrganizerRequest(message: string): boolean {
  return ORGANIZER_PATTERN.test(message.trim()) || pastedTaskLineCount(message) >= 2
}

export function extractPastedTaskDrafts(message: string): TaskOrganizerDraft[] {
  const lines = message.split(/\r?\n/)
  const candidates = lines
    .slice(isTaskOrganizerRequest(lines[0] || '') ? 1 : 0)
    .filter(line => LINE_PREFIX.test(line))
    .map(line => line.replace(LINE_PREFIX, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (candidates.length < 2) return []

  const seen = new Set<string>()
  return candidates.flatMap((title, index) => {
    const identity = title.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(identity)) return []
    seen.add(identity)

    const wordCount = title.split(/\s+/).filter(Boolean).length
    return [{
      id: `draft:${index + 1}`,
      title,
      draft: true as const,
      needsClarification: wordCount < 2 || title.length < 8 || GENERIC_DRAFT.test(title),
    }]
  })
}

export function scopeTaskOrganizerIntent(
  routed: RoutedIntent,
  selectedTaskIds: string[] | undefined,
): RoutedIntent {
  if (routed.responseMode !== 'smart_lanes' || !selectedTaskIds?.length) return routed

  return {
    ...routed,
    tools: routed.tools.map(call => call.tool === 'list_tasks'
      ? { ...call, parameters: { ...call.parameters, taskIds: [...selectedTaskIds] } }
      : call),
  }
}

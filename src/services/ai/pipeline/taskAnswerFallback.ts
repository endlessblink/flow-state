import { stripCardsBlock, type CardToolResult, type ParsedCards } from './cardsBlock'

export interface TaskAnswerItem {
  id?: string
  title?: string
  priority?: string
  dueDate?: string
  daysOverdue?: number
  description?: string
  projectName?: string
  estimatedDuration?: number
  subtasks?: Array<{ completed?: boolean; done?: boolean }>
}

export type TaskAnswerLanguage = 'he' | 'en'

export function collectTaskAnswerItems(toolResults: CardToolResult[]): TaskAnswerItem[] {
  const tasks: TaskAnswerItem[] = []
  for (const result of toolResults) {
    if (!result.success) continue
    const data = result.data
    if (Array.isArray(data)) {
      tasks.push(...data.filter(isTaskLike))
      continue
    }
    if (!data || typeof data !== 'object') continue
    const record = data as Record<string, unknown>
    for (const key of ['tasks', 'dueTodayTasks', 'overdueTasks']) {
      const value = record[key]
      if (Array.isArray(value)) tasks.push(...value.filter(isTaskLike))
    }
  }
  return tasks
}

export function shouldUseStructuredTaskFallback(
  answer: string,
  toolResults: CardToolResult[],
  parsedCards: ParsedCards | null,
): boolean {
  const taskCount = collectTaskAnswerItems(toolResults).filter(task => task.title).length
  if (taskCount === 0) return false
  if (parsedCards && parsedCards.groups.some(group => group.tasks.some(task => String(task.reason || '').trim().length > 0))) {
    return false
  }

  const visible = stripCardsBlock(answer).trim()
  if (!visible) return true

  const hasListStructure = /(^|\n)\s*(?:[-*•]|\d+[.)])\s+\S/.test(visible)
  const taskMentions = collectTaskAnswerItems(toolResults)
    .filter(task => task.title && visible.includes(task.title))
    .length
  const sentenceCount = (visible.match(/[.!?。؟]|(?:\n\s*\n)/g) || []).length
  const meaningfulMarkers = [
    'because', 'unblocks', 'blocks', 'risk', 'waiting', 'deadline', 'depends', 'sequence', 'first',
    'כי', 'פותח', 'חוסם', 'סיכון', 'מחכה', 'דדליין', 'תלוי', 'סדר', 'קודם',
  ]
  const hasMeaningfulMarker = meaningfulMarkers.some(marker => visible.toLocaleLowerCase().includes(marker))

  if (!hasListStructure && visible.length > 140 && sentenceCount <= 1) return true
  if (taskMentions > 0 && !hasListStructure && !hasMeaningfulMarker) return true
  if (taskMentions > 0 && visible.length < 80) return true
  return false
}

export function buildStructuredTaskFallback(
  toolResults: CardToolResult[],
  lang: TaskAnswerLanguage,
  options: { limit?: number; intro?: string } = {},
): string {
  const tasks = collectTaskAnswerItems(toolResults).filter(task => task.title).slice(0, options.limit ?? 4)
  if (tasks.length === 0) {
    return lang === 'he'
      ? 'מצאתי את הנתונים, אבל לא הצלחתי לנסח תשובת AI מלאה בזמן.'
      : 'I found the data, but could not finish the AI wording in time.'
  }

  const intro = options.intro ?? (lang === 'he'
    ? 'זה הסדר שהייתי בוחר לפי קשרים, סיכון ומה שזה פותח:'
    : 'I would use this order based on dependencies, risk, and what each task unlocks:')

  const rows = tasks.map((task, index) => {
    const reason = inferTaskReason(task, lang)
    return `${index + 1}. **${task.title}** - ${reason}`
  })

  const relationship = buildRelationshipLine(tasks, lang)
  return [intro, ...rows, relationship].filter(Boolean).join('\n')
}

export function buildStructuredTaskCards(
  toolResults: CardToolResult[],
  lang: TaskAnswerLanguage,
  groupName: string,
  kind?: ParsedCards['kind'],
  limit = 4,
): ParsedCards | null {
  const tasks = collectTaskAnswerItems(toolResults).filter(task => task.title).slice(0, limit)
  if (tasks.length === 0) return null

  return {
    groups: [{
      name: groupName,
      tasks: tasks.map(task => ({
        ...task as Record<string, unknown>,
        reason: inferTaskReason(task, lang),
      })),
    }],
    total: collectTaskAnswerItems(toolResults).filter(task => task.title).length,
    rawBlock: '',
    kind,
  }
}

function isTaskLike(value: unknown): value is TaskAnswerItem {
  return Boolean(value && typeof value === 'object' && typeof (value as Record<string, unknown>).title === 'string')
}

function inferTaskReason(task: TaskAnswerItem, lang: TaskAnswerLanguage): string {
  const title = String(task.title || '').toLocaleLowerCase()
  const due = dueReason(task, lang)
  const subtask = subtaskReason(task, lang)
  const note = noteReason(task, lang)
  const titleReason = titlePatternReason(title, lang)
  const priority = task.priority ? (lang === 'he' ? `עדיפות ${task.priority}` : `${task.priority} priority`) : ''
  const estimate = task.estimatedDuration ? (lang === 'he' ? `בערך ${task.estimatedDuration} דקות` : `about ${task.estimatedDuration} minutes`) : ''

  return [note, titleReason, subtask, due, priority, estimate]
    .filter(Boolean)
    .slice(0, 2)
    .join(lang === 'he' ? '; ' : '; ')
    || (lang === 'he'
      ? 'אין מספיק הקשר במשימה, אז היא צריכה בדיקת משמעות לפני ביצוע'
      : 'the task has little context, so clarify the real stake before doing it')
}

function dueReason(task: TaskAnswerItem, lang: TaskAnswerLanguage): string {
  if (typeof task.daysOverdue === 'number' && task.daysOverdue > 0) {
    return lang === 'he'
      ? `כבר באיחור ${task.daysOverdue} ימים אחרי הסיכון האמיתי`
      : `already ${task.daysOverdue} days late after the real stake`
  }
  if (!task.dueDate) return ''
  const date = String(task.dueDate).slice(0, 10)
  return lang === 'he' ? `יש דדליין ב-${date}` : `has a deadline on ${date}`
}

function subtaskReason(task: TaskAnswerItem, lang: TaskAnswerLanguage): string {
  if (!Array.isArray(task.subtasks) || task.subtasks.length === 0) return ''
  const done = task.subtasks.filter(item => item.completed || item.done).length
  if (done === 0) return lang === 'he' ? 'עדיין לא התחילה בפועל' : 'has not really started yet'
  if (done === task.subtasks.length) return lang === 'he' ? 'כמעט סגורה, כדאי לסיים' : 'nearly closed, worth finishing'
  return lang === 'he'
    ? `באמצע עבודה (${done}/${task.subtasks.length})`
    : `midstream (${done}/${task.subtasks.length} subtasks done)`
}

function noteReason(task: TaskAnswerItem, lang: TaskAnswerLanguage): string {
  const note = String(task.description || '').trim()
  if (!note) return ''
  const trimmed = note.length > 90 ? `${note.slice(0, 87)}...` : note
  return lang === 'he' ? `ההערה נותנת הקשר: ${trimmed}` : `note gives context: ${trimmed}`
}

function titlePatternReason(title: string, lang: TaskAnswerLanguage): string {
  if (/(payment|invoice|cardcom|charge|billing|תשלום|חשבונית|חיוב|קאדרקום)/i.test(title)) {
    return lang === 'he' ? 'כסף או גבייה עלולים להיתקע' : 'money or billing can get stuck'
  }
  if (/(reply|send|call|email|message|להגיב|לשלוח|להתקשר|מייל|הודעה)/i.test(title)) {
    return lang === 'he' ? 'מישהו כנראה מחכה לתגובה ממך' : 'someone is probably waiting on you'
  }
  if (/(outreach|cold opener|target list|sales|lead|פייפרפורט|לסקין|רשימת|אאוטריץ|מכירות)/i.test(title)) {
    return lang === 'he' ? 'זה חלק מרצף מכירות שכדאי לחבר יחד' : 'this is part of a sales sequence worth batching'
  }
  if (/(fix|bug|deploy|release|update|לתקן|באג|לפרוס|לעדכן)/i.test(title)) {
    return lang === 'he' ? 'תקלה או פריסה יכולות לחסום המשך עבודה' : 'a fix or release can block follow-on work'
  }
  if (/(gift|birthday|event|מתנה|יום הולדת|אירוע)/i.test(title)) {
    return lang === 'he' ? 'זה תלוי בזמן ואי אפשר להזיז בקלות' : 'the timing is fixed and hard to recover later'
  }
  return ''
}

function buildRelationshipLine(tasks: TaskAnswerItem[], lang: TaskAnswerLanguage): string {
  const titles = tasks.map(task => String(task.title || '').toLocaleLowerCase())
  const hasSalesChain = titles.some(title => /(target list|רשימת|פייפרפורט|לסקין)/i.test(title)) &&
    titles.some(title => /(cold opener|opener|אופן|פתיח)/i.test(title))
  if (hasSalesChain) {
    return lang === 'he'
      ? 'הקשר המרכזי: קודם בונים/בודקים את רשימת היעדים, ואז כותבים את הפתיח הקר.'
      : 'Main relationship: build or check the target list first, then write the cold opener.'
  }

  if (tasks.length >= 2) {
    return lang === 'he'
      ? 'הקשר המרכזי: להתחיל במה שחוסם כסף/אנשים, ואז לעבור לעבודה שמייצרת מומנטום.'
      : 'Main relationship: handle money or people blockers first, then move to momentum-building work.'
  }

  return ''
}

/**
 * useVoiceNLPParser - NLP parser for voice-to-task extraction
 * TASK-1026: Task Property Extraction from transcribed speech
 *
 * Extracts task properties (title, priority, due date, project) from
 * natural language input in Hebrew and English.
 *
 * @example
 * const { parseTranscription } = useVoiceNLPParser()
 * const result = parseTranscription("Remind me tomorrow to send email high priority")
 * // { title: "send email", dueDate: "2026-01-25", priority: "high", confidence: 0.9 }
 */

import { computed } from 'vue'
import type { TaskPriority } from '@/types/tasks'
import { formatDateKey as formatDate } from '@/utils/dateUtils'

// ============================================================================
// Types
// ============================================================================

export interface ExtractedTaskProperties {
  /** Extracted task title (cleaned of date/priority keywords) */
  title: string
  /** Due date in YYYY-MM-DD format */
  dueDate: string | null
  /** Due time in HH:MM format (24h) */
  dueTime: string | null
  /** Task priority */
  priority: TaskPriority
  /** Project name if mentioned */
  projectName: string | null
  /** Original transcription */
  originalText: string
  /** Detected language */
  language: 'he' | 'en'
  /** Confidence score 0-1 */
  confidence: number
  /** Action type for existing task commands */
  action: 'create' | 'postpone' | 'complete' | 'delete' | 'edit' | null
  /** Target task name for commands */
  targetTaskName: string | null
  /** Postpone amount in days (for postpone action) */
  postponeDays: number | null
}

export interface DateParseResult {
  date: Date
  matched: string
  confidence: number
}

export interface PriorityParseResult {
  priority: TaskPriority
  matched: string
  confidence: number
}

// ============================================================================
// Constants - Hebrew Patterns
// ============================================================================

const HEBREW_PRIORITY_PATTERNS = {
  high: [
    /בעדיפות\s+גבוהה/i,
    /עדיפות\s+גבוהה/i,
    /(?<!לא\s)דחוף/i, // Match "דחוף" only if NOT preceded by "לא "
    /חשוב\s+מאוד/i,
    /בדחיפות/i,
    /קריטי/i
  ],
  medium: [
    /בעדיפות\s+בינונית/i,
    /עדיפות\s+בינונית/i,
    /רגיל/i
  ],
  low: [
    /בעדיפות\s+נמוכה/i,
    /עדיפות\s+נמוכה/i,
    /לא\s+דחוף/i,
    /כשיש\s+זמן/i,
    /בזמן\s+הפנוי/i
  ]
}

const HEBREW_DATE_PATTERNS = {
  today: [/היום/i, /עכשיו/i],
  tomorrow: [/מחר/i, /מחרת/i],
  dayAfterTomorrow: [/מחרתיים/i, /בעוד\s+יומיים/i],
  thisWeek: [/השבוע/i, /בשבוע\s+הזה/i],
  nextWeek: [/שבוע\s+הבא/i, /בשבוע\s+הבא/i],
  thisWeekend: [/בסוף\s+השבוע/i, /בסופ"ש/i, /בסופש/i],
  inDays: [/בעוד\s+(\d+)\s+ימים?/i, /עוד\s+(\d+)\s+ימים?/i],
  inWeeks: [/בעוד\s+(\d+)\s+שבועות?/i, /עוד\s+(\d+)\s+שבועות?/i],
  inMonths: [/בעוד\s+(\d+)\s+חודשים?/i, /עוד\s+(\d+)\s+חודשים?/i],
  onDay: [
    /ביום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/i,
    /ב(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/i
  ]
}

const HEBREW_DAY_NAMES: Record<string, number> = {
  'ראשון': 0,
  'שני': 1,
  'שלישי': 2,
  'רביעי': 3,
  'חמישי': 4,
  'שישי': 5,
  'שבת': 6
}

const HEBREW_ACTION_PATTERNS = {
  postpone: [/דחה\s+את/i, /הזז\s+את/i, /העבר\s+את/i],
  complete: [/סמן\s+כבוצע/i, /סיים\s+את/i, /בוצע/i, /עשיתי/i],
  delete: [/מחק\s+את/i, /הסר\s+את/i],
  edit: [/ערוך\s+את/i, /שנה\s+את/i, /עדכן\s+את/i]
}

const HEBREW_TRIGGER_PHRASES = [
  /תזכיר\s+לי/i,
  /תזכור/i,
  /צריך\s+ל/i,
  /אני\s+צריך/i,
  /לעשות/i,
  /משימה/i,
  /ליצור\s+משימה/i
]

// ============================================================================
// Constants - English Patterns
// ============================================================================

const ENGLISH_PRIORITY_PATTERNS = {
  high: [
    /high\s+priority/i,
    /priority\s+high/i,
    /urgent/i,
    /asap/i,
    /important/i,
    /critical/i,
    /top\s+priority/i
  ],
  medium: [
    /medium\s+priority/i,
    /priority\s+medium/i,
    /normal\s+priority/i,
    /regular/i
  ],
  low: [
    /low\s+priority/i,
    /priority\s+low/i,
    /not\s+urgent/i,
    /when\s+possible/i,
    /whenever/i,
    /no\s+rush/i
  ]
}

const ENGLISH_DATE_PATTERNS = {
  today: [/today/i, /now/i, /right\s+now/i],
  tomorrow: [/tomorrow/i, /tmrw/i],
  dayAfterTomorrow: [/day\s+after\s+tomorrow/i, /in\s+two\s+days/i, /in\s+2\s+days/i],
  thisWeek: [/this\s+week/i, /later\s+this\s+week/i],
  nextWeek: [/next\s+week/i],
  thisWeekend: [/this\s+weekend/i, /weekend/i, /on\s+the\s+weekend/i],
  inDays: [/in\s+(\d+)\s+days?/i, /(\d+)\s+days?\s+from\s+now/i],
  inWeeks: [/in\s+(\d+)\s+weeks?/i, /(\d+)\s+weeks?\s+from\s+now/i],
  inMonths: [/in\s+(\d+)\s+months?/i, /(\d+)\s+months?\s+from\s+now/i],
  onDay: [
    /on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
  ]
}

const ENGLISH_DAY_NAMES: Record<string, number> = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6
}

const ENGLISH_ACTION_PATTERNS = {
  postpone: [/postpone/i, /delay/i, /move/i, /reschedule/i, /push\s+back/i],
  complete: [/mark\s+(as\s+)?done/i, /complete/i, /finish/i, /done\s+with/i, /completed/i],
  delete: [/delete/i, /remove/i, /cancel/i],
  edit: [/edit/i, /change/i, /update/i, /modify/i]
}

const ENGLISH_TRIGGER_PHRASES = [
  /remind\s+me\s+to/i, // "remind me to" - more specific, matches first
  /remind\s+me/i,
  /remember\s+to/i,
  /need\s+to/i,
  /have\s+to/i,
  /i\s+need\s+to/i,
  /i\s+have\s+to/i,
  /i\s+need/i,
  /i\s+have/i,
  /task/i,
  /create\s+(a\s+)?task/i,
  /add\s+(a\s+)?task/i
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect if text is Hebrew
 */
const isHebrew = (text: string): boolean => {
  const hebrewRegex = /[\u0590-\u05FF]/
  return hebrewRegex.test(text)
}

/**
 * Get next occurrence of a specific day of week
 */
const getNextDayOfWeek = (dayIndex: number): Date => {
  const today = new Date()
  const currentDay = today.getDay()
  let daysUntil = dayIndex - currentDay

  if (daysUntil <= 0) {
    daysUntil += 7 // Next week
  }

  const result = new Date(today)
  result.setDate(today.getDate() + daysUntil)
  return result
}

/**
 * Get this weekend (Saturday)
 */
const getThisWeekend = (): Date => {
  const today = new Date()
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
  const weekend = new Date(today)
  weekend.setDate(today.getDate() + daysUntilSaturday)
  return weekend
}

/**
 * Add days to a date
 */
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(date.getDate() + days)
  return result
}

/**
 * Add weeks to a date
 */
const addWeeks = (date: Date, weeks: number): Date => {
  return addDays(date, weeks * 7)
}

/**
 * Add months to a date
 */
const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date)
  result.setMonth(date.getMonth() + months)
  return result
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Extract priority from text
 */
const extractPriority = (text: string, isHebrewText: boolean): PriorityParseResult | null => {
  const patterns = isHebrewText ? HEBREW_PRIORITY_PATTERNS : ENGLISH_PRIORITY_PATTERNS

  // Check high priority first (most specific)
  for (const pattern of patterns.high) {
    const match = text.match(pattern)
    if (match) {
      return { priority: 'high', matched: match[0], confidence: 0.95 }
    }
  }

  // Check medium priority
  for (const pattern of patterns.medium) {
    const match = text.match(pattern)
    if (match) {
      return { priority: 'medium', matched: match[0], confidence: 0.9 }
    }
  }

  // Check low priority
  for (const pattern of patterns.low) {
    const match = text.match(pattern)
    if (match) {
      return { priority: 'low', matched: match[0], confidence: 0.9 }
    }
  }

  return null
}

/**
 * Extract due date from text using specific language patterns
 */
const extractDateWithPatterns = (
  text: string,
  patterns: typeof HEBREW_DATE_PATTERNS,
  dayNames: Record<string, number>
): DateParseResult | null => {
  const today = new Date()

  // Today
  for (const pattern of patterns.today) {
    const match = text.match(pattern)
    if (match) {
      return { date: today, matched: match[0], confidence: 0.95 }
    }
  }

  // Tomorrow
  for (const pattern of patterns.tomorrow) {
    const match = text.match(pattern)
    if (match) {
      return { date: addDays(today, 1), matched: match[0], confidence: 0.95 }
    }
  }

  // Day after tomorrow
  for (const pattern of patterns.dayAfterTomorrow) {
    const match = text.match(pattern)
    if (match) {
      return { date: addDays(today, 2), matched: match[0], confidence: 0.9 }
    }
  }

  // This weekend
  for (const pattern of patterns.thisWeekend) {
    const match = text.match(pattern)
    if (match) {
      return { date: getThisWeekend(), matched: match[0], confidence: 0.85 }
    }
  }

  // This week (Friday)
  for (const pattern of patterns.thisWeek) {
    const match = text.match(pattern)
    if (match) {
      const friday = getNextDayOfWeek(5)
      return { date: friday, matched: match[0], confidence: 0.8 }
    }
  }

  // Next week (next Monday)
  for (const pattern of patterns.nextWeek) {
    const match = text.match(pattern)
    if (match) {
      return { date: addWeeks(today, 1), matched: match[0], confidence: 0.85 }
    }
  }

  // In X days
  for (const pattern of patterns.inDays) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const days = parseInt(match[1], 10)
      if (!isNaN(days) && days > 0 && days < 365) {
        return { date: addDays(today, days), matched: match[0], confidence: 0.9 }
      }
    }
  }

  // In X weeks
  for (const pattern of patterns.inWeeks) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const weeks = parseInt(match[1], 10)
      if (!isNaN(weeks) && weeks > 0 && weeks < 52) {
        return { date: addWeeks(today, weeks), matched: match[0], confidence: 0.9 }
      }
    }
  }

  // In X months
  for (const pattern of patterns.inMonths) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const months = parseInt(match[1], 10)
      if (!isNaN(months) && months > 0 && months < 12) {
        return { date: addMonths(today, months), matched: match[0], confidence: 0.85 }
      }
    }
  }

  // On specific day
  for (const pattern of patterns.onDay) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const dayName = match[1].toLowerCase()
      const dayIndex = dayNames[dayName]
      if (dayIndex !== undefined) {
        return { date: getNextDayOfWeek(dayIndex), matched: match[0], confidence: 0.85 }
      }
    }
  }

  return null
}

/**
 * Extract due date from text (tries both languages for mixed-language input)
 */
const extractDate = (text: string, isHebrewText: boolean): DateParseResult | null => {
  // Try primary language first
  const primaryPatterns = isHebrewText ? HEBREW_DATE_PATTERNS : ENGLISH_DATE_PATTERNS
  const primaryDayNames = isHebrewText ? HEBREW_DAY_NAMES : ENGLISH_DAY_NAMES

  const result = extractDateWithPatterns(text, primaryPatterns, primaryDayNames)
  if (result) return result

  // If no match, try the other language (for mixed-language input)
  const fallbackPatterns = isHebrewText ? ENGLISH_DATE_PATTERNS : HEBREW_DATE_PATTERNS
  const fallbackDayNames = isHebrewText ? ENGLISH_DAY_NAMES : HEBREW_DAY_NAMES

  return extractDateWithPatterns(text, fallbackPatterns, fallbackDayNames)
}

/**
 * Extract postpone duration (for postpone commands)
 */
const extractPostponeDuration = (text: string, isHebrewText: boolean): number | null => {
  // Hebrew patterns
  if (isHebrewText) {
    const hebrewDaysMatch = text.match(/ב[־-]?(\d+)\s+ימים?/i) || text.match(/(\d+)\s+ימים?/i)
    if (hebrewDaysMatch && hebrewDaysMatch[1]) {
      return parseInt(hebrewDaysMatch[1], 10)
    }
    const hebrewWeeksMatch = text.match(/ב[־-]?(\d+)\s+שבועות?/i)
    if (hebrewWeeksMatch && hebrewWeeksMatch[1]) {
      return parseInt(hebrewWeeksMatch[1], 10) * 7
    }
  } else {
    // English patterns
    const englishDaysMatch = text.match(/by\s+(\d+)\s+days?/i) || text.match(/(\d+)\s+days?/i)
    if (englishDaysMatch && englishDaysMatch[1]) {
      return parseInt(englishDaysMatch[1], 10)
    }
    const englishWeeksMatch = text.match(/by\s+(\d+)\s+weeks?/i) || text.match(/(\d+)\s+weeks?/i)
    if (englishWeeksMatch && englishWeeksMatch[1]) {
      return parseInt(englishWeeksMatch[1], 10) * 7
    }
  }

  return null
}

/**
 * Detect action type (create, postpone, complete, delete, edit)
 */
const detectAction = (text: string, isHebrewText: boolean): 'create' | 'postpone' | 'complete' | 'delete' | 'edit' | null => {
  const patterns = isHebrewText ? HEBREW_ACTION_PATTERNS : ENGLISH_ACTION_PATTERNS

  for (const pattern of patterns.postpone) {
    if (pattern.test(text)) return 'postpone'
  }
  for (const pattern of patterns.complete) {
    if (pattern.test(text)) return 'complete'
  }
  for (const pattern of patterns.delete) {
    if (pattern.test(text)) return 'delete'
  }
  for (const pattern of patterns.edit) {
    if (pattern.test(text)) return 'edit'
  }

  return 'create' // Default to create
}

/**
 * Extract target task name for commands
 */
const extractTargetTaskName = (text: string, isHebrewText: boolean): string | null => {
  // Hebrew: "דחה את המשימה של הפגישה" -> "הפגישה"
  if (isHebrewText) {
    const match = text.match(/(?:את|של)\s+(?:המשימה\s+)?(?:של\s+)?(.+?)(?:\s+ב[־-]?\d+|\s*$)/i)
    if (match && match[1]) {
      return match[1].trim()
    }
  } else {
    // English: "postpone meeting task" -> "meeting"
    const match = text.match(/(?:postpone|complete|delete|edit|mark)\s+(?:the\s+)?(.+?)(?:\s+task|\s+by\s+\d+|\s+as|\s*$)/i)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Clean title by removing matched patterns
 */
const cleanTitle = (
  text: string,
  dateMatch: string | null,
  priorityMatch: string | null,
  isHebrewText: boolean
): string => {
  let cleaned = text

  // Remove date pattern FIRST (before trigger phrases can interfere)
  // This ensures "tomorrow" is removed as a complete word
  if (dateMatch) {
    // Use word boundary to ensure we match the complete word
    const escapedMatch = dateMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const dateRegex = new RegExp(`\\b${escapedMatch}\\b`, 'gi')
    cleaned = cleaned.replace(dateRegex, '')
  }

  // Remove priority pattern (with word boundaries)
  if (priorityMatch) {
    const escapedMatch = priorityMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const priorityRegex = new RegExp(`\\b${escapedMatch}\\b`, 'gi')
    cleaned = cleaned.replace(priorityRegex, '')
  }

  // Remove trigger phrases
  const triggers = isHebrewText ? HEBREW_TRIGGER_PHRASES : ENGLISH_TRIGGER_PHRASES
  for (const trigger of triggers) {
    cleaned = cleaned.replace(trigger, '')
  }

  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  // Remove leading "to " if it's a leftover (e.g., "remind me tomorrow to" → "remind me to" → "to")
  if (!isHebrewText) {
    cleaned = cleaned.replace(/^to\s+/i, '')
  }

  // Clean up punctuation and final trim
  cleaned = cleaned
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim()

  return cleaned
}

// ============================================================================
// Main Composable
// ============================================================================

export function useVoiceNLPParser() {
  /**
   * Parse transcription text and extract task properties
   */
  const parseTranscription = (text: string): ExtractedTaskProperties => {
    const trimmedText = text.trim()
    const isHebrewText = isHebrew(trimmedText)

    // Extract components
    const dateResult = extractDate(trimmedText, isHebrewText)
    const priorityResult = extractPriority(trimmedText, isHebrewText)
    const action = detectAction(trimmedText, isHebrewText)
    const targetTaskName = action !== 'create' ? extractTargetTaskName(trimmedText, isHebrewText) : null
    const postponeDays = action === 'postpone' ? extractPostponeDuration(trimmedText, isHebrewText) : null

    // Clean up title
    const title = cleanTitle(
      trimmedText,
      dateResult?.matched || null,
      priorityResult?.matched || null,
      isHebrewText
    )

    // Calculate overall confidence
    let confidence = 0.5 // Base confidence
    if (dateResult) confidence += 0.2
    if (priorityResult) confidence += 0.15
    if (title.length > 3) confidence += 0.15
    confidence = Math.min(confidence, 1)

    return {
      title: title || trimmedText, // Fall back to original if cleaning removed everything
      dueDate: dateResult ? formatDate(dateResult.date) : null,
      dueTime: null, // TODO: Add time extraction in future
      priority: priorityResult?.priority || null,
      projectName: null, // TODO: Add project extraction in future
      originalText: trimmedText,
      language: isHebrewText ? 'he' : 'en',
      confidence,
      action: action || 'create',
      targetTaskName,
      postponeDays
    }
  }

  /**
   * Check if browser supports the NLP features needed
   */
  const isSupported = computed(() => true) // Pure JS, no browser APIs needed

  /**
   * Get help examples for the user
   */
  const getExamples = computed(() => ({
    hebrew: [
      { input: 'תזכיר לי מחר לשלוח מייל בעדיפות גבוהה', description: 'Creates task with tomorrow due date and high priority' },
      { input: 'בעוד שבועיים לקנות מתנה לאמא', description: 'Creates task due in 2 weeks' },
      { input: 'דחה את המשימה של הפגישה ב-3 ימים', description: 'Postpones "meeting" task by 3 days' },
      { input: 'סמן כבוצע לשלוח הצעת מחיר', description: 'Marks task as complete' }
    ],
    english: [
      { input: 'Remind me tomorrow to send email high priority', description: 'Creates task with tomorrow due date and high priority' },
      { input: 'In two weeks buy gift for mom', description: 'Creates task due in 2 weeks' },
      { input: 'Postpone meeting task by 3 days', description: 'Postpones "meeting" task by 3 days' },
      { input: 'Mark done send quote', description: 'Marks task as complete' }
    ]
  }))

  return {
    parseTranscription,
    isSupported,
    getExamples,
    // Expose utilities for testing
    isHebrew,
    formatDate
  }
}

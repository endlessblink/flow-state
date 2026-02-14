/**
 * useVoiceTaskParser - NLP extraction for voice transcription
 * TASK-1026: NLP Property Extraction
 * TASK-1028: Voice Confirmation UI + Edit Before Submit
 *
 * Extracts task properties (title, priority, due date) from voice transcription.
 * Supports Hebrew and English with keyword-based extraction.
 */

// TASK-1322: SupportedLanguage defined locally (browser speech recognition removed)
export type SupportedLanguage = 'he-IL' | 'en-US' | 'auto'

export interface ParsedVoiceTask {
  /** Cleaned title after extracting keywords */
  title: string
  /** Original raw transcript */
  rawTranscript: string
  /** Extracted priority */
  priority: 'high' | 'medium' | 'low' | null
  /** Computed due date */
  dueDate: Date | null
  /** Human-readable label for due date (e.g., "tomorrow") */
  dueDateLabel: string | null
  /** Detected language */
  detectedLanguage: SupportedLanguage
}

// Priority keywords by language
const PRIORITY_KEYWORDS: Record<SupportedLanguage, Record<string, 'high' | 'medium' | 'low'>> = {
  'en-US': {
    'urgent': 'high',
    'high priority': 'high',
    'important': 'high',
    'critical': 'high',
    'asap': 'high',
    'medium priority': 'medium',
    'normal': 'medium',
    'normal priority': 'medium',
    'low priority': 'low',
    'when possible': 'low',
    'whenever': 'low',
    'eventually': 'low',
    'not urgent': 'low'
  },
  'he-IL': {
    'דחוף': 'high',
    'בעדיפות גבוהה': 'high',
    'חשוב': 'high',
    'קריטי': 'high',
    'בהקדם': 'high',
    'בעדיפות בינונית': 'medium',
    'רגיל': 'medium',
    'בעדיפות נמוכה': 'low',
    'כשאפשר': 'low',
    'מתי שאפשר': 'low',
    'לא דחוף': 'low'
  },
  'auto': {} // Not used directly
}

// Date keywords by language
interface DateKeyword {
  pattern: RegExp | string
  getDate: () => Date
  label: string
}

const DATE_KEYWORDS: Record<SupportedLanguage, DateKeyword[]> = {
  'en-US': [
    {
      pattern: /\b(today|now|tonight)\b/i,
      getDate: () => {
        const d = new Date()
        d.setHours(23, 59, 59, 999)
        return d
      },
      label: 'today'
    },
    {
      pattern: /\btomorrow\b/i,
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(23, 59, 59, 999)
        return d
      },
      label: 'tomorrow'
    },
    {
      pattern: /\b(this week|this\s+week)\b/i,
      getDate: () => {
        const d = new Date()
        // End of this week (Sunday)
        const daysUntilSunday = 7 - d.getDay()
        d.setDate(d.getDate() + daysUntilSunday)
        d.setHours(23, 59, 59, 999)
        return d
      },
      label: 'this week'
    },
    {
      pattern: /\b(next week|in a week)\b/i,
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() + 7)
        d.setHours(23, 59, 59, 999)
        return d
      },
      label: 'next week'
    },
    {
      pattern: /\bin (\d+) days?\b/i,
      getDate: function() {
        // Will be replaced dynamically
        return new Date()
      },
      label: '' // Will be set dynamically
    }
  ],
  // Hebrew patterns use whitespace/string boundaries instead of \b
  'he-IL': [
    {
      pattern: /(?:^|\s)(היום|עכשיו)(?:\s|$)/,
      getDate: () => {
        const d = new Date()
        d.setHours(23, 59, 59, 999)
        return d
      },
      label: 'היום'
    },
    {
      pattern: /(?:^|\s)מחר(?:\s|$)/,
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(23, 59, 59, 999)
        return d
      },
      label: 'מחר'
    },
    {
      pattern: /(?:^|\s)השבוע(?:\s|$)/,
      getDate: () => {
        const d = new Date()
        const daysUntilSunday = 7 - d.getDay()
        d.setDate(d.getDate() + daysUntilSunday)
        d.setHours(23, 59, 59, 999)
        return d
      },
      label: 'השבוע'
    },
    {
      pattern: /(?:^|\s)(שבוע הבא|בעוד שבוע)(?:\s|$)/,
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() + 7)
        d.setHours(23, 59, 59, 999)
        return d
      },
      label: 'שבוע הבא'
    },
    {
      pattern: /(?:^|\s)בעוד (\d+) ימים?(?:\s|$)/,
      getDate: function() {
        return new Date()
      },
      label: ''
    }
  ],
  'auto': [] // Not used directly
}

// Filler words to remove after extraction
const FILLER_WORDS: Record<SupportedLanguage, string[]> = {
  'en-US': [
    'remind me to',
    'remind me',
    'i need to',
    'i want to',
    'please',
    'can you',
    'add a task to',
    'add task',
    'new task',
    'create task'
  ],
  'he-IL': [
    'תזכיר לי ל',
    'תזכיר לי',
    'צריך ל',
    'רוצה ל',
    'בבקשה',
    'משימה חדשה',
    'הוסף משימה'
  ],
  'auto': []
}

/**
 * Detect language from text based on Hebrew character presence
 */
function detectLanguage(text: string): SupportedLanguage {
  const hebrewRegex = /[\u0590-\u05FF]/
  return hebrewRegex.test(text) ? 'he-IL' : 'en-US'
}

/**
 * Create a word boundary regex that works with both English and Hebrew
 * Hebrew characters don't work with \b word boundaries, so we use
 * lookahead/lookbehind with whitespace/start/end assertions
 */
function createWordBoundaryRegex(keyword: string, language: SupportedLanguage): RegExp {
  const escapedKeyword = escapeRegex(keyword)

  if (language === 'he-IL') {
    // For Hebrew, use whitespace or string boundaries
    // (?:^|\s) = start of string or whitespace before
    // (?:\s|$) = end of string or whitespace after
    return new RegExp(`(?:^|\\s)${escapedKeyword}(?:\\s|$)`, 'gi')
  }

  // For English, standard word boundaries work fine
  return new RegExp(`\\b${escapedKeyword}\\b`, 'gi')
}

/**
 * Find and extract priority keywords from text
 */
function extractPriority(
  text: string,
  language: SupportedLanguage
): { priority: 'high' | 'medium' | 'low' | null; cleanedText: string } {
  const keywords = PRIORITY_KEYWORDS[language]
  let priority: 'high' | 'medium' | 'low' | null = null
  let cleanedText = text

  // Sort keywords by length (longest first) to match "high priority" before "high"
  const sortedKeywords = Object.entries(keywords).sort(
    (a, b) => b[0].length - a[0].length
  )

  for (const [keyword, value] of sortedKeywords) {
    const regex = createWordBoundaryRegex(keyword, language)
    if (regex.test(cleanedText)) {
      priority = value
      // Reset lastIndex for the replacement (exec/test advances it)
      regex.lastIndex = 0
      cleanedText = cleanedText.replace(regex, ' ').trim()
      break // Only extract first match
    }
  }

  return { priority, cleanedText }
}

/**
 * Find and extract date keywords from text
 */
function extractDate(
  text: string,
  language: SupportedLanguage
): { dueDate: Date | null; dueDateLabel: string | null; cleanedText: string } {
  const keywords = DATE_KEYWORDS[language]
  let dueDate: Date | null = null
  let dueDateLabel: string | null = null
  let cleanedText = text

  for (const kw of keywords) {
    const pattern = typeof kw.pattern === 'string'
      ? new RegExp(escapeRegex(kw.pattern), 'gi')
      : kw.pattern

    const match = pattern.exec(cleanedText)
    if (match) {
      // Handle relative days pattern (e.g., "in 3 days" / "בעוד 3 ימים")
      if (match[1] && /^\d+$/.test(match[1])) {
        const days = parseInt(match[1], 10)
        const d = new Date()
        d.setDate(d.getDate() + days)
        d.setHours(23, 59, 59, 999)
        dueDate = d
        dueDateLabel = language === 'he-IL'
          ? `בעוד ${days} ימים`
          : `in ${days} days`
      } else {
        dueDate = kw.getDate()
        dueDateLabel = kw.label
      }

      cleanedText = cleanedText.replace(match[0], '').trim()
      break // Only extract first match
    }
  }

  return { dueDate, dueDateLabel, cleanedText }
}

/**
 * Remove filler words from text
 */
function removeFillerWords(text: string, language: SupportedLanguage): string {
  const fillers = FILLER_WORDS[language]
  let cleaned = text

  // Sort by length (longest first)
  const sortedFillers = [...fillers].sort((a, b) => b.length - a.length)

  for (const filler of sortedFillers) {
    const regex = new RegExp(`^${escapeRegex(filler)}\\s*`, 'i')
    cleaned = cleaned.replace(regex, '')
  }

  return cleaned.trim()
}

/**
 * Clean up the final title text
 */
function cleanTitle(text: string): string {
  return text
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing punctuation
    .replace(/^[,.\s-]+|[,.\s-]+$/g, '')
    // Capitalize first letter
    .replace(/^./, char => char.toUpperCase())
    .trim()
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse voice transcription into structured task data
 */
export function parseVoiceTranscript(
  transcript: string,
  language?: SupportedLanguage
): ParsedVoiceTask {
  const rawTranscript = transcript.trim()

  // Detect language if not provided or auto
  const detectedLanguage = language && language !== 'auto'
    ? language
    : detectLanguage(rawTranscript)

  let workingText = rawTranscript

  // Step 1: Extract priority
  const { priority, cleanedText: afterPriority } = extractPriority(
    workingText,
    detectedLanguage
  )
  workingText = afterPriority

  // Step 2: Extract date
  const { dueDate, dueDateLabel, cleanedText: afterDate } = extractDate(
    workingText,
    detectedLanguage
  )
  workingText = afterDate

  // Step 3: Remove filler words
  workingText = removeFillerWords(workingText, detectedLanguage)

  // Step 4: Clean up title
  const title = cleanTitle(workingText)

  return {
    title: title || rawTranscript, // Fallback to raw if title is empty
    rawTranscript,
    priority,
    dueDate,
    dueDateLabel,
    detectedLanguage
  }
}

/**
 * Vue composable for voice task parsing
 */
export function useVoiceTaskParser() {
  return {
    parseTranscript: parseVoiceTranscript,
    detectLanguage
  }
}

/**
 * Demo Content Guard
 * TASK-061: Detects and warns when programmatic task/project creation
 * contains demo or test content patterns.
 *
 * Purpose: Prevent accidental pollution of user data with test/demo content.
 * Related to TASK-054 data safety rules.
 */

// Patterns that indicate demo/test content
const DEMO_PATTERNS = [
  // Exact patterns (case-insensitive)
  /^test\s*task$/i,
  /^sample\s*(task|project|item)$/i,
  /^demo\s*(task|project|item)?$/i,
  /^example\s*(task|project|item)?$/i,
  /^test$/i,
  /^untitled$/i,
  /^new\s*task$/i,
  /^new\s*project$/i,

  // Contains patterns
  /lorem\s*ipsum/i,
  /foo\s*bar/i,
  /hello\s*world/i,
  /asdf/i,
  /qwerty/i,
  /test\s*\d+/i, // test1, test 2, etc.
  /task\s*\d+$/i, // task1, task 2, etc. (but only at end)

  // Programmatic patterns (AI/automation)
  /^sample\s/i,
  /created\s*by\s*(ai|claude|gpt|automation)/i,
  /auto[-\s]*generated/i,
  /placeholder/i,
] as const

// Whitelist patterns - legitimate titles that may trigger false positives
const WHITELIST_PATTERNS = [
  /test\s*(results|scores|prep|preparation|drive|run)/i, // "Test Results", "Test Drive"
  /demo\s*(day|meeting|presentation|video|call)/i, // "Demo Day", "Demo Meeting"
  /sample\s*(size|data|collection|analysis)/i, // "Sample Size", "Sample Data"
  /example\s*(code|implementation|usage)/i, // Work-related
  /unit\s*test/i, // "Write Unit Tests"
  /integration\s*test/i,
  /testing\s*(strategy|framework|plan)/i,
] as const

export interface DemoContentCheckResult {
  isDemo: boolean
  matchedPattern: string | null
  confidence: 'high' | 'medium' | 'low'
  suggestion: string | null
}

export interface DemoGuardOptions {
  warnInConsole?: boolean
  throwError?: boolean
  notifyUser?: boolean
  checkProjectNames?: boolean
}

const defaultOptions: DemoGuardOptions = {
  warnInConsole: import.meta.env.DEV,
  throwError: false,
  notifyUser: false,
  checkProjectNames: true,
}

/**
 * Check if a string matches any whitelist patterns
 */
function isWhitelisted(text: string): boolean {
  return WHITELIST_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * Check if a string contains demo/test content patterns
 */
export function checkForDemoContent(
  text: string,
  options: DemoGuardOptions = {}
): DemoContentCheckResult {
  const opts = { ...defaultOptions, ...options }

  if (!text || typeof text !== 'string') {
    return {
      isDemo: false,
      matchedPattern: null,
      confidence: 'low',
      suggestion: null,
    }
  }

  const trimmedText = text.trim()

  // Skip empty strings
  if (trimmedText.length === 0) {
    return {
      isDemo: false,
      matchedPattern: null,
      confidence: 'low',
      suggestion: null,
    }
  }

  // Check whitelist first - these are legitimate uses
  if (isWhitelisted(trimmedText)) {
    return {
      isDemo: false,
      matchedPattern: null,
      confidence: 'low',
      suggestion: null,
    }
  }

  // Check against demo patterns
  for (const pattern of DEMO_PATTERNS) {
    if (pattern.test(trimmedText)) {
      const patternStr = pattern.source

      // Determine confidence based on pattern type
      let confidence: 'high' | 'medium' | 'low' = 'medium'
      if (/^test\s*task$/i.test(trimmedText) || /^sample/i.test(trimmedText)) {
        confidence = 'high'
      } else if (/lorem|placeholder|auto[-\s]*generated/i.test(trimmedText)) {
        confidence = 'high'
      } else if (/\d+$/.test(trimmedText)) {
        confidence = 'low' // "task 1" could be legitimate
      }

      const result: DemoContentCheckResult = {
        isDemo: true,
        matchedPattern: patternStr,
        confidence,
        suggestion: getSuggestion(trimmedText),
      }

      // Handle based on options
      if (opts.warnInConsole) {
        logWarning(trimmedText, result)
      }

      if (opts.throwError && confidence === 'high') {
        throw new Error(
          `[DemoContentGuard] Blocked demo content creation: "${trimmedText}"`
        )
      }

      return result
    }
  }

  return {
    isDemo: false,
    matchedPattern: null,
    confidence: 'low',
    suggestion: null,
  }
}

/**
 * Guard wrapper for task creation
 */
export function guardTaskCreation(
  title: string,
  options: DemoGuardOptions = {}
): DemoContentCheckResult {
  return checkForDemoContent(title, options)
}

/**
 * Guard wrapper for project creation
 */
export function guardProjectCreation(
  name: string,
  options: DemoGuardOptions = {}
): DemoContentCheckResult {
  if (!options.checkProjectNames && options.checkProjectNames !== undefined) {
    return {
      isDemo: false,
      matchedPattern: null,
      confidence: 'low',
      suggestion: null,
    }
  }
  return checkForDemoContent(name, options)
}

/**
 * Log warning to console in development mode
 */
function logWarning(text: string, result: DemoContentCheckResult): void {
  const emoji = result.confidence === 'high' ? '🚨' : '⚠️'
  const level = result.confidence === 'high' ? 'error' : 'warn'

  console[level](
    `${emoji} [DemoContentGuard] Detected potential demo content:`,
    {
      text,
      pattern: result.matchedPattern,
      confidence: result.confidence,
      suggestion: result.suggestion,
    }
  )

  if (result.confidence === 'high') {
    console.trace('[DemoContentGuard] Stack trace for investigation:')
  }
}

/**
 * Get suggestion for why this might be demo content
 */
function getSuggestion(text: string): string {
  const lower = text.toLowerCase()

  if (/test\s*task/i.test(lower)) {
    return 'This looks like a test task. If creating real tasks, use descriptive titles.'
  }
  if (/sample/i.test(lower)) {
    return 'This contains "sample" which often indicates demo content.'
  }
  if (/lorem/i.test(lower)) {
    return 'Lorem ipsum is placeholder text, not real content.'
  }
  if (/placeholder/i.test(lower)) {
    return 'Placeholder content should not be saved to the database.'
  }
  if (/demo/i.test(lower)) {
    return 'Demo content should not pollute user data.'
  }
  if (/task\s*\d+$/i.test(lower)) {
    return 'Generic numbered tasks may indicate automated/test creation.'
  }

  return 'This pattern matches common demo/test content indicators.'
}

/**
 * Batch check multiple items (useful for imports or bulk operations)
 */
export function batchCheckForDemoContent(
  items: string[],
  options: DemoGuardOptions = {}
): { flagged: Array<{ text: string; result: DemoContentCheckResult }>; clean: string[] } {
  const flagged: Array<{ text: string; result: DemoContentCheckResult }> = []
  const clean: string[] = []

  for (const item of items) {
    const result = checkForDemoContent(item, { ...options, warnInConsole: false })
    if (result.isDemo) {
      flagged.push({ text: item, result })
    } else {
      clean.push(item)
    }
  }

  // Log summary if any flagged
  if (flagged.length > 0 && options.warnInConsole !== false && import.meta.env.DEV) {
    console.warn(
      `[DemoContentGuard] Batch check flagged ${flagged.length}/${items.length} items:`,
      flagged.map((f) => f.text)
    )
  }

  return { flagged, clean }
}

// Export for testing
export const _internal = {
  DEMO_PATTERNS,
  WHITELIST_PATTERNS,
  isWhitelisted,
}

/**
 * Simple Input Sanitizer for Personal Use
 * Basic protection without enterprise overhead
 */

/**
 * Simple HTML sanitization - removes dangerous tags but preserves formatting
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') return ''

  return input
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove dangerous event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove javascript: protocols
    .replace(/javascript:/gi, '')
    // Basic HTML escaping for safety
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Basic text sanitization - prevents XSS in text fields
 */
export function sanitizeText(input: unknown): string {
  if (!input) return ''
  const str = typeof input === 'string' ? input : String(input)

  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Task title sanitization - keeps safe characters only
 */
export function sanitizeTaskTitle(title: any): string {
  if (!title) return ''
  if (typeof title !== 'string') {
    title = String(title)
  }

  // Allow alphanumeric, spaces, and basic punctuation
  return title
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .substring(0, 200) // Reasonable length limit
}

/**
 * Task description sanitization - allows more formatting
 */
export function sanitizeTaskDescription(description: any): string {
  if (!description) return ''
  if (typeof description !== 'string') {
    description = String(description)
  }

  // Basic sanitization but allow some formatting
  return sanitizeHTML(description)
    .substring(0, 2000) // Reasonable length limit
}

/**
 * Simple filename sanitization
 */
export function sanitizeFilename(filename: any): string {
  if (!filename) return ''
  if (typeof filename !== 'string') {
    filename = String(filename)
  }

  return filename
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid filename chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .substring(0, 100)
}

/**
 * Check if input looks potentially dangerous
 */
export function isSuspicious(input: any): boolean {
  if (!input || typeof input !== 'string') return false

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /vbscript:/i,
    /data:text\/html/i
  ]

  return suspiciousPatterns.some(pattern => pattern.test(input))
}

/**
 * Simple validation for task data
 */
export function validateTaskData(task: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!task.title || typeof task.title !== 'string') {
    errors.push('Title is required')
  } else if (isSuspicious(task.title)) {
    errors.push('Title contains suspicious content')
  } else if (task.title.length > 200) {
    errors.push('Title is too long')
  }

  if (task.description && isSuspicious(task.description)) {
    errors.push('Description contains suspicious content')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeTaskTitle,
  sanitizeTaskDescription,
  sanitizeFilename,
  isSuspicious,
  validateTaskData
}
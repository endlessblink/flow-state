/**
 * Input Sanitization and Validation Utility
 * Comprehensive input sanitization, validation, and XSS prevention
 */

import { ref as _ref } from 'vue'

export interface ValidationRule {
  name: string
  validate: (value: unknown) => boolean
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  sanitizedValue: unknown
}

export interface SanitizationOptions {
  allowHTML?: boolean
  allowedTags?: string[]
  allowedAttributes?: string[]
  maxLength?: number
  trimWhitespace?: boolean
  escapeHTML?: boolean
  removeScripts?: boolean
  normalizeWhitespace?: boolean
}

export class InputSanitizer {
  private static readonly DEFAULT_ALLOWED_TAGS = [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre'
  ]

  private static readonly DEFAULT_ALLOWED_ATTRIBUTES = [
    'href', 'title', 'alt', 'class', 'id'
  ]

  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<form\b[^>]*>/gi,
    /<input\b[^>]*>/gi,
    /<textarea\b[^>]*>/gi,
    /<select\b[^>]*>/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /&#x[0-9a-f]+;?/gi,
    /&#\d+;?/gi
  ]

  // Main sanitization method
  static sanitize(input: unknown, options: SanitizationOptions = {}): unknown {
    if (input === null || input === undefined) {
      return input
    }

    const opts: Required<SanitizationOptions> = {
      allowHTML: false,
      allowedTags: this.DEFAULT_ALLOWED_TAGS,
      allowedAttributes: this.DEFAULT_ALLOWED_ATTRIBUTES,
      maxLength: 10000,
      trimWhitespace: true,
      escapeHTML: true,
      removeScripts: true,
      normalizeWhitespace: false,
      ...options
    }

    let sanitized = String(input)

    // Remove script content
    if (opts.removeScripts) {
      sanitized = this.removeScripts(sanitized)
    }

    // Remove dangerous patterns
    sanitized = this.removeDangerousPatterns(sanitized)

    // Handle HTML based on options
    if (opts.allowHTML) {
      sanitized = this.sanitizeHTML(sanitized, opts.allowedTags, opts.allowedAttributes)
    } else if (opts.escapeHTML) {
      sanitized = this.escapeHTML(sanitized)
    }

    // Normalize whitespace
    if (opts.normalizeWhitespace) {
      sanitized = this.normalizeWhitespace(sanitized)
    }

    // Trim whitespace
    if (opts.trimWhitespace) {
      sanitized = sanitized.trim()
    }

    // Enforce max length
    if (opts.maxLength && sanitized.length > opts.maxLength) {
      sanitized = sanitized.substring(0, opts.maxLength)
    }

    return sanitized
  }

  // Remove script tags and content
  private static removeScripts(input: string): string {
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  }

  // Remove dangerous patterns
  private static removeDangerousPatterns(input: string): string {
    let sanitized = input

    this.DANGEROUS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '')
    })

    return sanitized
  }

  // Escape HTML entities
  static escapeHTML(input: string): string {
    const div = document.createElement('div')
    div.textContent = input
    return div.innerHTML
  }

  // Sanitize HTML with allowed tags and attributes
  private static sanitizeHTML(input: string, allowedTags: string[], allowedAttributes: string[]): string {
    // Create a temporary DOM element to parse HTML
    const temp = document.createElement('div')
    temp.innerHTML = input

    // Sanitize each node
    this.sanitizeNode(temp, allowedTags, allowedAttributes)

    return temp.innerHTML
  }

  // Recursively sanitize DOM nodes
  private static sanitizeNode(node: Node, allowedTags: string[], allowedAttributes: string[]): void {
    const toRemove: Node[] = []

    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i]

      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element
        const tagName = element.tagName.toLowerCase()

        // Check if tag is allowed
        if (!allowedTags.includes(tagName)) {
          toRemove.push(child)
          continue
        }

        // Sanitize attributes
        const attributesToRemove: string[] = []
        for (let j = 0; j < element.attributes.length; j++) {
          const attr = element.attributes[j]
          const attrName = attr.name.toLowerCase()

          if (!allowedAttributes.includes(attrName) ||
              attrName.startsWith('on') ||
              attrName.startsWith('data-')) {
            attributesToRemove.push(attrName)
          }
        }

        attributesToRemove.forEach(attrName => {
          element.removeAttribute(attrName)
        })

        // Recursively sanitize children
        this.sanitizeNode(child, allowedTags, allowedAttributes)
      }
    }

    // Remove disallowed elements
    toRemove.forEach(child => {
      child.parentNode?.removeChild(child)
    })
  }

  // Normalize whitespace
  private static normalizeWhitespace(input: string): string {
    return input.replace(/\s+/g, ' ').trim()
  }

  // Validate input against rules
  static validate(input: any, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    for (const rule of rules) {
      try {
        if (!rule.validate(input)) {
          if (rule.severity === 'error') {
            errors.push(rule.message)
          } else {
            warnings.push(rule.message)
          }
        }
      } catch (error) {
        errors.push(`Validation rule "${rule.name}" failed: ${error}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue: input
    }
  }

  // Validate and sanitize in one step
  static validateAndSanitize(input: any, rules: ValidationRule[], options: SanitizationOptions = {}): ValidationResult {
    const sanitized = this.sanitize(input, options)
    const validation = this.validate(sanitized, rules)

    return {
      ...validation,
      sanitizedValue: sanitized
    }
  }

  // Common validation rules
  static readonly CommonRules = {
    required: {
      name: 'required',
      validate: (value: any) => value !== null && value !== undefined && value !== '',
      message: 'This field is required',
      severity: 'error' as const
    },

    email: {
      name: 'email',
      validate: (value: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return !value || emailRegex.test(value)
      },
      message: 'Please enter a valid email address',
      severity: 'error' as const
    },

    url: {
      name: 'url',
      validate: (value: string) => {
        const urlRegex = /^https?:\/\/.+/i
        return !value || urlRegex.test(value)
      },
      message: 'Please enter a valid URL',
      severity: 'error' as const
    },

    minLength: (min: number) => ({
      name: 'minLength',
      validate: (value: string) => !value || value.length >= min,
      message: `Must be at least ${min} characters long`,
      severity: 'error' as const
    }),

    maxLength: (max: number) => ({
      name: 'maxLength',
      validate: (value: string) => !value || value.length <= max,
      message: `Must be no more than ${max} characters long`,
      severity: 'error' as const
    }),

    alphanumeric: {
      name: 'alphanumeric',
      validate: (value: string) => !value || /^[a-zA-Z0-9]+$/.test(value),
      message: 'Only letters and numbers are allowed',
      severity: 'error' as const
    },

    noSpecialChars: {
      name: 'noSpecialChars',
      validate: (value: string) => !value || /^[a-zA-Z0-9\s\-_]+$/.test(value),
      message: 'No special characters allowed',
      severity: 'error' as const
    },

    noHTML: {
      name: 'noHTML',
      validate: (value: string) => !value || !/<[^>]*>/.test(value),
      message: 'HTML tags are not allowed',
      severity: 'error' as const
    },

    safeText: {
      name: 'safeText',
      validate: (value: string) => {
        if (!value) return true
        const dangerousPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+=/i
        ]
        return !dangerousPatterns.some(pattern => pattern.test(value))
      },
      message: 'Contains potentially unsafe content',
      severity: 'error' as const
    },

    taskTitle: {
      name: 'taskTitle',
      validate: (value: string) => {
        if (!value) return true
        return value.length >= 1 && value.length <= 200 &&
               !/<[^>]*>/.test(value) &&
               !/javascript:/i.test(value)
      },
      message: 'Task title must be 1-200 characters and contain no HTML',
      severity: 'error' as const
    },

    taskDescription: {
      name: 'taskDescription',
      validate: (value: string) => {
        if (!value) return true
        return value.length <= 2000 && !/javascript:/i.test(value)
      },
      message: 'Task description must be 2000 characters or less',
      severity: 'error' as const
    },

    projectName: {
      name: 'projectName',
      validate: (value: string) => {
        if (!value) return true
        return value.length >= 1 && value.length <= 100 &&
               /^[a-zA-Z0-9\s\-_]+$/.test(value)
      },
      message: 'Project name must be 1-100 characters with letters, numbers, spaces, hyphens, and underscores',
      severity: 'error' as const
    }
  }

  // Sanitize task data
  static sanitizeTaskData(task: any): any {
    return {
      id: this.sanitize(task.id, { allowHTML: false, maxLength: 50 }),
      title: this.sanitize(task.title, {
        allowHTML: false,
        maxLength: 200,
        trimWhitespace: true
      }),
      description: this.sanitize(task.description, {
        allowHTML: true,
        allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
        maxLength: 2000,
        trimWhitespace: true
      }),
      status: this.sanitize(task.status, { allowHTML: false, maxLength: 20 }),
      priority: this.sanitize(task.priority, { allowHTML: false, maxLength: 20 }),
      projectId: this.sanitize(task.projectId, { allowHTML: false, maxLength: 50 }),
      dueDate: this.sanitize(task.dueDate, { allowHTML: false, maxLength: 50 }),
      tags: Array.isArray(task.tags) ? task.tags.map((tag: any) =>
        this.sanitize(tag, { allowHTML: false, maxLength: 50 })
      ) : [],
      // Add other task fields as needed
    }
  }

  // Sanitize user input for search
  static sanitizeSearchInput(input: string): string {
    return this.sanitize(input, {
      allowHTML: false,
      maxLength: 500,
      trimWhitespace: true,
      normalizeWhitespace: true
    })
  }

  // Sanitize file names
  static sanitizeFileName(input: string): string {
    return this.sanitize(input, {
      allowHTML: false,
      maxLength: 255,
      trimWhitespace: true
    }).replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
  }

  // Check for XSS attempts
  static hasXSS(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /vbscript:/i,
      /data:text\/html/i
    ]

    return xssPatterns.some(pattern => pattern.test(input))
  }

  // Extract safe URLs from text
  static extractSafeURLs(text: string): string[] {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g
    const matches = text.match(urlRegex) || []

    return matches.filter(url => {
      const sanitized = this.sanitize(url, { allowHTML: false })
      return !this.hasXSS(sanitized)
    })
  }
}

// Vue composable for easy integration
export function useInputSanitizer() {
  const sanitize = (input: any, options?: SanitizationOptions) => {
    return InputSanitizer.sanitize(input, options)
  }

  const validate = (input: any, rules: ValidationRule[]) => {
    return InputSanitizer.validate(input, rules)
  }

  const validateAndSanitize = (input: any, rules: ValidationRule[], options?: SanitizationOptions) => {
    return InputSanitizer.validateAndSanitize(input, rules, options)
  }

  const sanitizeTaskData = (task: any) => {
    return InputSanitizer.sanitizeTaskData(task)
  }

  const hasXSS = (input: string) => {
    return InputSanitizer.hasXSS(input)
  }

  return {
    sanitize,
    validate,
    validateAndSanitize,
    sanitizeTaskData,
    hasXSS,
    rules: InputSanitizer.CommonRules
  }
}

export default InputSanitizer
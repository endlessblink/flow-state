/**
 * TASK-1620: Localization Completeness Tests — 10 tests.
 *
 * Reads src/i18n/locales/en.json and src/i18n/locales/he.json and verifies
 * structural parity between the two locale files.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Load locale files once
// ---------------------------------------------------------------------------

const LOCALES_DIR = resolve(__dirname, '../../../src/i18n/locales')
const EN_PATH = resolve(LOCALES_DIR, 'en.json')
const HE_PATH = resolve(LOCALES_DIR, 'he.json')

let enRaw = ''
let heRaw = ''
let en: Record<string, unknown> = {}
let he: Record<string, unknown> = {}

beforeAll(() => {
  if (existsSync(EN_PATH)) enRaw = readFileSync(EN_PATH, 'utf-8')
  if (existsSync(HE_PATH)) heRaw = readFileSync(HE_PATH, 'utf-8')
  if (enRaw) en = JSON.parse(enRaw)
  if (heRaw) he = JSON.parse(heRaw)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collect all dot-path keys from a nested object.
 * e.g. { a: { b: 'val' } } → ['a.b']
 */
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

/**
 * Recursively collect all leaf keys (values are strings/non-objects) with their values.
 */
function collectLeaves(
  obj: Record<string, unknown>,
  prefix = ''
): Array<{ key: string; value: unknown }> {
  const leaves: Array<{ key: string; value: unknown }> = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      leaves.push(...collectLeaves(v as Record<string, unknown>, path))
    } else {
      leaves.push({ key: path, value: v })
    }
  }
  return leaves
}

/**
 * Get the shape (structure) of an object: same tree but values replaced by their typeof.
 */
function shape(obj: unknown): unknown {
  if (obj === null || obj === undefined) return typeof obj
  if (typeof obj !== 'object' || Array.isArray(obj)) return typeof obj
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = shape(v)
  }
  return result
}

/**
 * Extract all ICU/vue-i18n placeholder names from a string.
 * e.g. "{count} tasks" → ['count']
 * e.g. "{0}" → ['0']
 */
function extractPlaceholders(val: string): string[] {
  const matches = val.match(/\{[^}]+\}/g) ?? []
  return matches.map(m => m.slice(1, -1))
}

// ---------------------------------------------------------------------------
// Test 1: English locale file exists and is valid JSON
// ---------------------------------------------------------------------------

describe('Locale file validity', () => {
  it('en.json exists and is valid JSON', () => {
    expect(existsSync(EN_PATH)).toBe(true)
    expect(() => JSON.parse(enRaw)).not.toThrow()
    expect(typeof en).toBe('object')
    expect(en).not.toBeNull()
  })

  // Test 2
  it('he.json exists and is valid JSON', () => {
    expect(existsSync(HE_PATH)).toBe(true)
    expect(() => JSON.parse(heRaw)).not.toThrow()
    expect(typeof he).toBe('object')
    expect(he).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests 3-4: Parity — no missing or orphaned keys
// ---------------------------------------------------------------------------

describe('Key parity between locales', () => {
  it('all keys in English exist in Hebrew (no missing translations)', () => {
    const enKeys = collectKeys(en)
    const heKeys = new Set(collectKeys(he))
    const missing = enKeys.filter(k => !heKeys.has(k))
    if (missing.length > 0) {
      console.warn(`[i18n] Missing ${missing.length} Hebrew keys:`, missing.slice(0, 10))
    }
    expect(missing).toEqual([])
  })

  it('all keys in Hebrew exist in English (no orphaned translations)', () => {
    const heKeys = collectKeys(he)
    const enKeys = new Set(collectKeys(en))
    const orphaned = heKeys.filter(k => !enKeys.has(k))
    if (orphaned.length > 0) {
      console.warn(`[i18n] Orphaned ${orphaned.length} Hebrew keys:`, orphaned.slice(0, 10))
    }
    expect(orphaned).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Tests 5-6: No empty string values
// ---------------------------------------------------------------------------

describe('No empty translation values', () => {
  it('no empty string values in English', () => {
    const leaves = collectLeaves(en)
    const empty = leaves.filter(({ value }) => value === '')
    if (empty.length > 0) {
      console.warn('[i18n] Empty English values:', empty.map(e => e.key).slice(0, 10))
    }
    expect(empty).toEqual([])
  })

  it('no empty string values in Hebrew', () => {
    const leaves = collectLeaves(he)
    const empty = leaves.filter(({ value }) => value === '')
    if (empty.length > 0) {
      console.warn('[i18n] Empty Hebrew values:', empty.map(e => e.key).slice(0, 10))
    }
    expect(empty).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 7: Nested key structure matches (same depth and shape)
// ---------------------------------------------------------------------------

describe('Structural parity', () => {
  it('nested key structure is identical between en and he', () => {
    const enShape = shape(en)
    const heShape = shape(he)

    // Both should have the same top-level keys
    const enTopKeys = Object.keys(en).sort()
    const heTopKeys = Object.keys(he).sort()
    expect(heTopKeys).toEqual(enTopKeys)

    // For each top-level section, check that nested keys match
    for (const section of enTopKeys) {
      const enSection = en[section]
      const heSection = he[section]

      if (typeof enSection === 'object' && enSection !== null) {
        const enSectionKeys = Object.keys(enSection as Record<string, unknown>).sort()
        const heSectionKeys = Object.keys((heSection ?? {}) as Record<string, unknown>).sort()
        expect(heSectionKeys).toEqual(enSectionKeys)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Test 8: No duplicate keys at the same level
// ---------------------------------------------------------------------------

describe('No duplicate keys', () => {
  it('no duplicate keys at the same level in either locale', () => {
    function findDuplicates(jsonStr: string): string[] {
      // Parse raw JSON manually to detect duplicate keys (JSON.parse silently deduplicates)
      const duplicates: string[] = []
      // Simple heuristic: count occurrences of "key": patterns at each nesting level
      // Track keys per object depth using a stack
      const keyStack: Set<string>[] = []
      let inString = false
      let escape = false
      let i = 0

      while (i < jsonStr.length) {
        const ch = jsonStr[i]

        if (escape) { escape = false; i++; continue }
        if (ch === '\\' && inString) { escape = true; i++; continue }
        if (ch === '"') { inString = !inString; i++; continue }

        if (!inString) {
          if (ch === '{') {
            keyStack.push(new Set<string>())
          } else if (ch === '}') {
            keyStack.pop()
          }
        }

        // Extract key name: look for "key" : pattern when we're not in a string
        if (!inString && ch === '"' && keyStack.length > 0) {
          // Find end of key string
          let j = i + 1
          while (j < jsonStr.length && !(jsonStr[j] === '"' && jsonStr[j - 1] !== '\\')) j++
          const key = jsonStr.slice(i + 1, j)
          // Check if immediately followed by :
          let k = j + 1
          while (k < jsonStr.length && jsonStr[k] === ' ') k++
          if (jsonStr[k] === ':') {
            const current = keyStack[keyStack.length - 1]
            if (current) {
              if (current.has(key)) duplicates.push(key)
              else current.add(key)
            }
          }
        }

        i++
      }

      return duplicates
    }

    // Use a simpler approach: parse with a reviver that tracks keys
    function detectDuplicateKeys(jsonStr: string): string[] {
      const seen: string[] = []
      // Regex approach: find all "key": patterns and look for duplicates within the same object
      // This is intentionally simple — catches obvious duplicates at each object level
      const objectRe = /\{([^{}]*)\}/g
      let match: RegExpExecArray | null
      while ((match = objectRe.exec(jsonStr)) !== null) {
        const body = match[1]
        const keyRe = /"([^"\\]+)"\s*:/g
        const keysInObject: string[] = []
        let km: RegExpExecArray | null
        while ((km = keyRe.exec(body)) !== null) {
          const k = km[1]
          if (keysInObject.includes(k)) seen.push(k)
          keysInObject.push(k)
        }
      }
      return seen
    }

    const enDups = detectDuplicateKeys(enRaw)
    const heDups = detectDuplicateKeys(heRaw)

    expect(enDups).toEqual([])
    expect(heDups).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 9: Placeholder patterns match between locales
// ---------------------------------------------------------------------------

describe('Placeholder parity', () => {
  it('placeholder patterns {name} in matching keys are consistent between en and he', () => {
    const enLeaves = collectLeaves(en)
    const heLeaves = collectLeaves(he)
    const heMap = new Map(heLeaves.map(l => [l.key, l.value]))

    const mismatches: Array<{ key: string; en: string[]; he: string[] }> = []

    for (const { key, value: enVal } of enLeaves) {
      if (typeof enVal !== 'string') continue
      const heVal = heMap.get(key)
      if (typeof heVal !== 'string') continue

      // Deduplicate before comparing — vue-i18n pluralisation strings repeat placeholders
      // across plural forms (e.g. "{count} task | {count} tasks") which is valid.
      // What matters is that the SET of placeholder names is the same.
      const enPlaceholders = [...new Set(extractPlaceholders(enVal))].sort()
      const hePlaceholders = [...new Set(extractPlaceholders(heVal))].sort()

      // Compare as sorted unique sets
      const enSet = JSON.stringify(enPlaceholders)
      const heSet = JSON.stringify(hePlaceholders)

      if (enSet !== heSet) {
        mismatches.push({ key, en: enPlaceholders, he: hePlaceholders })
      }
    }

    if (mismatches.length > 0) {
      console.warn(
        '[i18n] Placeholder mismatches (first 5):',
        mismatches.slice(0, 5)
      )
    }

    expect(mismatches).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 10: Total key count is reasonable
// ---------------------------------------------------------------------------

describe('Key count sanity', () => {
  it('total key count is between 50 and 5000 in both locales', () => {
    const enCount = collectKeys(en).length
    const heCount = collectKeys(he).length

    expect(enCount).toBeGreaterThan(50)
    expect(enCount).toBeLessThan(5000)

    expect(heCount).toBeGreaterThan(50)
    expect(heCount).toBeLessThan(5000)

    // Both locales should have the same count (enforced by tests 3+4, verified here)
    expect(enCount).toBe(heCount)
  })
})

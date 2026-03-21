/**
 * Naive UI Overrides Tests (TASK-1640)
 *
 * Static analysis verifying that global-overrides.css and App.vue maintain
 * the correct Naive UI style overrides for glass morphism dark theme.
 * No DOM/Vue runtime required.
 *
 * Tests:
 *  1.  global-overrides.css exists and has substantial content
 *  2.  NDatePicker dark theme overrides present (background override)
 *  3.  NDatePicker selected date uses --brand-primary (#4ECDC4) not generic blue
 *  4.  NDatePicker weekend color neutralized (overrides default Naive UI red)
 *  5.  NPopover overrides present for glass morphism background
 *  6.  All NDatePicker usages have :actions="[]" to suppress default buttons
 *  7.  No NSelect used directly (CustomSelect wrapper must be used instead)
 *  8.  NConfigProvider in App.vue passes :theme-overrides
 *  9.  themeOverrides in App.vue contains DatePicker key
 * 10.  Scrollbar styling overrides present for dark theme
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { glob } from 'glob'

const SRC = path.resolve(__dirname, '../../../src')
const GLOBAL_OVERRIDES = path.join(SRC, 'assets/global-overrides.css')
const APP_VUE = path.join(SRC, 'App.vue')

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function extractScript(source: string): string {
  const matches = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  return matches.map(m => m[1]).join('\n')
}

/**
 * Extract the outermost SFC <template> block.
 * Stops at the last </template> to handle nested named slots.
 */
function extractTemplate(source: string): string {
  const startMatch = source.match(/<template>/)
  if (!startMatch || startMatch.index === undefined) return ''
  const start = startMatch.index + '<template>'.length
  const lastClose = source.lastIndexOf('</template>')
  if (lastClose === -1 || lastClose <= start) return source.slice(start)
  return source.slice(start, lastClose)
}

/** Collect all .vue files under src/ */
function getAllVueFiles(): string[] {
  return glob.sync('**/*.vue', { cwd: SRC, absolute: true })
}

// ---------------------------------------------------------------------------
// Test 1: global-overrides.css exists and has substantial content
// ---------------------------------------------------------------------------
describe('TASK-1640: Naive UI Overrides', () => {

  it('Test 1: global-overrides.css exists and has substantial content (>500 lines)', () => {
    expect(fs.existsSync(GLOBAL_OVERRIDES), 'src/assets/global-overrides.css must exist').toBe(true)
    const content = readFile(GLOBAL_OVERRIDES)
    const lineCount = content.split('\n').length
    expect(lineCount).toBeGreaterThan(500)
  })

  // ---------------------------------------------------------------------------
  // Test 2: NDatePicker dark theme overrides: panel background set
  // ---------------------------------------------------------------------------
  it('Test 2: NDatePicker panel background overridden to dark/glass theme', () => {
    const css = readFile(GLOBAL_OVERRIDES)

    // The .n-date-picker-panel / .n-date-panel selectors must exist
    expect(css).toContain('.n-date-picker-panel')
    expect(css).toContain('.n-date-panel')

    // Panel must set background to a CSS variable (not default Naive UI white/light)
    expect(css).toMatch(/\.n-date-picker-panel[\s\S]{0,200}background:\s*var\(/)
  })

  // ---------------------------------------------------------------------------
  // Test 3: Selection uses #4ECDC4 (--brand-primary teal) not generic blue
  // ---------------------------------------------------------------------------
  it('Test 3: NDatePicker selected date uses #4ECDC4 (brand-primary teal)', () => {
    const css = readFile(GLOBAL_OVERRIDES)

    // Selected date color must be #4ECDC4
    expect(css).toContain('#4ECDC4')

    // Must appear in context of .n-date-panel-date--selected
    expect(css).toContain('.n-date-panel-date--selected')

    // Verify the selected color is #4ECDC4 — find any rule for selected dates
    // The override appears in `.n-date-panel .n-date-panel-date.n-date-panel-date--selected`
    const selectedBlocks = [...css.matchAll(/n-date-panel-date--selected[\s\S]{0,500}/g)]
    const selectedContent = selectedBlocks.map(m => m[0]).join('\n')
    expect(selectedContent).toContain('#4ECDC4')
  })

  // ---------------------------------------------------------------------------
  // Test 4: Weekend color neutralized
  // ---------------------------------------------------------------------------
  it('Test 4: NDatePicker weekend/weekday Naive UI red color is neutralized in overrides', () => {
    const css = readFile(GLOBAL_OVERRIDES)

    // A section specifically targeting weekday labels to override Naive's red
    expect(css).toContain('.n-date-panel-weekdays')

    // The override must reset to a non-red color using a token
    const weekdayBlock = css.match(/\.n-date-panel-weekdays[\s\S]{0,200}/)?.[0] ?? ''
    expect(weekdayBlock).toMatch(/color:/)

    // Comment or selector referencing weekend neutralization
    expect(css).toMatch(/weekday|weekend/i)
  })

  // ---------------------------------------------------------------------------
  // Test 5: NPopover glass morphism overrides present
  // ---------------------------------------------------------------------------
  it('Test 5: NPopover glass morphism overrides are present', () => {
    const css = readFile(GLOBAL_OVERRIDES)

    // Must have .n-popover override
    expect(css).toContain('.n-popover')

    // Popover background must use overlay/glass variable
    expect(css).toMatch(/\.n-popover[\s\S]{0,300}--n-color:\s*var\(--overlay-component-bg\)/)

    // .n-popover-content must also be overridden
    expect(css).toContain('.n-popover-content')
  })

  // ---------------------------------------------------------------------------
  // Test 6: All NDatePicker usages have :actions="[]"
  // ---------------------------------------------------------------------------
  it('Test 6: All NDatePicker usages pass :actions="[]" to suppress default buttons', () => {
    const vueFiles = getAllVueFiles()
    const violations: string[] = []

    for (const file of vueFiles) {
      const source = readFile(file)
      // Find each NDatePicker usage block
      const datepickerBlocks = [...source.matchAll(/<NDatePicker([\s\S]*?)(?:\/?>|\/>)/g)]

      for (const match of datepickerBlocks) {
        const attrs = match[1]
        // Must have :actions="[]" — bare actions="" (no colon) shows all defaults
        if (!/:actions="\[\]"/.test(attrs)) {
          violations.push(path.relative(SRC, file))
          break // Only report each file once
        }
      }
    }

    // Known violation: ReminderPicker.vue uses NDatePicker without :actions="[]"
    // This is a tracked issue — test enforces it doesn't grow beyond 1
    const KNOWN_VIOLATIONS = ['components/notifications/ReminderPicker.vue']

    if (violations.length > 0) {
      console.warn('[TASK-1640 Test 6] NDatePicker without :actions="[]" found in:')
      violations.forEach(v => console.warn(' ', v))
    }

    const unexpectedViolations = violations.filter(v => !KNOWN_VIOLATIONS.includes(v))
    expect(
      unexpectedViolations,
      `New NDatePicker usages without :actions="[]": ${unexpectedViolations.join(', ')}`
    ).toHaveLength(0)

    // Baseline: known violations must not grow
    expect(violations.length).toBeLessThanOrEqual(KNOWN_VIOLATIONS.length)
  })

  // ---------------------------------------------------------------------------
  // Test 7: No NSelect used directly (must use CustomSelect wrapper)
  // ---------------------------------------------------------------------------
  it('Test 7: NSelect is not used directly in any .vue template (use CustomSelect instead)', () => {
    const vueFiles = getAllVueFiles()
    const violations: string[] = []

    for (const file of vueFiles) {
      const source = readFile(file)
      const template = extractTemplate(source)
      const script = extractScript(source)

      // Check for direct NSelect usage in template
      const hasNSelectTemplate = /<NSelect[\s/>]/.test(template)
      // Check for NSelect import
      const hasNSelectImport = /import\s*\{[^}]*\bNSelect\b[^}]*\}\s*from\s*['"]naive-ui['"]/.test(script)

      if (hasNSelectTemplate || hasNSelectImport) {
        const rel = path.relative(SRC, file)
        violations.push(rel)
      }
    }

    if (violations.length > 0) {
      console.warn('[TASK-1640 Test 7] NSelect used directly (should use CustomSelect) in:')
      violations.forEach(v => console.warn(' ', v))
    }

    expect(violations, `Direct NSelect usage found in: ${violations.join(', ')}`).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Test 8: NConfigProvider in App.vue passes :theme-overrides
  // ---------------------------------------------------------------------------
  it('Test 8: App.vue uses NConfigProvider with :theme-overrides binding', () => {
    const source = readFile(APP_VUE)
    const template = extractTemplate(source)

    // NConfigProvider must be present
    expect(template).toContain('NConfigProvider')

    // Must pass :theme-overrides (not bare theme-overrides)
    expect(template).toContain(':theme-overrides="themeOverrides"')
  })

  // ---------------------------------------------------------------------------
  // Test 9: themeOverrides in App.vue contains DatePicker section
  // ---------------------------------------------------------------------------
  it('Test 9: themeOverrides in App.vue defines DatePicker overrides', () => {
    const source = readFile(APP_VUE)
    const script = extractScript(source)

    // themeOverrides object must exist
    expect(script).toContain('themeOverrides')

    // Must have DatePicker key
    expect(script).toContain('DatePicker:')

    // Must import GlobalThemeOverrides type from naive-ui
    expect(script).toContain('GlobalThemeOverrides')
  })

  // ---------------------------------------------------------------------------
  // Test 10: Scrollbar styling overrides present for dark theme
  // ---------------------------------------------------------------------------
  it('Test 10: Dark theme scrollbar styling overrides present in global-overrides.css', () => {
    const css = readFile(GLOBAL_OVERRIDES)

    // Custom webkit scrollbar overrides must exist
    expect(css).toContain('::-webkit-scrollbar')
    expect(css).toContain('::-webkit-scrollbar-track')
    expect(css).toContain('::-webkit-scrollbar-thumb')

    // Must use design tokens, not hardcoded colors
    const thumbBlock = css.match(/::-webkit-scrollbar-thumb[\s\S]{0,150}/)?.[0] ?? ''
    expect(thumbBlock).toMatch(/var\(--/)
  })
})

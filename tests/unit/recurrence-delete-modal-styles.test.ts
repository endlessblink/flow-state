/**
 * BUG-1783 regression guard: RecurrenceDeleteModal action buttons must
 * render the Skip/Stop actions with brand-saturation borders so the
 * teal-accented (skip) and red-accented (stop) intent reads at a glance.
 *
 * Prior styling commits drifted the borders to fractional alpha
 * (`rgba(78, 205, 196, 0.8)`) which read as washed out on the modal's
 * dark surface.
 *
 * Source-text assertions rather than rendered-style assertions because
 * jsdom doesn't apply Vue scoped CSS reliably. We assert the exact
 * stylesheet contract instead.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MODAL_SRC = readFileSync(
  path.join(ROOT, 'src/components/common/RecurrenceDeleteModal.vue'),
  'utf-8'
)

// Helper: extract a CSS rule body for a given selector from the source.
// Returns the inside of the `{ ... }` braces, stripped of comments.
function ruleBody(selector: string): string {
  // Selector at start of line (or after whitespace), followed by `{ ... }`
  const re = new RegExp(`(?:^|\\s)${selector.replace(/[.\-]/g, m => '\\' + m)}\\s*\\{([^}]*)\\}`, 'm')
  const match = MODAL_SRC.match(re)
  if (!match) throw new Error(`CSS rule not found: ${selector}`)
  return match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim()
}

describe('BUG-1783: RecurrenceDeleteModal action button contrast', () => {
  it('Skip button has full-saturation brand-primary border (no fractional alpha)', () => {
    const css = ruleBody('.action-btn--skip')
    // Must reference the brand token directly, not a stale fractional rgba
    expect(css).toMatch(/border:\s*1px\s+solid\s+var\(--brand-primary\)/)
    // Must NOT contain washed-out fractional alpha shapes
    expect(css).not.toMatch(/border:\s*1px\s+solid\s+rgba\([^)]*0\.\d+\s*\)/)
  })

  it('Stop button has full-saturation color-danger border (no fractional alpha)', () => {
    const css = ruleBody('.action-btn--stop')
    expect(css).toMatch(/border:\s*1px\s+solid\s+var\(--color-danger\)/)
    expect(css).not.toMatch(/border:\s*1px\s+solid\s+rgba\([^)]*0\.\d+\s*\)/)
  })

  it('Skip button has a tinted background gradient (not transparent default)', () => {
    const css = ruleBody('.action-btn--skip')
    expect(css).toMatch(/background:\s*linear-gradient/)
    // Confirm the gradient uses the brand teal-green (45, 212, 191 — TASK-1791b rebrand)
    expect(css).toMatch(/rgba\(45,\s*212,\s*191/)
  })

  it('Stop button has a tinted background gradient (not transparent default)', () => {
    const css = ruleBody('.action-btn--stop')
    expect(css).toMatch(/background:\s*linear-gradient/)
    // Confirm the gradient uses danger red (239, 68, 68)
    expect(css).toMatch(/rgba\(239,\s*68,\s*68/)
  })

  it('Skip and Stop labels still resolve to brand colour tokens', () => {
    // Label rules live as nested selectors `.action-btn--skip .action-label`
    // and `.action-btn--stop .action-label`. Match against the full file.
    expect(MODAL_SRC).toMatch(/\.action-btn--skip\s+\.action-label\s*\{[^}]*color:\s*var\(--brand-primary\)/)
    expect(MODAL_SRC).toMatch(/\.action-btn--stop\s+\.action-label\s*\{[^}]*color:\s*var\(--color-danger\)/)
  })
  it('keeps each action row tall enough for its label and hint', () => {
    const css = ruleBody('.action-btn')
    expect(css).toMatch(/min-height:\s*max\(4\.25rem,\s*4\.75em\)/)
    expect(css).toMatch(/font:\s*inherit/)
    expect(css).toMatch(/line-height:\s*normal/)
    expect(css).toMatch(/align-items:\s*flex-start/)
    expect(css).toMatch(/overflow:\s*visible/)
    expect(MODAL_SRC).toMatch(/\.action-text\s*\{[^}]*flex:\s*1 1 auto/)
    expect(MODAL_SRC).toMatch(/\.action-label\s*\{[^}]*display:\s*block/)
    expect(MODAL_SRC).toMatch(/\.action-hint\s*\{[^}]*display:\s*block/)
    expect(MODAL_SRC).toMatch(/\.action-hint\s*\{[^}]*white-space:\s*normal/)
  })
})

# cyberflow-design-assessment

Automated design quality gate for Cyberflow RPG UI components.

## Metadata

```yaml
name: cyberflow-design-assessment
trigger: After UI changes to src/components/gamification/cyber/ or src/views/CyberflowView.vue
version: 1.0.0
tags: [design, ui, cyberflow, quality-gate]
```

## Purpose

Reviews Cyberflow cyberpunk UI components against design system standards, readability requirements, and game UI best practices. Prevents design debt accumulation by catching violations before merge.

## When to Invoke

1. **After UI component changes** to files matching:
   - `src/components/gamification/cyber/**/*.vue`
   - `src/views/CyberflowView.vue`
   - `src/assets/cyberflow-tokens.css`

2. **Before merging** Cyberflow feature branches

3. **Periodic audits** of existing Cyberflow UI

## Review Criteria

### 1. Design Token Compliance

**NEVER hardcode these values:**
```css
/* ❌ BAD */
color: rgba(255, 255, 255, 0.6);
background: #1a1a2e;
padding: 12px 16px;
font-size: 14px;
border-radius: 8px;

/* ✅ GOOD */
color: var(--text-secondary);
background: var(--cf-dark-bg);
padding: var(--space-3) var(--space-4);
font-size: var(--text-sm);
border-radius: var(--radius-md);
```

**Token categories to check:**
- **Text colors**: `var(--text-{primary|secondary|tertiary|muted|subtle})`
- **Cyberflow colors**: `var(--cf-*)` from `cyberflow-tokens.css`
- **Spacing**: `var(--space-{1|2|3|4|5|6|8|10|12|16})`
- **Typography**: `var(--text-{xs|sm|base|lg|xl|2xl})`
- **Borders**: `var(--border-{subtle|muted|primary})`
- **Backgrounds**: `var(--cf-dark-*) | var(--surface-*) | var(--glass-*)`
- **Radii**: `var(--radius-{sm|md|lg|xl})`

### 2. Typography & Readability

**Minimum font sizes:**
- Body text: `0.75rem` (12px) minimum — use `var(--text-xs)`
- Decorative labels: `0.625rem` (10px) absolute minimum — use `0.65rem` for badges
- Titles: `var(--text-sm)` (0.875rem/14px) minimum

**Font families:**
- Titles: `var(--font-cyber-title)` (Orbitron)
- Body: `var(--font-cyber-ui)` (Rajdhani)
- Data/Monospace: `var(--font-cyber-data)` (Space Mono)

**Contrast requirements:**
| Text Level | Minimum Opacity | Token |
|------------|-----------------|-------|
| Primary | 0.90 | `var(--text-primary)` |
| Secondary | 0.70 | `var(--text-secondary)` |
| Muted | 0.45 | `var(--text-muted)` |
| Subtle | 0.30 | `var(--text-subtle)` |

**CRITICAL**: Never use opacity below 0.3 for any text content.

### 3. Cyberpunk Game UI Patterns

**Research basis**: Cyberpunk 2077, Deus Ex, VA-11 Hall-A, Hyper Light Drifter

**DO:**
- Use augmented-ui frames (`data-augmented-ui`) for panel borders
- Clear visual hierarchy (neon accents on dark backgrounds)
- Single-metric cards (one key stat per card section)
- Progressive disclosure (dashboard overview → detail views)
- Persistent navigation that doesn't shift
- 4-column grid with `var(--space-4)` gutters
- Scanline overlays at 5-10% opacity maximum (intense mode only)
- Corner brackets/frames around important UI elements
- Hexagonal or diagonal slice shapes for visual interest

**DON'T:**
- Cram multiple complex sections on one page
- Use hover-to-reveal submenus (unreliable)
- Use red text on red/dark-red backgrounds (CP2077 lesson)
- Make decorative elements look functional
- Shift menu items on selection
- Use font sizes below 10px for anything
- Use more than 3 neon colors in one panel
- Use full-screen scanline overlays above 10% opacity

### 4. Information Density

**Visual hierarchy:**
- Each panel/card should have ONE clear purpose
- Progress bars minimum 8px height (`0.5rem`)
- XP/stats numbers should be 1.5x-2x larger than labels
- Time remaining should be prominent (not buried)
- Use color + size together to convey importance

**Layout rules:**
- Maximum 4 stat cards per row
- Minimum `var(--space-4)` (16px) gutters between cards
- Maximum 3 levels of visual hierarchy per component
- Minimum `var(--space-6)` (24px) between major sections

### 5. Accessibility

**Required attributes:**
- Progress bars: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Interactive elements: `:focus-visible` styles
- Status indicators: `aria-live="polite"` for dynamic updates
- Navigation: `<nav>` with `aria-label`

**Motion:**
```css
@media (prefers-reduced-motion: reduce) {
  .animation-class {
    animation: none !important;
    transition: none !important;
  }
}
```

**Color:**
- Never use color as the ONLY way to convey information
- Status indicators need shape + color + text
- Progress bars need percentage text + visual fill

## Execution Steps

### Step 1: Identify Files to Review

```bash
# Find recently modified Cyberflow components
git diff --name-only HEAD~5 | grep -E "(src/components/gamification/cyber/|src/views/CyberflowView.vue)"
```

Or use provided file list from context.

### Step 2: Token Compliance Scan

Use Grep to find hardcoded values:

```bash
# Find hardcoded rgba
grep -n "rgba\(" <file>

# Find hardcoded hex colors
grep -n "#[0-9a-fA-F]\{3,8\}" <file>

# Find hardcoded pixel values
grep -n "[0-9]\+px" <file>

# Find hardcoded rem values (not in var())
grep -n "[0-9]\+\.\?[0-9]*rem" <file> | grep -v "var("
```

For each violation, identify the appropriate token replacement:
- rgba(255,255,255,X) → check opacity level → map to `var(--text-*)`
- Hex colors → check context → map to `var(--cf-*)` or `var(--surface-*)`
- Pixel spacing → map to `var(--space-*)`
- Font sizes → map to `var(--text-*)`

### Step 3: Readability Scan

```bash
# Find font sizes below minimum
grep -n "font-size:" <file> | grep -E "(0\.[0-6]rem|[0-9]px)"

# Find low-opacity text
grep -n "opacity:" <file> | grep -E "0\.[0-2][0-9]"

# Find potentially low-contrast color combinations
grep -n "color:.*rgba.*0\.[0-3]" <file>
```

For each issue:
- Font size < 0.625rem → FAIL (increase to minimum)
- Font size 0.625-0.75rem → WARN (acceptable for labels only)
- Opacity < 0.3 → FAIL (increase or use semantic token)
- Opacity 0.3-0.45 → WARN (check readability in context)

### Step 4: UI Pattern Analysis

Read the component file and check for:

**Anti-patterns:**
- Multiple unrelated metrics in one card
- Nested expandable sections (more than 2 levels deep)
- Hover-only interactions without click fallback
- Progress bars without numeric percentage
- Red text on red backgrounds
- Shifting navigation elements

**Best practices:**
- Augmented-ui usage: `grep "data-augmented-ui" <file>`
- Progressive disclosure: Check for dashboard → detail flow
- Grid layout: Look for 4-column grid with proper gutters
- Scanline intensity: Check opacity values on overlays

### Step 5: Information Density Check

Calculate metrics per component:
- Stat cards per row (should be ≤ 4)
- Progress bar heights (should be ≥ 8px)
- Label vs value size ratio (values should be 1.5-2x labels)
- Section spacing (should be ≥ 24px between major sections)

### Step 6: Accessibility Audit

```bash
# Check for ARIA attributes on progress bars
grep -A 5 "progress" <file> | grep "aria-"

# Check for focus-visible styles
grep "focus-visible" <file>

# Check for reduced-motion support
grep "prefers-reduced-motion" <file>

# Check for aria-live on dynamic content
grep "aria-live" <file>
```

## Output Format

Generate a structured report:

```markdown
## Cyberflow Design Assessment Report

**Files Reviewed**: [list of files]
**Date**: [timestamp]
**Overall Grade**: [A/B/C/D/F]

---

### 1. Design Token Compliance: [PASS/WARN/FAIL]

[If violations found:]
**Hardcoded values found**:
- `src/path/to/file.vue:42` → `color: rgba(255,255,255,0.6)` — use `var(--text-secondary)`
- `src/path/to/file.vue:78` → `padding: 12px 16px` — use `var(--space-3) var(--space-4)`

**Summary**: X hardcoded colors, Y hardcoded spacing values, Z hardcoded font sizes

[If clean:]
✅ No hardcoded values detected. All styles use design tokens.

---

### 2. Typography & Readability: [PASS/WARN/FAIL]

[If violations found:]
**Font sizes below minimum**:
- `src/path/to/file.vue:105` → `font-size: 0.55rem` — increase to `var(--text-xs)` (0.75rem)

**Low contrast text**:
- `src/path/to/file.vue:89` → `opacity: 0.25` — increase to 0.45 or use `var(--text-muted)`

**Summary**: X font size violations, Y contrast violations

[If clean:]
✅ All text meets minimum size and contrast requirements.

---

### 3. Cyberpunk UI Patterns: [PASS/WARN/FAIL]

[If violations found:]
**Anti-patterns detected**:
- Multiple unrelated metrics crammed in StatCard component (lines 120-180)
- Red text on red background at line 234 (readability issue)

**Missing best practices**:
- No augmented-ui frames on panel borders
- Progress bars lack numeric percentage display

**Summary**: X anti-patterns, Y missing best practices

[If clean:]
✅ Follows cyberpunk UI best practices from reference games.

---

### 4. Information Density: [PASS/WARN/FAIL]

[If violations found:]
**Layout issues**:
- 6 stat cards in one row (line 145) — reduce to 4 maximum
- Progress bar height 4px (line 203) — increase to 8px minimum

**Hierarchy issues**:
- XP value same size as label (line 167) — make value 1.5-2x larger

**Summary**: X layout issues, Y hierarchy issues

[If clean:]
✅ Information density is balanced and scannable.

---

### 5. Accessibility: [PASS/WARN/FAIL]

[If violations found:]
**Missing ARIA attributes**:
- Progress bar at line 156 missing `role="progressbar"` and `aria-*` attributes

**Motion without reduced-motion support**:
- Animations at lines 234-245 need `@media (prefers-reduced-motion)` fallback

**Color-only indicators**:
- Status badge at line 312 uses only color to convey state (add icon or text)

**Summary**: X ARIA violations, Y motion violations, Z color-only indicators

[If clean:]
✅ All accessibility requirements met.

---

### Priority Fixes

[Numbered list of most impactful changes, ordered by severity:]

1. **CRITICAL**: Line 42 — Replace `rgba(255,255,255,0.2)` with `var(--text-muted)` (contrast fail)
2. **HIGH**: Lines 156-158 — Add ARIA attributes to progress bar
3. **MEDIUM**: Line 105 — Increase font size from 0.55rem to 0.75rem
4. **LOW**: Line 78 — Replace hardcoded padding with spacing tokens

---

### Recommendations

[If grade < B, provide specific guidance:]
- Consider splitting StatCard into single-metric cards
- Review Cyberpunk 2077 UI screenshots for visual hierarchy examples
- Use design tokens guide: `docs/claude-md-extension/design-system.md`
- Reference Cyberflow tokens: `src/assets/cyberflow-tokens.css`

---

**Next Steps**: [Fix priority issues above, then re-run assessment]
```

## Grading Rubric

| Grade | Criteria |
|-------|----------|
| **A** | 0 FAIL violations, 0-2 WARN violations, all best practices followed |
| **B** | 0 FAIL violations, 3-5 WARN violations, most best practices followed |
| **C** | 1-2 FAIL violations, any WARN violations, some best practices missing |
| **D** | 3-5 FAIL violations, multiple best practices missing |
| **F** | 6+ FAIL violations, majority of best practices missing |

**FAIL violations** (must fix):
- Font size < 0.625rem on non-decorative text
- Text opacity < 0.3
- Missing ARIA on interactive elements
- Red text on red backgrounds
- Progress bars < 6px height
- Color-only status indicators

**WARN violations** (should fix):
- Font size 0.625-0.75rem on body text
- Text opacity 0.3-0.45 on non-subtle text
- Hardcoded spacing values
- Hardcoded colors
- More than 4 stat cards per row
- Missing reduced-motion support

## Example Usage

```bash
# From Claude Code conversation
/cyberflow-design-assessment

# Or invoke after changes
# (skill auto-detects modified files in src/components/gamification/cyber/)
```

## Integration Points

- **Pre-commit hook**: Run on staged Cyberflow files
- **CI/CD**: Run on PR branches touching Cyberflow components
- **Dev-Maestro**: Link as quality gate for Cyberflow tasks
- **Manual audits**: Periodic full-component reviews

## References

- Design tokens guide: `docs/claude-md-extension/design-system.md`
- Cyberflow tokens: `src/assets/cyberflow-tokens.css`
- Base design tokens: `src/assets/design-tokens.css`
- Cyberpunk UI research: Cyberpunk 2077, Deus Ex, VA-11 Hall-A

---

**Version**: 1.0.0
**Last Updated**: February 7, 2026
**Maintainer**: FlowState Design System Team

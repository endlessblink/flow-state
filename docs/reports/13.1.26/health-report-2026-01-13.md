# Codebase Health Report

**Generated**: 2026-01-13T10:43:20.970Z
**Health Score**: 51/100 (Grade D)

---

## Summary

| Metric | Status | Count |
|--------|--------|-------|
| TypeScript Errors | error | 1 |
| ESLint Issues | error | 666 errors, 378 warnings |
| Dead Code Files | error | 129 files |
| Security Vulnerabilities | error | 8 total |
| Outdated Dependencies | error | 39 packages |

---

## TypeScript Errors (1 issues)

**Instructions for AI Agent**: Fix each TypeScript error below. The errors are grouped by file for easier navigation.

### `src/composables/canvas/useCanvasEvents.ts`

- **Line 106**: TS2353 - Object literal may only specify known properties, and 'selected' does not exist in type 'Partial<Node<any, any, string>> | ((node: GraphNode<any, any, string>) => Partial<Node<any, any, string>>)'.

## ESLint Issues (666 errors, 378 warnings)

**Instructions for AI Agent**: Fix ESLint issues. Prioritize errors over warnings. Note: 418 issues are auto-fixable with `npx eslint --fix`.

### `src/components/HealthDashboard.vue`

- [ERROR] Line 137: 'issues' is assigned a value but never used. Allowed unused vars must match /^_/u. (@typescript-eslint/no-unused-vars)
- [ERROR] Line 232: 'fill' should be on a new line. (vue/max-attributes-per-line)
- [ERROR] Line 232: 'stroke' should be on a new line. (vue/max-attributes-per-line)
- [ERROR] Line 232: 'stroke-width' should be on a new line. (vue/max-attributes-per-line)
- [ERROR] Line 270: 'cy' should be on a new line. (vue/max-attributes-per-line)

### `src/components/base/ProjectEmojiIcon.vue`

- [WARN] Line 21: 'v-html' directive can lead to XSS attack. (vue/no-v-html)

### `src/components/calendar/CalendarDayView.vue`

- [WARN] Line 8: Unexpected any. Specify a different type. (@typescript-eslint/no-explicit-any)
- [ERROR] Line 12: 'formatSlotTime' is assigned a value but never used. Allowed unused vars must match /^_/u. (@typescript-eslint/no-unused-vars)
- [ERROR] Line 26: defineProps should be the first statement in `<script setup>` (after any potential import statements or type definitions). (vue/define-macros-order)

### `src/components/calendar/CalendarMonthView.vue`

- [WARN] Line 8: Unexpected any. Specify a different type. (@typescript-eslint/no-explicit-any)
- [ERROR] Line 21: defineProps should be the first statement in `<script setup>` (after any potential import statements or type definitions). (vue/define-macros-order)

### `src/components/calendar/CalendarWeekView.vue`

- [WARN] Line 7: Unexpected any. Specify a different type. (@typescript-eslint/no-explicit-any)
- [ERROR] Line 18: 'getStatusLabel' is assigned a value but never used. Allowed unused vars must match /^_/u. (@typescript-eslint/no-unused-vars)
- [ERROR] Line 22: defineProps should be the first statement in `<script setup>` (after any potential import statements or type definitions). (vue/define-macros-order)
- [WARN] Line 23: Unexpected any. Specify a different type. (@typescript-eslint/no-explicit-any)

### `src/components/canvas/CanvasContextMenus.vue`

- [ERROR] Line 64: defineEmits should be the first statement in `<script setup>` (after any potential import statements or type definitions). (vue/define-macros-order)

## Dead Code (129 unused files)

**Instructions for AI Agent**: Review these files. If truly unused, they can be safely deleted. If they should be used, add proper imports/exports.

### Unused Files
- `dev-manager/server.js`
- `src/mcp-crash-monitor.cjs`
- `src/test-coordinates.ts`
- `scripts/perform-cleanup.cjs`
- `scripts/shadow-mirror.cjs`
- `scripts/verify-shadow-layer.cjs`
- `dev-manager/scripts/debug-task-parser.js`
- `dev-manager/scripts/health-scanner.js`
- `src/assets/canvas-view-layout.css`
- `src/assets/canvas-view-overrides.css`

## Security Vulnerabilities (8 issues)

**Instructions for AI Agent**: Run `npm audit fix` to auto-fix. For breaking changes, run `npm audit fix --force` or manually update packages.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Moderate | 0 |
| Low | 6 |

## Outdated Dependencies (39 packages)

**Instructions for AI Agent**: Update packages carefully. Test after each major version bump.

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| @intlify/unplugin-vue-i18n | 11.0.1 | 11.0.3 | Safe to update |
| @storybook/addon-a11y | 10.1.4 | 10.1.11 | Safe to update |
| @storybook/addon-docs | 10.1.4 | 10.1.11 | Safe to update |
| @storybook/addon-onboarding | 10.1.4 | 10.1.11 | Safe to update |
| @storybook/addon-vitest | 10.1.4 | 10.1.11 | Safe to update |
| @storybook/vue3-vite | 10.1.4 | 10.1.11 | Safe to update |
| @supabase/supabase-js | 2.89.0 | 2.90.1 | Safe to update |
| @tailwindcss/forms | 0.5.10 | 0.5.11 | Safe to update |
| @types/dompurify | 3.2.0 | 3.0.5 | Safe to update |
| @types/node | 24.10.1 | 25.0.7 | Major update - review changelog |
| @types/uuid | 9.0.8 | 10.0.0 | Major update - review changelog |
| @typescript-eslint/eslint-plugin | 6.21.0 | 8.53.0 | Major update - review changelog |
| @typescript-eslint/parser | 6.21.0 | 8.53.0 | Major update - review changelog |
| @vitejs/plugin-vue | 6.0.2 | 6.0.3 | Safe to update |
| @vitest/browser | 3.2.4 | 4.0.17 | Major update - review changelog |

---

## Recommended Fix Order

1. **Critical Security** - Fix any critical/high vulnerabilities first
2. **TypeScript Errors** - These block compilation
3. **ESLint Errors** - Code quality issues that may cause bugs
4. **Dead Code** - Clean up unused files to reduce maintenance burden
5. **Outdated Deps** - Update dependencies for security and features

---

## Quick Fix Commands

```bash
# Auto-fix ESLint issues
npx eslint src --fix

# Fix security vulnerabilities
npm audit fix

# Update all dependencies (careful!)
npm update

# Check for TypeScript errors
npx vue-tsc --noEmit
```

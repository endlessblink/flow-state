# Codebase Health Report

**Generated**: 2026-01-11T14:22:42.351Z
**Health Score**: 30/100 (Grade E)

---

## Summary

| Metric | Status | Count |
|--------|--------|-------|
| TypeScript Errors | error | 53 |
| ESLint Issues | timeout | 0 errors, 0 warnings |
| Dead Code Files | error | 115 files |
| Security Vulnerabilities | error | 8 total |
| Outdated Dependencies | error | 39 packages |

---

## TypeScript Errors (34 issues)

**Instructions for AI Agent**: Fix each TypeScript error below. The errors are grouped by file for easier navigation.

### `src/components/auth/SignupForm.vue`

- **Line 244**: TS2345 - Argument of type 'string | undefined' is not assignable to parameter of type 'Record<string, unknown> | undefined'.

### `src/components/calendar/CalendarDayView.vue`

- **Line 37**: TS2300 - Duplicate identifier 'resizePreview'.
- **Line 44**: TS2300 - Duplicate identifier 'resizePreview'.

### `src/components/calendar/CalendarMonthView.vue`

- **Line 22**: TS2300 - Duplicate identifier 'monthDays'.
- **Line 23**: TS2300 - Duplicate identifier 'currentTaskId'.
- **Line 25**: TS2300 - Duplicate identifier 'monthDays'.
- **Line 26**: TS2300 - Duplicate identifier 'currentTaskId'.

### `src/components/calendar/CalendarWeekView.vue`

- **Line 25**: TS2300 - Duplicate identifier 'weekEvents'.
- **Line 26**: TS2300 - Duplicate identifier 'currentTaskId'.
- **Line 28**: TS2300 - Duplicate identifier 'weekEvents'.
- **Line 29**: TS2300 - Duplicate identifier 'currentTaskId'.

### `src/components/canvas/TaskNode.vue`

- **Line 42**: TS2322 - Type 'string | boolean | undefined' is not assignable to type 'boolean'.
- **Line 56**: TS2322 - Type 'boolean | undefined' is not assignable to type 'boolean'.

### `src/components/common/TiptapEditor.vue`

- **Line 378**: TS2559 - Type 'false' has no properties in common with type 'SetContentOptions'.

### `src/components/inbox/UnifiedInboxPanel.vue`

- **Line 27**: TS2322 - Type 'string | null' is not assignable to type '"medium" | "low" | "high" | null'.

### `src/components/inbox/calendar/CalendarInboxHeader.vue`

- **Line 65**: TS2322 - Type 'Set<string>' is not assignable to type 'string | number'.
- **Line 66**: TS2769 - No overload matches this call.

### `src/components/inbox/unified/UnifiedInboxHeader.vue`

- **Line 60**: TS2322 - Type 'string | null' is not assignable to type '"medium" | "low" | "high" | null'.

### `src/components/settings/tabs/StorageSettingsTab.vue`

- **Line 124**: TS2322 - Type '{ value: number; label: string; }[]' is not assignable to type 'Option[]'.
- **Line 125**: TS2322 - Type 'number' is not assignable to type 'string'.
- **Line 132**: TS2322 - Type '{ value: number; label: string; }[]' is not assignable to type 'Option[]'.
- **Line 133**: TS2322 - Type 'number' is not assignable to type 'string'.
- **Line 277**: TS2339 - Property 'restoreBackup' does not exist on type '{ Database: FunctionalComponent<LucideProps, {}, any, {}>; Download: FunctionalComponent<LucideProps, {}, any, {}>; ... 51 more ...; $router: Router; }'.

### `src/components/tasks/DoneToggle.vue`

- **Line 3**: TS2345 - Argument of type '{ isCompleted: boolean; disabled: boolean; ripples: { id: number; x: number; y: number; timestamp: number; }[]; showCelebration: boolean; showTouchFeedback: boolean; size: "sm" | "md" | "lg"; ... 12 more ...; onClick: any; }' is not assignable to parameter of type '{ readonly isCompleted: boolean; readonly disabled: boolean; readonly ripples: Ripple[]; readonly showCelebration: boolean; readonly showTouchFeedback: boolean; readonly size: "sm" | "md" | "lg"; ... 14 more ...; readonly "onUpdate:isFocused"?: ((val: boolean) => any) | undefined; } & VNodeProps & AllowedComponentPr...'.

### `src/components/tasks/DragHandle.vue`

- **Line 19**: TS2322 - Type '(direction: "up" | "down" | "left" | "right") => void' is not assignable to type '(direction: string) => void'.

### `src/components/tasks/HierarchicalTaskRow.vue`

- **Line 82**: TS2322 - Type '"medium" | "low" | "high" | null' is not assignable to type 'string | undefined'.
- **Line 83**: TS2345 - Argument of type '"medium" | "low" | "high" | null' is not assignable to parameter of type 'string | undefined'.
- **Line 193**: TS2345 - Argument of type 'Readonly<MappedOmit<LooseRequired<Props>, "selected" | "indentLevel" | "expandedTasks" | "visitedIds">> & { readonly indentLevel: number; readonly selected: boolean; readonly expandedTasks: Set<...>; readonly visitedIds: Set<...>; } & { ...; }' is not assignable to parameter of type '{ task: Task; indentLevel: number; hasSubtasks: boolean; isExpanded: boolean; }'.

### `src/components/tasks/TaskEditModal.vue`

- **Line 121**: TS2345 - Argument of type 'ComputedRef<HTMLInputElement | null | undefined>' is not assignable to parameter of type 'Ref<HTMLInputElement | undefined, HTMLInputElement | undefined>'.

### `src/components/tasks/edit/TaskEditMetadata.vue`

- **Line 62**: TS2322 - Type 'string | null' is not assignable to type 'string | number'.

### `src/composables/canvas/useCanvasDragDrop.ts`

- **Line 53**: TS2322 - Type 'number | undefined' is not assignable to type 'number'.
- **Line 53**: TS2322 - Type 'number | undefined' is not assignable to type 'number'.

### `src/composables/canvas/useCanvasSelection.ts`

- **Line 251**: TS2367 - This comparison appears to be unintentional because the types '"in_progress" | "planned" | "backlog" | "on_hold"' and '"in-progress"' have no overlap.

### `src/composables/useOptimisticUI.ts`

- **Line 9**: TS2307 - Cannot find module '@/utils/offlineQueue' or its corresponding type declarations.

## Dead Code (115 unused files)

**Instructions for AI Agent**: Review these files. If truly unused, they can be safely deleted. If they should be used, add proper imports/exports.

### Unused Files
- `dev-manager/server.js`
- `scripts/perform-cleanup.cjs`
- `scripts/shadow-mirror.cjs`
- `scripts/verify-shadow-layer.cjs`
- `src/mcp-crash-monitor.cjs`
- `src/test-coordinates.ts`
- `dev-manager/scripts/debug-task-parser.js`
- `dev-manager/scripts/health-scanner.js`
- `scripts/utils/get-next-task-id.cjs`
- `src/assets/canvas-view-layout.css`

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
| @types/node | 24.10.1 | 25.0.6 | Major update - review changelog |
| @types/uuid | 9.0.8 | 10.0.0 | Major update - review changelog |
| @typescript-eslint/eslint-plugin | 6.21.0 | 8.52.0 | Major update - review changelog |
| @typescript-eslint/parser | 6.21.0 | 8.52.0 | Major update - review changelog |
| @vitejs/plugin-vue | 6.0.2 | 6.0.3 | Safe to update |
| @vitest/browser | 3.2.4 | 4.0.16 | Major update - review changelog |

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

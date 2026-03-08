# Component Interaction Patterns for FlowState

Universal component best practices adapted for FlowState's glass morphism design system. Reference this when implementing or reviewing UI components.

## Component Quick Rules

| Component | Key Rule | FlowState Notes |
|-----------|----------|-----------------|
| Button | Verb-first labels; one primary per section | Glass bg + colored border (NEVER solid fill) |
| Modal | Trap focus; X + Cancel + Escape to close | Use `BaseModal` with glass prop |
| Toast | Auto-dismiss 4-6s; include undo for destructive ops | Glass morphism styling |
| Toggle | Immediate effect only; never in Save forms | Solid fill OK for toggle dot only |
| Form | Single column; labels above; inline validation on blur | Use `BaseInput`, `CustomSelect` |
| Empty State | Illustration + headline + CTA; positive framing | Match glass morphism aesthetic |
| Card | Media > title > meta > action; shadow OR border not both | Use `BaseCard` with glass prop |
| Dropdown | 7+/-2 items; destructive last in red; Escape to close | Use `CustomSelect` or `ContextMenu` |
| Tabs | 2-7 tabs; bottom border indicator; arrow keys between | Active state uses `--brand-primary` |
| Search | Cmd/Ctrl+K shortcut; debounce 200-300ms | Global search composable |
| Badge | 1-2 words; pill shape; limited color palette | Use `BaseBadge` variants |
| Skeleton | Match real layout shape; shimmer animation | Show after 300ms delay |

## Interaction Patterns

### Focus Management
- Modals/drawers: trap focus inside, return to trigger on close
- Context menus: focus first item on open, return focus on Escape
- Dynamic content: focus first new element after insertion
- Keyboard nav: arrow keys within groups, Tab between groups

### Loading States
- Skeleton screens for predictable layouts (task lists, cards)
- Spinners with text for unpredictable waits ("Syncing tasks...")
- Show loading after 300ms delay to prevent flicker
- Preserve container dimensions during loading (prevent layout shift)

### Validation
- Inline validation on blur (not on every keystroke)
- Error message below the input field, not in tooltips
- Focus first error field on form submit
- Clear error when user starts correcting the field

### Destructive Actions
- Require confirmation via `ConfirmationModal`
- Include undo in toasts when possible (soft-delete pattern)
- Red text/icon for destructive menu items, positioned last
- Never auto-delete without user action

### Touch & Mobile
- 44px minimum touch targets
- Swipe gestures: 10px threshold before locking direction
- `touch-action: pan-y` on scrollable containers with horizontal swipes
- Never `preventDefault()` in passive `touchstart` (Android kills gesture)

## Anti-Patterns (Flag These)

| Anti-Pattern | Do This Instead |
|---|---|
| Rainbow badges (every status different bright color) | Limited semantic palette (3-5 colors) |
| Modal inside modal | Use drawer or navigate to page |
| Disabled submit with no explanation | Indicate what's missing |
| Spinner for predictable layouts | Skeleton screens |
| "Click here" links | Descriptive link text |
| Placeholder as only label | Visible label above input |
| Equal-weight buttons side by side | Primary/secondary hierarchy |
| `<div @click>` for interactive elements | `<button>` or `BaseButton` |
| Auto-advancing carousel | User-controlled navigation |
| Color-only status indication | Color + icon + text |

## FlowState Component Mapping

When UI Design Brain suggests a generic component, use FlowState's equivalent:

| Generic | FlowState Component | Notes |
|---------|---------------------|-------|
| Button | `BaseButton` / `BaseIconButton` | variant prop for styling |
| Input | `BaseInput` | label, helper, prefix/suffix slots |
| Select/Dropdown | `CustomSelect` | ONLY dropdown component |
| Modal | `BaseModal` + `ConfirmationModal` | glass prop for glass morphism |
| Card | `BaseCard` | glass prop |
| Badge | `BaseBadge` | variant: default/success/warning/danger/info/count |
| Popover | `BasePopover` | variant: menu/tooltip/dropdown |
| Context Menu | `ContextMenu` | Right-click menus |
| Markdown | `MarkdownRenderer` / `MarkdownEditor` | Display vs edit |
| Checkbox (done) | `DoneToggle` | Animated with celebration |

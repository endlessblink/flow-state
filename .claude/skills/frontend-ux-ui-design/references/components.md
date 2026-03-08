# Component Best Practices Encyclopedia

Sourced from component.gallery, enriched with production-grade guidance. Read this file when implementing specific UI components.

## Navigation & Structure

### Accordion
- Allow multiple open sections simultaneously when space permits
- Use chevron icons that rotate to indicate state
- Animate height smoothly (use `grid-template-rows: 0fr/1fr` trick, not `max-height`)
- Keyboard: Enter/Space to toggle, arrow keys between headers

### Breadcrumbs
- Use `>` or `/` separators, not icons
- Current page is plain text (not a link)
- Truncate middle items on mobile with `...`
- Wrap in `<nav aria-label="Breadcrumb">`

### Header
- Sticky headers: max 64px height, add shadow on scroll
- Logo links to home, always
- 5-7 nav items max; overflow into "More" dropdown
- Mobile: hamburger reveals full-screen nav or drawer

### Navigation
- Clear active state (bold text + indicator, not just color)
- Group related items with subtle separators
- Icons + text > icons alone (except in compact sidebars)
- Sidebar: collapsible to icon-only mode on desktop

### Footer
- Multi-column layout: Product, Company, Resources, Legal
- Include accessibility links (privacy, terms)
- Social icons in a row, not scattered
- Newsletter signup if relevant

### Pagination
- Show first, last, and 2 neighbors of current page
- Ellipsis for gaps
- Disable (don't hide) prev/next at boundaries
- Mobile: simplify to prev/next + current/total

### Tabs
- 2-7 tabs; more = use dropdown or scrollable strip
- Active indicator: bottom border (not background change)
- Keyboard: arrow keys between tabs, Tab into panel content
- Mobile: scrollable horizontal strip or convert to accordion

## Feedback & Status

### Alert
- Semantic colors + icon: red/error, amber/warning, green/success, blue/info
- Max 2 sentences; link to details if more needed
- Dismissible alerts need close button + `role="alert"` for urgent
- Don't stack more than 2 alerts

### Badge
- 1-2 words max; pill shape for status
- Limited color palette (3-5 semantic colors)
- Anti-pattern: rainbow badges with no semantic meaning
- Count badges: `99+` cap for large numbers

### Progress Bar
- Always show percentage label
- Determinate when progress is known; indeterminate when unknown
- Color shifts: neutral → brand → success at completion
- Minimum visible width even at 0-1%

### Spinner
- Show after 300ms delay to prevent flicker
- Accompany with text ("Loading tasks...")
- Anti-pattern: using spinners for predictable layouts (use skeletons)
- Size: 16px inline, 24-32px block, 48px full-page

### Toast
- Auto-dismiss 4-6 seconds; manual dismiss always available
- Stack newest on top; max 3 visible
- Include undo action for destructive operations
- Position: bottom-right (desktop), bottom-center (mobile)

### Empty State
- Illustration + helpful headline + primary CTA
- Positive framing ("No tasks yet" + "Create your first task")
- Anti-pattern: blank page with no guidance
- Match the illustration style to the app's design language

### Skeleton
- Match actual layout shape and dimensions
- Shimmer animation (left-to-right gradient sweep)
- Anti-pattern: generic gray blocks that don't match real content
- Remove skeleton → real content with a subtle fade

## Input Controls

### Button
- Verb-first labels ("Save changes", "Delete project", not "Submit")
- One primary per section; secondary for alternatives; ghost for tertiary
- Minimum height: 36px desktop, 44px mobile
- Loading state: spinner + disabled, preserve button width
- Anti-pattern: equal-weight buttons side by side

### Button Group
- Max 3-4 buttons; more = use dropdown
- Connected borders (remove inner border-radius)
- Clear visual distinction between active/inactive in toggle groups

### Checkbox
- Use for multi-select or boolean toggles IN FORMS (that require Save)
- Label must be clickable (wrap or `htmlFor`)
- Indeterminate state for parent of partially-selected children
- Group with fieldset + legend

### Radio Button
- Use for single-select from 2-5 options
- Pre-select a reasonable default when possible
- Vertical layout preferred; horizontal only for 2-3 short options
- Group with fieldset + legend

### Toggle/Switch
- Immediate effect only — never in forms that require Save
- Clear on/off labels or states
- Anti-pattern: using toggles inside forms with submit buttons
- Width: 40-48px, height: 24px

### Text Input
- Label above (vertical forms) or beside (horizontal/compact)
- Placeholder as format hint, never as label replacement
- Validation: inline on blur, not on every keystroke
- Error message below input, not in tooltip
- Prefix/suffix slots for units, icons, actions

### Textarea
- Auto-grow with content (min-height, optional max-height)
- Character count if there's a limit
- Resize handle: vertical only (not horizontal)
- Monospace font for code input

### Select
- Use native `<select>` for simple cases (5-7 options)
- Custom select for: search, multi-select, option groups, rich content
- Anti-pattern: custom select that breaks keyboard nav

### Combobox
- Combines text input + dropdown for large option sets
- Debounce search: 200-300ms
- Highlight matching text in options
- Allow free-text entry or restrict to options (be explicit which)

### Date Input / Datepicker
- Input field shows formatted date; calendar opens on click/focus
- Keyboard: arrow keys navigate days, Enter selects
- Support manual text entry in expected format
- Disable unavailable dates visually (gray + no interaction)

### File Upload
- Drag-and-drop zone + click-to-browse
- Show accepted formats and size limits upfront
- Progress indicator during upload
- Preview thumbnails for images

### Search Input
- Cmd/Ctrl+K shortcut for global search
- Debounce: 200-300ms
- Clear button (X) when text is present
- Recent searches / suggestions dropdown

### Slider
- Always show current value label
- Tick marks for discrete values
- Keyboard: arrow keys for step, Home/End for min/max
- Dual thumbs for range selection

### Color Picker
- Preset swatches + custom input
- Show hex/rgb value alongside picker
- Eyedropper tool when available (native API)

### Segmented Control
- 2-5 options, mutually exclusive
- Animated active indicator that slides between options
- Replaces tabs when controlling the same content area inline
- All segments same width

## Display Elements

### Avatar
- Fallback chain: image → initials → generic icon
- Sizes: 24 (inline), 32 (list), 40 (card), 64+ (profile)
- Status dot: positioned bottom-right, use semantic colors
- Group: overlap with z-index stack + "+N" overflow

### Card
- Hierarchy: media → title → meta → action
- Shadow OR border, not both
- Hover state: subtle lift (translateY -2px) or border highlight
- Anti-pattern: cards with no clear action/destination

### List
- Consistent vertical lanes (icon, text, meta, action)
- Fixed-width slots for icons/actions, even when empty
- Dividers between items (border or gap, be consistent)
- Keyboard: arrow keys to navigate, Enter to select

### Image
- Always `width` + `height` attributes (prevent CLS)
- `loading="lazy"` below fold; `fetchpriority="high"` for hero
- `alt` text: descriptive for content, `alt=""` for decorative
- `object-fit: cover` for thumbnails in fixed containers

### Separator
- Horizontal: `<hr>` with subtle color
- Vertical: thin border or flexbox-based
- Use spacing alone (no line) when separation is obvious

### Skeleton
- See Feedback & Status section above

### Link
- Underline for inline links (distinguishable from surrounding text)
- No underline for nav links (context makes them obvious)
- External links: open in new tab + external icon
- Anti-pattern: "Click here" link text

### Quote / Blockquote
- Left border accent (4px, brand or muted color)
- Italic body text, regular attribution
- Attribution: em-dash + name

## Interactive Overlays

### Modal
- Always: X button, Cancel button, Escape key to close
- Trap focus inside modal; return focus to trigger on close
- Backdrop click dismisses (unless destructive action in progress)
- Max width: 480px (sm), 640px (md), 800px (lg)
- Anti-pattern: modal inside modal (use drawer or page instead)
- Anti-pattern: using modals for content that exceeds comfortable scroll

### Drawer
- Right side for detail views; left side for navigation
- Width: 320-480px desktop; full-width mobile
- Backdrop overlay; Escape to close
- Slide animation: 200-300ms ease-out

### Popover
- Triggered by click (not hover for interactive content)
- Auto-position to stay in viewport
- Close on outside click or Escape
- Arrow pointing to trigger element

### Tooltip
- Triggered by hover/focus (not click)
- Delay: 300ms show, 100ms hide
- Max width: 200-300px
- Anti-pattern: essential information in tooltips only
- Plain text only; interactive content = use popover

### Dropdown Menu
- 7±2 items max
- Destructive actions: last position, red text
- Keyboard: arrow keys navigate, Enter selects, Escape closes
- Submenus: right-arrow to open, left-arrow to close
- Dividers to group related items

### Tree View
- Indent children consistently (16-24px per level)
- Expand/collapse arrows; keyboard: left/right to collapse/expand
- Checkbox trees: parent auto-checks/unchecks children
- Lazy-load deep branches

## Forms & Structure

### Form
- Single-column layout (faster to scan, better mobile)
- Labels above inputs; inline validation on blur
- Submit button: enabled until request starts, then show spinner
- Errors: focus first error on submit
- Warn before leaving with unsaved changes

### Fieldset
- Group related inputs with `<fieldset>` + `<legend>`
- Visual grouping: subtle border or background shift
- Don't nest fieldsets more than 2 levels

### Label
- Associated via `htmlFor`/`id` pairing
- Required indicator: red asterisk or "(required)" text
- Optional fields: mark as "(optional)" instead of marking required
- Help text below label, above input

## Specialized

### Hero
- Strong headline (6-10 words), supporting subtext (1-2 sentences)
- One clear CTA; optional secondary
- Full-bleed image/video or split layout (text + media)
- Anti-pattern: "Welcome to [Product]" as headline

### Rich Text Editor
- Floating toolbar on selection (not always visible)
- Markdown shortcuts (## for headings, ** for bold)
- Paste handling: strip formatting option
- Auto-save with visual indicator

### Carousel
- User-controlled navigation (arrows + dots)
- Anti-pattern: auto-advancing without pause on hover
- Anti-pattern: more than 7 slides
- Show partial next slide as affordance
- Swipe support on touch devices

## Accessibility Components

### Skip Link
- First focusable element on page
- Hidden until focused: `position: absolute` + visible on `:focus`
- Target: main content area (`#main-content`)

### Visually Hidden
- `clip: rect(0,0,0,0); position: absolute; width: 1px; height: 1px;`
- Use for screen-reader-only labels and descriptions
- Never use `display: none` for content that screen readers need

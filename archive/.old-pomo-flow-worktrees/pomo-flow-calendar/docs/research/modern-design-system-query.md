# Perplexity Query: Modern Design System for Vue 3 Project Management App

## Context

Building a productivity app (Vue 3 + TypeScript) with Kanban, Calendar, and Canvas views. Current design feels fragmented and dated. Need to achieve a cohesive, modern, professional design system like **Nifty, Hive, ClickUp, Linear, or Notion**.

**Current Stack:**
- Vue 3 Composition API
- TypeScript
- Custom CSS (no component library)
- Dark theme
- Multiple views: Kanban board, Calendar (Day/Week/Month), Canvas workflow

**Goal:** Transform from "mesh of bits and pieces" to cohesive, modern, slick design that's enjoyable to use daily.

## Research Questions

### 1. Modern Design Systems for Project Management Tools (2024)

**Question:** What are the key design patterns and visual systems used by modern project management tools like Nifty, Hive, ClickUp, Linear, and Notion in 2024?

**Specific elements to analyze:**
- Color systems (semantic colors, surface hierarchy)
- Typography scales (what fonts, sizes, weights)
- Spacing/padding systems (4px, 8px grid?)
- Border radius and edge treatments
- Shadow systems (elevation layers)
- Glassmorphism vs. flat vs. neumorphism
- Animation timing and easing functions
- Card design patterns
- Button styles and states
- Input field treatments

**Need examples/screenshots of:**
- Task cards in Kanban views
- Calendar event styling
- Navigation patterns
- Modal/dialog designs
- Empty states
- Loading states

### 2. Glassmorphism and Modern Surface Treatments

**Question:** How to implement glassmorphism and elevated surfaces in dark-themed productivity apps?

**Technical implementation:**
- CSS backdrop-filter techniques
- Background opacity and blur values
- Border treatments (subtle, glowing, gradient?)
- Shadow layering for depth
- Hover state transitions
- Performance considerations (backdrop-filter can be expensive)

**Specific patterns:**
```css
/* What are the optimal values for modern glassmorphic cards? */
.glass-card {
  background: rgba(?, ?, ?, ?);
  backdrop-filter: blur(?px);
  border: ?px solid rgba(?, ?, ?, ?);
  box-shadow: ?;
}
```

### 3. Animation and Micro-Interaction Patterns

**Question:** What animation patterns make modern productivity apps feel smooth, responsive, and delightful (not gimmicky)?

**Animation types to research:**
- **Spring animations:** Cubic-bezier values for natural motion
- **Stagger animations:** Cards appearing in sequence
- **Hover lift effects:** translateY + shadow changes
- **Drag feedback:** Ghost element, snap animations
- **Loading skeletons:** Shimmer effects vs. fade-in
- **Success states:** Subtle celebration (checkmark scale, confetti?)
- **Transitions:** View switching (fade, slide, scale)

**Performance:**
- Which CSS properties are GPU-accelerated? (transform, opacity)
- How to avoid layout thrashing?
- RequestAnimationFrame for smooth 60fps?

**Code examples needed:**
- Spring easing functions (cubic-bezier values)
- Stagger delay calculations
- Smooth drag-and-drop transitions
- Skeleton loader implementations

### 4. Dark Theme Color Systems

**Question:** What are proven dark theme color palettes and semantic color systems for productivity tools?

**Need guidance on:**
- Base surface colors (darkest to lightest)
- Text hierarchy colors (primary, secondary, muted, disabled)
- Accent colors (primary action, success, warning, danger)
- Border colors (subtle vs. interactive)
- Hover/focus state colors
- Syntax highlighting for code (if applicable)

**Accessibility:**
- WCAG AA contrast ratios for dark themes
- Color-blind safe palettes
- Semantic color naming (not just "blue-500")

**Examples from:**
- Linear's dark mode
- Notion's dark theme
- ClickUp's dark mode
- VS Code's dark theme tokens

### 5. Card Design Patterns for Task Management

**Question:** What are the best practices for designing task cards in Kanban boards and calendar views?

**Visual hierarchy on cards:**
- Title prominence and truncation
- Priority indicators (stripe, badge, glow, border?)
- Status badges (shape, color, position)
- Metadata display (time, tags, assignee)
- Action buttons (visible always vs. on hover?)
- Drag handles (when to show, how to style)

**Interaction states:**
- Default state
- Hover state (lift, glow, border change?)
- Active/dragging state
- Selected state (multi-select)
- Disabled/completed state (opacity, strikethrough, grayscale?)

**Layout patterns:**
- Vertical vs. horizontal metadata
- Icon placement and sizing
- Spacing between elements
- Maximum card width for readability

### 6. Typography and Readability

**Question:** What font stacks, sizes, and hierarchy work best for productivity apps with lots of text content?

**Font recommendations:**
- System font stacks vs. web fonts?
- Monospace for data (times, IDs, code)?
- Font sizes for different content levels
- Line heights for readability
- Letter spacing adjustments

**Hierarchy:**
- How many heading levels needed?
- Body text variations (primary, secondary, caption)
- When to use font weight vs. color for hierarchy?
- Optimal line length for task descriptions

### 7. Vue 3 Component Libraries with Modern Design

**Question:** Which Vue 3 component libraries offer production-ready, modern designs out-of-the-box that could replace custom components?

**Libraries to compare:**
- **Vuetify 3** - Material Design
- **PrimeVue** - Professional enterprise components
- **Naive UI** - Modern, lightweight
- **Element Plus** - Comprehensive component set
- **Headless UI** - Unstyled, full control
- **Radix Vue** - Headless primitives

**Evaluation criteria:**
- Vue 3 Composition API support
- TypeScript quality
- Dark theme support
- Customization flexibility
- Performance (bundle size, runtime)
- Design quality (modern vs. dated)
- Animation systems built-in

**Trade-offs:**
- Library vs. custom: faster development vs. full control
- Design constraints vs. starting from scratch
- Learning curve for library APIs

### 8. Spacing and Layout Systems

**Question:** What spacing and layout systems create visual harmony in complex multi-view applications?

**Grid systems:**
- 4px, 8px, or 12px base unit?
- Spacing scale (1, 2, 3, 4, 6, 8, 12, 16...)
- Container max-widths
- Responsive breakpoints

**Layout patterns:**
- Sidebar widths (fixed vs. resizable)
- Content area padding
- Card spacing in lists/grids
- Modal/dialog positioning and sizing

### 9. Drag-and-Drop Visual Feedback

**Question:** How do modern tools like ClickUp and Notion handle drag-and-drop visual feedback to make it feel smooth and intuitive?

**Patterns to research:**
- **Drag ghost styling:** Opacity, shadow, scale changes
- **Drop zone indicators:** Highlight, outline, background change
- **Snap-to-grid feedback:** Visual guides, magnetic snapping
- **Invalid drop states:** Red outline, cursor change
- **Multi-item drag:** Stacked visual, count badge
- **Smooth transitions:** Drag start/end animations

**CSS/JS techniques:**
- CSS transforms during drag (not re-rendering)
- RequestAnimationFrame for smooth tracking
- Momentum on drag release (spring physics)
- Auto-scroll when near edges

### 10. Empty States and Loading Patterns

**Question:** What empty state and loading patterns make apps feel polished and guide users effectively?

**Empty states:**
- Illustration style (minimal, friendly, professional)
- Copy tone (helpful, not scolding)
- Call-to-action prominence
- Examples: "No tasks yet" vs. "Your canvas awaits" vs. "Let's get started"

**Loading states:**
- Skeleton screens vs. spinners
- Shimmer animation values
- Content placeholder shapes
- Stagger reveal on load

### 11. Iconography and Visual Language

**Question:** What icon systems and visual languages work best for task management interfaces?

**Icon considerations:**
- Icon library choice (Lucide, Heroicons, Phosphor, Tabler)
- Size scale (12px, 16px, 20px, 24px)
- Stroke width (1px, 1.5px, 2px)
- Color treatments (monochrome vs. accent colored)
- When to use icons vs. text

**Visual consistency:**
- Icon placement (before text, after, standalone)
- Icon button treatments
- Badge icon sizing

### 12. Responsive and Adaptive Design

**Question:** How should a multi-view productivity app adapt between desktop and mobile without separate codebases?

**Patterns:**
- Navigation collapse (sidebar → bottom nav on mobile)
- Kanban columns (horizontal scroll vs. vertical stack)
- Calendar views (simplified for mobile)
- Canvas gestures (pinch-zoom, two-finger pan)
- Modal behavior (full-screen on mobile)

### 13. Performance Optimization for Rich UIs

**Question:** How to maintain 60fps with heavy glassmorphism, shadows, and animations?

**Optimization techniques:**
- GPU-accelerated properties (transform, opacity)
- will-change hints (when to use)
- Debouncing expensive effects
- Virtual scrolling for long lists
- Lazy loading components
- Code splitting by route

### 14. Cohesive Interaction Language

**Question:** How to create a consistent interaction language across different view types (Kanban, Calendar, Canvas)?

**Consistency needs:**
- Click vs. double-click patterns
- Hover state timing (delay, transition)
- Keyboard shortcuts (same actions, same keys)
- Context menus (when/where to show)
- Drag behavior (cursor feedback, drop zones)
- Selection patterns (single, multi, range)

### 15. Real-World Production Examples

**Request:** Please provide links to open-source project management tools with modern, cohesive designs:

**Criteria:**
- Vue 3 or React (web-based, inspectable)
- Open source on GitHub
- Modern design (2023-2024)
- Production-quality (not demos/templates)
- Multiple views (Kanban, Calendar, or similar)

**Specific examples wanted:**
- Nifty-like designs (if any open source alternatives)
- Hive-style UI patterns
- ClickUp-inspired implementations
- Linear-quality design systems
- Notion-clone projects with great UX

## Expected Research Output

### 1. Complete Design System Specification
- Color palette with semantic naming
- Typography scale and font stack
- Spacing system (4px, 8px base?)
- Shadow elevation system (6 levels)
- Border radius values
- Animation curves and durations

### 2. Component Design Patterns
- Task card design (Kanban)
- Calendar event card design
- Canvas node design
- Button variations (primary, secondary, ghost, danger)
- Input field styling
- Modal/dialog design

### 3. CSS Implementation Examples
- Working glassmorphism code
- Spring animation cubic-bezier values
- Hover effect transitions
- Drag ghost styling
- Skeleton loader implementation

### 4. Component Library Recommendation
- Best Vue 3 library for our use case
- How to integrate without losing custom work
- Which components to use vs. build custom
- Theming and customization approach

### 5. Migration Strategy
- Incremental redesign plan
- Which view to redesign first?
- How to maintain consistency during transition
- Testing strategy to avoid breaking features

## Success Criteria

**Visual:**
- ✅ Cohesive design language across all views
- ✅ Modern aesthetics (glassmorphism, depth, smooth animations)
- ✅ Professional polish (like Nifty, Hive, ClickUp)
- ✅ Delightful micro-interactions
- ✅ Clear visual hierarchy

**Functional:**
- ✅ No feature breakage during redesign
- ✅ 60fps animations maintained
- ✅ Responsive (works on mobile)
- ✅ Accessible (keyboard navigation, WCAG AA)

**Subjective:**
- ✅ Fun to use (not sterile)
- ✅ Feels modern (2024, not 2018)
- ✅ Professional (could show to clients)
- ✅ Makes me WANT to use it daily

## Additional Context

**Current App State:**
- 3 calendar views (Day/Week/Month) ✅
- Kanban board ✅
- Canvas with inbox (MVP) ✅
- ~2500 lines of Vue/TS code
- All features working functionally

**Design Pain Points:**
- "Mesh of bits and pieces" - inconsistent styling
- "Not modern" - feels dated
- "Not fun" - lacks delight
- No cohesive visual language

**Primary Use Case:**
- Personal productivity tool
- Used daily for task/workflow management
- Needs to feel good to use (not just functional)
- Desktop-first (browser-based)

**Inspiration Sources (for reference):**
- Nifty PM (smooth, modern, cohesive)
- Hive (visual hierarchy, clean)
- ClickUp (feature-rich, polished)
- Linear (minimal, fast, delightful)
- Notion (flexible, beautiful)
- AppFlowy (cohesive design system)

## Constraints

- Vue 3 + TypeScript (not changing stack)
- Dark theme primary
- Custom CSS preferred (but open to component library)
- Must maintain existing features
- Performance critical (60fps)
- No build complexity (keep Vite simple)

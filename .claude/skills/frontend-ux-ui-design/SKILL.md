---
name: frontend-ux-ui-design
description: Create distinctive, production-grade frontend interfaces with high UX and UI design quality. Use when building web components, pages, landing pages, dashboards, or applications for ANY project. Covers UX flows, UI visual design, design system generation, industry-specific reasoning, web standards compliance, and anti-AI-slop aesthetics.
---

# Frontend UX/UI Design Intelligence

**Version:** 2.0.0
**Category:** Design + Build
**Related Skills:** dev-implement-ui-ux (FlowState-specific), dev-storybook

## Overview

Comprehensive design skill for building distinctive, production-grade frontend interfaces across ANY project. Combines design system generation, industry-specific reasoning, web standards compliance, and creative direction into a single workflow.

**Use this skill for:** New projects, landing pages, dashboards, client work, side projects — anything that isn't FlowState-specific (use `flowstate-ui-ux` for FlowState).

## When to Activate

- Building a new website, landing page, or web app
- Creating UI for a project outside FlowState
- User says "build me a...", "design a...", "create a landing page for..."
- Choosing a visual direction for a new product
- Reviewing UI code for web standards compliance

## Workflow: Four Steps

1. **Identify Components** — Read the request and determine which UI components are needed. Read `references/components.md` for best practices per component.
2. **Apply Best Practices** — Follow each component's rules from the reference (layout, interaction, states).
3. **Choose Design Direction** — Select a style from the Style Library (Section 2.2) or design presets below.
4. **Generate Code** — Production-ready code following all standards in this skill.

## Design Presets (Quick Selection)

| Preset | When to Use | Key Traits |
|--------|-------------|------------|
| **Modern SaaS** (default) | Most web apps, dashboards | Neutral palette, one accent, 8px grid, generous whitespace |
| **Apple-level Minimal** | Premium products, portfolios | Near-monochrome, large type hierarchy, micro-interactions |
| **Enterprise** | B2B, admin panels, data-heavy | Information-dense, compact spacing, fully keyboard-navigable |
| **Creative / Portfolio** | Agencies, artists, bold brands | Asymmetric layouts, dramatic scale, vivid accents |
| **Data Dashboard** | Analytics, metrics, monitoring | Data-dense, consistent alignment, KPI > trend > detail hierarchy |

## 15 Most Common Components

| Component | Key Rule | Reference |
|-----------|----------|-----------|
| **Button** | Verb-first labels; one primary per section | `references/components.md` |
| **Card** | Media > title > meta > action; shadow OR border | `references/components.md` |
| **Modal** | Trap focus; X + Cancel + Escape to close | `references/components.md` |
| **Navigation** | 5-7 items max; clear active state | `references/components.md` |
| **Table** | Sticky header; right-align numbers; sortable | `references/components.md` |
| **Tabs** | 2-7 tabs; active indicator; accordion on mobile | `references/components.md` |
| **Form** | Single column; labels above; inline validation on blur | `references/components.md` |
| **Toast** | Auto-dismiss 4-6s; undo for destructive ops | `references/components.md` |
| **Alert** | Semantic colors + icon; max 2 sentences | `references/components.md` |
| **Drawer** | Right for detail, left for nav; 320-480px | `references/components.md` |
| **Search** | Cmd/Ctrl+K shortcut; debounce 200-300ms | `references/components.md` |
| **Empty State** | Illustration + headline + CTA; positive framing | `references/components.md` |
| **Skeleton** | Match layout shape; shimmer; show after 300ms | `references/components.md` |
| **Badge** | 1-2 words; pill shape; limited color palette | `references/components.md` |
| **Dropdown** | 7+/-2 items; destructive last in red | `references/components.md` |

For detailed patterns on all 60+ components, read `references/components.md`.

---

# PART 1: DESIGN THINKING

Before coding, commit to a BOLD aesthetic direction:

1. **Purpose** — What problem does this interface solve? Who uses it?
2. **Tone** — Pick a direction: brutally minimal, maximalist, retro-futuristic, organic/natural, luxury/refined, playful, editorial, brutalist, art deco, soft/pastel, industrial, cyberpunk, neo-classical, etc.
3. **Constraints** — Framework, performance budget, accessibility level
4. **Differentiation** — What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity. NEVER converge on safe defaults.

---

# PART 2: DESIGN SYSTEM GENERATION

When starting a new project, generate a complete design system before writing any code.

## 2.1 Generation Workflow

```
1. USER REQUEST ("Build a landing page for my beauty spa")
   │
2. IDENTIFY INDUSTRY
   │  Match to: SaaS, Fintech, Healthcare, E-commerce, Services,
   │  Creative, Education, Real Estate, Food/Restaurant, Fitness, etc.
   │
3. SELECT STYLE + PATTERN + COLORS + TYPOGRAPHY
   │  Use industry reasoning rules (Section 2.3)
   │
4. GENERATE DESIGN SYSTEM
   │  Pattern + Style + Colors + Typography + Effects + Anti-patterns
   │
5. IMPLEMENT WITH SYSTEM
      Apply consistently across all components
```

## 2.2 Style Library (27 Styles)

### General Styles

| # | Style | Best For | Key Properties |
|---|-------|----------|----------------|
| 1 | Glassmorphism | Premium dashboards, creative apps | Frosted glass, blur, transparency |
| 2 | Neumorphism | Calculators, toggles, settings | Soft shadows, extruded/inset |
| 3 | Claymorphism | Playful apps, kids, casual | 3D clay look, rounded, soft shadows |
| 4 | Brutalism | Art, portfolios, statements | Raw, exposed structure, harsh contrast |
| 5 | Neo-Brutalism | SaaS, startups, dev tools | Thick borders, solid shadows, bold color |
| 6 | Minimalism | Professional, corporate, luxury | Whitespace, restraint, precision |
| 7 | Material 3 | Android apps, Google ecosystem | Dynamic color, elevation, shape system |
| 8 | Bento Grid | Portfolios, dashboards, Apple-style | Grid cards, varied sizes, visual storytelling |
| 9 | Dark Mode Premium | Dev tools, media, fintech | Rich darks, accent pops, subtle gradients |
| 10 | Retro/Vintage | Restaurants, craft brands, nostalgia | Aged textures, serif fonts, warm palettes |
| 11 | Cyberpunk/Neon | Gaming, nightlife, tech | Neon glows, dark backgrounds, futuristic |
| 12 | Organic/Natural | Wellness, sustainability, food | Earth tones, flowing shapes, textures |
| 13 | Editorial/Magazine | Blogs, news, publishing | Strong typography, grid, whitespace |
| 14 | Gradient Mesh | Creative agencies, portfolios | Complex multi-color gradients, depth |
| 15 | Monochrome | Luxury, fashion, photography | Single hue range, contrast through tone |
| 16 | Flat Design 2.0 | Corporate, utilities, icons | Flat + subtle shadows, clean geometry |
| 17 | Isometric | Product showcases, infographics | 3D isometric illustrations, depth |
| 18 | Duotone | Creative, music, events | Two-color scheme applied to images/UI |
| 19 | Scandinavian | Home goods, lifestyle, minimal | Light wood, pastels, clean, functional |
| 20 | Art Deco | Luxury, events, hospitality | Geometric patterns, gold accents, symmetry |
| 21 | Memphis | Youth brands, creative, fun | Bold patterns, squiggles, bright colors |
| 22 | Swiss/International | Corporate, data, finance | Grids, Helvetica, systematic, clean |
| 23 | Soft UI | Wellness, beauty, premium services | Soft shadows, rounded, calming |
| 24 | Terminal/Hacker | Dev tools, CLI apps, tech | Monospace, green-on-black, scanlines |
| 25 | Newspaper | News, blogs, text-heavy | Columns, serif headings, rules |
| 26 | Kawaii/Cute | Kids, pets, casual games | Rounded, pastel, playful illustrations |
| 27 | Luxury/High-End | Fashion, jewelry, automotive | Thin fonts, dark bg, gold/silver accents |

### Landing Page Patterns

| Pattern | Best For | Structure |
|---------|----------|-----------|
| Hero-Centric | Strong visual identity | Hero > Features > Social Proof > CTA |
| Conversion-Optimized | Lead gen, sales | Headline > Pain > Solution > Proof > CTA > FAQ |
| Feature Showcase | SaaS, complex products | Hero > Feature Grid > Deep Dives > Pricing |
| Minimal & Direct | Simple products, apps | Hero > Key Benefit > Screenshot > Download |
| Social Proof-Focused | Services, B2C | Hero > Testimonials > Features > Trust Badges |
| Interactive Demo | Software, tools | Hero > Live Demo > Features > Pricing |
| Trust & Authority | B2B, enterprise | Hero > Logos > Case Studies > Stats > Contact |
| Storytelling | Brands, nonprofits | Narrative Scroll > Problem > Journey > Impact |

## 2.3 Industry-Specific Reasoning Rules

| Industry | Recommended Style | Color Mood | Typography Mood | Anti-Patterns |
|----------|------------------|------------|-----------------|---------------|
| SaaS/Tech | Minimalism, Bento Grid | Cool blues, teals | Clean sans-serif (Geist, Satoshi) | Generic purple gradients |
| Fintech/Banking | Swiss, Dark Premium | Navy, gold, white | Professional serif + sans | Bright neons, playful fonts |
| Healthcare | Soft UI, Minimalism | Soft blues, greens, white | Friendly sans (Nunito, Source Sans) | Dark themes, harsh contrast |
| E-commerce | Flat 2.0, Bento Grid | Brand-specific, high contrast | Readable body (16px+) | Cluttered layouts, tiny text |
| Beauty/Wellness | Soft UI, Organic | Pastels, earth tones, gold | Elegant serif + light sans | Dark mode, harsh shadows |
| Restaurant/Food | Retro, Editorial | Warm earth, deep reds, cream | Serif headings, clean body | Cold blues, corporate feel |
| Creative/Agency | Brutalism, Gradient Mesh | Bold, unexpected combos | Distinctive display fonts | Safe, corporate aesthetics |
| Legal/Consulting | Swiss, Minimalism | Navy, charcoal, white | Traditional serif (Merriweather) | Playful, casual, colorful |
| Real Estate | Luxury, Minimalism | Dark + gold, or light + navy | Elegant, wide-spaced | Cluttered, cheap-looking |
| Education | Flat 2.0, Soft UI | Warm, approachable | Friendly, readable (18px body) | Dense text, small fonts |
| Gaming | Cyberpunk, Dark Premium | Neons, darks, high contrast | Bold, futuristic display | Corporate, boring |
| Fitness | Neo-Brutalism, Dark Premium | Energetic (orange, red, black) | Bold, impactful sans | Soft, pastel, delicate |

## 2.4 Color Palette Generation

### By Mood

| Mood | Primary | Secondary | Accent | Background |
|------|---------|-----------|--------|------------|
| Calming | Soft blue #7EC8E3 | Sage #A8D5BA | Gold #D4AF37 | Warm white #FFF5F5 |
| Energetic | Coral #FF6B6B | Orange #FFA07A | Yellow #FFD93D | Light gray #F8F9FA |
| Professional | Navy #1B2A4A | Steel #64748B | Teal #0D9488 | White #FFFFFF |
| Luxurious | Charcoal #1A1A2E | Gold #C9A96E | Cream #F5F0E8 | Off-black #0F0F23 |
| Playful | Purple #8B5CF6 | Pink #EC4899 | Yellow #FBBF24 | Light purple #F5F3FF |
| Natural | Forest #2D5016 | Sand #C2956B | Terracotta #C4704E | Cream #FAF3E0 |
| Tech/Modern | Indigo #4F46E5 | Cyan #06B6D4 | Lime #84CC16 | Dark #0F172A |

### 60-30-10 Rule

```
60% - Dominant (backgrounds, large surfaces)
30% - Supporting (cards, secondary surfaces)
10% - Accent (CTAs, highlights, focus)
```

## 2.5 Typography Pairing

| Heading | Body | Mood | Best For |
|---------|------|------|----------|
| Playfair Display | Source Sans 3 | Elegant, editorial | Luxury, publishing, lifestyle |
| Space Grotesk | Inter | Modern, technical | SaaS, dev tools, dashboards |
| Fraunces | Commissioner | Warm, sophisticated | Food, hospitality, boutique |
| Clash Display | General Sans | Bold, contemporary | Agencies, portfolios, startups |
| Cormorant Garamond | Montserrat | Classical, refined | Wellness, beauty, legal |
| DM Serif Display | DM Sans | Clean, balanced | Corporate, finance, real estate |
| Unbounded | Outfit | Futuristic, bold | Gaming, tech, entertainment |
| Instrument Serif | Instrument Sans | Minimal, precise | Design studios, architecture |

**Rule:** NEVER default to Inter/Roboto/system fonts. Always pick a distinctive pairing that matches the project's personality. Vary between projects.

---

# PART 3: WEB STANDARDS COMPLIANCE

Apply these rules to ALL implementations. Based on Vercel Web Interface Guidelines.

## 3.1 Accessibility (WCAG 2.2 AA)

| Rule | Implementation |
|------|---------------|
| Icon-only buttons need `aria-label` | `<button aria-label="Delete item"><TrashIcon /></button>` |
| Form controls need labels | `<label for="email">Email</label>` or `aria-label` |
| Interactive elements need keyboard handlers | `@keydown.enter`, `@keydown.space` |
| Use `<button>` for actions, `<a>` for navigation | NEVER `<div @click>` for interactive elements |
| Images need `alt` (or `alt=""` if decorative) | `<img alt="Product screenshot" ...>` |
| Decorative icons need `aria-hidden="true"` | `<CheckIcon aria-hidden="true" />` |
| Headings follow hierarchy h1-h6 | Never skip levels (h1 > h3) |
| Target size minimum 24x24px (44px recommended) | `min-height: 44px` on buttons |

## 3.2 Focus States

```css
/* ALWAYS provide visible focus */
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* NEVER use outline:none without replacement */
/* WRONG: */ *:focus { outline: none; }
/* RIGHT: */ *:focus:not(:focus-visible) { outline: none; }
```

## 3.3 Forms

| Rule | Why |
|------|-----|
| Add `autocomplete` and meaningful `name` | Browser autofill, password managers |
| Use correct `type` (`email`, `tel`, `url`) | Mobile keyboard optimization |
| NEVER block paste (`@paste.prevent`) | Accessibility violation |
| Disable spellcheck on codes/emails | `spellcheck="false"` |
| Submit button stays enabled until request starts | Show spinner during request |
| Errors inline next to fields | Focus first error on submit |
| Warn before leaving with unsaved changes | `beforeunload` or router guard |

## 3.4 Animation Rules

```css
/* ALWAYS honor reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* ONLY animate compositor-friendly properties */
/* RIGHT: */ transform, opacity
/* WRONG: */ width, height, top, left, margin, padding

/* NEVER use transition: all */
/* RIGHT: */ transition: transform 200ms ease-out, opacity 200ms ease-out;
/* WRONG: */ transition: all 200ms ease;
```

## 3.5 Typography Micro-Rules

| Rule | Example |
|------|---------|
| Use `...` not `...` | `Loading...` |
| Use curly quotes `"` `"` not straight `"` | `"Welcome back"` |
| Non-breaking spaces | `10&nbsp;MB`, `Cmd&nbsp;K` |
| `font-variant-numeric: tabular-nums` | Number columns, prices, stats |
| `text-wrap: balance` on headings | Prevents widows/orphans |

## 3.6 Content Handling

```css
/* Text containers MUST handle overflow */
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Flex children need min-w-0 for truncation to work */
.flex-child { min-width: 0; }
```

- ALWAYS handle empty states — never render broken UI for empty data
- Anticipate short, average, and very long user-generated content

### Flexbox Chips/Pills Overflow Pitfalls

| Pitfall | Fix |
|---------|-----|
| `flex: 1` (= `1 1 0%`) starts at 0 width — truncates text even with `overflow: visible` | Use `flex: 0 0 auto` for natural content width |
| `-webkit-line-clamp` persists through CSS overrides | Must explicitly unset: `-webkit-line-clamp: unset; -webkit-box-orient: unset` |
| `overflow-x: auto` + `overflow-y: visible` both become `auto` (CSS spec) | Don't mix; use `min-width: 0` on flex parent + `overflow-x: auto` only |
| `display: inline` inside flex container → blockified (CSS spec) | Use `display: block` instead |
| Selected chip outline clipped by parent `padding: 0` | Add padding to container for decoration space |
| Horizontal scroll not working on flex children | Add `min-width: 0` to the flex child that scrolls |

## 3.7 Images & Performance

| Rule | Implementation |
|------|---------------|
| `<img>` needs explicit `width` and `height` | Prevents CLS (Cumulative Layout Shift) |
| Below-fold images: `loading="lazy"` | Reduces initial load |
| Above-fold critical images: `fetchpriority="high"` | Faster LCP |
| Large lists (>50 items): virtualize | Use `content-visibility: auto` or virtual scroll library |
| Add `<link rel="preconnect">` for CDN domains | Faster asset loading |
| Critical fonts: `<link rel="preload" as="font">` | `font-display: swap` |

## 3.8 Navigation & State

- URL MUST reflect state — filters, tabs, pagination in query params
- Links use `<a>`/`<RouterLink>` (support Cmd+click, middle-click)
- Destructive actions need confirmation or undo — NEVER immediate delete
- Deep-link all stateful UI — if it uses `useState`/`ref`, consider URL sync

## 3.9 Touch & Mobile

```css
/* Prevent 300ms tap delay */
* { touch-action: manipulation; }

/* Prevent bounce in modals/drawers */
.modal { overscroll-behavior: contain; }

/* Safe areas for notched devices */
.full-bleed {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}
```

## 3.10 Dark Mode

```css
/* Set color-scheme for native element styling (scrollbars, inputs) */
html { color-scheme: dark; }

/* Match theme-color to page background */
<meta name="theme-color" content="#0f172a">

/* Native <select>: explicit bg and color for Windows */
select { background-color: var(--surface); color: var(--text); }
```

## 3.11 Locale & i18n

- Dates/times: use `Intl.DateTimeFormat`, NEVER hardcoded formats
- Numbers/currency: use `Intl.NumberFormat`, NEVER `$${amount}`
- Detect language via `Accept-Language` / `navigator.languages`, NOT IP

---

# PART 4: ANTI-PATTERNS (FLAG THESE)

### AI-Slop Aesthetics (NEVER)
- Purple-to-blue gradient on white background
- Inter/Roboto/system fonts as the only choice
- `border-radius: 12px` on everything
- Cookie-cutter card grids with identical shadows
- Generic hero with "Welcome to [Product]" headline
- Stock photo of diverse team in modern office

### Component Anti-Patterns (NEVER)
- Rainbow badges — every status a different bright color with no semantic meaning
- Modal inside modal — use a page or drawer for complex flows
- Disabled submit with no explanation — always indicate what's missing
- Spinner for predictable layouts — use skeleton screens instead
- "Click here" links — link text must describe the destination
- Hamburger menu on desktop — use visible navigation when space allows
- Auto-advancing carousels — let users control navigation
- Placeholder-only form fields — always use visible labels
- Equal-weight buttons — establish primary/secondary/tertiary hierarchy
- Tiny text (< 12px) — body text minimum 14px, prefer 16px
- Tooltips containing essential information — use inline text or popovers
- Color-only status indication — always add icon or text alongside

### Code Anti-Patterns (ALWAYS FLAG)
- `user-scalable=no` or `maximum-scale=1` (disabling zoom)
- `@paste.prevent` / `onPaste + preventDefault` (blocking paste)
- `transition: all` (performance killer)
- `outline: none` without `:focus-visible` replacement
- `<div @click>` or `<span @click>` (should be `<button>`)
- Images without `width`/`height` dimensions
- Large arrays `.map()` without virtualization (>50 items)
- Form inputs without labels
- Icon buttons without `aria-label`
- Hardcoded date/number formats (use `Intl.*`)

---

# PART 5: PRE-DELIVERY CHECKLIST

Run this before shipping any UI work:

## Visual Quality
- [ ] No AI-generic aesthetics — design has personality and intention
- [ ] Color palette follows 60-30-10 rule
- [ ] Typography has distinctive pairing (NOT Inter/Roboto default)
- [ ] Spacing is consistent (8px grid or chosen system)
- [ ] Hover states on ALL interactive elements
- [ ] `cursor: pointer` on all clickable elements

## Accessibility
- [ ] All `<img>` have `alt` attributes
- [ ] All icon buttons have `aria-label`
- [ ] No `<div>` or `<span>` used as buttons
- [ ] Focus states visible (`:focus-visible` with ring/outline)
- [ ] Text contrast 4.5:1 minimum (WCAG AA)
- [ ] Touch targets 44px minimum
- [ ] `prefers-reduced-motion` respected

## Performance
- [ ] Images have `width`/`height` (no CLS)
- [ ] Below-fold images use `loading="lazy"`
- [ ] No `transition: all` in CSS
- [ ] Lists >50 items are virtualized
- [ ] Fonts preloaded with `font-display: swap`

## Responsiveness
- [ ] Tested at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scrollbar at any breakpoint
- [ ] Touch-friendly on mobile (`touch-action: manipulation`)
- [ ] Safe areas handled for notched devices

## Content
- [ ] Empty states handled gracefully
- [ ] Long text content truncates or wraps properly
- [ ] Error messages include fix/next step
- [ ] Loading states end with ellipsis: "Loading..."
- [ ] No emojis used as icons (use SVG: Heroicons, Lucide, Phosphor)

---

# PART 6: CREATIVE EXECUTION

## Aesthetic Principles

- **Typography**: Choose fonts that are beautiful and unexpected. Pair a distinctive display font with a refined body font. Font choice alone can differentiate a design.
- **Color & Theme**: Commit to a cohesive aesthetic. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Depth**: Create atmosphere — gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, grain overlays. NEVER default to solid white/gray.

## Implementation Standards

- Production-grade and functional code
- Visually striking and memorable design
- Cohesive aesthetic point-of-view throughout
- Meticulous refinement in every detail
- Match implementation complexity to the vision — maximalist needs elaborate code, minimalist needs precision

Remember: Claude is capable of extraordinary creative work. Don't hold back — commit fully to a distinctive vision that stands apart from generic AI output.

---

**Skill Keywords:** frontend, design, UI, UX, landing page, web app, dashboard, design system, color palette, typography, accessibility, WCAG, animation, web standards, industry-specific

**Standards:** WCAG 2.2, Vercel Web Interface Guidelines, Material Design 3, Apple HIG

**Last Updated:** March 2026

# TASK-111: Pomo-Flow Landing Page for Early Access

**Status:** PLANNING
**Priority:** High
**Created:** 2026-01-07

---

## Overview

Create a landing page for Pomo-Flow hosted on GitHub Pages (free) that showcases features, collects early access signups, and clearly communicates the semi open-source business model.

## Problem Statement

Pomo-Flow needs a public-facing landing page to:
1. Attract potential users and build a waitlist before public launch
2. Communicate the value proposition (Pomodoro + Task Management)
3. Explain the open-core business model transparently
4. Convert visitors to early access signups
5. Direct developers to the GitHub repository

Currently, there's no marketing presence - only the GitHub repo and internal documentation.

---

## Proposed Solution

### Landing Page Structure

```
┌─────────────────────────────────────────────────────────┐
│  HEADER                                                 │
│  Logo | Features | Pricing | GitHub ⭐ | [Early Access] │
├─────────────────────────────────────────────────────────┤
│  HERO SECTION                                           │
│  "Focus Better. Achieve More."                          │
│  Pomodoro timer meets intelligent task management       │
│  [Join Early Access]  [View on GitHub]                  │
│  ┌─────────────────────────────────────┐               │
│  │     App Screenshot (Board View)      │               │
│  └─────────────────────────────────────┘               │
├─────────────────────────────────────────────────────────┤
│  FEATURES SECTION (Bento Grid)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ ⏱️ Timer │ │ 📋 Board │ │ 📅 Calendar│               │
│  └──────────┘ └──────────┘ └──────────┘               │
│  ┌──────────┐ ┌────────────────────────┐               │
│  │ 🎨 Canvas│ │ 🔄 Sync Anywhere       │               │
│  └──────────┘ └────────────────────────┘               │
├─────────────────────────────────────────────────────────┤
│  PRICING/MODEL SECTION                                  │
│  "Open Source at Heart"                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │ SELF-HOST   │ │ CLOUD       │ │ PRO         │      │
│  │ Free        │ │ $X/month    │ │ $Y/month    │      │
│  │ Your Supa   │ │ Our Supa    │ │ AI + Gaming │      │
│  └─────────────┘ └─────────────┘ └─────────────┘      │
├─────────────────────────────────────────────────────────┤
│  EARLY ACCESS SIGNUP                                    │
│  "Be the first to experience Pomo-Flow"                 │
│  [email input] [Join Waitlist]                          │
│  ○ Interested in: Free / Cloud / Pro                    │
├─────────────────────────────────────────────────────────┤
│  FOOTER                                                 │
│  GitHub | Docs | Privacy | Terms                        │
│  "Made with ❤️ for productivity enthusiasts"            │
└─────────────────────────────────────────────────────────┘
```

### Business Model Tiers

| Tier | Price | Target User | Features |
|------|-------|-------------|----------|
| **Free (Self-Host)** | $0 | Developers, Technical Users | Full app, deploy your own Supabase instance, full control |
| **Cloud** | $5-9/mo | General users | Hosted Supabase (no setup), automatic backups, priority support |
| **Pro** | $12-15/mo | Power users | Everything in Cloud + AI task breakdown, gamification (XP/levels), advanced analytics |

> **Important:** The app requires Supabase for data persistence. Free tier users deploy their own Supabase instance (free tier available from Supabase). Paid users get our hosted infrastructure.

### Platform Support (Current & Planned)

| Platform | Status | Technology |
|----------|--------|------------|
| Web Browser | ✅ Working | Vue 3 + Vite |
| Desktop (Windows/Mac/Linux) | 🔄 Ready to build | Tauri v2 |
| Mobile PWA | 📋 Roadmap | Service Worker |

### Database Architecture (Current)

| Layer | Technology | Notes |
|-------|------------|-------|
| **Data Storage** | Supabase PostgreSQL | All task/project data |
| **Auth** | Supabase Auth | Email/OAuth (required for data persistence) |
| **Realtime Sync** | Supabase Realtime | Cross-device sync via PostgreSQL subscriptions |
| **UI Preferences** | localStorage | Filters, theme, non-critical settings only |

> **Note:** App is 100% Supabase. PouchDB/CouchDB legacy code archived Jan 2026 (TASK-118).

---

## Technical Approach

### Architecture Decision: Separate Landing Page Repository

**Recommended:** Create a new repository `pomo-flow-landing` for the landing page.

**Rationale:**
- Clean separation of marketing site from application code
- Simpler GitHub Pages deployment (no base path issues)
- Can use different tech stack optimized for static sites
- Independent deployment cycles
- SEO-optimized static HTML generation

**Alternative Considered:** VitePress in main repo
- Rejected: Adds complexity, mixes concerns, deployment conflicts

### Tech Stack for Landing Page

```
pomo-flow-landing/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment
├── src/
│   ├── components/
│   │   ├── Hero.vue
│   │   ├── Features.vue
│   │   ├── Pricing.vue
│   │   ├── SignupForm.vue
│   │   └── Footer.vue
│   ├── assets/
│   │   ├── screenshots/        # App screenshots
│   │   ├── logo.svg           # Brand logo (needs creation)
│   │   └── design-tokens.css  # Copy from main app
│   ├── App.vue
│   └── main.ts
├── public/
│   ├── favicon.ico
│   ├── robots.txt
│   └── CNAME                   # Custom domain
├── index.html
├── vite.config.ts
├── tailwind.config.js          # Reuse main app config
└── package.json
```

### Email Collection Strategy

**Recommended: Formspree** (simplest for static sites)

```html
<form action="https://formspree.io/f/{form-id}" method="POST">
  <input type="email" name="email" required />
  <input type="hidden" name="_subject" value="Pomo-Flow Early Access" />

  <!-- Tier interest segmentation -->
  <select name="tier_interest">
    <option value="free">Free (Self-Hosted)</option>
    <option value="cloud">Cloud</option>
    <option value="pro">Pro (AI + Gamification)</option>
    <option value="unsure">Not sure yet</option>
  </select>

  <!-- Honeypot for spam -->
  <input type="text" name="_gotcha" style="display:none" />

  <button type="submit">Join Early Access</button>
</form>
```

**Alternative Options:**
- Mailchimp embedded form (if email marketing automation needed)
- Google Forms (free unlimited, exports to Sheets)
- ConvertKit (creator-focused, good landing pages)

### GitHub Pages Deployment

**Workflow: `.github/workflows/deploy.yml`**

```yaml
name: Deploy Landing Page

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: './dist'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Custom Domain Setup

1. Register domain (suggestions: `pomoflow.app`, `pomo-flow.io`, `getpomoflow.com`)
2. Add `CNAME` file to `public/` with domain name
3. Configure DNS:
   - A records pointing to GitHub Pages IPs
   - Or CNAME record for `www` subdomain
4. Enable HTTPS in repository settings (automatic via Let's Encrypt)

---

## Acceptance Criteria

### Functional Requirements

- [ ] Landing page loads at custom domain with HTTPS
- [ ] Hero section clearly communicates value proposition
- [ ] Feature showcase displays Board, Calendar, Canvas, Timer views
- [ ] Pricing section explains free/cloud/pro tiers
- [ ] Email signup form collects addresses with tier interest
- [ ] Form submission sends confirmation (in-page + email)
- [ ] GitHub link is prominently displayed
- [ ] Mobile responsive design (320px - 1920px+)
- [ ] Page loads in < 3 seconds on 3G

### Non-Functional Requirements

- [ ] Lighthouse score > 90 on mobile
- [ ] WCAG AA accessibility compliance
- [ ] Privacy policy and terms of service pages
- [ ] Google Analytics or Plausible analytics configured
- [ ] Open Graph meta tags for social sharing
- [ ] Sitemap.xml for SEO

### Quality Gates

- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile device testing (iOS Safari, Android Chrome)
- [ ] Form submission tested with real email
- [ ] 404 page configured
- [ ] Spell check and grammar review

---

## Implementation Phases

### Phase 1: Foundation (MVP)
**Goal:** Get a working landing page live

1. Create new repository `pomo-flow-landing`
2. Set up Vue 3 + Vite + Tailwind project
3. Copy design tokens from main app
4. Build Hero section with basic CTA
5. Add email signup form (Formspree)
6. Deploy to GitHub Pages (username.github.io/pomo-flow-landing)
7. Test form submission

**Deliverable:** Basic landing page collecting emails

### Phase 2: Content & Polish
**Goal:** Professional marketing presence

1. Design/obtain logo and favicon
2. Create or capture app screenshots
3. Build Features section with bento grid
4. Build Pricing section with tier comparison
5. Add Footer with links
6. Write compelling copy for all sections
7. Implement glass morphism styling from main app

**Deliverable:** Polished landing page matching app aesthetics

### Phase 3: Domain & Legal
**Goal:** Professional domain and compliance

1. Register custom domain
2. Configure DNS and HTTPS
3. Create Privacy Policy page
4. Create Terms of Service page
5. Add cookie consent (if using analytics)
6. Update main app README to link to landing page

**Deliverable:** Production-ready landing page at custom domain

### Phase 4: Analytics & Optimization
**Goal:** Track and improve conversions

1. Set up analytics (Plausible recommended for privacy)
2. Configure conversion tracking for signups
3. Add Open Graph / Twitter Card meta tags
4. Submit sitemap to Google Search Console
5. A/B test headline and CTA variations
6. Implement referral tracking (optional)

**Deliverable:** Data-driven landing page with conversion tracking

---

## Content Requirements

### Copy to Write

**Hero Section:**
- Headline: "Focus Better. Achieve More."
- Subheadline: "The Pomodoro timer that knows what you need to work on next."
- CTA Primary: "Join Early Access"
- CTA Secondary: "View on GitHub"

**Feature Cards:**
1. **Pomodoro Timer**: "Stay in the zone with customizable work and break sessions. Never lose track of time again."
2. **Board View**: "Organize tasks like a kanban pro. Drag, drop, and prioritize your way to productivity."
3. **Calendar View**: "See your week at a glance. Schedule focused work sessions when you're at your best."
4. **Canvas View**: "Map out complex projects visually. Connect tasks and see the bigger picture."
5. **Real-time Sync**: "Access your tasks from any device. Changes sync instantly across all platforms."

**Pricing Section:**
- Section Title: "Open Source at Heart"
- Free Tier: "Self-Host" - "Full-featured, forever free. Deploy on your own Supabase instance."
- Cloud Tier: "Cloud" - "Zero setup. We host everything. Automatic backups. Priority support."
- Pro Tier: "Pro" - "AI-powered task breakdown. Gamification to keep you motivated."

**Early Access CTA:**
- Headline: "Be Among the First"
- Subtext: "Join 500+ productivity enthusiasts waiting for launch."
- Button: "Get Early Access"

### Assets Needed

1. **Logo** - Need to create (TASK-110 mentions "Cyber Tomato" theme)
2. **Favicon** - Derived from logo
3. **App Screenshots:**
   - Board View (hero image)
   - Calendar View
   - Canvas View
   - Timer in action
4. **Open Graph Image** - 1200x630px social preview

---

## Dependencies & Prerequisites

### Blocking Dependencies
- None - can start immediately

### Recommended Before Launch
- Logo design (TASK-110)
- App screenshots from stable version
- Privacy policy template

### Nice to Have
- Testimonials from beta testers
- GitHub star milestone to display

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low signup conversion | Medium | High | A/B test headlines, optimize CTA placement |
| Spam form submissions | High | Medium | Honeypot field, consider hCaptcha |
| Domain name unavailable | Medium | Low | Have 3-5 backup domain options |
| GitHub Pages outage | Low | Medium | Static site, easy to migrate to Netlify/Vercel |
| GDPR compliance issues | Medium | High | Use EU-friendly ESP, clear privacy policy |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Page Load Time | < 2.5s LCP | Lighthouse |
| Signup Conversion | > 5% | Analytics |
| Bounce Rate | < 60% | Analytics |
| Mobile Traffic | Track % | Analytics |
| GitHub Referrals | Track clicks | Analytics |
| Email Deliverability | > 95% | ESP Dashboard |

---

## Critical Questions Requiring Decision

### Before Starting

1. **Domain name choice?**
   - Options: `pomoflow.app`, `pomo-flow.io`, `getpomoflow.com`
   - Budget: ~$12-40/year depending on TLD

2. **Email service provider?**
   - Formspree (simplest, free tier 50/month)
   - Mailchimp (automation, free tier 500 contacts)
   - Google Forms → Sheets (free unlimited, no automation)

3. **Analytics platform?**
   - Plausible (privacy-focused, $9/mo)
   - Google Analytics 4 (free, privacy concerns)
   - None initially

4. **Pricing specifics?**
   - Cloud tier: $5/mo? $9/mo?
   - Pro tier: $12/mo? $15/mo?
   - Or show "Coming soon" without prices?

### Can Defer

5. Logo design - can use text logo initially
6. Testimonials - add post-launch
7. Referral mechanics - add if waitlist grows

---

## References & Research

### Internal References
- Design tokens: `src/assets/design-tokens.css`
- Tailwind config: `tailwind.config.js`
- App screenshots: `.playwright-mcp/*.png`
- Architecture: `docs/claude-md-extension/architecture.md`

### External References
- GitHub Pages Docs: https://docs.github.com/en/pages
- Vite Static Deploy: https://vite.dev/guide/static-deploy.html
- Formspree: https://formspree.io/
- Plausible Analytics: https://plausible.io/
- Open Core Model: https://handbook.opencoreventures.com/

### Inspiration
- Plausible.io - Clean open source positioning
- Cal.com - Open core business model
- Linear.app - Beautiful productivity landing page

---

## MVP Checklist

Minimum viable landing page to launch:

- [ ] Repository created and configured
- [ ] Hero section with headline + email form
- [ ] Basic feature list (can be text only)
- [ ] Formspree form working
- [ ] Deployed to GitHub Pages
- [ ] Mobile responsive
- [ ] Privacy policy link (can link to placeholder)

**Estimated effort for MVP:** Can be built in a single focused session.

---

*Generated with Claude Code - 2026-01-07*

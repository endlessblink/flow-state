# TASK-1483: Dev-Maestro Dashboard UI Redesign

## Context

### Original Request
Redesign the Dev-Maestro dashboard: strip dead sections, fix layout, fix design token consistency, then add a Skills & Docs monitoring system.

### Research Findings
- **File**: `dev-maestro/kanban/index.html` (10,571 lines) -- monolithic HTML/CSS/JS
- **Server**: `dev-maestro/server.js` (3,937 lines) -- Express.js with beads API (~850 lines, L943-L1789)
- **Current `:root` tokens** (L10-L43): 18 tokens defined (surfaces, text, borders, brand, status, transitions)
- **Broken token refs** (14 occurrences): `--accent-primary` (L402,415,442,3566,3567,3883,3884,4023,4034), `--border-color` (L150), `--border-default` (L389), `--color-error` (L3275,3276), `--text-tertiary` (L3094)
- **Hardcoded hex values**: ~176 occurrences of `#hex` outside `:root`
- **Beads CSS**: L1386-L1932 (~547 lines)
- **Beads HTML**: L4757-L4806 + L4809-L4829 (~70 lines)
- **Beads JS**: L8273-L8944 (~672 lines)
- **D3.js import**: L4388
- **Navigation tabs**: 6 tabs (Status Board, Ideas, Roadmap, Archive, Priority Board, Beads) at L4406-L4459
- **Views to remove**: ideas-view (L4606-L4641), roadmap-view (L4642-L4677), archive-view (L4678-L4719), status-view (L4723-L4755), beads-view (L4757-L4806+)
- **View renderers to remove**: `renderIdeasKanban` (L6163-L6228), `renderRoadmapKanban` (L6295-L6355), `renderArchiveKanban` (L6423-L6626), parsers for each (L6235-L6292, L6362-L6420, L6626-L6714)
- **View switch logic**: L7402-L7422 (switchView function references all dead views)
- **Layout**: Kanban uses CSS grid with `.kanban-board` horizontal columns. No dedicated "In Progress pinned on top" layout.
- **Dead CSS for removed views**: Ideas columns (L665-L680), Roadmap columns (L682-L697), Archive columns (L699-L714), Status/Priority columns (L716-L724)

### Interview Summary
User confirmed all requirements upfront (no interview needed -- requirements are complete).

---

## Work Objectives

### Core Objective
Transform the Dev-Maestro dashboard from a bloated multi-view tool into a focused, design-consistent kanban board with a new Skills & Docs monitoring system.

### Deliverables
1. **Phase 1**: Stripped-down, layout-fixed, design-token-consistent dashboard
2. **Phase 2**: Skills & Docs usage monitoring system with heat map visualization

### Definition of Done
- All dead views removed (Ideas, Roadmap, Archive, Priority Board, Beads)
- In Progress panel pinned at top, Monitored below, no wasted space
- Zero broken token references
- Zero hardcoded hex values outside `:root`
- Consistent border-radius and font-size scales
- All missing tokens added
- Skills/Docs monitoring tracks invocations and renders heat map
- Dashboard loads without errors, all remaining features functional

---

## Must Have / Must NOT Have

### Must Have
- In Progress always visible at top
- Monitored panel fills remaining space below
- All CSS values use design tokens
- New tokens for missing semantic colors
- Skills/Docs monitoring with frequency-based card sizing

### Must NOT Have
- Ideas, Roadmap, Archive, Priority Board, Beads views
- D3.js dependency (only used by Beads graph)
- Recently Completed section
- Any `bd` CLI integration
- Hardcoded hex colors outside `:root` token definitions

---

## Task Flow and Dependencies

```
Phase 1 (Sequential within, parallel where noted):
  1.1 Add missing design tokens to :root          (independent)
  1.2 Remove dead views - CSS                      (independent)
  1.3 Remove dead views - HTML                     (depends on 1.2)
  1.4 Remove dead views - JS renderers & parsers   (depends on 1.3)
  1.5 Remove dead views - Navigation tabs          (depends on 1.3)
  1.6 Remove Beads - CSS + HTML + JS               (independent of 1.2-1.5)
  1.7 Remove Beads - server.js endpoints           (independent)
  1.8 Remove D3.js import                          (depends on 1.6)
  1.9 Fix broken token references                  (depends on 1.1)
  1.10 Replace hardcoded hex values with tokens    (depends on 1.1, 1.9)
  1.11 Standardize border-radius scale             (depends on 1.10)
  1.12 Normalize font-size units                   (depends on 1.10)
  1.13 Redesign layout: In Progress top + Monitored below  (depends on 1.2-1.5)
  1.14 Smoke test & fix regressions                (depends on all above)

Phase 2 (After Phase 1):
  2.1 Design monitoring data schema                (independent)
  2.2 Create server-side monitoring endpoints       (depends on 2.1)
  2.3 Add client-side invocation tracking           (depends on 2.2)
  2.4 Build frequency-based card renderer           (depends on 2.3)
  2.5 Build heat map visualization                  (depends on 2.3)
  2.6 Build connection/co-occurrence view           (depends on 2.3)
  2.7 Integration test                              (depends on all above)
```

---

## Detailed TODOs

### Phase 1: Strip Dead Sections + Fix Layout + Design Consistency

#### TASK 1.1: Add Missing Design Tokens to `:root`
**File**: `dev-maestro/kanban/index.html` (L10-L43)
**Action**: Add these tokens to the `:root` block:
```
--accent-primary: var(--brand-primary)    /* alias for broken refs */
--border-color: var(--border-medium)      /* alias for broken refs */
--border-default: var(--border-medium)    /* alias for broken refs */
--color-error: var(--color-danger)        /* alias for broken refs */
--text-tertiary: var(--text-muted)        /* alias for broken refs */
--color-merge: #10b981                    /* merge action */
--color-discard: #ef4444                  /* discard action */
--color-paused: #fca5a5                   /* paused status */
--color-review-purple: #a855f7           /* review status */
--text-on-brand: #000000                 /* text on brand-colored bg */
--terminal-bg: #0a0a0a                   /* terminal/output bg */
--terminal-text: #a3e635                 /* terminal text */
--terminal-border: #1a1a1a              /* terminal border */
```
**Acceptance**: All 14 broken token references resolve. New tokens available for Phase 1.10.

#### TASK 1.2: Remove Dead Views - CSS
**File**: `dev-maestro/kanban/index.html`
**Action**: Remove CSS blocks for:
- Ideas view columns (L665-L680)
- Roadmap view columns (L682-L697)
- Archive view columns (L699-L714)
- Status/Priority view columns (L716-L724)
- Any CSS classes prefixed with `.ideas-`, `.roadmap-`, `.archive-`, `.status-column-`
**Acceptance**: No CSS rules for removed views remain. Estimated ~60 lines removed.

#### TASK 1.3: Remove Dead Views - HTML
**File**: `dev-maestro/kanban/index.html`
**Action**: Remove HTML blocks:
- Ideas view container (L4606-L4641)
- Roadmap view container (L4642-L4677)
- Archive view container (L4678-L4719)
- Status/Priority view container (L4723-L4755)
**Acceptance**: No `#ideas-view`, `#roadmap-view`, `#archive-view`, `#status-view` elements exist. Estimated ~150 lines removed.

#### TASK 1.4: Remove Dead Views - JS Renderers & Parsers
**File**: `dev-maestro/kanban/index.html`
**Action**: Remove functions:
- `renderIdeasKanban()` (L6163-L6228)
- `parseIdeasMarkdown()` (L6235-L6292)
- `renderRoadmapKanban()` (L6295-L6355)
- `parseRoadmapMarkdown()` (L6362-L6420)
- `renderArchiveKanban()` (L6423-L6626)
- `parseIdeasFile()` (L6626-L6670)
- `parseRoadmapFile()` (L6673-L6711)
- `parseArchiveFile()` (L6714+)
- Status board renderer (search for `renderStatusKanban` or `status-column-`)
- Remove `ideas`, `roadmap`, `archive` from parsed data objects (L5373-5378, L5818-5823)
- Remove section parsing for ideas/roadmap/archive in MASTER_PLAN parser (L5393-5454, L5655-5724)
- Remove view switch cases (L7402-7422) for ideas, roadmap, archive, status, beads
- Remove refresh cases (L8110-8115)
**Acceptance**: No JS references to removed views. Estimated ~700 lines removed.

#### TASK 1.5: Remove Dead Views - Navigation Tabs
**File**: `dev-maestro/kanban/index.html`
**Action**: Remove nav tab buttons (L4415-L4458):
- Ideas tab (L4415-L4422)
- Roadmap tab (L4423-L4430)
- Archive tab (L4431-L4438)
- Priority Board tab (L4439-L4445)
- Beads tab (L4446-L4459)
**Acceptance**: Only "Status Board" (kanban) tab remains. Consider renaming to just "Tasks" since it is the only view.

#### TASK 1.6: Remove Beads - CSS + HTML + JS (index.html)
**File**: `dev-maestro/kanban/index.html`
**Action**: Remove:
- CSS: L1386-L1932 (~547 lines, `/* BEADS VIEW */` section)
- HTML: L4757 to end of beads-view container (~70 lines)
- JS: L8273-L8944 (~672 lines, `// ===== BEADS AGENT TRACKER =====` section)
- D3.js import at L4388
- Any beads-related CSS outside the main block (`.bead-card.in-progress` at L1772, etc.)
**Acceptance**: No beads-related code remains. No D3 import. Estimated ~1,300 lines removed.

#### TASK 1.7: Remove Beads - Server Endpoints
**File**: `dev-maestro/server.js`
**Action**: Remove:
- Beads API section (L943-L1789, `// ============== BEADS API ==============` to just before `// ============== ORCHESTRATOR API ==============`)
- `BD_PATH` constant (L945)
- `runningAgents` Map (L948)
- All `/api/beads/*` routes
**Acceptance**: No `/api/beads` routes in server.js. Server starts without errors. Estimated ~847 lines removed.

#### TASK 1.8: Remove D3.js Import
**File**: `dev-maestro/kanban/index.html`
**Action**: Remove the `<script>` tag importing D3.js at L4388.
**Acceptance**: No D3 reference in the file.

#### TASK 1.9: Fix Broken Token References
**File**: `dev-maestro/kanban/index.html`
**Action**: After TASK 1.1 adds alias tokens, verify all 14 broken references now resolve:
- `--accent-primary` at L402, 415, 442, 3566, 3567, 3883, 3884, 4023, 4034 (9 occurrences)
- `--border-color` at L150 (1 occurrence)
- `--border-default` at L389 (1 occurrence)
- `--color-error` at L3275, 3276 (2 occurrences)
- `--text-tertiary` at L3094 (1 occurrence)

**Alternative approach**: Instead of alias tokens, directly replace each broken ref with the correct existing token:
- `var(--accent-primary)` -> `var(--brand-primary)` (all 9)
- `var(--border-color)` -> `var(--border-medium)` (1)
- `var(--border-default)` -> `var(--border-medium)` (1)
- `var(--color-error)` -> `var(--color-danger)` (2)
- `var(--text-tertiary)` -> `var(--text-muted)` (1)

This approach is cleaner (no alias indirection). **Preferred.**

**Acceptance**: Zero broken token references. `grep` for each broken token returns 0 results.

#### TASK 1.10: Replace Hardcoded Hex Values with Tokens
**File**: `dev-maestro/kanban/index.html`
**Action**: Audit all ~176 hardcoded hex values outside `:root`. For each:
1. Map to existing token if exact match (e.g., `#4ECDC4` -> `var(--brand-primary)`)
2. Map to closest semantic token if near match
3. Add new token to `:root` if genuinely new color needed
4. Common patterns to look for:
   - `#ef4444` -> `var(--color-danger)` (todo/critical column headers)
   - `#f59e0b` -> `var(--color-warning)` (in-progress)
   - `#10b981` -> `var(--color-success)` (done/merge)
   - `#3b82f6` -> `var(--color-info)` (review)
   - `#fca5a5` -> `var(--color-paused)` (paused)
   - `#4a5568`, `#2d3748`, `#c53030`, `#2c5282`, etc. -> new tokens or existing surface/border tokens
   - `rgba(...)` values for backgrounds -> check against existing surface tokens
**Acceptance**: `grep '#[0-9a-fA-F]' index.html` returns ONLY lines inside `:root {}`. Zero hardcoded hex elsewhere.

#### TASK 1.11: Standardize Border-Radius Scale
**File**: `dev-maestro/kanban/index.html`
**Action**:
1. Add radius tokens to `:root`:
   ```
   --radius-xs: 3px;    /* badges, small pills */
   --radius-sm: 6px;    /* inputs, small elements */
   --radius-md: 8px;    /* buttons, cards */
   --radius-lg: 12px;   /* panels, modals */
   --radius-xl: 16px;   /* large modals, overlays */
   --radius-full: 9999px; /* circular elements */
   ```
2. Replace all hardcoded `border-radius` values with appropriate token
**Acceptance**: No hardcoded `border-radius: Npx` outside `:root`. All use `var(--radius-*)`.

#### TASK 1.12: Normalize Font-Size Units
**File**: `dev-maestro/kanban/index.html`
**Action**:
1. Decide on `px` (matches the rest of the codebase which is all px)
2. Add font-size tokens to `:root`:
   ```
   --font-xs: 11px;
   --font-sm: 12px;
   --font-md: 13px;
   --font-base: 14px;
   --font-lg: 16px;
   --font-xl: 18px;
   --font-2xl: 24px;
   --font-3xl: 32px;
   ```
3. Replace all hardcoded `font-size` values with tokens
4. Convert any `rem` values to the nearest `px` token
**Acceptance**: No hardcoded `font-size` values. All use `var(--font-*)`. No mixed px/rem.

#### TASK 1.13: Redesign Layout - In Progress Top + Monitored Below
**File**: `dev-maestro/kanban/index.html`
**Action**:
1. Change the kanban board from horizontal columns to a vertical layout with two sections:
   - **Top section (pinned)**: "In Progress" -- shows tasks with `status === 'in_progress'`
   - **Bottom section (fills remaining)**: "Monitored" -- shows Planned, Paused, Review, Done columns side by side
2. CSS approach:
   ```css
   .kanban-layout {
     display: flex;
     flex-direction: column;
     height: 100%;
   }
   .in-progress-section {
     /* Pinned, auto-height based on content, max ~40% */
     flex: 0 0 auto;
     max-height: 40vh;
     overflow-y: auto;
   }
   .monitored-section {
     /* Fills remaining space */
     flex: 1;
     display: grid;
     grid-template-columns: repeat(4, 1fr);
     overflow-y: auto;
   }
   ```
3. Update HTML structure to wrap existing columns in new layout containers
4. Update JS rendering to populate new containers
**Acceptance**: In Progress is always at top. No empty space below. Monitored columns fill remaining viewport.

#### TASK 1.14: Smoke Test & Fix Regressions
**Action**:
1. Start server: `node dev-maestro/server.js`
2. Load dashboard in browser
3. Verify: Kanban loads, tasks render, search works, filters work
4. Verify: No console errors
5. Verify: No broken CSS (inspect for `var(--undefined)` computed values)
6. Verify: Orchestrator panel still works (it's independent of removed views)
7. Verify: Task detail modal works (click a task card)
8. Verify: Inline status editing works
9. Fix any regressions found
**Acceptance**: Dashboard fully functional with remaining features. Zero console errors.

---

### Phase 2: Skills & Docs Usage Monitoring System

#### TASK 2.1: Design Monitoring Data Schema
**Action**: Define data structures for tracking skill/doc usage.

**Storage**: JSON file at `.maestro/monitoring.json` (simple, no new dependencies)

```json
{
  "skills": {
    "skill-name": {
      "invocations": 42,
      "lastUsed": "2026-03-08T10:00:00Z",
      "coOccurrences": {
        "doc-name": 5,
        "other-skill": 3
      },
      "taskAssociations": ["TASK-1483", "TASK-1456"]
    }
  },
  "docs": {
    "doc-path": {
      "references": 18,
      "lastReferenced": "2026-03-08T10:00:00Z",
      "coOccurrences": {
        "skill-name": 5
      },
      "taskAssociations": ["TASK-1483"]
    }
  },
  "events": [
    {
      "timestamp": "2026-03-08T10:00:00Z",
      "type": "skill_invocation",
      "name": "frontend-ui-ux",
      "taskId": "TASK-1483",
      "relatedDocs": ["design-system.md"]
    }
  ]
}
```
**Acceptance**: Schema documented. JSON file created with empty initial state.

#### TASK 2.2: Create Server-Side Monitoring Endpoints
**File**: `dev-maestro/server.js`
**Action**: Add new API routes:
- `POST /api/monitoring/track` -- Log a skill invocation or doc reference
- `GET /api/monitoring/stats` -- Get aggregated stats (invocation counts, co-occurrences)
- `GET /api/monitoring/heatmap` -- Get heatmap data (time-bucketed invocation counts)
- `GET /api/monitoring/connections` -- Get co-occurrence graph data (nodes + edges)
- `POST /api/monitoring/reset` -- Reset tracking data (admin)
**Acceptance**: All endpoints respond correctly. Data persists across server restarts.

#### TASK 2.3: Add Client-Side Invocation Tracking
**File**: `dev-maestro/kanban/index.html`
**Action**:
1. Scan `.claude/skills/` and `.claude/config/skills.json` for available skills
2. Scan `docs/` for documentation files
3. When the dashboard loads, call `/api/monitoring/stats` to get current data
4. Provide a mechanism for external tools (Claude sessions) to report usage via the API
5. Add a "Monitor" nav tab to replace removed tabs
**Acceptance**: Dashboard shows current skill/doc inventory. Tracking API is callable from external tools.

#### TASK 2.4: Build Frequency-Based Card Renderer
**File**: `dev-maestro/kanban/index.html`
**Action**:
1. Create a new view section "Skills & Docs Monitor"
2. Render skills and docs as cards sized by invocation frequency:
   - High frequency: large card (e.g., 200x150px)
   - Medium frequency: medium card (150x100px)
   - Low/zero frequency: small card (100x60px) or hidden with toggle
3. Cards show: name, invocation count, last used timestamp, trend indicator
4. Sort by frequency (most used first)
5. Style using design tokens from Phase 1
**Acceptance**: Cards render with correct sizes. Most-used skills/docs are visually prominent.

#### TASK 2.5: Build Heat Map Visualization
**File**: `dev-maestro/kanban/index.html`
**Action**:
1. Add a heat map grid (no D3 -- use CSS Grid + inline styles for colors)
2. X-axis: days/weeks, Y-axis: skills/docs
3. Cell color intensity maps to invocation count (use opacity of `--brand-primary`)
4. Tooltip on hover showing exact count + timestamp
5. Toggle between "Skills only", "Docs only", "Both"
**Acceptance**: Heat map renders with correct data. Color intensity maps to frequency.

#### TASK 2.6: Build Connection/Co-occurrence View
**File**: `dev-maestro/kanban/index.html`
**Action**:
1. Render co-occurrence relationships as a simple connection diagram
2. Use CSS + absolute positioning (no D3) or a lightweight canvas approach
3. Nodes = skills/docs, edges = co-occurrence count
4. Thicker edges = more co-occurrences
5. Click a node to highlight its connections
**Acceptance**: Connections display between co-occurring skills/docs. Visual weight reflects frequency.

#### TASK 2.7: Integration Test
**Action**:
1. Start server, load dashboard
2. Call tracking API manually: `curl -X POST localhost:6010/api/monitoring/track -H 'Content-Type: application/json' -d '{"type":"skill","name":"frontend-ui-ux","taskId":"TASK-1483"}'`
3. Verify card size updates on refresh
4. Verify heat map shows the new data point
5. Verify connections update
6. Test edge cases: empty data, single item, 100+ items
**Acceptance**: Full pipeline works end-to-end. No console errors. Performance acceptable with 100+ items.

---

## Commit Strategy

| Commit | Content | Estimated Size |
|--------|---------|----------------|
| 1 | Add missing design tokens to `:root` | ~20 lines added |
| 2 | Remove dead views (CSS + HTML + JS + nav tabs) | ~1,100 lines removed |
| 3 | Remove Beads system (CSS + HTML + JS + server endpoints) | ~2,100 lines removed |
| 4 | Fix broken token references | ~14 line changes |
| 5 | Replace hardcoded hex values with tokens | ~176 line changes |
| 6 | Standardize border-radius scale | ~50 line changes |
| 7 | Normalize font-size units | ~40 line changes |
| 8 | Redesign layout: In Progress top + Monitored below | ~80 lines changed |
| 9 | Phase 2: Monitoring data schema + server endpoints | ~200 lines added (server.js) |
| 10 | Phase 2: Client-side tracking + frequency cards | ~300 lines added (index.html) |
| 11 | Phase 2: Heat map + connections visualization | ~250 lines added (index.html) |

**Net result**: File shrinks from ~10,571 to ~7,000 lines after Phase 1, grows to ~7,750 after Phase 2.

---

## Success Criteria

### Phase 1
- [ ] Dashboard loads with zero console errors
- [ ] Only kanban view remains (no Ideas, Roadmap, Archive, Priority Board, Beads tabs)
- [ ] In Progress section pinned at top of kanban view
- [ ] Monitored section fills remaining space below
- [ ] No broken CSS token references (`grep` for undefined tokens returns 0)
- [ ] No hardcoded hex outside `:root` (`grep` verification)
- [ ] Consistent border-radius scale (all use `var(--radius-*)`)
- [ ] Consistent font-size units (all use `var(--font-*)`)
- [ ] Task cards render correctly (click, edit, status change)
- [ ] Search and filters still work
- [ ] Orchestrator panel still works
- [ ] Server starts without errors after beads removal

### Phase 2
- [ ] `/api/monitoring/track` accepts and persists events
- [ ] `/api/monitoring/stats` returns aggregated data
- [ ] Skills/Docs cards render with frequency-based sizing
- [ ] Heat map shows time-bucketed usage data
- [ ] Co-occurrence connections display between related items
- [ ] Performance acceptable with 100+ tracked items
- [ ] Monitor view accessible via navigation

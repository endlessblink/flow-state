# feat: Dev Manager Health Dashboard - System Status at a Glance

## Overview

Add a comprehensive **Health Dashboard** tab to the dev-manager that provides real-time visibility into code quality, type safety, test coverage, dead code, dependencies, and build health. All metrics scannable at a glance with drill-down capability.

## Problem Statement

Currently, checking system health requires running multiple commands manually:
- `npm run lint` for ESLint issues
- `vue-tsc --noEmit` for TypeScript errors
- `npx knip` for dead code
- `npm audit` for vulnerabilities
- `npm outdated` for dependency freshness

There's no unified view showing the overall health of the codebase, making it easy to miss regressions or accumulating technical debt.

## Proposed Solution

Create a new **"Health"** tab in dev-manager that:
1. Runs health scans on-demand or automatically
2. Displays metrics in a visual dashboard with color-coded status
3. Shows trends over time (optional historical tracking)
4. Provides drill-down to specific issues

## Technical Approach

### Architecture

```
dev-manager/
├── server.js                    # Add /api/health endpoints
├── health/
│   └── index.html              # New Health dashboard tab
├── scripts/
│   └── health-scanner.js       # Node script that runs all checks
└── data/
    └── health-history.json     # Optional: historical metrics
```

### Backend: Health Scanner API

**New file: `dev-manager/scripts/health-scanner.js`**

Runs these checks and returns JSON:

| Metric | Command/Tool | Output |
|--------|--------------|--------|
| TypeScript Errors | `vue-tsc --noEmit 2>&1` | Error count, file list |
| ESLint Issues | `eslint src --format json` | Errors, warnings, fixable |
| Dead Code | `npx knip --reporter json` | Unused files, exports, deps |
| Test Status | `npm run test:ci` | Pass/fail count |
| Coverage | `coverage-summary.json` | Line/branch/function % |
| Bundle Size | `dist/assets/*.js` stats | Total KB, largest chunks |
| Dependencies | `npm audit --json` + `npm outdated --json` | Vulnerabilities, outdated |
| Build Status | Last build exit code | Pass/fail |

**New endpoints in `server.js`:**

```javascript
// GET /api/health - Full health scan (slow, ~30s)
// GET /api/health/quick - Quick scan (TS + ESLint only, ~5s)
// GET /api/health/cached - Return last scan results
// POST /api/health/scan - Trigger background scan
```

### Frontend: Health Dashboard

**New file: `dev-manager/health/index.html`**

Visual dashboard with:

1. **Status Banner** - Overall health score (0-100) with color
2. **Metric Cards** - One card per category with:
   - Icon + Title
   - Current value (big number)
   - Status color (green/yellow/red)
   - Trend arrow (if historical data available)
3. **Issue Lists** - Expandable sections showing actual errors
4. **Last Scan Time** - When metrics were collected
5. **Scan Button** - Manual refresh trigger

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  SYSTEM HEALTH: 78/100  ●●●●●●●●○○  Last scan: 2m ago  │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ TS Errors│ │  ESLint  │ │Dead Code │ │  Tests   │    │
│ │    12    │ │  3 warn  │ │ 5 files  │ │ 48/48 ✓  │    │
│ │   🔴     │ │   🟡     │ │   🟡     │ │   🟢     │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Coverage │ │  Bundle  │ │   Deps   │ │  Build   │    │
│ │   67%    │ │  1.2 MB  │ │ 2 vulns  │ │    ✓     │    │
│ │   🟡     │ │   🟢     │ │   🔴     │ │   🟢     │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────────────────┤
│ ▼ TypeScript Errors (12)                               │
│   src/stores/canvas.ts:142 - Type 'string' not...      │
│   src/composables/useSync.ts:89 - Property 'foo'...    │
└─────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Backend Scanner (Core)
- [ ] Create `dev-manager/scripts/health-scanner.js`
- [ ] Add TypeScript error collection (parse vue-tsc output)
- [ ] Add ESLint metric collection (JSON format)
- [ ] Add dead code scan via knip
- [ ] Add npm audit/outdated parsing
- [ ] Add bundle size calculation
- [ ] Create `/api/health` endpoint in server.js
- [ ] Test endpoint returns valid JSON

#### Phase 2: Frontend Dashboard (MVP)
- [ ] Create `dev-manager/health/index.html`
- [ ] Add tab to main `dev-manager/index.html`
- [ ] Build metric cards with Chart.js gauges
- [ ] Add status colors based on thresholds
- [ ] Add expandable issue lists
- [ ] Add manual scan button
- [ ] Style with existing design tokens

#### Phase 3: Polish & History (Optional)
- [ ] Add historical tracking to JSON file
- [ ] Show trend arrows (improving/declining)
- [ ] Add auto-refresh option
- [ ] Add export functionality

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `dev-manager/scripts/health-scanner.js` | Create | Core scanner logic |
| `dev-manager/server.js` | Modify | Add /api/health endpoints |
| `dev-manager/health/index.html` | Create | Dashboard UI |
| `dev-manager/index.html` | Modify | Add Health tab |
| `dev-manager/styles.css` | Modify | Add health-specific styles |

## Thresholds & Scoring

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| TS Errors | 0 | 1-10 | >10 |
| ESLint Errors | 0 | 0 (1+ warn) | >0 |
| Dead Code Files | 0-2 | 3-10 | >10 |
| Test Pass Rate | 100% | 90-99% | <90% |
| Coverage | >80% | 60-80% | <60% |
| Bundle Size | <1.5MB | 1.5-2MB | >2MB |
| Vulnerabilities | 0 | 1-3 low | >3 or any high |
| Outdated Deps | 0-5 | 6-15 | >15 |

**Overall Score**: Weighted average (TS errors and vulnerabilities weighted higher)

## Acceptance Criteria

### Functional Requirements
- [ ] Health tab appears in dev-manager navigation
- [ ] Clicking "Scan" runs all health checks
- [ ] All 8 metric categories display with correct values
- [ ] Color coding reflects actual status (green/yellow/red)
- [ ] Expandable sections show detailed issues
- [ ] Last scan time displays accurately

### Non-Functional Requirements
- [ ] Full scan completes in <60 seconds
- [ ] Quick scan completes in <10 seconds
- [ ] Dashboard loads cached results instantly
- [ ] Works offline (shows last cached scan)

## Dependencies

- **Existing tools**: knip, eslint, vue-tsc, vitest (all installed)
- **Existing infra**: Chart.js in dev-manager, design tokens
- **No new dependencies required**

## Risk Analysis

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scan takes too long | Medium | Add quick scan option, background processing |
| False positives in dead code | Medium | Allow ignore patterns in config |
| Metrics inconsistent with CI | Low | Use same commands as CI workflow |

## Verification

After implementation:
1. Start dev-manager: `npm run dev:manager`
2. Navigate to Health tab
3. Click "Scan" button
4. Verify all 8 metrics populate correctly
5. Introduce a TypeScript error → verify it appears
6. Fix the error → verify count decreases

## References

### Internal Files
- `dev-manager/server.js` - Express server to extend
- `dev-manager/stats/index.html` - Similar dashboard pattern
- `.github/workflows/ci.yml` - CI commands to mirror
- `eslint.config.js` - ESLint configuration
- `vitest.config.ts` - Test configuration

### External Docs
- [Knip Documentation](https://knip.dev/)
- [ESLint JSON Formatter](https://eslint.org/docs/latest/use/formatters/)
- [Chart.js Doughnut Charts](https://www.chartjs.org/docs/latest/charts/doughnut.html)

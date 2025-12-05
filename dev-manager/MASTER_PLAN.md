# Dev Manager - Master Plan

**Last Updated**: December 5, 2025

## Overview

Dev Manager is a unified development dashboard for Pomo-Flow that consolidates three key developer tools into a single tabbed interface. It runs on port 6010 and provides visual management of tasks, skills, and documentation.

```bash
npm run dev:manager  # Start at http://localhost:6010
```

## Architecture

```
dev-manager/
├── index.html           # Main tabbed interface
├── README.md            # Quick reference
├── MASTER_PLAN.md       # This file
├── kanban/              # Task management
│   ├── index.html       # Kanban board UI
│   ├── kanban.md        # Task data (markdown)
│   ├── ideas.md         # Feature ideas
│   └── roadmap.md       # Project roadmap
├── skills/              # Skills visualization
│   ├── index.html       # Force-graph visualization
│   └── graph-data.json  # Generated skill data
└── docs/                # Documentation graph
    ├── index.html       # Force-graph visualization
    └── graph-data.json  # Generated doc data
```

## Tabs

### 1. Kanban (📋)

**Purpose**: Track development tasks across views (My Tasks, Ideas, Roadmap, Archive, Status)

**Views**:
| View | Source | Description |
|------|--------|-------------|
| My Tasks | `kanban.md` | Active development tasks by lane |
| Ideas | `ideas.md` | Feature ideas with priority tags |
| Roadmap | `roadmap.md` | Sprint planning and milestones |
| Archive | `kanban.md` | Completed/archived tasks |
| Status | Generated | Summary statistics |

**Markdown Format** (`kanban.md`):
```markdown
## Backlog
### TASK-001 | Task Title
**Priority**: HIGH | MEDIUM | LOW
**Tags**: #frontend #bug
Task description here.

## In Progress
### TASK-002 | Another Task
...
```

**Features**:
- Drag-and-drop between lanes (Backlog, In Progress, Review, Done, Blocked)
- Color-coded priority badges
- Tag filtering
- GPU-accelerated rendering for smooth scrolling

### 2. Skills (🎯)

**Purpose**: Visualize 69+ Claude Code skills with usage-based sizing

**Data Source**: Generated from `.claude/skills/*/SKILL.md`

**Generate Data**:
```bash
npm run skills:graph
```

**Features**:
- Force-directed graph layout (D3.js + force-graph)
- Node sizes based on usage data (larger = more used)
- Color-coded categories:
  - 🐛 Debugging (red)
  - 💻 Development (green)
  - 🏗️ Architecture (blue)
  - ⚙️ Operations (amber)
  - 📚 Documentation (purple)
  - 🧪 Testing (cyan)
  - 💾 Data (pink)
  - 🔧 Other (gray)
- Hover for full skill name
- Click for detail panel with path and description
- Search to highlight matching skills
- Zoom controls (+/-/fit)

**Usage Data**:
Currently simulated in `index.html`. Can be connected to `.claude/logs/skill-metrics.json` when more data is collected.

### 3. Docs (📚)

**Purpose**: Visualize documentation structure from `/docs` folder

**Data Source**: Generated from `docs/**/*.md`

**Generate Data**:
```bash
npm run docs:graph
```

**Features**:
- Force-directed graph with category clustering
- "Hide archived" toggle (filters `docs/archive/*`)
- Category emojis inside nodes
- Hover for full document title
- Click for detail panel with path
- Search to highlight matching docs

**Categories**:
- 📊 Reports
- ⚔️ Conflict Resolution
- 📦 Archive
- 🐛 Debug
- 📖 Guides
- 📋 Planning
- 📚 Reference

## Technical Details

### Force Graph Configuration

Both Skills and Docs graphs use similar D3 force configurations:

```javascript
// Charge: Repulsion strength
graph.d3Force('charge', d3.forceManyBody().strength(-400));

// Links: Distance between connected nodes
graph.d3Force('link').distance(120);

// Collision: Prevents node overlap
graph.d3Force('collide', d3.forceCollide().radius(node => size + 50));

// Radial: Spreads nodes outward from center
graph.d3Force('radial', d3.forceRadial(350, 0, 0));
```

### Label Strategy

To prevent text overlap while showing all labels:
1. Labels always visible but truncated (11-14 chars)
2. Hover shows full name with dark background
3. Category labels always show full name
4. Strong collision detection ensures spacing

### Tab Persistence

Selected tab is saved to `localStorage` as `dev-manager-tab` and restored on reload.

## Integration Points

| Command | Port | Purpose |
|---------|------|---------|
| `npm run dev` | 5546 | Main Pomo-Flow app |
| `npm run dev:manager` | 6010 | This dashboard |
| `npm run storybook` | 6006 | Component library |

## Future Enhancements

### Planned
- [ ] Connect skills usage to real telemetry data
- [ ] Add skill dependency arrows
- [ ] Kanban: Sync with GitHub Issues
- [ ] Docs: Show document content preview

### Ideas
- [ ] Skills: Filter by category
- [ ] Docs: Show last modified date
- [ ] Kanban: Time tracking integration
- [ ] Add keyboard shortcuts (1/2/3 for tabs)

## Maintenance

### Regenerate Graph Data
```bash
npm run skills:graph  # Regenerate skills graph
npm run docs:graph    # Regenerate docs graph
```

### Update Kanban
Edit markdown files directly:
- `dev-manager/kanban/kanban.md` - Tasks
- `dev-manager/kanban/ideas.md` - Ideas
- `dev-manager/kanban/roadmap.md` - Roadmap

## History

| Date | Change |
|------|--------|
| Dec 5, 2025 | Added usage-based node sizing, always-visible labels |
| Dec 5, 2025 | Restored from commit `5d3b9c3` (Nov 23, 2025) |
| Nov 23, 2025 | Initial unified dashboard created |

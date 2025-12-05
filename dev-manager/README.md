# Dev Manager

Unified development management dashboard for Pomo-Flow with tabbed interface.

## Quick Start

```bash
npm run dev:manager
# Open http://localhost:6010
```

All three services run in a single tabbed interface - no need to open multiple ports.

## Tabs

| Tab | Description |
|-----|-------------|
| **Kanban** | Development task tracking (Frontend, Backend, Database, DevOps, Design) |
| **Skills** | 80+ Claude Code skills with analytics and relationship mapping |
| **Docs** | Interactive 347-node documentation canvas with search |

## Features

- Single command starts everything
- Tab selection persists across sessions
- Each service runs in isolated iframe (no CSS/JS conflicts)
- Dark theme matching Pomo-Flow

## Related

```bash
npm run dev          # Main Pomo-Flow app (port 5546)
npm run storybook    # Component library (port 6006)
```

## History

Restored from commit `5d3b9c3` (Nov 23, 2025) on Dec 5, 2025.

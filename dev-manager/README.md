# Flow State

Development dashboard with Kanban board, Health scanning, Skills visualization, and multi-agent orchestration for tracking tasks via MASTER_PLAN.md.

## Installation (Standalone)

Install Flow State on any system with one command:

```bash
curl -sSL https://raw.githubusercontent.com/endlessblink/flow-state/main/install.sh | bash
```

This installs to `~/.flow-state/`. To customize the location:

```bash
export FLOW_STATE_DIR=/path/to/install
curl -sSL https://raw.githubusercontent.com/endlessblink/flow-state/main/install.sh | bash
```

## Updating

Run the same install command to update to the latest version:

```bash
curl -sSL https://raw.githubusercontent.com/endlessblink/flow-state/main/install.sh | bash
```

Or manually:

```bash
cd ~/.flow-state
git pull origin main
npm install
```

## Starting the Server

```bash
cd ~/.flow-state
npm start
# Open http://localhost:6010
```

Or with install + start:

```bash
curl -sSL https://raw.githubusercontent.com/endlessblink/flow-state/main/install.sh | bash -s -- --start
```

## Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `6010` | Server port |
| `MASTER_PLAN_PATH` | `../docs/MASTER_PLAN.md` | Path to your MASTER_PLAN.md file |

**Using with any project:**

```bash
# In your .env file:
MASTER_PLAN_PATH=/path/to/your/project/docs/MASTER_PLAN.md
```

## Tabs

| Tab | Description |
|-----|-------------|
| **Kanban** | Development task tracking parsed from MASTER_PLAN.md |
| **Health** | Code quality scanning (TypeScript, ESLint, npm audit, etc.) |
| **Skills** | Claude Code skills with analytics and relationship mapping |
| **Docs** | Interactive documentation canvas with search |
| **Timeline** | Development timeline view |
| **Stats** | Project statistics |

## Features

- Live sync: Changes to MASTER_PLAN.md auto-refresh the UI
- Drag-and-drop task status updates
- Health scanning with 8+ code quality metrics
- Beads workflow for multi-agent orchestration
- Dark theme
- Tab selection persists across sessions

## Shell Alias (Optional)

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias flow-state='cd ~/.flow-state && node server.js'
```

Then just run `flow-state` from anywhere.

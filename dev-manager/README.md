# Dev Manager

Unified development management dashboard with Kanban board for tracking tasks via MASTER_PLAN.md.

## Installation (Standalone)

Install dev-manager on any system with one command:

```bash
curl -sSL https://raw.githubusercontent.com/endlessblink/pomo-flow/master/dev-manager/install.sh | bash
```

This installs to `~/.dev-manager/`. To customize the location:

```bash
export DEV_MANAGER_DIR=/path/to/install
curl -sSL https://raw.githubusercontent.com/endlessblink/pomo-flow/master/dev-manager/install.sh | bash
```

## Updating

Run the same install command to update to the latest version:

```bash
curl -sSL https://raw.githubusercontent.com/endlessblink/pomo-flow/master/dev-manager/install.sh | bash
```

Or manually:

```bash
cd ~/.dev-manager
git pull origin master
cd dev-manager && npm install
```

## Starting the Server

```bash
cd ~/.dev-manager/dev-manager
npm start
# Open http://localhost:6010
```

Or with install + start:

```bash
curl -sSL https://raw.githubusercontent.com/endlessblink/pomo-flow/master/dev-manager/install.sh | bash -s -- --start
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

**Using with your own project:**

```bash
# In your .env file:
MASTER_PLAN_PATH=/path/to/your/project/docs/MASTER_PLAN.md
```

## Usage within Pomo-Flow

If you cloned the full pomo-flow repo:

```bash
npm run dev:manager
# Open http://localhost:6010
```

## Tabs

| Tab | Description |
|-----|-------------|
| **Kanban** | Development task tracking parsed from MASTER_PLAN.md |
| **Skills** | Claude Code skills with analytics and relationship mapping |
| **Docs** | Interactive documentation canvas with search |
| **Timeline** | Development timeline view |
| **Stats** | Project statistics |

## Features

- Live sync: Changes to MASTER_PLAN.md auto-refresh the UI
- Drag-and-drop task status updates
- Dark theme
- Tab selection persists across sessions

## Shell Alias (Optional)

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias dev-manager='cd ~/.dev-manager/dev-manager && node server.js'
```

Then just run `dev-manager` from anywhere.

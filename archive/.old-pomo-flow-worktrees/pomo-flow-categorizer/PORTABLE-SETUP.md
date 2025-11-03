# Portable Claude Code Skill Monitoring System

This guide shows how to use the skill monitoring system from any folder or in different projects.

## Quick Start

### Option 1: Install in Any Project (Recommended)

1. **Install the system in your target project:**
   ```bash
   # Navigate to your target Claude Code project
   cd /path/to/your/project

   # Run the portable installer from this project
   node "/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/portable-skill-monitor.js"
   ```

2. **Start monitoring in your target project:**
   ```bash
   npm run skill-logs:start
   ```

### Option 2: Run from Source Project

1. **Run directly from the source project:**
   ```bash
   cd "/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow"
   node start-skill-monitoring-simple.js
   ```

## What Gets Installed

When you run the portable installer, it copies these files to your target project:

```
.your-project/
├── .claude/
│   ├── hooks/
│   │   └── skill-logger.sh          # Hook script for logging
│   └── mcp-logging-server/
│       ├── server.js                # MCP server
│       └── package.json             # Server dependencies
├── mcp-dashboard.html               # Real-time dashboard
├── start-skill-monitoring-simple.js # Main launcher
├── start-dashboard-server.js        # HTTP server for dashboard
├── simple-skill-monitor.js          # Terminal monitor
└── package.json                     # Updated with new scripts
```

## Available Commands

After installation, your target project will have these npm scripts:

```bash
npm run skill-logs:start      # Start complete monitoring system (recommended)
npm run skill-logs:server    # Start MCP server only (port 6777)
npm run skill-logs:dashboard # Start dashboard server only (port 8080)
npm run skill-logs:monitor   # Start terminal monitor only
```

## Configuration

### Hook Configuration (Required for automatic logging)

Add this to your target project's `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": {
      "command": ".claude/hooks/skill-logger.sh pre",
      "enabled": true
    },
    "PostToolUse": {
      "command": ".claude/hooks/skill-logger.sh post",
      "enabled": true
    }
  }
}
```

### Port Configuration

- **MCP Server**: Port 6777 (WebSocket + HTTP API)
- **Dashboard HTTP Server**: Port 8080 (clickable URL)
- **Terminal Monitor**: Uses MCP server connection

## Accessing the Dashboard

Once the system is running, you can access:

- **Clickable URL**: http://localhost:8080
- **Direct file**: file:///path/to/your/project/mcp-dashboard.html
- **MCP API**: http://localhost:6777
- **WebSocket**: ws://localhost:6777

## Features

- ✅ **Automatic skill usage logging** via Claude Code hooks
- ✅ **Real-time dashboard** with WebSocket updates
- ✅ **Terminal monitoring** with live updates
- ✅ **Click-to-open dashboard** URLs
- ✅ **Session tracking** and metrics
- ✅ **Cross-project compatibility**
- ✅ **Portable installation** system

## System Requirements

- Node.js (for server components)
- Claude Code project with `.claude` directory
- Ports 6777 and 8080 available (or change them in the files)

## Troubleshooting

### "Command not found" errors
- Make sure Node.js is installed and in your PATH
- Run `npm install` in the target project if needed

### Port conflicts
- Change ports in the server files:
  - MCP server: `.claude/mcp-logging-server/server.js` (line 391)
  - Dashboard server: `start-dashboard-server.js` (line 11)

### Hooks not triggering
- Verify `.claude/settings.local.json` exists and has the correct hook configuration
- Ensure the hook script is executable: `chmod +x .claude/hooks/skill-logger.sh`

### Dashboard not loading
- Check that both servers are running
- Verify WebSocket connection to port 6777
- Check browser console for connection errors

## Example Usage

1. **Install in a new project:**
   ```bash
   cd ~/my-new-project
   node "/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/portable-skill-monitor.js"
   ```

2. **Configure hooks:**
   ```bash
   # Create .claude/settings.local.json with hook configuration
   # (See Configuration section above)
   ```

3. **Start monitoring:**
   ```bash
   npm run skill-logs:start
   ```

4. **Access dashboard:**
   - Click the http://localhost:8080 URL in terminal
   - Or open the file directly

5. **Use Claude Code normally:**
   - Skills will be logged automatically
   - Dashboard shows real-time usage
   - Terminal shows live updates

## File Locations

- **Source project**: `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/`
- **Target project**: Any folder with a `.claude` directory
- **Installed files**: Copied to target project `.claude/` and root directory
- **Logs**: Stored in `.claude/logs/` (auto-created)
- **Dashboard**: Available at both file:// and http:// URLs
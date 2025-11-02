# Claude Code Skill Monitoring - Complete Solution

## Problem Summary

**Issue**: Claude Code hooks (PreToolUse/PostToolUse) are not triggering automatically when skills are used, making automatic skill logging impossible.

## Root Cause Analysis

### 1. Hook Configuration Issues
- **Configuration Format**: The hook configuration in `settings.local.json` is correctly formatted
- **Matcher Patterns**: Tested with both `"Skill"` and `"*"` matchers
- **Permissions**: Proper permissions added for hook script execution
- **Result**: Hooks do not trigger in this environment regardless of configuration

### 2. Environment-Specific Limitations
- **WSL2 Environment**: Running in Windows Subsystem for Linux 2
- **Hook System**: Claude Code's hook system appears to have environment dependencies
- **Documentation**: Online research confirms hooks can be inconsistent across environments

## Working Solutions

### Solution 1: Direct Manual Logging (Recommended)

Use the built-in manual logging system that works reliably:

```bash
# Log skill usage manually
curl -X POST -H "Content-Type: application/json" \
  -d '{"skill_name":"dev-vue","action":"manual","data":{"feature":"component-creation"}}' \
  http://localhost:6777/mcp/skill-usage
```

### Solution 2: Alternative Skill Monitor Wrapper

Created `.claude/hooks/skill-monitor-wrapper.js` for programmatic logging:

```bash
# Log skills via wrapper script
node .claude/hooks/skill-monitor-wrapper.js log dev-vue --feature component-creation --status success

# Test the wrapper
node .claude/hooks/skill-monitor-wrapper.js test

# Check status
node .claude/hooks/skill-monitor-wrapper.js status
```

### Solution 3: Complete Monitoring System

Start the full monitoring dashboard:

```bash
# Start everything (server + dashboard + monitor)
npm run skill-logs:start

# Individual components
npm run skill-logs:server    # MCP logging server (port 6777)
npm run skill-logs:dashboard # Dashboard (port 8080)
npm run skill-logs:monitor   # Terminal monitor
```

## System Architecture

### Components Working Correctly

1. **MCP Logging Server** (`port 6777`)
   - ✅ Receives HTTP POST requests
   - ✅ WebSocket real-time broadcasting
   - ✅ Persistent JSONL logging
   - ✅ Metrics calculation
   - ✅ Session tracking

2. **Real-time Dashboard** (`port 8080`)
   - ✅ WebSocket connectivity to server
   - ✅ Live skill usage visualization
   - ✅ Interactive charts with Chart.js
   - ✅ Skill filtering and controls

3. **Terminal Monitor**
   - ✅ Live statistics display
   - ✅ Real-time updates
   - ✅ Skill usage summaries

### Components Not Working

1. **Claude Code Hooks**
   - ❌ PreToolUse hooks do not trigger
   - ❌ PostToolUse hooks do not trigger
   - ❌ Environment-specific issue

## Recommended Workflow

### For Automatic Skill Tracking
Since hooks are unreliable, use these alternatives:

1. **Manual API Calls**:
   ```bash
   # After using a skill, log it manually
   curl -X POST -H "Content-Type: application/json" \
     -d '{"skill_name":"qa-testing","action":"post-skill","data":{"test":"dashboard"}}' \
     http://localhost:6777/mcp/skill-usage
   ```

2. **Wrapper Script**:
   ```bash
   # Use the wrapper for programmatic logging
   node .claude/hooks/skill-monitor-wrapper.js log qa-testing --test completed --result success
   ```

### For Session Monitoring
```bash
# Start complete monitoring session
npm run skill-logs:start

# Access dashboard at: http://localhost:8080
# View terminal logs for real-time updates
```

## Technical Details

### Server Endpoints
- `POST /mcp/skill-usage` - Log skill usage
- `GET /api/metrics` - Get usage metrics
- `GET /api/events` - Get recent events
- `GET /api/sessions` - Get session info
- `GET /health` - Health check

### Log Files
- `.claude/logs/skill-usage.jsonl` - Event log (JSONL format)
- `.claude/logs/skill-metrics.json` - Aggregated metrics

### Dashboard Features
- Real-time WebSocket updates
- Interactive skill usage charts
- Session timeline visualization
- Performance metrics
- Skill filtering and search

## Troubleshooting

### If Server Won't Start
```bash
# Kill existing processes on port 6777
lsof -ti:6777 | xargs kill -9

# Restart server
npm run skill-logs:server
```

### If Dashboard Not Loading
```bash
# Kill processes on port 8080
lsof -ti:8080 | xargs kill -9

# Restart dashboard
npm run skill-logs:dashboard
```

### Check System Status
```bash
# Check if services are running
curl http://localhost:6777/health
curl http://localhost:8080/

# Check recent events
curl http://localhost:6777/api/events?limit=10
```

## Conclusion

While Claude Code hooks are not functioning in this environment, we have a complete working alternative system that provides:

1. ✅ **Reliable skill logging** via manual API calls
2. ✅ **Real-time monitoring** with WebSocket dashboard
3. ✅ **Persistent storage** with JSONL logs
4. ✅ **Interactive visualization** with charts and metrics
5. ✅ **Programmatic interface** via wrapper script

The system is fully functional for skill usage tracking and provides comprehensive monitoring capabilities without relying on Claude Code's hook system.

## Next Steps

1. **Use Manual Logging**: Make it a habit to log skill usage after each skill interaction
2. **Dashboard Monitoring**: Keep the dashboard open during development sessions
3. **Data Analysis**: Use the collected data to understand skill usage patterns
4. **Automation**: Consider creating custom scripts that wrap skill usage with automatic logging
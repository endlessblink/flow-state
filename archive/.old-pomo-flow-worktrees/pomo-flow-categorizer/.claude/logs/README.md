# Log Management System

## Overview

This directory contains the skill usage logging system with automatic log rotation to prevent unbounded growth while preserving historical data.

## Files

- **skill-usage.jsonl** - Active log file (automatically rotated when it reaches 100 entries)
- **skill-usage.jsonl.archive** - Manual archive of previous test data
- **skill-usage.jsonl.backup** - Backup file (preserved)
- **archives/** - Rotated log archives (created automatically)
- **log-rotation.cjs** - Log rotation utility module
- **test-rotation.cjs** - Test suite for log rotation

## Log Rotation System

### Automatic Rotation

The MCP logging server automatically checks and rotates logs:

- **On Startup** - Checks if rotation is needed when server starts
- **Hourly** - Periodic checks every 60 minutes
- **Threshold** - Rotates when log exceeds 100 entries
- **Archive Retention** - Keeps last 3 archives, deletes older ones

### Manual Rotation

You can manually trigger log rotation via the API:

```bash
# Get log statistics
curl http://localhost:3001/api/logs/stats

# Manually rotate logs
curl -X POST http://localhost:3001/api/logs/rotate
```

### Archive Naming

Archives are named with timestamps:
- `skill-usage-YYYY-MM-DD.jsonl` - First rotation of the day
- `skill-usage-YYYY-MM-DD-1.jsonl` - Subsequent rotations on same day

## Configuration

Default settings (can be customized in server.js):

```javascript
{
  maxEntries: 100,        // Rotate after this many entries
  keepArchives: 3,        // Keep last N archives
  archiveDir: '.claude/logs/archives'
}
```

## Testing

Run the test suite to verify log rotation:

```bash
cd .claude/logs
node test-rotation.cjs
```

Expected output:
- ✅ Rotation check detection
- ✅ Log file rotation
- ✅ Statistics calculation
- ✅ Archive cleanup (keeps max 3 archives)

## API Endpoints

### Get Log Statistics

```bash
GET http://localhost:3001/api/logs/stats
```

Response:
```json
{
  "activeLog": {
    "path": "/path/to/skill-usage.jsonl",
    "exists": true,
    "lineCount": 42,
    "size": 5120
  },
  "archives": [
    {
      "name": "skill-usage-2025-10-24.jsonl",
      "lineCount": 100,
      "size": 12288,
      "modified": "2025-10-24T12:00:00.000Z"
    }
  ],
  "totalEntries": 142,
  "rotationNeeded": false
}
```

### Manual Rotation

```bash
POST http://localhost:3001/api/logs/rotate
```

Response:
```json
{
  "success": true,
  "rotated": true,
  "lineCount": 105,
  "archivePath": "/path/to/archives/skill-usage-2025-10-24.jsonl",
  "deletedArchives": [],
  "message": "Rotated 105 entries to skill-usage-2025-10-24.jsonl"
}
```

## Benefits

1. **Performance** - Active log stays small and fast
2. **Automatic Maintenance** - No manual cleanup needed
3. **History Preservation** - Old logs archived, not deleted
4. **Configurable** - Adjust thresholds and retention as needed
5. **Production-Ready** - Industry standard log rotation approach

## Troubleshooting

### Archives not being created

Check that:
1. MCP logging server is running
2. Archives directory has write permissions
3. Log rotation check runs successfully on startup

### Too many archives

Adjust `keepArchives` setting in server.js to keep more or fewer archives.

### Rotation not triggering

Check:
1. Current entry count: `curl http://localhost:3001/api/logs/stats`
2. Server logs for rotation messages
3. Manually trigger: `curl -X POST http://localhost:3001/api/logs/rotate`

## Example Usage

```bash
# Check current status
curl http://localhost:3001/api/logs/stats | jq

# Manually rotate if needed
curl -X POST http://localhost:3001/api/logs/rotate | jq

# View recent events (not affected by rotation)
curl http://localhost:3001/api/events?limit=20 | jq
```

## Development

To modify rotation behavior:

1. Edit `log-rotation.cjs` for core logic
2. Edit `server.js` checkAndRotateLogs() for integration
3. Run tests: `node test-rotation.cjs`
4. Restart MCP server to apply changes

---

**Last Updated**: October 24, 2025
**Version**: 1.0

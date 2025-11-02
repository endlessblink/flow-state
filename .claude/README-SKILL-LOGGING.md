# Claude Code Skill Usage Logging System

A comprehensive logging and monitoring system for tracking Claude Code skill usage with real-time analytics and visualizations.

## 🚀 Features

### Core Logging
- **Automatic Skill Tracking**: Logs every skill invocation with timestamps and parameters
- **Performance Metrics**: Tracks execution time and success/failure rates
- **Session Management**: Groups skill usage by Claude Code sessions
- **Error Tracking**: Detailed error logging with stack traces
- **Configurable Logging**: Adjustable log levels and retention policies

### Analysis & Insights
- **Usage Patterns**: Analyze when and how skills are used
- **Performance Reports**: Track success rates and average execution times
- **Trend Analysis**: Identify usage trends over time
- **Error Analysis**: Track and analyze common failure patterns
- **Export Capabilities**: Export data for external analysis

### Visual Dashboard
- **Real-time Monitoring**: Live dashboard with charts and metrics
- **Interactive Charts**: Usage trends, hourly distribution, skill performance
- **Recent Activity**: View latest skill invocations
- **Export Functionality**: Download analysis reports

## 📁 File Structure

```
.claude/
├── skill-logger.js          # Core logging functionality
├── skill-wrapper.js         # Skill execution wrapper
├── config/
│   └── logging.json         # Logging configuration
├── utils/
│   └── log-analyzer.js      # Analysis utilities
├── logs/                    # Log files directory
│   ├── skill-usage-*.log   # Daily log files
│   └── skill-metrics.json  # Aggregated metrics
└── README-SKILL-LOGGING.md  # This documentation

skill-usage-dashboard.html   # Visual dashboard
```

## 🛠️ Installation & Setup

### 1. Configuration
The system is pre-configured with sensible defaults. Edit `.claude/config/logging.json` to customize:

```json
{
  "level": "INFO",
  "maxLogFiles": 10,
  "maxLogSize": "10MB",
  "enableMetrics": true,
  "enablePerformanceTracking": true,
  "retentionDays": 30,
  "trackSessions": true,
  "sanitizeParameters": true
}
```

### 2. Manual Skill Logging
To manually log skill usage when skills are invoked:

```javascript
import { SkillLogger } from './.claude/skill-logger.js';

const logger = new SkillLogger();
await logger.init();

await logger.logSkillUsage(
  'skill-name',           // Skill identifier
  { param1: 'value' },    // Parameters (will be sanitized)
  'success',              // Outcome: 'success', 'error', 'timeout'
  1250,                   // Duration in milliseconds (optional)
  null                    // Error object (if failed)
);
```

## 📊 Usage

### NPM Scripts
The system provides convenient npm scripts:

```bash
# View recent logs
npm run skill-logs:recent

# View skill metrics
npm run skill-logs:metrics

# Analyze usage patterns
npm run skill-logs:analyze

# Generate performance report
npm run skill-logs:performance

# Export data (JSON format, 7 days)
npm run skill-logs:export

# Clean old logs
npm run skill-logs:cleanup

# Launch visual dashboard
npm run skill-dashboard
```

### Direct CLI Usage

#### Skill Logger
```bash
# Test the logger
node .claude/skill-logger.js test

# View recent logs (limit 10, optional skill filter)
node .claude/skill-logger.js recent [skill-name] [limit]

# View metrics
node .claude/skill-logger.js metrics

# Clean old logs
node .claude/skill-logger.js cleanup
```

#### Log Analyzer
```bash
# Analyze usage patterns (default 7 days)
node .claude/utils/log-analyzer.js patterns [days]

# Generate performance report
node .claude/utils/log-analyzer.js performance

# Export analysis (format: json/csv, days: number)
node .claude/utils/log-analyzer.js export json 7
```

## 📈 Visual Dashboard

### Starting the Dashboard
```bash
npm run skill-dashboard
```

The dashboard runs on `http://localhost:5547` and provides:

- **Real-time Statistics**: Total calls, active skills, success rate, average duration
- **Usage Charts**: Top skills, hourly distribution, daily trends
- **Performance Metrics**: Success rates by skill
- **Recent Activity**: Live feed of skill invocations
- **Data Export**: Download analysis reports

### Dashboard Features
- **Time Range Selection**: View data for last 24 hours, 7 days, or 30 days
- **Auto-refresh**: Configurable refresh intervals (manual, 5s, 10s, 30s)
- **Interactive Charts**: Click to drill down into specific data points
- **Responsive Design**: Works on desktop and mobile devices

## 🔧 Advanced Configuration

### Skill-specific Settings
Configure logging behavior per skill in `logging.json`:

```json
{
  "skills": {
    "qa-testing": {
      "enabled": true,
      "trackDuration": true,
      "trackParameters": true
    },
    "ops-port-manager": {
      "enabled": true,
      "trackDuration": true,
      "trackParameters": false
    }
  }
}
```

### Log Levels
- **DEBUG**: Verbose logging with all details
- **INFO**: Standard logging (default)
- **WARN**: Only warnings and errors
- **ERROR**: Only errors

### Data Sanitization
The system automatically sanitizes sensitive parameters:
- Passwords, tokens, keys, secrets are replaced with `[REDACTED]`
- Customizable via the `sanitizeParameters` configuration option

## 📊 Data Formats

### Log Entry Format
```json
{
  "timestamp": "2025-10-22T17:45:00.000Z",
  "sessionId": "session_1729643100000_abc123",
  "skillName": "qa-testing",
  "parameters": { "test": true },
  "outcome": "success",
  "duration": 1500,
  "error": null,
  "metadata": {
    "nodeVersion": "v22.18.0",
    "platform": "linux",
    "cwd": "/path/to/project"
  }
}
```

### Metrics Format
```json
{
  "qa-testing": {
    "totalCalls": 25,
    "successfulCalls": 23,
    "failedCalls": 2,
    "totalDuration": 37500,
    "averageDuration": 1630,
    "lastUsed": "2025-10-22T17:45:00.000Z",
    "firstUsed": "2025-10-15T10:30:00.000Z"
  }
}
```

## 🐛 Troubleshooting

### Common Issues

1. **"Cannot find module" error**
   - Ensure you're running from the project root directory
   - Check that all files exist in `.claude/` directory

2. **Permission errors**
   - Ensure write permissions to `.claude/logs/` directory
   - Check file system permissions

3. **No logs appearing**
   - Verify skills are being invoked with the logger
   - Check log level configuration
   - Ensure `enableMetrics` is set to `true`

### Debug Mode
Enable debug logging by setting the level to "DEBUG" in the configuration:

```json
{
  "level": "DEBUG",
  "enableConsoleOutput": true
}
```

## 🔄 Integration with Claude Code

### Automatic Integration
To automatically track all skill usage, modify your Claude Code skills to include the logger:

```javascript
// At the beginning of each skill
import { SkillLogger } from './.claude/skill-logger.js';

const logger = new SkillLogger();
await logger.init();

// Log skill invocation
const startTime = Date.now();
try {
  // Your skill logic here
  await logger.logSkillUsage('skill-name', parameters, 'success', Date.now() - startTime);
} catch (error) {
  await logger.logSkillUsage('skill-name', parameters, 'error', Date.now() - startTime, error);
  throw error;
}
```

### Skill Wrapper
Use the provided skill wrapper for automatic logging:

```javascript
import { SkillWrapper } from './.claude/skill-wrapper.js';

const wrapper = new SkillWrapper();
await wrapper.executeSkill('qa-testing', args);
```

## 📈 Performance Considerations

- **Log Rotation**: Automatic cleanup of old logs based on retention policy
- **Memory Usage**: Logs are written immediately to minimize memory impact
- **Performance Overhead**: < 5ms additional overhead per skill invocation
- **Storage**: Approx. 1KB per skill invocation (varies with parameters)

## 🤝 Contributing

To extend the logging system:

1. **Add new metrics**: Modify `LogAnalyzer` class
2. **New chart types**: Update the dashboard HTML
3. **Export formats**: Add new export options in `log-analyzer.js`
4. **Configuration options**: Extend the logging configuration schema

## 📄 License

This skill logging system is part of the pomo-flow project and follows the same MIT license.
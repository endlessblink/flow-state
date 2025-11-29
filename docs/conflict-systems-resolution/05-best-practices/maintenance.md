# Maintenance

Ongoing maintenance procedures for the conflict resolution system.

## Regular Maintenance Tasks

### Daily

| Task | Description | Automation |
|------|-------------|------------|
| Monitor error rates | Check for spikes in conflict errors | Alerting |
| Review pending conflicts | Check queue size | Dashboard |
| Check sync health | Verify replication active | Health check |

### Weekly

| Task | Description | Automation |
|------|-------------|------------|
| Review metrics | Analyze resolution patterns | Report |
| Clear resolved conflicts | Compact database | Cron job |
| Check logs | Look for warnings/errors | Log aggregation |
| Update documentation | Reflect any changes | Manual |

### Monthly

| Task | Description | Automation |
|------|-------------|------------|
| Performance review | Analyze p95 response times | Dashboard |
| Storage audit | Check database size growth | Alerting |
| Security review | Audit access patterns | Manual |
| Dependency updates | Check for updates | Dependabot |

---

## Database Maintenance

### Compaction

Regular compaction prevents database bloat:

```typescript
// Schedule compaction
async function scheduledCompaction() {
  console.log('Starting database compaction...')

  try {
    await db.compact()
    console.log('Compaction complete')
  } catch (error) {
    console.error('Compaction failed:', error)
    Sentry.captureException(error)
  }
}

// Run weekly
cron.schedule('0 3 * * 0', scheduledCompaction) // 3 AM Sunday
```

### Cleanup Old Conflicts

Remove stale conflict data:

```typescript
async function cleanupOldConflicts(maxAgeDays: number = 30) {
  const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000)

  const result = await db.query('conflicts/by_date', {
    endkey: cutoff,
    include_docs: true
  })

  for (const row of result.rows) {
    if (row.doc.resolved) {
      await db.remove(row.doc)
    }
  }

  console.log(`Cleaned up ${result.rows.length} old conflicts`)
}
```

### Index Maintenance

Ensure indexes are optimal:

```typescript
// Check index health
async function checkIndexes() {
  const info = await db.info()
  const indexes = await db.getIndexes()

  return {
    docCount: info.doc_count,
    diskSize: info.disk_size,
    indexes: indexes.indexes.map(i => ({
      name: i.name,
      fields: i.def.fields
    }))
  }
}

// Rebuild if needed
async function rebuildIndex(indexName: string) {
  const index = await db.getIndexes()
    .then(r => r.indexes.find(i => i.name === indexName))

  if (index) {
    await db.deleteIndex(index)
    await db.createIndex({ index: index.def })
  }
}
```

---

## Performance Monitoring

### Key Metrics

```typescript
// src/monitoring/conflictMetrics.ts
class ConflictMetrics {
  private metrics = {
    detectionTime: new Histogram('conflict_detection_ms'),
    resolutionTime: new Histogram('conflict_resolution_ms'),
    queueSize: new Gauge('conflict_queue_size'),
    errorRate: new Counter('conflict_errors_total'),
    autoResolveRate: new Gauge('conflict_auto_resolve_rate')
  }

  recordDetection(durationMs: number) {
    this.metrics.detectionTime.observe(durationMs)
  }

  recordResolution(durationMs: number, wasAuto: boolean) {
    this.metrics.resolutionTime.observe(durationMs)
    // Update auto-resolve rate
  }

  recordError(errorType: string) {
    this.metrics.errorRate.inc({ type: errorType })
  }

  getStats() {
    return {
      p50Detection: this.metrics.detectionTime.percentile(50),
      p95Detection: this.metrics.detectionTime.percentile(95),
      p99Detection: this.metrics.detectionTime.percentile(99),
      p50Resolution: this.metrics.resolutionTime.percentile(50),
      p95Resolution: this.metrics.resolutionTime.percentile(95),
      errorRate: this.metrics.errorRate.rate('1m')
    }
  }
}
```

### Alerting Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: conflict-resolution
    rules:
      - alert: HighConflictErrorRate
        expr: rate(conflict_errors_total[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High conflict resolution error rate

      - alert: ConflictQueueBacklog
        expr: conflict_queue_size > 500
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Conflict queue backlog growing

      - alert: SlowConflictResolution
        expr: histogram_quantile(0.95, conflict_resolution_ms) > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Conflict resolution taking too long
```

---

## Log Management

### Log Levels

```typescript
// Configure logging
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'conflict.log' })
  ]
})

// Usage
logger.debug('Conflict detected', { documentId, type })
logger.info('Conflict resolved', { documentId, strategy, duration })
logger.warn('Auto-resolution failed, falling back to manual', { documentId })
logger.error('Resolution error', { documentId, error })
```

### Log Rotation

```bash
# /etc/logrotate.d/pomo-flow
/var/log/pomo-flow/conflict.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    postrotate
        systemctl reload pomo-flow
    endscript
}
```

### Log Analysis

```bash
# Find most common conflict types
cat conflict.log | jq -r '.type' | sort | uniq -c | sort -rn

# Find slowest resolutions
cat conflict.log | jq 'select(.duration > 1000)' | head -20

# Find error patterns
cat conflict.log | jq 'select(.level == "error") | .error' | sort | uniq -c
```

---

## Backup Procedures

### Database Backup

```bash
#!/bin/bash
# backup-couchdb.sh

BACKUP_DIR="/backups/couchdb"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="pomo-flow"

# Create backup
curl -X GET "http://localhost:5984/$DB_NAME/_all_docs?include_docs=true" \
  -H "Content-Type: application/json" \
  > "$BACKUP_DIR/${DB_NAME}_${DATE}.json"

# Compress
gzip "$BACKUP_DIR/${DB_NAME}_${DATE}.json"

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.json.gz" -mtime +30 -delete

echo "Backup complete: ${DB_NAME}_${DATE}.json.gz"
```

### Configuration Backup

```bash
#!/bin/bash
# backup-config.sh

BACKUP_DIR="/backups/config"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup config files
tar -czf "$BACKUP_DIR/config_${DATE}.tar.gz" \
  /etc/pomo-flow/*.json \
  /etc/pomo-flow/*.env

echo "Config backup complete"
```

### Restore Procedure

```bash
#!/bin/bash
# restore-couchdb.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: restore-couchdb.sh <backup-file>"
  exit 1
fi

# Decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -k "$BACKUP_FILE"
  BACKUP_FILE="${BACKUP_FILE%.gz}"
fi

# Restore
curl -X POST "http://localhost:5984/pomo-flow/_bulk_docs" \
  -H "Content-Type: application/json" \
  -d @"$BACKUP_FILE"

echo "Restore complete"
```

---

## Troubleshooting Guide

### Common Issues

#### 1. Conflicts Not Being Detected

**Symptoms**: Sync completes but no conflicts shown

**Diagnosis**:
```bash
# Check if _conflicts present
curl http://localhost:5984/pomo-flow/doc-id?conflicts=true
```

**Solutions**:
- Verify sync is using `{ conflicts: true }`
- Check detector is initialized
- Verify event listeners attached

#### 2. Resolution Hangs

**Symptoms**: Resolution never completes

**Diagnosis**:
```typescript
// Check for pending promises
console.log(resolver.getPendingOperations())
```

**Solutions**:
- Check database connectivity
- Verify no deadlocks
- Add timeout handling

#### 3. Auto-Resolution Not Working

**Symptoms**: All conflicts require manual resolution

**Diagnosis**:
```typescript
console.log(conflict.canAutoResolve, conflict.severity)
```

**Solutions**:
- Check `maxSeverity` configuration
- Verify conflict type classification
- Review auto-resolution rules

#### 4. High Memory Usage

**Symptoms**: Memory grows over time

**Diagnosis**:
```bash
# Check heap usage
node --inspect app.js
# Open chrome://inspect
```

**Solutions**:
- Clear conflict cache periodically
- Limit batch sizes
- Check for listener leaks

---

## Health Checks

### Automated Health Check

```typescript
// src/health/conflictHealth.ts
export async function checkConflictSystemHealth(): Promise<HealthReport> {
  const checks: HealthCheck[] = []

  // Check detector
  checks.push(await checkDetector())

  // Check resolver
  checks.push(await checkResolver())

  // Check database connection
  checks.push(await checkDatabase())

  // Check queue
  checks.push(await checkQueue())

  const allHealthy = checks.every(c => c.status === 'healthy')

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  }
}
```

### Health Endpoint

```typescript
// src/api/health.ts
app.get('/health/conflicts', async (req, res) => {
  const health = await checkConflictSystemHealth()

  res.status(health.status === 'healthy' ? 200 : 503)
  res.json(health)
})
```

---

## Upgrade Procedures

### Minor Version Updates

1. Review changelog
2. Run tests locally
3. Deploy to staging
4. Validate functionality
5. Deploy to production
6. Monitor for issues

### Major Version Updates

1. Review breaking changes
2. Plan migration strategy
3. Create rollback plan
4. Test thoroughly in staging
5. Schedule maintenance window
6. Backup all data
7. Deploy with feature flag
8. Gradual rollout
9. Monitor extensively
10. Remove feature flag after stable

---

## Documentation Maintenance

### Keep Updated

- [ ] README reflects current state
- [ ] API docs match implementation
- [ ] Configuration options documented
- [ ] Troubleshooting guide current
- [ ] Change log maintained

### Review Cycle

- Monthly: Check for outdated info
- Per release: Update all affected docs
- Quarterly: Full documentation audit

---

## See Also

- [Configuration](./configuration.md) - Configuration options
- [Deployment](./deployment.md) - Deployment procedures
- [Test Strategy](../04-testing-and-validation/test-strategy.md) - Testing approach

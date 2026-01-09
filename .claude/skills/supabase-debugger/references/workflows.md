# Extended Debugging Workflows

Detailed step-by-step workflows for complex debugging scenarios.

## Workflow: Debug Authentication Flow End-to-End

### Scenario
Users report intermittent login failures, session persistence issues, or unexpected logouts.

### Step 1: Capture Authentication State

```javascript
// Add comprehensive auth logging
const setupAuthDebug = () => {
  // Log initial state
  supabase.auth.getSession().then(({ data, error }) => {
    console.log('[Auth] Initial session:', data.session ? 'exists' : 'none');
    if (error) console.error('[Auth] Initial error:', error);
  });

  // Monitor all changes
  supabase.auth.onAuthStateChange((event, session) => {
    const timestamp = new Date().toISOString();
    console.log(`[Auth ${timestamp}] Event: ${event}`);
    console.log('[Auth] Session:', session ? {
      userId: session.user.id,
      email: session.user.email,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
      tokenExpiresIn: Math.floor((session.expires_at * 1000 - Date.now()) / 1000) + 's'
    } : 'none');
  });
};
```

### Step 2: Check Token Lifecycle

```javascript
// Monitor token refresh
const monitorTokenRefresh = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.warn('[Token] No active session');
    return;
  }

  const expiresAt = session.expires_at * 1000;
  const now = Date.now();
  const expiresIn = expiresAt - now;

  console.log('[Token] Status:', {
    expiresAt: new Date(expiresAt).toISOString(),
    expiresIn: Math.floor(expiresIn / 1000) + 's',
    shouldRefresh: expiresIn < 60000
  });

  if (expiresIn < 60000) {
    console.log('[Token] Attempting refresh...');
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('[Token] Refresh failed:', error.message);
    } else {
      console.log('[Token] Refreshed, new expiry:',
        new Date(data.session.expires_at * 1000).toISOString());
    }
  }
};
```

### Step 3: Verify Server-Side Auth

```sql
-- Check user in database
SELECT
  id,
  email,
  created_at,
  confirmed_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data
FROM auth.users
WHERE email = 'user@example.com';

-- Check sessions
SELECT *
FROM auth.sessions
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC
LIMIT 5;

-- Check refresh tokens
SELECT *
FROM auth.refresh_tokens
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC
LIMIT 5;
```

### Step 4: Common Issues & Fixes

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| Token expires too fast | Check `JWT_EXPIRY` config | Increase expiry in config.toml |
| Refresh fails | Check refresh token status | Clear tokens, re-authenticate |
| Session not persisted | Storage issue | Check localStorage, cookies |
| Cross-tab sync issues | Multiple instances | Use shared auth state |

---

## Workflow: Diagnose Slow Queries

### Scenario
Page loads take >2 seconds, users complain about sluggish performance.

### Step 1: Identify Slow Queries

```sql
-- Enable query tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find the culprits
SELECT
  LEFT(query, 80) as query_preview,
  calls,
  total_time::numeric(10,2) as total_ms,
  (mean_time)::numeric(10,2) as avg_ms,
  (max_time)::numeric(10,2) as max_ms,
  rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
AND mean_time > 50
ORDER BY total_time DESC
LIMIT 10;
```

### Step 2: Analyze Specific Query

```sql
-- Get full query plan
EXPLAIN (ANALYZE, BUFFERS, TIMING, COSTS, VERBOSE)
SELECT t.*, u.name as user_name
FROM tasks t
JOIN users u ON t.user_id = u.id
WHERE t.status = 'pending'
ORDER BY t.created_at DESC
LIMIT 50;

-- Key things to look for:
-- - Seq Scan (table scan - needs index)
-- - Nested Loop with high rows
-- - Sort with high memory
-- - Hash Join spillage to disk
```

### Step 3: Check Index Coverage

```sql
-- Find tables doing sequential scans
SELECT
  relname as table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  CASE WHEN idx_scan > 0
    THEN round(seq_scan::numeric / idx_scan, 2)
    ELSE seq_scan
  END as seq_to_idx_ratio
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC;

-- Suggest indexes for common patterns
SELECT
  'CREATE INDEX idx_' || t.relname || '_' || a.attname
    || ' ON ' || t.relname || '(' || a.attname || ');' as suggestion,
  t.relname as table_name,
  a.attname as column_name
FROM pg_stat_user_tables t
JOIN pg_attribute a ON a.attrelid = t.relid
WHERE t.seq_scan > t.idx_scan * 5
AND t.seq_scan > 100
AND a.attnum > 0
AND NOT a.attisdropped
AND NOT EXISTS (
  SELECT 1 FROM pg_index i
  WHERE i.indrelid = t.relid
  AND a.attnum = ANY(i.indkey)
);
```

### Step 4: Optimize Application Code

```javascript
// BEFORE: Inefficient query
const getTasks = async () => {
  const { data } = await supabase
    .from('tasks')
    .select('*');  // Fetches ALL columns

  // Client-side filtering (bad!)
  return data.filter(t => t.status === 'pending')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50);
};

// AFTER: Optimized query
const getTasks = async () => {
  const { data } = await supabase
    .from('tasks')
    .select('id, title, due_date, priority')  // Only needed columns
    .eq('status', 'pending')  // Server-side filter
    .order('created_at', { ascending: false })
    .limit(50);

  return data;
};
```

---

## Workflow: Debug Realtime Synchronization

### Scenario
Changes in database not appearing in UI, or appearing with significant delay.

### Step 1: Verify Publication Status

```sql
-- Check if table is in realtime publication
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- If missing, add it
ALTER PUBLICATION supabase_realtime ADD TABLE your_table;
```

### Step 2: Monitor Subscription Health

```javascript
// Comprehensive subscription debug
const debugSubscription = (tableName) => {
  const channel = supabase.channel(`debug-${tableName}`);

  channel
    .on('postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload) => {
        const timestamp = new Date().toISOString();
        console.log(`[Realtime ${timestamp}] Event:`, payload.eventType);
        console.log('[Realtime] Old:', payload.old);
        console.log('[Realtime] New:', payload.new);
      }
    )
    .on('system', {}, (payload) => {
      console.log('[System]', payload);
    })
    .subscribe((status, err) => {
      console.log('[Subscription] Status:', status);
      if (err) console.error('[Subscription] Error:', err);
    });

  return channel;
};

// Usage
const channel = debugSubscription('tasks');

// Cleanup
// supabase.removeChannel(channel);
```

### Step 3: Test Message Delivery

```javascript
// Broadcast test
const testBroadcast = async () => {
  const channel = supabase.channel('broadcast-test');

  let received = false;
  const timeout = setTimeout(() => {
    if (!received) {
      console.error('[Test] Message not received within 5 seconds');
    }
  }, 5000);

  channel
    .on('broadcast', { event: 'test' }, (payload) => {
      received = true;
      clearTimeout(timeout);
      const latency = Date.now() - payload.payload.sent_at;
      console.log(`[Test] Message received, latency: ${latency}ms`);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Test] Sending test message...');
        await channel.send({
          type: 'broadcast',
          event: 'test',
          payload: { sent_at: Date.now() }
        });
      }
    });
};
```

### Step 4: Check Filter Syntax

```javascript
// Common filter mistakes

// WRONG: Missing eq. prefix
.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'tasks',
  filter: 'user_id=abc123'  // Wrong!
}, handler)

// CORRECT: With eq. prefix
.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'tasks',
  filter: 'user_id=eq.abc123'  // Correct!
}, handler)

// For UUID columns
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'tasks',
  filter: `user_id=eq.${userId}`
}, handler)
```

---

## Workflow: Investigate Memory Leaks

### Scenario
Application memory grows over time, eventually becoming sluggish or crashing.

### Step 1: Baseline Memory

```javascript
// Create memory baseline
const memoryBaseline = {
  initial: performance.memory?.usedJSHeapSize || 0,
  samples: [],
  startTime: Date.now(),

  sample() {
    const current = performance.memory?.usedJSHeapSize || 0;
    this.samples.push({
      timestamp: Date.now() - this.startTime,
      memory: current,
      delta: current - this.initial
    });
  },

  report() {
    const latest = this.samples[this.samples.length - 1];
    const growth = latest.delta / 1024 / 1024;
    const rate = growth / (latest.timestamp / 1000 / 60); // MB per minute

    console.log('Memory Report:');
    console.log(`  Initial: ${(this.initial / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Current: ${(latest.memory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Growth: ${growth.toFixed(2)} MB`);
    console.log(`  Rate: ${rate.toFixed(3)} MB/min`);
  }
};

// Sample every 10 seconds
setInterval(() => memoryBaseline.sample(), 10000);

// Check report
// memoryBaseline.report();
```

### Step 2: Audit Supabase Resources

```javascript
// Count active channels
const auditChannels = () => {
  const channels = supabase.getChannels();
  console.log(`Active channels: ${channels.length}`);
  channels.forEach(ch => {
    console.log(`  - ${ch.topic} (${ch.state})`);
  });
  return channels.length;
};

// Track channel creation
const originalChannel = supabase.channel.bind(supabase);
let channelCount = 0;
supabase.channel = (name, opts) => {
  channelCount++;
  console.log(`[Channel] Created #${channelCount}: ${name}`);
  return originalChannel(name, opts);
};
```

### Step 3: Find Cleanup Issues

```javascript
// Vue 3 / Composition API proper cleanup
import { onUnmounted, ref } from 'vue';

const useTaskSubscription = () => {
  const tasks = ref([]);
  let channel = null;

  const subscribe = () => {
    channel = supabase
      .channel('tasks-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          // Handle change
        }
      )
      .subscribe();
  };

  // CRITICAL: Cleanup on component unmount
  onUnmounted(() => {
    if (channel) {
      console.log('[Cleanup] Removing channel:', channel.topic);
      supabase.removeChannel(channel);
      channel = null;
    }
  });

  return { tasks, subscribe };
};
```

### Step 4: Cleanup Orphaned Resources

```javascript
// Force cleanup of all channels
const cleanupAllChannels = () => {
  const channels = supabase.getChannels();
  console.log(`Cleaning up ${channels.length} channels...`);
  supabase.removeAllChannels();
  console.log('All channels removed');
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  cleanupAllChannels();
});
```

---

## Workflow: Production Deployment Validation

### Scenario
Preparing to deploy to production, need comprehensive validation.

### Step 1: Security Audit

```sql
-- Check RLS is enabled on all public tables
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;

-- Find tables without any policies
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename
HAVING COUNT(p.policyname) = 0;

-- Audit policy coverage
SELECT
  tablename,
  COUNT(*) as policy_count,
  array_agg(DISTINCT cmd) as operations
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

### Step 2: Performance Baseline

```sql
-- Capture query performance baseline
SELECT
  query,
  calls,
  mean_time,
  total_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_time DESC
LIMIT 50;

-- Save to file for comparison
\copy (SELECT * FROM pg_stat_statements ORDER BY total_time DESC) TO '/tmp/query_baseline.csv' CSV HEADER;
```

### Step 3: Connection Stress Test

```javascript
// Test concurrent connections
const stressTest = async (concurrency = 10) => {
  console.log(`Testing ${concurrency} concurrent connections...`);

  const promises = Array(concurrency).fill(null).map(async (_, i) => {
    const start = Date.now();
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('count')
        .limit(1);

      const duration = Date.now() - start;
      return { id: i, success: !error, duration };
    } catch (err) {
      return { id: i, success: false, error: err.message };
    }
  });

  const results = await Promise.all(promises);

  const successful = results.filter(r => r.success);
  const avgDuration = successful.reduce((a, b) => a + b.duration, 0) / successful.length;

  console.log('Results:');
  console.log(`  Successful: ${successful.length}/${concurrency}`);
  console.log(`  Average duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`  Failed:`, results.filter(r => !r.success));
};
```

### Step 4: Final Checklist

```markdown
## Pre-Deployment Checklist

### Security
- [ ] RLS enabled on ALL public tables
- [ ] Each table has SELECT, INSERT, UPDATE, DELETE policies as needed
- [ ] Service role key NOT exposed to client
- [ ] CORS configured for production domains only

### Performance
- [ ] Indexes on foreign keys
- [ ] Indexes on frequently filtered columns
- [ ] No N+1 queries in application code
- [ ] Connection pooling configured

### Reliability
- [ ] Error handling in all Supabase calls
- [ ] Token refresh before expiration
- [ ] Subscription cleanup on unmount
- [ ] Graceful degradation for offline

### Monitoring
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Performance monitoring enabled
- [ ] Alerting for critical errors
- [ ] Logging for debugging

### Data
- [ ] Migrations tested on staging
- [ ] Rollback plan documented
- [ ] Backup verified
- [ ] Seed data removed
```

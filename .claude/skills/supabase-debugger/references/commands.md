# Supabase Debugger Command Reference

Complete reference for all debugging commands organized by module.

## Connection & Status Commands

### Check Infrastructure

```bash
# Verify Docker is running
docker ps

# Check Supabase services status
npx supabase status

# View service URLs and keys
npx supabase status -o json

# Start Supabase services
npx supabase start

# Stop Supabase services
npx supabase stop

# Reset database (destructive)
npx supabase db reset
```

### Test Connectivity

```bash
# Test PostgreSQL connection
psql "postgresql://postgres:postgres@localhost:5432/postgres" -c "SELECT 1"

# Test REST API
curl http://localhost:54321/rest/v1/ -H "apikey: YOUR_ANON_KEY"

# Test Auth service
curl http://localhost:54321/auth/v1/health

# Test Realtime
curl http://localhost:54321/realtime/v1/health
```

## Authentication Commands

### Session Management

```javascript
// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Refresh session
const { data, error } = await supabase.auth.refreshSession();

// Sign out
await supabase.auth.signOut();
```

### Token Inspection

```javascript
// Decode JWT token
const token = 'eyJhbG...';
const payload = JSON.parse(atob(token.split('.')[1]));
console.log({
  sub: payload.sub,         // User ID
  email: payload.email,     // Email
  role: payload.role,       // Role
  exp: new Date(payload.exp * 1000),  // Expiration
  iat: new Date(payload.iat * 1000),  // Issued at
  aud: payload.aud,         // Audience
});

// Check if expired
const isExpired = Date.now() > payload.exp * 1000;
```

### Auth State Monitoring

```javascript
// Listen to auth changes
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    console.log('Event:', event);
    // Events: INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED
    console.log('Session:', session);
  }
);

// Cleanup
subscription.unsubscribe();
```

## Database Commands

### Query Analysis

```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

### Explain Queries

```sql
-- Basic explain
EXPLAIN SELECT * FROM tasks WHERE user_id = 'uuid';

-- Detailed explain with timing
EXPLAIN (ANALYZE, BUFFERS, TIMING, FORMAT TEXT)
SELECT * FROM tasks WHERE user_id = 'uuid';

-- JSON format for parsing
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM tasks WHERE user_id = 'uuid';
```

### Index Management

```sql
-- List all indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public';

-- Check index usage
SELECT
  relname as table,
  indexrelname as index,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT
  indexrelname as index,
  idx_scan as scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE 'pg_%';
```

### Connection Pool

```sql
-- Current connections
SELECT
  count(*) as total,
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
GROUP BY state, wait_event_type, wait_event;

-- Active queries
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Kill a connection
SELECT pg_terminate_backend(pid);

-- Show max connections
SHOW max_connections;
```

### Table Statistics

```sql
-- Table sizes
SELECT
  relname as table,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_size_pretty(pg_table_size(relid)) as table_size,
  pg_size_pretty(pg_indexes_size(relid)) as index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Row counts
SELECT
  schemaname,
  relname as table,
  n_live_tup as rows,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Table bloat estimate
SELECT
  relname as table,
  n_dead_tup as dead_tuples,
  n_live_tup as live_tuples,
  round(100 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 2) as dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

## RLS Commands

### View Policies

```sql
-- All policies on a table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'your_table';

-- All policies in schema
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Tables with RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;

-- Tables WITHOUT RLS
SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false;
```

### Test Policies

```sql
-- Switch to authenticated role
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-uuid-here';
SET request.jwt.claim.role = 'authenticated';

-- Test queries
SELECT * FROM your_table;
INSERT INTO your_table (col) VALUES ('test');
UPDATE your_table SET col = 'new' WHERE id = 1;
DELETE FROM your_table WHERE id = 1;

-- Reset role
RESET ROLE;
```

## Realtime Commands

### Subscription Management

```javascript
// Create channel
const channel = supabase.channel('my-channel');

// Subscribe to postgres changes
channel
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'tasks' },
    (payload) => console.log('Change:', payload)
  )
  .subscribe();

// Broadcast
channel
  .on('broadcast', { event: 'message' }, (payload) => {
    console.log('Broadcast:', payload);
  })
  .subscribe();

// Presence
channel
  .on('presence', { event: 'sync' }, () => {
    console.log('Presence sync:', channel.presenceState());
  })
  .subscribe();

// List all channels
const channels = supabase.getChannels();

// Remove specific channel
supabase.removeChannel(channel);

// Remove all channels
supabase.removeAllChannels();
```

### Debug Subscriptions

```javascript
// Monitor subscription status
channel.subscribe((status) => {
  console.log('Status:', status);
  // SUBSCRIBED, TIMED_OUT, CLOSED, CHANNEL_ERROR
});

// Check channel state
console.log('Channel state:', channel.state);
console.log('Channel topic:', channel.topic);

// System events
channel.on('system', {}, (payload) => {
  console.log('System:', payload);
});
```

### Realtime Database Config

```sql
-- Check publication tables
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- Add table to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE your_table;

-- Remove table from realtime
ALTER PUBLICATION supabase_realtime DROP TABLE your_table;
```

## Performance Commands

### Memory Tracking

```javascript
// Browser memory (Chrome only)
const getMemory = () => {
  if (performance.memory) {
    return {
      used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
      total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
      limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
    };
  }
  return 'Not available';
};

// Monitor memory over time
const initialMemory = performance.memory?.usedJSHeapSize || 0;
setInterval(() => {
  const current = performance.memory?.usedJSHeapSize || 0;
  const delta = ((current - initialMemory) / 1024 / 1024).toFixed(2);
  console.log(`Memory delta: ${delta} MB`);
}, 5000);
```

### Query Performance

```sql
-- Slowest queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  min_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE calls > 10
ORDER BY mean_time DESC
LIMIT 20;

-- Most called queries
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- Total query time by query
SELECT
  query,
  total_time,
  calls,
  total_time / calls as avg_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;
```

## Error Codes Reference

| Code | Name | Description |
|------|------|-------------|
| `PGRST301` | JWT Expired | Authentication token has expired |
| `PGRST302` | JWT Invalid | Token signature verification failed |
| `42501` | Insufficient Privilege | RLS policy denied access |
| `42703` | Undefined Column | Column does not exist |
| `23505` | Unique Violation | Duplicate key value |
| `23503` | FK Violation | Foreign key constraint failed |
| `23502` | Not Null Violation | Null value in required column |
| `57P03` | Cannot Connect | Database server not running |
| `53300` | Too Many Connections | Connection limit exceeded |
| `40001` | Serialization Failure | Transaction conflict |
| `40P01` | Deadlock Detected | Deadlock between transactions |

## Environment Variables

```bash
# Supabase credentials (from npx supabase status)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

# Debug flags
SUPABASE_DEBUG=true
SUPABASE_DEBUG_LEVEL=info  # error|warn|info|debug
```

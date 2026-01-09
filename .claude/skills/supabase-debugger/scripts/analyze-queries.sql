-- Supabase Query Analysis Script
-- Run these queries to analyze database performance

-- ==============================================
-- SETUP: Enable query statistics
-- ==============================================

-- Enable pg_stat_statements if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reset statistics (run if needed)
-- SELECT pg_stat_statements_reset();

-- ==============================================
-- SLOW QUERIES
-- ==============================================

-- Top 20 slowest queries by average time
SELECT
    LEFT(query, 80) as query_preview,
    calls,
    round(total_exec_time::numeric, 2) as total_time_ms,
    round(mean_exec_time::numeric, 2) as avg_time_ms,
    round(max_exec_time::numeric, 2) as max_time_ms,
    rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
AND calls > 1
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ==============================================
-- MOST CALLED QUERIES
-- ==============================================

-- Queries called most frequently
SELECT
    LEFT(query, 80) as query_preview,
    calls,
    round(total_exec_time::numeric, 2) as total_time_ms,
    round(mean_exec_time::numeric, 2) as avg_time_ms,
    rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY calls DESC
LIMIT 20;

-- ==============================================
-- TOTAL TIME CONSUMERS
-- ==============================================

-- Queries consuming most total time
SELECT
    LEFT(query, 80) as query_preview,
    calls,
    round(total_exec_time::numeric, 2) as total_time_ms,
    round((total_exec_time / (SELECT sum(total_exec_time) FROM pg_stat_statements) * 100)::numeric, 2) as pct_total
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- ==============================================
-- CONNECTION ANALYSIS
-- ==============================================

-- Current connection status
SELECT
    count(*) as total,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity
GROUP BY state, wait_event_type, wait_event
ORDER BY count(*) DESC;

-- Long-running queries
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE state != 'idle'
AND query NOT LIKE '%pg_stat%'
ORDER BY duration DESC
LIMIT 10;

-- ==============================================
-- INDEX ANALYSIS
-- ==============================================

-- Tables doing too many sequential scans
SELECT
    relname as table_name,
    seq_scan,
    seq_tup_read,
    idx_scan,
    CASE
        WHEN idx_scan = 0 THEN 'No indexes used'
        ELSE round(seq_scan::numeric / idx_scan, 2)::text
    END as seq_to_idx_ratio
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC
LIMIT 20;

-- Index usage statistics
SELECT
    schemaname,
    relname as table_name,
    indexrelname as index_name,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC
LIMIT 20;

-- Unused indexes (candidates for removal)
SELECT
    schemaname,
    relname as table_name,
    indexrelname as index_name,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan < 10
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- ==============================================
-- TABLE STATISTICS
-- ==============================================

-- Table sizes
SELECT
    relname as table_name,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size,
    pg_size_pretty(pg_table_size(relid)) as table_size,
    pg_size_pretty(pg_indexes_size(relid)) as index_size,
    n_live_tup as rows
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- Table bloat (dead tuples)
SELECT
    relname as table_name,
    n_dead_tup as dead_tuples,
    n_live_tup as live_tuples,
    round(100 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 2) as dead_pct,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 100
ORDER BY n_dead_tup DESC;

-- ==============================================
-- RLS POLICY CHECK
-- ==============================================

-- Tables with RLS status
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;

-- Policy coverage by table
SELECT
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policy_count,
    array_agg(p.cmd) as operations
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- ==============================================
-- LOCKS
-- ==============================================

-- Current locks
SELECT
    pg_stat_activity.pid,
    pg_locks.locktype,
    pg_locks.mode,
    pg_locks.granted,
    pg_stat_activity.query,
    pg_stat_activity.state
FROM pg_locks
JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
WHERE pg_stat_activity.pid != pg_backend_pid()
ORDER BY pg_locks.granted, pg_stat_activity.query_start;

-- Blocked queries
SELECT
    blocked.pid AS blocked_pid,
    blocked.query AS blocked_query,
    blocking.pid AS blocking_pid,
    blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks blocked_locks ON blocked.pid = blocked_locks.pid
JOIN pg_locks blocking_locks ON blocked_locks.locktype = blocking_locks.locktype
    AND blocked_locks.relation = blocking_locks.relation
    AND blocked_locks.pid != blocking_locks.pid
JOIN pg_stat_activity blocking ON blocking_locks.pid = blocking.pid
WHERE NOT blocked_locks.granted;

-- ==============================================
-- SUGGESTED INDEXES
-- ==============================================

-- Foreign keys without indexes
SELECT
    tc.table_name,
    kcu.column_name,
    'CREATE INDEX idx_' || tc.table_name || '_' || kcu.column_name
        || ' ON public.' || tc.table_name || '(' || kcu.column_name || ');' as suggested_ddl
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND NOT EXISTS (
    SELECT 1 FROM pg_indexes pi
    WHERE pi.schemaname = 'public'
    AND pi.tablename = tc.table_name
    AND pi.indexdef LIKE '%' || kcu.column_name || '%'
)
ORDER BY tc.table_name;

# Schema Validation Queries

SQL queries for validating database schema integrity and finding common issues.

## Schema Discovery

### List All Tables

```sql
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
```

### Table Columns with Details

```sql
SELECT
  table_name,
  column_name,
  data_type,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

### Foreign Key Relationships

```sql
SELECT
  tc.table_name as child_table,
  kcu.column_name as child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public';
```

## Schema Validation Checks

### Find Missing NOT NULL Constraints

```sql
-- Columns that might need NOT NULL
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND is_nullable = 'YES'
AND column_name IN ('user_id', 'created_at', 'updated_at', 'name', 'email')
ORDER BY table_name;
```

### Find Missing Primary Keys

```sql
SELECT t.table_name
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints c
  ON t.table_name = c.table_name
  AND t.table_schema = c.table_schema
  AND c.constraint_type = 'PRIMARY KEY'
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND c.constraint_name IS NULL;
```

### Find Missing Foreign Key Indexes

```sql
-- Foreign keys without indexes (performance issue)
SELECT
  tc.table_name,
  kcu.column_name,
  'CREATE INDEX idx_' || tc.table_name || '_' || kcu.column_name
    || ' ON ' || tc.table_name || '(' || kcu.column_name || ');' as suggested_index
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
);
```

### Check Column Type Consistency

```sql
-- Find columns with same name but different types across tables
SELECT
  column_name,
  array_agg(DISTINCT data_type) as types,
  array_agg(table_name) as tables
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY column_name
HAVING COUNT(DISTINCT data_type) > 1;
```

### Validate UUID Columns

```sql
-- Ensure id columns use UUID
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name = 'id'
AND data_type != 'uuid';
```

### Check Timestamp Columns

```sql
-- Ensure created_at/updated_at use proper type
SELECT
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('created_at', 'updated_at')
AND (
  data_type != 'timestamp with time zone'
  OR column_default IS NULL
);
```

## RLS Validation

### Tables Without RLS

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
ORDER BY tablename;
```

### Tables With RLS But No Policies

```sql
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
AND t.rowsecurity = true
GROUP BY t.tablename
HAVING COUNT(p.policyname) = 0;
```

### Policy Coverage Report

```sql
SELECT
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count,
  array_agg(DISTINCT p.cmd) as operations_covered
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
```

### Validate User ID Reference

```sql
-- Check tables with user_id column have proper RLS
SELECT
  c.table_name,
  EXISTS(
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = c.table_name
    AND p.qual LIKE '%auth.uid()%'
  ) as has_auth_uid_policy
FROM information_schema.columns c
JOIN pg_tables t ON c.table_name = t.tablename
WHERE c.table_schema = 'public'
AND c.column_name = 'user_id'
AND t.rowsecurity = true;
```

## Performance Validation

### Missing Indexes on Large Tables

```sql
-- Tables with high seq_scan ratio (might need indexes)
SELECT
  relname as table_name,
  seq_scan,
  idx_scan,
  n_live_tup as row_count,
  CASE
    WHEN idx_scan = 0 THEN 'No index scans'
    ELSE round(seq_scan::numeric / idx_scan, 2)::text
  END as seq_to_idx_ratio
FROM pg_stat_user_tables
WHERE seq_scan > 100
AND n_live_tup > 1000
ORDER BY seq_scan DESC;
```

### Unused Indexes

```sql
SELECT
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan as times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan < 50
AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Duplicate Indexes

```sql
-- Find potentially duplicate indexes
SELECT
  pg_size_pretty(sum(pg_relation_size(idx))::bigint) as size,
  (array_agg(idx))[1] as idx1,
  (array_agg(idx))[2] as idx2,
  (array_agg(idx))[3] as idx3
FROM (
  SELECT
    indexrelid::regclass as idx,
    (indrelid::text || E'\n' || indclass::text || E'\n' || indkey::text) as key
  FROM pg_index
) sub
GROUP BY key
HAVING count(*) > 1
ORDER BY sum(pg_relation_size(idx)) DESC;
```

## Data Integrity Checks

### Orphaned Records

```sql
-- Find orphaned records (child without parent)
-- Replace table/column names as needed
SELECT
  c.id,
  c.parent_id
FROM child_table c
LEFT JOIN parent_table p ON c.parent_id = p.id
WHERE p.id IS NULL
AND c.parent_id IS NOT NULL;
```

### Null Values in Required Fields

```sql
-- Find nulls where they shouldn't be
SELECT
  'tasks' as table_name,
  COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_id,
  COUNT(*) FILTER (WHERE title IS NULL OR title = '') as null_or_empty_title,
  COUNT(*) FILTER (WHERE created_at IS NULL) as null_created_at
FROM tasks
UNION ALL
SELECT
  'projects',
  COUNT(*) FILTER (WHERE user_id IS NULL),
  COUNT(*) FILTER (WHERE name IS NULL OR name = ''),
  COUNT(*) FILTER (WHERE created_at IS NULL)
FROM projects;
```

### Duplicate Detection

```sql
-- Find potential duplicates
SELECT
  user_id,
  title,
  COUNT(*) as occurrences
FROM tasks
GROUP BY user_id, title
HAVING COUNT(*) > 1
ORDER BY occurrences DESC;
```

## Migration Safety Checks

### Before Running Migration

```sql
-- Check current table structure
\d+ your_table

-- Count rows (for large tables, estimate impact)
SELECT reltuples::bigint AS estimate
FROM pg_class
WHERE relname = 'your_table';

-- Check for active transactions
SELECT
  pid,
  state,
  query,
  now() - query_start as duration
FROM pg_stat_activity
WHERE state != 'idle';
```

### After Running Migration

```sql
-- Verify column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'your_table'
AND column_name = 'new_column';

-- Verify constraint was added
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'your_table'::regclass;

-- Verify index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'your_table';
```

## Quick Validation Script

```sql
-- Run this for a quick health check
DO $$
DECLARE
  issues text[] := '{}';
  tbl record;
BEGIN
  -- Check for tables without RLS
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND NOT rowsecurity
  LOOP
    issues := array_append(issues, 'No RLS: ' || tbl.tablename);
  END LOOP;

  -- Check for tables without primary key
  FOR tbl IN
    SELECT t.table_name
    FROM information_schema.tables t
    LEFT JOIN information_schema.table_constraints c
      ON t.table_name = c.table_name AND c.constraint_type = 'PRIMARY KEY'
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    AND c.constraint_name IS NULL
  LOOP
    issues := array_append(issues, 'No PK: ' || tbl.table_name);
  END LOOP;

  -- Report
  IF array_length(issues, 1) > 0 THEN
    RAISE NOTICE 'Schema issues found: %', issues;
  ELSE
    RAISE NOTICE 'No issues found!';
  END IF;
END $$;
```

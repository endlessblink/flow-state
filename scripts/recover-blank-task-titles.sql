-- BUG-1777: Recover original task titles from task_audit_log on VPS production.
--
-- Context: The load-time repair in v1.3.70 (repairTaskTitles) already relabeled
-- previously-blank tasks to the literal string "Untitled Task" and persisted
-- that back to VPS. So `title IS NULL OR title = ''` returns 0 rows now — the
-- real targets are rows with `title = 'Untitled Task'` whose audit log contains
-- a prior *real* title.
--
-- Run with:
--   ssh -i ~/.ssh/id_ed25519 root@84.46.253.137 \
--     "docker exec -i supabase-db psql -U postgres -d postgres" \
--     < scripts/recover-blank-task-titles.sql
--
-- Steps 1, 2, 4 are READ-ONLY. Step 3 is the recovery WRITE.

-- =========================================================================
-- STEP 1: Inspect current state of suspect tasks (READ-ONLY)
-- =========================================================================
\echo ''
\echo '--- STEP 1: Tasks currently labeled "Untitled Task" or blank ---'
SELECT id,
       title,
       status,
       due_date,
       is_in_inbox,
       parent_id,
       (canvas_position IS NOT NULL) AS has_canvas_position,
       created_at,
       updated_at
FROM tasks
WHERE (title IS NULL OR title = '' OR title = 'Untitled Task')
  AND is_deleted = false
ORDER BY updated_at DESC;

-- =========================================================================
-- STEP 2: Look up the last REAL title from audit log (READ-ONLY)
-- Exclude '', NULL, and 'Untitled Task' (the repair's fallback) so we only
-- surface genuine historical titles worth restoring.
-- =========================================================================
\echo ''
\echo '--- STEP 2: Recoverable titles from task_audit_log ---'
WITH suspect_tasks AS (
  SELECT id
  FROM tasks
  WHERE (title IS NULL OR title = '' OR title = 'Untitled Task')
    AND is_deleted = false
)
SELECT DISTINCT ON (task_id)
       task_id,
       title        AS recoverable_title,
       event_type,
       event_at
FROM task_audit_log
WHERE task_id IN (SELECT id FROM suspect_tasks)
  AND title IS NOT NULL
  AND title <> ''
  AND title <> 'Untitled Task'
ORDER BY task_id, event_at DESC;

-- =========================================================================
-- STEP 3: Restore titles from audit log (WRITE)
-- Only touches rows whose current title is NULL / '' / 'Untitled Task'.
-- Only restores a title if the audit log has one that is NOT the fallback.
-- Setting updated_at = now() pushes the fix to all connected clients via realtime.
-- =========================================================================
\echo ''
\echo '--- STEP 3: Restoring recoverable titles ---'
WITH last_real_title_per_task AS (
  SELECT DISTINCT ON (task_id) task_id, title
  FROM task_audit_log
  WHERE title IS NOT NULL
    AND title <> ''
    AND title <> 'Untitled Task'
  ORDER BY task_id, event_at DESC
)
UPDATE tasks t
SET    title = l.title,
       updated_at = now()
FROM   last_real_title_per_task l
WHERE  t.id = l.task_id
  AND  t.is_deleted = false
  AND  (t.title IS NULL OR t.title = '' OR t.title = 'Untitled Task')
RETURNING t.id, t.title AS restored_title;

-- =========================================================================
-- STEP 4: Verify residuals (READ-ONLY)
-- Anything still "Untitled Task" here either was renamed intentionally by the
-- user, or had no audit-log history. It will stay as "Untitled Task" and is
-- renameable manually in the app.
-- =========================================================================
\echo ''
\echo '--- STEP 4: Residuals after recovery ---'
SELECT id, title, is_in_inbox, parent_id IS NOT NULL AS has_parent
FROM tasks
WHERE (title IS NULL OR title = '' OR title = 'Untitled Task')
  AND is_deleted = false
ORDER BY updated_at DESC;

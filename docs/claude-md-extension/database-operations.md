# FlowState Database Operations Reference

> **Purpose**: Enable Claude Code to perform data operations (queries, cleanup, bulk actions) directly against the FlowState database. This is an OPERATIONAL reference, not a development reference.

## Connection

```bash
# Execute SQL against local Supabase
docker exec supabase_db_flow-state psql -U postgres -c "SQL_HERE"

# Multi-line SQL
docker exec supabase_db_flow-state psql -U postgres <<'SQL'
SELECT * FROM tasks WHERE is_deleted = false LIMIT 5;
SQL

# Production (VPS) — NEVER run destructive queries without user approval
ssh -i ~/.ssh/id_ed25519 root@84.46.253.137 \
  docker exec supabase-db psql -U postgres -c "SQL_HERE"
```

**User ID**: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` (single-user app, but always filter by user_id for RLS compatibility)

---

## Table Schemas (Quick Reference)

### tasks (primary table — 241 rows, 148 deleted, 79 done)
| Column | Type | Key Info |
|--------|------|----------|
| id | uuid | PK, auto-generated |
| user_id | uuid | FK → auth.users |
| project_id | uuid | FK → projects (nullable) |
| title | text | NOT NULL |
| description | text | |
| status | text | `planned`, `in_progress`, `done`, `backlog`, `on_hold` |
| priority | text | `low`, `medium`, `high`, NULL |
| progress | integer | 0-100 |
| due_date | timestamptz | |
| due_time | text | HH:MM format |
| scheduled_date | timestamptz | Calendar view date |
| scheduled_time | text | HH:MM format |
| estimated_duration | integer | Minutes |
| subtasks | jsonb | `[{id, title, completed}]` |
| tags | text[] | Array of tag strings |
| parent_task_id | uuid | FK → tasks (hierarchical) |
| parent_id | text | Canvas group parent |
| depends_on | text[] | Task dependency IDs |
| position | jsonb | Canvas `{x, y}` |
| column_id | text | Kanban column |
| order | integer | Sort order |
| is_in_inbox | boolean | Inbox flag |
| is_deleted | boolean | Soft delete |
| deleted_at | timestamptz | |
| completed_at | timestamptz | |
| is_pinned | boolean | KDE widget pin |
| is_uncategorized | boolean | No project assigned |
| recurrence | jsonb | Legacy recurrence config |
| recurrence_rule | jsonb | New recurrence rule |
| recurrence_parent_id | uuid | FK → tasks |
| recurrence_count | integer | |
| attachments | jsonb | `[{id, driveFileId, name, mimeType, thumbnailUrl}]` |
| reminders | jsonb | `[{id, datetime, label, fired, dismissed}]` |
| position_version | integer | Optimistic locking |
| done_for_now_until | date | Rescheduled date |
| created_at / updated_at | timestamptz | Auto-managed |

### projects
| Column | Type | Key Info |
|--------|------|----------|
| id | uuid | PK |
| user_id | uuid | FK |
| name | text | NOT NULL |
| color | text | Hex or emoji |
| color_type | text | `hex`, `emoji` |
| view_type | text | `status`, `date`, `priority`, `list`, `board` |
| parent_id | uuid | FK → projects (nested) |
| order | integer | |
| is_deleted | boolean | |

### groups (canvas groups)
| Column | Type | Key Info |
|--------|------|----------|
| id | text | PK (not uuid!) |
| user_id | uuid | FK |
| name | text | NOT NULL |
| type | text | `custom` default |
| color | text | |
| position_json | jsonb | `{x, y, width, height}` |
| layout | text | `vertical`, `horizontal` |
| is_visible / is_collapsed | boolean | |
| parent_group_id | text | Nested groups |
| filters_json | jsonb | Smart group filters |
| is_power_mode | boolean | Power group flag |
| auto_collect | boolean | |
| is_deleted | boolean | |

### timer_sessions
| Column | Type | Key Info |
|--------|------|----------|
| id | uuid | PK |
| user_id | uuid | FK |
| task_id | text | Linked task |
| start_time | timestamptz | NOT NULL |
| duration | integer | Seconds, NOT NULL |
| remaining_time | integer | Seconds, NOT NULL |
| is_active | boolean | |
| is_paused | boolean | |
| is_break | boolean | |
| device_leader_id | text | Cross-device sync |

### tombstones (deletion records — 90 day TTL)
| Column | Type | Key Info |
|--------|------|----------|
| entity_type | varchar(50) | `task`, `group`, `project` |
| entity_id | text | |
| deleted_at | timestamptz | |
| expires_at | timestamptz | `now() + 90 days` |

### notifications
| Column | Type | Key Info |
|--------|------|----------|
| id | text | PK |
| task_id | text | |
| title / body | text | |
| scheduled_time | timestamptz | |
| is_shown / is_dismissed | boolean | |

### pinned_tasks (KDE widget)
| Column | Type | Key Info |
|--------|------|----------|
| id | uuid | PK |
| title | text | NOT NULL |
| description | text | |
| project_id | uuid | FK |
| priority | text | |
| sort_order | integer | |

### user_gamification
| Column | Type | Key Info |
|--------|------|----------|
| user_id | uuid | PK |
| total_xp / available_xp | integer | |
| level | integer | |
| current_streak / longest_streak | integer | |
| streak_freezes | integer | |
| corruption_level | integer | 0-100 |
| character_class | text | `netrunner` default |
| active_multiplier | float | 1.0-5.0 |

### user_settings
| Column | Type | Key Info |
|--------|------|----------|
| user_id | uuid | FK |
| work_duration | integer | Seconds (default 1200 = 20min) |
| short_break_duration | integer | Seconds (default 300) |
| theme | text | `system` default |
| language | text | `en` default |
| ai_settings | jsonb | AI config blob |
| kanban_settings | jsonb | Board config |
| canvas_viewport | jsonb | Saved viewport |

---

## Common Operations Cookbook

### Finding Duplicates

```sql
-- Duplicate tasks by title (non-deleted)
SELECT title, count(*) as cnt, array_agg(id) as ids
FROM tasks
WHERE is_deleted = false
GROUP BY title
HAVING count(*) > 1
ORDER BY cnt DESC;

-- Duplicate tasks by title AND project
SELECT title, project_id, count(*) as cnt, array_agg(id) as ids
FROM tasks
WHERE is_deleted = false
GROUP BY title, project_id
HAVING count(*) > 1;

-- Duplicate tasks by title, keeping the oldest
SELECT t.id, t.title, t.created_at, t.status
FROM tasks t
JOIN (
  SELECT title, min(created_at) as first_created
  FROM tasks WHERE is_deleted = false
  GROUP BY title HAVING count(*) > 1
) dups ON t.title = dups.title AND t.created_at > dups.first_created
WHERE t.is_deleted = false
ORDER BY t.title, t.created_at;
```

### Deleting Duplicates (soft delete — keeps oldest)

```sql
-- Preview what would be deleted
WITH ranked AS (
  SELECT id, title, created_at, status,
    ROW_NUMBER() OVER (PARTITION BY title ORDER BY created_at ASC) as rn
  FROM tasks WHERE is_deleted = false
)
SELECT id, title, created_at, status FROM ranked WHERE rn > 1;

-- Soft-delete duplicates (keeps oldest by created_at)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY title ORDER BY created_at ASC) as rn
  FROM tasks WHERE is_deleted = false
)
UPDATE tasks SET is_deleted = true, deleted_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

### Task Queries

```sql
-- All active tasks (non-deleted, non-done)
SELECT id, title, status, priority, project_id, due_date
FROM tasks
WHERE is_deleted = false AND status != 'done'
ORDER BY due_date ASC NULLS LAST;

-- Tasks by project (with project name)
SELECT t.title, t.status, t.priority, p.name as project
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
WHERE t.is_deleted = false
ORDER BY p.name, t.order;

-- Overdue tasks
SELECT id, title, due_date, status
FROM tasks
WHERE is_deleted = false AND status != 'done'
  AND due_date < now()
ORDER BY due_date ASC;

-- Tasks in inbox
SELECT id, title, created_at FROM tasks
WHERE is_deleted = false AND is_in_inbox = true
ORDER BY created_at DESC;

-- Orphaned tasks (project deleted but task still references it)
SELECT t.id, t.title, t.project_id
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
WHERE t.is_deleted = false AND t.project_id IS NOT NULL
  AND (p.id IS NULL OR p.is_deleted = true);

-- Tasks with no project
SELECT id, title, status FROM tasks
WHERE is_deleted = false AND project_id IS NULL AND is_uncategorized = true;

-- Recently completed tasks
SELECT id, title, completed_at
FROM tasks
WHERE status = 'done' AND is_deleted = false
ORDER BY completed_at DESC LIMIT 20;
```

### Bulk Updates

```sql
-- Move all tasks from one project to another
UPDATE tasks SET project_id = 'NEW_PROJECT_UUID'
WHERE project_id = 'OLD_PROJECT_UUID' AND is_deleted = false;

-- Bulk set priority
UPDATE tasks SET priority = 'medium'
WHERE priority IS NULL AND is_deleted = false;

-- Move inbox tasks to a project
UPDATE tasks SET project_id = 'PROJECT_UUID', is_in_inbox = false
WHERE is_in_inbox = true AND is_deleted = false;

-- Reset all "on_hold" tasks to "planned"
UPDATE tasks SET status = 'planned'
WHERE status = 'on_hold' AND is_deleted = false;
```

### Cleanup Operations

```sql
-- Hard-delete soft-deleted tasks older than 30 days
DELETE FROM tasks
WHERE is_deleted = true AND deleted_at < now() - interval '30 days';

-- Clean expired tombstones
DELETE FROM tombstones WHERE expires_at < now();

-- Find and clean stale timer sessions (no activity in 24h)
UPDATE timer_sessions SET is_active = false
WHERE is_active = true AND updated_at < now() - interval '24 hours';

-- Remove dismissed notifications older than 7 days
DELETE FROM notifications
WHERE is_dismissed = true AND updated_at < now() - interval '7 days';
```

### Stats & Reports

```sql
-- Task status breakdown
SELECT status, count(*) FROM tasks
WHERE is_deleted = false GROUP BY status ORDER BY count DESC;

-- Tasks per project
SELECT p.name, count(t.id) as task_count,
  count(CASE WHEN t.status = 'done' THEN 1 END) as done,
  count(CASE WHEN t.status != 'done' THEN 1 END) as active
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id AND t.is_deleted = false
WHERE p.is_deleted = false
GROUP BY p.name ORDER BY task_count DESC;

-- Completion rate by week
SELECT date_trunc('week', completed_at) as week,
  count(*) as completed
FROM tasks
WHERE status = 'done' AND completed_at IS NOT NULL AND is_deleted = false
GROUP BY week ORDER BY week DESC LIMIT 12;

-- Pomodoro stats
SELECT t.title, t.completed_pomodoros, t.estimated_pomodoros
FROM tasks t
WHERE t.is_deleted = false AND t.completed_pomodoros > 0
ORDER BY t.completed_pomodoros DESC LIMIT 20;

-- Gamification summary
SELECT level, total_xp, available_xp, current_streak, longest_streak,
  corruption_level, character_class
FROM user_gamification LIMIT 1;
```

### Project Management

```sql
-- List all projects
SELECT id, name, color, view_type, "order"
FROM projects WHERE is_deleted = false ORDER BY "order";

-- Project hierarchy
SELECT p.name as project, pp.name as parent
FROM projects p
LEFT JOIN projects pp ON p.parent_id = pp.id
WHERE p.is_deleted = false;
```

### Canvas & Groups

```sql
-- List canvas groups with position
SELECT id, name, type, position_json, is_collapsed
FROM groups WHERE is_deleted = false ORDER BY name;

-- Tasks with canvas positions
SELECT id, title, position, parent_id
FROM tasks
WHERE is_deleted = false AND position IS NOT NULL;

-- Orphaned canvas tasks (parent group deleted)
SELECT t.id, t.title, t.parent_id
FROM tasks t
LEFT JOIN groups g ON t.parent_id = g.id
WHERE t.is_deleted = false AND t.parent_id IS NOT NULL
  AND (g.id IS NULL OR g.is_deleted = true);
```

---

## Safety Rules

1. **ALWAYS preview before mutating** — Run SELECT first, show user the rows, then UPDATE/DELETE
2. **Prefer soft-delete** — Set `is_deleted = true, deleted_at = now()` instead of DELETE
3. **Add tombstone on delete** — When removing tasks, insert a tombstone so sync doesn't re-create them:
   ```sql
   INSERT INTO tombstones (user_id, entity_type, entity_id)
   VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'task', 'TASK_UUID');
   ```
4. **Never hard-delete without user approval** — Per CLAUDE.md rules
5. **Always set updated_at** — `updated_at = now()` on any UPDATE to trigger sync
6. **Production queries need explicit approval** — Local DB is safe for reads; VPS needs confirmation

---

## REST API Alternative (Supabase PostgREST)

For operations that should respect RLS and trigger realtime events:

```bash
# Base URL
LOCAL="http://127.0.0.1:54321/rest/v1"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY5NjIyOTA3LCJleHAiOjE5ODgxNTA0MDB9.aLhhbRQ3t3i9ON40_te1rngOUVUouPFrysdp7DLwLXg"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Njk2MjI5MDcsImV4cCI6MTk4ODE1MDQwMH0.Whn8SGOv-oMSYbnFYuwm8yUfYrHJ59GH34KQCuBkEmI"

# Query tasks (bypasses RLS with service key)
curl -s "$LOCAL/tasks?is_deleted=eq.false&select=id,title,status" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | jq .

# Update a task (triggers realtime)
curl -X PATCH "$LOCAL/tasks?id=eq.TASK_UUID" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "done", "completed_at": "2026-03-14T10:00:00Z"}'

# Delete (soft)
curl -X PATCH "$LOCAL/tasks?id=eq.TASK_UUID" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"is_deleted": true, "deleted_at": "2026-03-14T10:00:00Z"}'
```

**When to use REST vs psql:**
- **psql**: Fast, bulk operations, reports, no realtime needed
- **REST**: When the app is running and you want changes to appear live (triggers Supabase Realtime → app picks up changes instantly)

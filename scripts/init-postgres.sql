-- Postgres Schema for Pomo-Flow
-- Matches src/database/AppSchema.ts

-- 1. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  -- Core Identity & Content
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planned',
  priority TEXT,

  -- Project & Hierarchy
  project_id TEXT,
  parent_task_id TEXT,

  -- Pomodoro Tracking
  total_pomodoros INTEGER DEFAULT 0,
  estimated_pomodoros INTEGER DEFAULT 1,
  progress INTEGER DEFAULT 0,

  -- Scheduling & Calendar
  due_date TEXT,
  scheduled_date TEXT,
  scheduled_time TEXT,
  estimated_duration INTEGER,

  -- Complex Fields (JSON)
  instances_json TEXT,
  subtasks_json TEXT,
  depends_on_json TEXT,
  tags_json TEXT,
  connection_types_json TEXT,
  recurrence_json TEXT,
  recurring_instances_json TEXT,
  notification_prefs_json TEXT,

  -- Canvas & Spatial
  canvas_position_x DOUBLE PRECISION,
  canvas_position_y DOUBLE PRECISION,
  is_in_inbox INTEGER DEFAULT 1,

  -- Kanban Workflow
  "order" INTEGER DEFAULT 0,
  column_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Soft Delete Support
  is_deleted INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  -- Core Identity
  name TEXT NOT NULL,
  description TEXT,

  -- Appearance
  color TEXT DEFAULT '#808080',
  color_type TEXT DEFAULT 'hex',
  icon TEXT,
  emoji TEXT,

  -- Hierarchy
  parent_id TEXT,

  -- View Configuration
  view_type TEXT DEFAULT 'status',

  -- Sorting
  "order" INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft Delete
  is_deleted INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ
);

-- 3. Groups Table (Canvas Sections)
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'custom',
  color TEXT,
  position_json TEXT,
  filters_json TEXT,
  layout TEXT DEFAULT 'vertical',
  is_visible INTEGER DEFAULT 1,
  is_collapsed INTEGER DEFAULT 0,
  collapsed_height INTEGER DEFAULT 0,
  parent_group_id TEXT,
  is_power_mode INTEGER DEFAULT 0,
  power_keyword_json TEXT,
  assign_on_drop_json TEXT,
  collect_filter_json TEXT,
  auto_collect INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  property_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted INTEGER DEFAULT 0
);

-- 4. Subtasks Table
CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  parent_task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed_pomodoros INTEGER DEFAULT 0,
  is_completed INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Timer Sessions Table
CREATE TABLE IF NOT EXISTS timer_sessions (
  id TEXT PRIMARY KEY,
  session_type TEXT,
  task_id TEXT,
  duration INTEGER DEFAULT 0,
  remaining INTEGER DEFAULT 0,
  is_running INTEGER DEFAULT 0,
  is_paused INTEGER DEFAULT 0,
  sessions_completed INTEGER DEFAULT 0,
  total_sessions_today INTEGER DEFAULT 0,
  device_leader_id TEXT,
  last_heartbeat TIMESTAMPTZ,
  work_duration INTEGER,
  short_break_duration INTEGER,
  long_break_duration INTEGER,
  sessions_before_long_break INTEGER,
  auto_start_breaks INTEGER DEFAULT 0,
  auto_start_pomodoros INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  type TEXT,
  title TEXT,
  message TEXT,
  scheduled_for TIMESTAMPTZ,
  timing_minutes INTEGER,
  is_read INTEGER DEFAULT 0,
  is_dismissed INTEGER DEFAULT 0,
  is_snoozed INTEGER DEFAULT 0,
  snoozed_until TIMESTAMPTZ,
  sound_enabled INTEGER DEFAULT 1,
  vibration_enabled INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

-- 7. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  "key" TEXT UNIQUE NOT NULL,
  value_json TEXT,
  category TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Logical Replication for PowerSync
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE projects REPLICA IDENTITY FULL;
ALTER TABLE groups REPLICA IDENTITY FULL;
ALTER TABLE subtasks REPLICA IDENTITY FULL;
ALTER TABLE timer_sessions REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE settings REPLICA IDENTITY FULL;

-- Create Publication for PowerSync
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
    CREATE PUBLICATION powersync FOR ALL TABLES;
  END IF;
END $$;

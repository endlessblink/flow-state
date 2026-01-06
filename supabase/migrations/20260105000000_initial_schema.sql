-- Supabase Schema Definition for Pomo-Flow
-- Migration from PouchDB/SQLite to PostgreSQL

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. PROJECTS TABLE
-- -----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text, -- storing hex or emoji directly
  color_type text check (color_type in ('hex', 'emoji')) default 'hex',
  view_type text check (view_type in ('status', 'date', 'priority', 'list', 'board')) default 'status',
  parent_id uuid references public.projects(id) on delete set null,
  "order" integer default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies for Projects
alter table public.projects enable row level security;

create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. TASKS TABLE
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  status text check (status in ('planned', 'in_progress', 'done', 'backlog', 'on_hold')) default 'planned',
  priority text check (priority in ('low', 'medium', 'high', null)),
  
  -- Progress tracking
  progress integer default 0,
  total_pomodoros integer default 0,
  estimated_pomodoros integer default 0, -- plan
  completed_pomodoros integer default 0, -- actual
  
  -- Timing
  due_date timestamptz,
  due_time text, -- HH:MM
  estimated_duration integer, -- minutes
  
  -- JSON structures (Nozawa-style normalization not strictly needed for these tightly coupled arrays)
  subtasks jsonb default '[]'::jsonb, 
  -- Example subtask: { "id": "uuid", "title": "Foo", "collection": "subtasks", "isCompleted": false }
  
  tags text[], -- PostgreSQL Array type is cleaner than JSON for simple strings
  
  -- Relationships
  parent_task_id uuid references public.tasks(id) on delete set null,
  depends_on uuid[], -- Array of task IDs
  
  -- Canvas
  position jsonb, -- { "x": 100, "y": 200 }
  instances jsonb default '[]'::jsonb,
  connection_types jsonb, -- e.g. { "taskId": "blocker" }
  recurring_instances jsonb default '[]'::jsonb,
  recurrence jsonb,
  notification_prefs jsonb,
  
  is_in_inbox boolean default false,
  
  -- Metadata
  "order" integer default 0,
  column_id text, -- for custom kanban columns if we move beyond status
  
  is_deleted boolean default false,
  deleted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies for Tasks
alter table public.tasks enable row level security;

create policy "Users can view their own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------------------

-- Auto-update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_projects_updated_at
    before update on public.projects
    for each row
    execute procedure update_updated_at_column();

create trigger update_tasks_updated_at
    before update on public.tasks
    for each row
    execute procedure update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. GROUPS TABLE (Canvas)
-- -----------------------------------------------------------------------------
create table public.groups (
  id text primary key, -- Keeping text for flexibility (UUID v4 usually used)
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text check (type in ('status', 'priority', 'project', 'timeline', 'custom')) default 'custom',
  color text,
  
  -- Layout & Position
  position_json jsonb, -- {x, y, width, height}
  layout text check (layout in ('vertical', 'horizontal', 'grid', 'freeform')) default 'vertical',
  
  -- State
  is_visible boolean default true,
  is_collapsed boolean default false,
  collapsed_height integer,
  
  -- Hierarchy
  parent_group_id text references public.groups(id) on delete set null,
  
  -- Filters & Logic
  filters_json jsonb,
  is_power_mode boolean default false,
  power_keyword_json jsonb,
  assign_on_drop_json jsonb,
  collect_filter_json jsonb,
  auto_collect boolean default false,
  is_pinned boolean default false,
  property_value text, -- For specific property mapping
  
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies for Groups
alter table public.groups enable row level security;

create policy "Users can view their own groups"
  on public.groups for select
  using (auth.uid() = user_id);

create policy "Users can insert their own groups"
  on public.groups for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own groups"
  on public.groups for update
  using (auth.uid() = user_id);

create policy "Users can delete their own groups"
  on public.groups for delete
  using (auth.uid() = user_id);

create trigger update_groups_updated_at
    before update on public.groups
    for each row
    execute procedure update_updated_at_column();

alter publication supabase_realtime add table public.groups;

-- -----------------------------------------------------------------------------
-- 5. USER SETTINGS TABLE (Timer, App Preferences)
-- -----------------------------------------------------------------------------
create table public.user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,

  -- Timer Settings
  work_duration integer default 1200, -- 20 minutes in seconds
  short_break_duration integer default 300, -- 5 minutes
  long_break_duration integer default 900, -- 15 minutes
  auto_start_breaks boolean default true,
  auto_start_pomodoros boolean default true,
  play_notification_sounds boolean default true,

  -- UI Preferences
  theme text check (theme in ('light', 'dark', 'system')) default 'system',
  language text default 'en',
  sidebar_collapsed boolean default false,
  board_density text check (board_density in ('compact', 'comfortable', 'spacious')) default 'comfortable',

  -- Kanban Settings
  kanban_settings jsonb default '{}'::jsonb,

  -- Canvas Viewport (last position)
  canvas_viewport jsonb, -- { x, y, zoom }

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies for User Settings
alter table public.user_settings enable row level security;

create policy "Users can view their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

create trigger update_user_settings_updated_at
    before update on public.user_settings
    for each row
    execute procedure update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 6. TIMER SESSIONS TABLE (Active Pomodoro Sessions for Cross-Device Sync)
-- -----------------------------------------------------------------------------
create table public.timer_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Session Info
  task_id text, -- Can be task UUID, 'general', or 'break'
  start_time timestamptz not null,
  duration integer not null, -- total duration in seconds
  remaining_time integer not null, -- remaining seconds

  -- State
  is_active boolean default true,
  is_paused boolean default false,
  is_break boolean default false,
  completed_at timestamptz,

  -- Cross-Device Leadership (for timer sync)
  device_leader_id text, -- Device ID that controls this session
  device_leader_last_seen timestamptz, -- Heartbeat timestamp

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies for Timer Sessions
alter table public.timer_sessions enable row level security;

create policy "Users can view their own timer sessions"
  on public.timer_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own timer sessions"
  on public.timer_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own timer sessions"
  on public.timer_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own timer sessions"
  on public.timer_sessions for delete
  using (auth.uid() = user_id);

create trigger update_timer_sessions_updated_at
    before update on public.timer_sessions
    for each row
    execute procedure update_updated_at_column();

-- Index for finding active sessions quickly
create index idx_timer_sessions_active on public.timer_sessions(user_id, is_active) where is_active = true;

-- Enable realtime for timer sessions (critical for cross-device sync)
alter publication supabase_realtime add table public.timer_sessions;

-- -----------------------------------------------------------------------------
-- 7. NOTIFICATIONS TABLE (Scheduled Task Reminders)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id text primary key, -- Format: taskId-reminder-minutesBefore
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id text not null,

  -- Notification Content
  title text not null,
  body text,

  -- Scheduling
  scheduled_time timestamptz not null,
  snoozed_until timestamptz,

  -- State
  is_shown boolean default false,
  is_dismissed boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies for Notifications
alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

create trigger update_notifications_updated_at
    before update on public.notifications
    for each row
    execute procedure update_updated_at_column();

-- Index for finding pending notifications
create index idx_notifications_pending on public.notifications(user_id, scheduled_time)
  where is_shown = false and is_dismissed = false;

-- -----------------------------------------------------------------------------
-- 8. QUICK SORT SESSIONS TABLE (Session History & Streaks)
-- -----------------------------------------------------------------------------
create table public.quick_sort_sessions (
  id text primary key, -- Format: session_timestamp_random
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Session Stats
  tasks_processed integer default 0,
  time_spent integer default 0, -- milliseconds
  efficiency real default 0, -- tasks per minute
  streak_days integer default 0,

  completed_at timestamptz not null,
  created_at timestamptz default now()
);

-- RLS Policies for Quick Sort Sessions
alter table public.quick_sort_sessions enable row level security;

create policy "Users can view their own quick sort sessions"
  on public.quick_sort_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quick sort sessions"
  on public.quick_sort_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own quick sort sessions"
  on public.quick_sort_sessions for delete
  using (auth.uid() = user_id);

-- Index for streak calculation
create index idx_quick_sort_completed on public.quick_sort_sessions(user_id, completed_at desc);

-- -----------------------------------------------------------------------------
-- 9. COMPLETED POMODORO SESSIONS TABLE (Historical Tracking)
-- -----------------------------------------------------------------------------
create table public.pomodoro_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete set null,

  -- Session Details
  duration integer not null, -- seconds
  is_break boolean default false,

  started_at timestamptz not null,
  completed_at timestamptz not null,

  created_at timestamptz default now()
);

-- RLS Policies for Pomodoro History
alter table public.pomodoro_history enable row level security;

create policy "Users can view their own pomodoro history"
  on public.pomodoro_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own pomodoro history"
  on public.pomodoro_history for insert
  with check (auth.uid() = user_id);

-- Index for analytics queries
create index idx_pomodoro_history_user_date on public.pomodoro_history(user_id, completed_at desc);

-- -----------------------------------------------------------------------------
-- 10. ENABLE REALTIME FOR KEY TABLES
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.user_settings;
alter publication supabase_realtime add table public.notifications;

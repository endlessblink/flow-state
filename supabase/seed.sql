-- FlowState Development Seed
-- TASK-317: Auto-creates dev user on fresh database startup
-- BUG-339: Fixed password hashing to use extensions prefix and cost factor 10
-- This prevents auth.users table reset from breaking local development

-- Local Supabase runs migrations as postgres, so current CLI releases do not
-- inherit the production API grants for tables created by those migrations.
-- Mirror the production user-scoped API boundary for development and E2E;
-- RLS policies still decide which rows each authenticated user may access.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.tasks,
    public.groups,
    public.projects,
    public.user_settings,
    public.lanes,
    public.workspaces,
    public.workspace_members,
    public.workspace_invites,
    public.task_comments,
    public.workspace_activity,
    public.notifications,
    public.timer_sessions,
    public.pomodoro_history,
    public.quick_sort_sessions,
    public.tombstones
TO authenticated, service_role;

-- Dev user credentials:
--   Email: dev@flowstate.local
--   Password: dev123

-- CRITICAL: Use extensions.crypt() with cost factor 10 to match GoTrue's bcrypt
-- Without this, passwords won't validate against Supabase Auth

-- Create dev user if not exists (idempotent)
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    confirmation_token,
    recovery_token
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '00000000-0000-0000-0000-000000000000',
    'dev@flowstate.local',
    extensions.crypt('dev123', extensions.gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Dev User"}',
    'authenticated',
    'authenticated',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Required auth.identities entry (newer Supabase versions require this)
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","email":"dev@flowstate.local"}',
    'email',
    now(),
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- Log successful seeding
DO $$
BEGIN
    RAISE NOTICE 'FlowState dev user seeded:';
    RAISE NOTICE '  - dev@flowstate.local / dev123';
END $$;

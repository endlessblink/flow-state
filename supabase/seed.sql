-- FlowState Development Seed
-- TASK-317: Auto-creates dev user on fresh database startup
-- This prevents auth.users table reset from breaking local development

-- Dev user credentials:
--   Email: dev@flowstate.local
--   Password: dev123

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
    crypt('dev123', gen_salt('bf')),
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
    RAISE NOTICE 'FlowState dev user seeded: dev@flowstate.local / dev123';
END $$;

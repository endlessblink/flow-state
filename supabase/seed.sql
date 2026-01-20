-- FlowState Development Seed
-- TASK-317: Auto-creates dev user on fresh database startup
-- BUG-339: Fixed password hashing to use extensions prefix and cost factor 10
-- This prevents auth.users table reset from breaking local development

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

-- =============================================================================
-- Production User: endlessblink@gmail.com
-- CRITICAL: This user MUST be seeded to preserve FK relationships with data
-- =============================================================================
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
    '717f5209-42d8-4bb9-8781-740107a384e5',
    '00000000-0000-0000-0000-000000000000',
    'endlessblink@gmail.com',
    extensions.crypt('FlowState2026!', extensions.gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"EndlessBlink"}',
    'authenticated',
    'authenticated',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

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
    '717f5209-42d8-4bb9-8781-740107a384e5',
    '717f5209-42d8-4bb9-8781-740107a384e5',
    '717f5209-42d8-4bb9-8781-740107a384e5',
    '{"sub":"717f5209-42d8-4bb9-8781-740107a384e5","email":"endlessblink@gmail.com"}',
    'email',
    now(),
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- Log successful seeding
DO $$
BEGIN
    RAISE NOTICE 'FlowState users seeded:';
    RAISE NOTICE '  - dev@flowstate.local / dev123';
    RAISE NOTICE '  - endlessblink@gmail.com / FlowState2026!';
END $$;

/**
 * TASK-329: Post-start health check to ensure critical production user exists.
 * This script auto-heals the auth.users table if it was wiped during a restart.
 */
const { execSync } = require('child_process');

const EMAIL = 'endlessblink@gmail.com';
const UUID = '717f5209-42d8-4bb9-8781-740107a384e5';
const PASSWORD = 'FlowState2026!'; // Stable recovery password

function runSql(sql) {
    // Try possible container names (manual docker-compose vs supabase-cli)
    const containers = ['flowstate_db', 'supabase_db_flow-state'];

    for (const container of containers) {
        try {
            // Check if container is running first
            const status = execSync(`docker inspect -f '{{.State.Running}}' ${container} 2>/dev/null`, { encoding: 'utf8' }).trim();
            if (status !== 'true') continue;

            const output = execSync(`docker exec ${container} psql -U postgres -d postgres -t -c "${sql}"`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
            return output.trim();
        } catch (e) {
            // Silently try next container
        }
    }
    return null;
}

async function verify() {
    console.log(`🔍 [TASK-329] Verifying user ${EMAIL}...`);

    const countSql = `SELECT count(*) FROM auth.users WHERE email = '${EMAIL}';`;
    const result = runSql(countSql);

    if (result === null) {
        console.error('❌ [TASK-329] Could not reach database. Is Supabase/Docker running?');
        process.exit(1);
    }

    if (result === '0') {
        console.warn(`⚠️ [TASK-329] User ${EMAIL} missing! Recreating with stable UUID ${UUID}...`);

        // Use crypt from pgcrypto (standard in Supabase) for bcrypt
        const insertSql = `
            -- 1. Insert into auth.users
            INSERT INTO auth.users (
                id, email, encrypted_password, email_confirmed_at, 
                role, aud, confirmation_token, raw_app_meta_data, 
                raw_user_meta_data, created_at, updated_at, 
                last_sign_in_at, email_change, email_change_token_new,
                email_change_token_current, phone_change, phone_change_token,
                reauthentication_token
            )
            VALUES (
                '${UUID}', '${EMAIL}', crypt('${PASSWORD}', gen_salt('bf')), now(), 
                'authenticated', 'authenticated', '', '{"provider":"email","providers":["email"]}', 
                '{}', now(), now(), now(), '', '', '', '', '', ''
            );
            
            -- 2. Insert into auth.identities
            INSERT INTO auth.identities (
                id, user_id, provider_id, identity_data, provider, 
                last_sign_in_at, created_at, updated_at
            )
            VALUES (
                '${UUID}', '${UUID}', '${UUID}', '{"sub":"${UUID}","email":"${EMAIL}"}', 
                'email', now(), now(), now()
            );
        `;

        const insertResult = runSql(insertSql);
        if (insertResult !== null) {
            console.log(`✅ [TASK-329] User ${EMAIL} successfully recreated.`);
            console.log(`ℹ️ [RECOVERY] Login with: ${EMAIL} / ${PASSWORD}`);
        } else {
            console.error(`❌ [TASK-329] Failed to recreate user. Check docker logs.`);
        }
    } else {
        console.log(`✅ [TASK-329] User ${EMAIL} is present and healthy.`);
    }
}

verify().catch(err => {
    console.error('💥 [TASK-329] Script failed:', err);
    process.exit(1);
});

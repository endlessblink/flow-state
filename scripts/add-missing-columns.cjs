
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function run() {
    await client.connect();
    try {
        console.log('Adding missing columns to tasks table...');

        await client.query(`
      ALTER TABLE public.tasks 
      ADD COLUMN IF NOT EXISTS instances jsonb default '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS connection_types jsonb,
      ADD COLUMN IF NOT EXISTS recurring_instances jsonb default '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS recurrence jsonb,
      ADD COLUMN IF NOT EXISTS notification_prefs jsonb;
    `);

        console.log('Columns added successfully.');

        // Force schema cache reload via notify (Supabase specific trick, but ALTER usually does it)
        await client.query(`NOTIFY pgrst, 'reload schema'`);

    } catch (err) {
        console.error('Error executing schema update:', err);
    } finally {
        await client.end();
    }
}

run();

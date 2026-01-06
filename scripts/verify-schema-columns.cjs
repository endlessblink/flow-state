
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

const REQUIRED_COLUMNS = [
    'connection_types',
    'instances',
    'recurrence',
    'recurring_instances',
    'notification_prefs'
];

async function verify() {
    await client.connect();
    try {
        console.log('Verifying columns in public.tasks...');

        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'tasks';
    `);

        const existingColumns = res.rows.map(r => r.column_name);
        const missing = REQUIRED_COLUMNS.filter(col => !existingColumns.includes(col));

        if (missing.length > 0) {
            console.error('❌ Still missing columns:', missing);
            process.exit(1);
        } else {
            console.log('✅ All required columns are present:');
            REQUIRED_COLUMNS.forEach(col => console.log(`   - ${col}`));
        }

    } catch (err) {
        console.error('Error verifying schema:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

verify();

const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function verify() {
    try {
        await client.connect();
        console.log('Connected to database.');

        const tables = ['projects', 'tasks', 'groups'];

        for (const table of tables) {
            try {
                const res = await client.query(`SELECT count(*) FROM public.${table}`);
                console.log(`Table '${table}' exists. Row count: ${res.rows[0].count}`);
            } catch (err) {
                console.error(`Error querying table '${table}':`, err.message);
            }
        }

    } catch (err) {
        console.error('Database connection failed:', err);
    } finally {
        await client.end();
    }
}

verify();

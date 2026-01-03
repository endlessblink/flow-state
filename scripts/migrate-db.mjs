import fetch from 'node-fetch';

const SRC = 'http://admin:pomoflow-2024@84.46.253.137:5984/pomoflow-tasks';
const DEST = 'http://admin:pomoflow-2024@84.46.253.137:5984/pomoflow-tasks-v3';

async function migrate() {
    console.log('Fetching all docs from source...');
    const response = await fetch(`${SRC}/_all_docs?include_docs=true`);
    const data = await response.json();

    console.log(`Found ${data.total_rows} total rows.`);
    const activeDocs = data.rows
        .map(r => r.doc)
        .filter(doc => doc && !doc._deleted);

    console.log(`Found ${activeDocs.length} active documents. Migrating...`);

    for (const doc of activeDocs) {
        const cleanDoc = { ...doc };
        delete cleanDoc._rev; // Start fresh revision history

        const res = await fetch(`${DEST}/${doc._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanDoc)
        });

        if (res.ok) {
            console.log(`✅ Migrated: ${doc._id}`);
        } else {
            console.error(`❌ Failed: ${doc._id}`, await res.text());
        }
    }

    console.log('Migration Complete.');
}

migrate().catch(console.error);

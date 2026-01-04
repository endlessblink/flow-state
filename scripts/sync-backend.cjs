const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
    user: 'user',
    host: 'postgres', // Internal Docker host
    database: 'pomoflow',
    password: 'password',
    port: 5432,
});

const SECRET = 'dev_secret';

/**
 * Minimal Sync Backend for PowerSync Upstream (Client -> Postgres)
 * 
 * PowerSync Service handles Downstream (Postgres -> Client).
 * This API handles the Upload Queue (Client -> Postgres).
 */
app.get('/.well-known/jwks.json', (req, res) => {
    console.log(`📡 [BACKEND] JWKS requested by ${req.ip}`);
    const jwksPath = path.join(__dirname, 'jwks.json');
    if (fs.existsSync(jwksPath)) {
        res.sendFile(jwksPath);
    } else {
        res.status(404).send('JWKS not found');
    }
});

app.post('/upload', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send('Unauthorized');

    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, SECRET);

        const { batch } = req.body;
        console.debug(`🚀 [BACKEND] Processing ${batch.length} operations...`);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const op of batch) {
                console.log(`📦 [BACKEND] Op: ${op.op} | Table: ${op.table} | ID: ${op.id} | Has opData: ${!!(op.opData || op.data)}`);
                console.debug('RAW OP:', JSON.stringify(op));

                if (op.op === 'PUT') {
                    const table = op.type || op.table;
                    const data = op.data || op.opData;
                    if (!table || !data) {
                        console.warn(`⚠️ [BACKEND] Skipping invalid ${op.op} op: table or data missing`);
                        continue;
                    }

                    const columns = Object.keys(data).filter(k => k !== 'id');
                    const values = columns.map(k => data[k]);
                    const rowId = op.id || data.id;

                    console.log(`📝 [BACKEND] Upserting to ${table} | ID: ${rowId}`);

                    const query = `
                        INSERT INTO "${table}" ("id", ${columns.map(k => `"${k}"`).join(', ')})
                        VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')})
                        ON CONFLICT (id) DO UPDATE SET
                        ${columns.map((k, i) => `"${k}" = $${i + 2}`).join(', ')}
                    `;

                    await client.query(query, [rowId, ...values]);
                } else if (op.op === 'PATCH') {
                    const table = op.type || op.table;
                    const data = op.data || op.opData;
                    const rowId = op.id || data?.id;
                    if (!table || !data || !rowId) {
                        console.warn(`⚠️ [BACKEND] Skipping invalid PATCH op: table, data, or ID missing`);
                        continue;
                    }

                    const columns = Object.keys(data).filter(k => k !== 'id');
                    const values = columns.map(k => data[k]);

                    console.log(`📝 [BACKEND] Patching ${table} | ID: ${rowId} | Keys: ${columns.join(', ')}`);

                    const query = `
                        UPDATE "${table}" SET
                        ${columns.map((k, i) => `"${k}" = $${i + 2}`).join(', ')}
                        WHERE "id" = $1
                    `;

                    await client.query(query, [rowId, ...values]);
                } else if (op.op === 'DELETE') {
                    const table = op.type || op.table;
                    if (!table || !op.id) {
                        console.warn('⚠️ [BACKEND] Skipping invalid DELETE op: table or id missing');
                        continue;
                    }
                    await client.query(`DELETE FROM "${table}" WHERE "id" = $1`, [op.id]);
                }
            }
            await client.query('COMMIT');
            res.status(200).json({ ok: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ [BACKEND] DB Error:', err);
            res.status(500).send(err.message);
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(401).send('Invalid Token');
    }
});

app.listen(3000, () => {
    console.log('🚀 [SYNC-BACKEND] Listening on port 3000');
});

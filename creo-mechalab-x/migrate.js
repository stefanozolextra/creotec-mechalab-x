require('dotenv').config({ path: './server/.env' });
const pool = require('./server/db');

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_action_logs (
                action_id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                occurred_at TIMESTAMPTZ DEFAULT NOW(),
                batch_code VARCHAR(255),
                actor_account_id INTEGER REFERENCES accounts(account_id) ON DELETE SET NULL,
                message TEXT NOT NULL,
                meta JSONB
            );
        `);
        console.log('admin_action_logs table created successfully!');
    } catch (e) {
        console.error('Error creating table:', e);
    } finally {
        pool.end();
    }
}

run();

const pkg = require('pg');
require('dotenv').config();

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'circular',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Migrating admin table...');
    await client.query(`
      ALTER TABLE admin ADD COLUMN IF NOT EXISTS a_role VARCHAR(50);
      ALTER TABLE admin ADD COLUMN IF NOT EXISTS a_parent_id INTEGER REFERENCES admin(a_id);
      ALTER TABLE admin ADD COLUMN IF NOT EXISTS a_position VARCHAR(255);
    `);

    console.log('Migrating c_information table...');
    await client.query(`
      ALTER TABLE c_information ADD COLUMN IF NOT EXISTS in_workflow_status VARCHAR(50) DEFAULT 'DRAFT';
      ALTER TABLE c_information ADD COLUMN IF NOT EXISTS in_current_owner_id INTEGER REFERENCES admin(a_id);
      ALTER TABLE c_information ADD COLUMN IF NOT EXISTS in_creator_id INTEGER REFERENCES admin(a_id);
    `);

    console.log('Creating c_workflow_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS c_workflow_history (
          wh_id SERIAL PRIMARY KEY,
          in_id INTEGER REFERENCES c_information(in_id) ON DELETE CASCADE,
          from_user_id INTEGER REFERENCES admin(a_id),
          to_user_id INTEGER REFERENCES admin(a_id),
          action VARCHAR(50),
          comments TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

import pool from './src/config/database.js';

async function fixSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if table has data
    const res = await client.query('SELECT COUNT(*) FROM c_workflow_history');
    console.log(`Current rows in c_workflow_history: ${res.rows[0].count}`);

    // Drop old table
    await client.query('DROP TABLE c_workflow_history');
    console.log('Dropped old c_workflow_history table.');

    // Recreate new table
    await client.query(`
      CREATE TABLE c_workflow_history (
          wh_id SERIAL PRIMARY KEY,
          in_id INTEGER REFERENCES c_information(in_id) ON DELETE CASCADE,
          from_user_id INTEGER REFERENCES admin(a_id),
          from_user_name VARCHAR(255),
          from_user_position VARCHAR(255),
          to_user_id INTEGER REFERENCES admin(a_id),
          to_user_name VARCHAR(255),
          to_user_position VARCHAR(255),
          action VARCHAR(50),
          comments TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Created new c_workflow_history table with correct schema.');

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

fixSchema();

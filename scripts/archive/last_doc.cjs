const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular' });

async function run() {
  try {
    const res = await pool.query(`
      SELECT in_id, in_num_date, in_workflow_status, in_current_owner_id, created_at
      FROM c_information
      ORDER BY in_id DESC LIMIT 5
    `);
    console.log('Recent records:', res.rows);

    const users = await pool.query(`
      SELECT a_id, a_username, a_role FROM a_users WHERE a_username = 'wanch' OR a_id = 7
    `);
    console.log('Users:', users.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();

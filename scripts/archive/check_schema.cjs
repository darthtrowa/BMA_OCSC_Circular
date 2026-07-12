import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  user: 'root',
  host: 'localhost',
  database: 'circular_db',
  password: 'root',
  port: 5432,
});

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'c_workflow_history';
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkSchema();

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ocsc_circular',
  password: 'MKhNYeMDtZ4nuUCy',
  port: 5432,
});

async function main() {
  try {
    const res = await pool.query('SELECT * FROM c_workflow_delegations LIMIT 1');
    if (res.rows.length > 0) {
      console.log(Object.keys(res.rows[0]));
      console.log(res.rows[0]);
    } else {
      console.log('No delegations found');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();

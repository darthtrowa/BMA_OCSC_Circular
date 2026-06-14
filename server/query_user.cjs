const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular' });

async function run() {
  try {
    const delRes = await pool.query("SELECT * FROM c_workflow_delegations WHERE assigner_id = 9 OR assignee_id = 9");
    console.log("Delegations for user 9:");
    console.log(delRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();

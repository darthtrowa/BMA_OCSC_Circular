const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular' });

async function run() {
  try {
    const docRes = await pool.query("SELECT in_id, in_detail, in_num_date, in_workflow_status, in_current_owner_id, in_flow_state FROM c_information WHERE in_detail LIKE '%ว5/2569%' OR in_num_date LIKE '%ว5/2569%'");
    console.log('Doc:', docRes.rows);
    if (docRes.rows.length > 0) {
      const hRes = await pool.query('SELECT * FROM c_workflow_history WHERE in_id = $1 ORDER BY created_at DESC LIMIT 5', [docRes.rows[0].in_id]);
      console.log('History:', hRes.rows);
    }
  } finally {
    pool.end();
  }
}
run();

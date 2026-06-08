const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular?schema=public' });

async function check() {
  const res = await pool.query("SELECT ag_id, ag_name, parent_ag_id FROM c_agency WHERE ag_id IN (41, 46, 47)");
  console.table(res.rows);
  process.exit(0);
}
check().catch(console.error);

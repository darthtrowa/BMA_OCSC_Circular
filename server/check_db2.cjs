const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular?schema=public' });

async function check() {
  const res = await pool.query("SELECT a_id, a_username, a_role, a_agency_id, a_position FROM admin WHERE a_role IN ('COORDINATOR', 'STAFF', 'GRP_LEADER') LIMIT 20");
  console.table(res.rows);
  process.exit(0);
}
check().catch(console.error);

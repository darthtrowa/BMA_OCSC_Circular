const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://bma_user:bma_password@localhost:5432/bma_circular' });
pool.query("SELECT a_id, a_username, a_role, a_agency_id, a_position FROM admin WHERE a_role IN ('COORDINATOR', 'STAFF', 'GRP_LEADER') LIMIT 20")
.then(res => { console.table(res.rows); process.exit(0); })
.catch(e => { console.error(e); process.exit(1); });

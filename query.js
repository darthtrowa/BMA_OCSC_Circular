const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/circular_db' });

pool.query('SELECT a_id, a_name, a_role, a_parent_id FROM admin ORDER BY a_id').then(res => {
  console.table(res.rows);
  pool.end();
});

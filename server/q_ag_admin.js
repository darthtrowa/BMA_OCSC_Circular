import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular' });
pool.query('SELECT a_id, a_username, a_agency_id FROM admin ORDER BY a_id').then(res => {
  console.table(res.rows);
  pool.end();
});

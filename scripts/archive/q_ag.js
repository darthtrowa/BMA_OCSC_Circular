import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular' });
pool.query('SELECT * FROM c_agency').then(res => {
  console.table(res.rows);
  pool.end();
});

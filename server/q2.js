import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular' });
pool.query('UPDATE admin SET a_parent_id = 4 WHERE a_id = 6').then(() => {
  console.log('Updated jojosan24 parent to nataga_s');
  pool.end();
});

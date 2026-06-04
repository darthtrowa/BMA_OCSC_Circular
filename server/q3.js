import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular' });
const queries = [
  'UPDATE admin SET a_parent_id = 4 WHERE a_id = 6', // jojosan24 -> nataga_s
  'UPDATE admin SET a_parent_id = 6 WHERE a_id = 7', // busarin_r -> jojosan24
  'UPDATE admin SET a_parent_id = 6 WHERE a_id = 8', // wanchalerm_c -> jojosan24
  'UPDATE admin SET a_parent_id = 5 WHERE a_id = 2', // admincsc01 -> parichart_c
];
Promise.all(queries.map(q => pool.query(q))).then(() => {
  console.log('Hierarchy updated for all test users');
  pool.end();
});

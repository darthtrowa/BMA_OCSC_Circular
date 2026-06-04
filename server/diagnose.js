import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular' });

// Check workflow history columns
const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='c_workflow_history' ORDER BY ordinal_position`);
console.log('=== c_workflow_history columns ===');
console.table(res.rows);

// Check c_information columns relevant to workflow
const res2 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='c_information' AND column_name LIKE '%workflow%' OR column_name LIKE '%owner%' OR column_name LIKE '%status%' ORDER BY ordinal_position`);
console.log('=== c_information workflow/owner columns ===');
console.table(res2.rows);

// Sample history
const res3 = await pool.query(`SELECT * FROM c_workflow_history ORDER BY wh_id DESC LIMIT 5`);
console.log('=== Recent workflow history ===');
console.table(res3.rows);

pool.end();

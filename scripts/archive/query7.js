import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  const res = await pool.query(`
    SELECT in_num_date, in_current_owner_id, in_is_parallel, in_flow_state FROM c_information WHERE in_id = 187
  `);
  console.log(res.rows);
  
  // also check if any other parallel tracks are stuck
  const res2 = await pool.query(`
    SELECT pa_id, in_id, current_owner_id FROM c_parallel_assignments WHERE in_id = 187
  `);
  console.log('Parallel tracks:', res2.rows);

  process.exit(0);
}
run();

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
    SELECT in_id, in_num_date, in_detail, in_workflow_status, in_flow_state, in_current_owner_id, in_is_parallel
    FROM c_information
    WHERE in_detail LIKE '%การปรับปรุงมาตรฐานกำหนดตำแหน่งสายงานสำรวจดิน%'
  `);
  console.log('Found documents:', res.rows);
  
  if (res.rows.length === 1) {
    const docId = res.rows[0].in_id;
    await pool.query("UPDATE c_information SET in_flow_state = 'out' WHERE in_id = $1", [docId]);
    console.log(`Updated document ${docId} to out state`);
  }
  process.exit(0);
}
run();

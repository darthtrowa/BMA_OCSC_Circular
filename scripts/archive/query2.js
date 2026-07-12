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
    SELECT a.a_id, a.a_username, a.a_role, a.a_agency_id, ag.ag_name, ag.ag_type, ag.parent_ag_id 
    FROM admin a 
    LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id 
    WHERE a.a_username = 'somboon_p' OR a.a_role = 'STAFF'
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();

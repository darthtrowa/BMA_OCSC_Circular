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
  await pool.query("UPDATE admin SET a_role = 'GRP_LEADER' WHERE a_username = 'somboon_p'");
  const res = await pool.query("SELECT a_id, a_username, a_role, a_position FROM admin WHERE a_role != 'STAFF'");
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();

import pool from './src/config/database.js';

async function checkAdmin() {
  try {
    const res = await pool.query(`SELECT a_id, a_username, a_name, a_role, a_permiss FROM admin WHERE a_id = 2`);
    console.log(res.rows[0]);
    
    // get all admins
    const res2 = await pool.query(`SELECT a_id, a_username, a_name, a_role, a_permiss FROM admin`);
    console.log(res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkAdmin();

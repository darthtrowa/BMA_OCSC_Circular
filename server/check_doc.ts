import pool from './src/config/database.js';

async function checkDoc() {
  try {
    const res = await pool.query(`
      SELECT in_id, in_workflow_status, in_current_owner_id, in_creator_id 
      FROM c_information 
      WHERE in_id = 509;
    `);
    console.log('Doc 509:', res.rows[0]);
    
    const adminRes = await pool.query(`
      SELECT a_id, a_username, a_role, permiss
      FROM admin
      WHERE a_id = $1;
    `, [res.rows[0]?.in_current_owner_id]);
    console.log('Owner details:', adminRes.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkDoc();

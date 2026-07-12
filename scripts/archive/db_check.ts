import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/circular_db'
});

async function check() {
  try {
    const agRes = await db.query(`SELECT ag_id, ag_name, parent_ag_id, ag_type, ag_role FROM c_agency WHERE ag_id IN (2, 48)`);
    console.log("Agencies:", agRes.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await db.end();
  }
}

check();

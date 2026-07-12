import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/circular_db'
});

async function run() {
  try {
    const res = await db.query('SELECT ag_id, ag_name, parent_ag_id FROM c_agency LIMIT 10');
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await db.end();
  }
}

run();

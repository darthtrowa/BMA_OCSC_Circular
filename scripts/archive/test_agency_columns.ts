import db from './src/config/database.js';

async function test() {
  const { rows } = await db.query('SELECT * FROM c_agency LIMIT 1');
  console.log('Columns:', Object.keys(rows[0]));
  process.exit(0);
}
test();

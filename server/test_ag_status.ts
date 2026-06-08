import db from './src/config/database.js';

async function test() {
  const { rows } = await db.query('SELECT DISTINCT ag_status FROM c_agency');
  console.log('Statuses:', rows);
  process.exit(0);
}
test();

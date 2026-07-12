import db from './src/config/database.js';

async function testApi() {
  const { rows } = await db.query('SELECT ag_id, ag_name, parent_ag_id FROM c_agency WHERE ag_id IN (41, 47)');
  console.log(rows);
  process.exit(0);
}
testApi();

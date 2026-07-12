import db from './src/config/database.js';

async function testApi() {
  const { rows } = await db.query('SELECT a_id, a_name, a_role, a_agency_id FROM admin WHERE a_username = $1', ['wanchalerm_c']);
  console.log(rows);
  process.exit(0);
}
testApi();

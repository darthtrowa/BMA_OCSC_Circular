import db from './src/config/database.js';

async function testApi() {
  const { rows } = await db.query("SELECT a_id, a_username, a_name, a_role, a_agency_id, a_status FROM admin WHERE a_role = 'GRP_LEADER'");
  console.log('All GRP_LEADERs:', rows);
  process.exit(0);
}
testApi();

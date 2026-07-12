import db from './src/config/database.js';

async function test() {
  const { rows } = await db.query('SELECT ag_id, ag_name, parent_ag_id, ag_type FROM c_agency ORDER BY agency_ordering ASC');
  console.log('Sample agency row:', rows[0]);
  console.log('Agency with parent:', rows.find(r => r.parent_ag_id));
  console.log('Agencies with !parent_ag_id:', rows.filter(r => !r.parent_ag_id).length);
  process.exit(0);
}
test();

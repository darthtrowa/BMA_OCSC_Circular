import db from './src/config/database.js';

async function test() {
  const { rows } = await db.query('SELECT ag_id, ag_name, parent_ag_id FROM c_agency ORDER BY agency_ordering ASC');
  console.log('All agencies:');
  rows.forEach(r => {
    console.log(`- [${r.ag_id}] ${r.ag_name} (Parent: ${r.parent_ag_id})`);
  });
  process.exit(0);
}
test();

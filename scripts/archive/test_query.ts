import db from './src/config/database.js';

async function check() {
  const { rows } = await db.query('SELECT ag_id, ag_name, parent_ag_id, ag_type FROM c_agency');
  console.log('Total:', rows.length);
  console.log('Top level:', rows.filter(r => !r.parent_ag_id).map(r => r.ag_name));
  console.log('Department type:', rows.filter(r => r.ag_type === 'DEPARTMENT').map(r => r.ag_name));
  process.exit(0);
}
check();

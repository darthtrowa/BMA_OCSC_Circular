import { db } from './src/db.js'; db.query('SELECT a_id, a_name, a_role, a_agency_id FROM admin').then(r => { console.log(r.rows); process.exit(0); }).catch(console.error);

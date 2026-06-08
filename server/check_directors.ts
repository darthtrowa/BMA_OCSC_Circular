import db from './src/config/database.js';

async function main() {
  const { rows } = await db.query(`
    SELECT a.a_id, a.a_name, a.a_role, a.a_agency_id, ag.ag_name, ag.parent_ag_id, p_ag.ag_name as parent_ag_name
    FROM admin a
    LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
    LEFT JOIN c_agency p_ag ON ag.parent_ag_id = p_ag.ag_id
    WHERE a.a_status = '1'
  `);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main();

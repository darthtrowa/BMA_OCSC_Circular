import db from './src/config/database.js';
async function run() {
  const users = await db.query("SELECT a_id, a_name, a_role, a_agency_id FROM admin WHERE a_role = 'HR_DIRECTOR'");
  console.log("HR_DIRECTOR users:", users.rows);
  
  const hragency = await db.query("SELECT ag_id, ag_name FROM c_agency WHERE ag_name LIKE '%ศสท%' OR ag_name LIKE '%บริหารทรัพยากรบุคคล%'");
  console.log("HR Agencies:", hragency.rows);
  process.exit(0);
}
run();

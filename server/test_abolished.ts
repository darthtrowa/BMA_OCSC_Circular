import db from './src/config/database.js';

async function test() {
  const { rows } = await db.query('SELECT ag_id, ag_name, ag_status, parent_ag_id FROM c_agency WHERE ag_name IN (\'กองทะเบียนประวัติข้าราชการ\', \'กองอัตรากำลัง\', \'กองระบบงาน\', \'กองวินัยและส่งเสริมสมรรถภาพ\')');
  console.log(rows);
  process.exit(0);
}
test();

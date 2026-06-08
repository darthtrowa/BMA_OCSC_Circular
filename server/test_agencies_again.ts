import db from './src/config/database.js';

async function test() {
  const { rows } = await db.query('SELECT ag_id, ag_name, parent_ag_id, ag_type FROM c_agency WHERE ag_status = \'active\'');
  const positions = rows.filter(r => r.ag_type === 'POSITION');
  console.log('Positions count:', positions.length);
  const tops = rows.filter(r => !r.parent_ag_id && r.ag_type !== 'POSITION');
  console.log('Top level (no parent, no position):');
  tops.forEach(r => console.log(r.ag_name));
  
  const level2 = rows.filter(r => r.ag_name.includes('กลุ่มงานสรรหา') || r.ag_name.includes('ฝ่ายบริหารงานทั่วไป'));
  console.log('Level 2 check:');
  level2.forEach(r => console.log(r.ag_name, 'Parent:', r.parent_ag_id, 'Type:', r.ag_type));
  process.exit(0);
}
test();

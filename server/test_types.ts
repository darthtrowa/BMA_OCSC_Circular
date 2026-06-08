import { getCachedQuery } from './src/utils/cache.js';
async function test() {
  const result = await getCachedQuery("SELECT ag_id, ag_name, parent_ag_id FROM c_agency WHERE ag_status = 'active' ORDER BY agency_ordering ASC");
  console.log('Result type for parent_ag_id:', typeof result.rows[0].parent_ag_id);
  console.log('Sample for กลุ่มงานสรรหาบุคคล 1:', result.rows.find((r:any) => r.ag_name.includes('กลุ่มงานสรรหาบุคคล 1')));
  process.exit(0);
}
test();

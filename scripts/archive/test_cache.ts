import { getCachedQuery } from './src/utils/cache.js';
async function test() {
  const result = await getCachedQuery("SELECT ag_id, ag_name, parent_ag_id, ag_type FROM c_agency WHERE ag_status = 'active' ORDER BY agency_ordering ASC");
  console.log(result.rows.find(r => r.ag_name.includes('กลุ่มงานสรรหาบุคคล 1')));
  process.exit(0);
}
test();

import { getCachedQuery } from './src/utils/cache.js';
async function test() {
  const result = await getCachedQuery("SELECT ag_id, ag_name, parent_ag_id, ag_type FROM c_agency WHERE ag_status = 'active' ORDER BY agency_ordering ASC");
  const matches = result.rows.filter((r:any) => r.ag_name.includes('กลุ่มงานสรรหาบุคคล 1'));
  console.log('Matches:', matches);
  process.exit(0);
}
test();

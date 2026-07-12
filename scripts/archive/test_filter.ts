import db from './src/config/database.js';

async function testApi() {
  const effectiveUserId = 8;
  const roles = 'GRP_LEADER';
  
  const { rows: effRows } = await db.query(
    `SELECT a_role, a_agency_id FROM admin WHERE a_id = $1`,
    [effectiveUserId]
  );

  let effectiveUserRole = effRows[0].a_role;
  let effectiveUserAgencyId = effRows[0].a_agency_id;
  let effectiveUserAgencyParentId = null;

  if (effectiveUserAgencyId) {
    const { rows: effAg } = await db.query(
      'SELECT parent_ag_id FROM c_agency WHERE ag_id = $1',
      [effectiveUserAgencyId]
    );
    if (effAg.length > 0 && effAg[0].parent_ag_id) {
      effectiveUserAgencyParentId = Number(effAg[0].parent_ag_id);
    }
  }

  const params = ['1'];
  let sql = `SELECT a.a_id, a.a_name, a.a_role, a.a_position, a.a_agency_id, c.parent_ag_id 
         FROM admin a 
         LEFT JOIN c_agency c ON a.a_agency_id = c.ag_id 
         WHERE a.a_status = $1`;
  sql += ` AND a_role IN ($2)`;
  params.push('GRP_LEADER');

  let { rows } = await db.query(sql, params);

  console.log('SQL result:', rows);

  const isRequestingGrpLeader = roles && roles.includes('GRP_LEADER');
  console.log('isRequestingGrpLeader:', isRequestingGrpLeader);

  rows = rows.filter((r) => {
    if (isRequestingGrpLeader && r.a_role === 'GRP_LEADER') {
        console.log('Checking GRP_LEADER', r.a_name);
        if (Number(r.a_agency_id) === Number(effectiveUserAgencyId)) return true;
        console.log('1. ', effectiveUserAgencyParentId, r.parent_ag_id);
        if (effectiveUserAgencyParentId && Number(r.parent_ag_id) === Number(effectiveUserAgencyParentId)) return true;
        console.log('2. ', effectiveUserAgencyParentId, r.a_agency_id);
        if (effectiveUserAgencyParentId && Number(r.a_agency_id) === Number(effectiveUserAgencyParentId)) return true;
        return false;
    }
    return false;
  });

  console.log('After filter:', rows);
  process.exit(0);
}
testApi();

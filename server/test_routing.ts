import db from './src/config/database.js';

async function testApi() {
  const effectiveUserId = 8; // wanchalerm_c
  const roles = 'GRP_LEADER';
  
  const { rows: effRows } = await db.query(
    `SELECT a.a_role, a.a_agency_id, ag.parent_ag_id
     FROM admin a
     LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
     WHERE a.a_id = $1`,
    [effectiveUserId]
  );
  
  let effectiveUserRole = effRows[0].a_role;
  let effectiveUserAgencyId = effRows[0].a_agency_id;
  let effectiveUserAgencyParentId = effRows[0].parent_ag_id;

  let childAgencyIds: number[] = [];
  let ancestorAgencyIds: number[] = [];

  if (effectiveUserAgencyId) {
    const { rows: childRows } = await db.query(
      'SELECT ag_id FROM c_agency WHERE parent_ag_id = $1',
      [effectiveUserAgencyId]
    );
    childAgencyIds = childRows.map((r: any) => r.ag_id);

    const { rows: ancestorRows } = await db.query(
      `WITH RECURSIVE ancestors AS (
         SELECT ag_id, parent_ag_id FROM c_agency WHERE ag_id = $1
         UNION
         SELECT c.ag_id, c.parent_ag_id FROM c_agency c
         INNER JOIN ancestors a ON c.ag_id = a.parent_ag_id
       )
       SELECT ag_id FROM ancestors`,
      [effectiveUserAgencyId]
    );
    ancestorAgencyIds = ancestorRows.map((r: any) => Number(r.ag_id));
  }

  const params: any[] = ['1'];
  let sql = `SELECT a.a_id, a.a_name, a.a_role, a.a_position, a.a_agency_id, c.parent_ag_id 
         FROM admin a 
         LEFT JOIN c_agency c ON a.a_agency_id = c.ag_id 
         WHERE a.a_status = $1`;
  const roleList = ['GRP_LEADER'];
  sql += ` AND a_role IN ($2)`;
  params.push(...roleList);

  let { rows } = await db.query(sql, params);
  
  console.log('Before filter:', rows.map(r => r.a_name));

  rows = rows.filter((r: any) => r.a_role !== 'SYSTEM_ADMIN' && r.a_role !== 'SUPERADMIN');

  if (effectiveUserRole !== 'SUPERADMIN' && effectiveUserRole !== 'SYSTEM_ADMIN') {
    if (effectiveUserRole === 'DIV_DIRECTOR' || effectiveUserRole === 'HR_DIRECTOR') {
      rows = rows.filter((r: any) =>
        r.a_role === 'DIV_DIRECTOR' ||
        r.a_role === 'HR_DIRECTOR' ||
        childAgencyIds.includes(Number(r.a_agency_id))
      );
    } else {
      const isRequestingGrpLeader = roles && roles.includes('GRP_LEADER');
      rows = rows.filter((r: any) => {
        if (isRequestingGrpLeader && r.a_role === 'GRP_LEADER') {
            if (Number(r.a_agency_id) === Number(effectiveUserAgencyId)) return true;
            if (effectiveUserAgencyParentId && Number(r.parent_ag_id) === Number(effectiveUserAgencyParentId)) return true;
            if (effectiveUserAgencyParentId && Number(r.a_agency_id) === Number(effectiveUserAgencyParentId)) return true;
            return false;
        }
        
        if ((r.a_role === 'DIV_DIRECTOR' || r.a_role === 'HR_DIRECTOR') && 
            ancestorAgencyIds.includes(Number(r.parent_ag_id))) {
            return true;
        }
        
        if (Number(r.a_agency_id) === Number(effectiveUserAgencyId)) return true;
        if (effectiveUserAgencyParentId && Number(r.parent_ag_id) === Number(effectiveUserAgencyParentId)) return true;
        
        return (effectiveUserAgencyParentId && Number(r.a_agency_id) === Number(effectiveUserAgencyParentId)) ||
               childAgencyIds.includes(Number(r.a_agency_id));
      });
    }
    console.log('After role filter:', rows.map(r => r.a_name));
    rows = rows.filter((r: any) => r.a_id !== effectiveUserId);
    console.log('After exclude self:', rows.map(r => r.a_name));
  }

  // --- Attach acting delegates ---
  if (rows.length > 0) {
    const userAgIds = [...new Set(rows.map((r: any) => r.a_agency_id).filter(Boolean))];
    let delegations: any[] = [];
    
    if (userAgIds.length > 0) {
      const placeholdersAg = userAgIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
      const { rows: dRows } = await db.query(
        `SELECT d.assigner_ag_id, assignee.a_id AS assignee_id, assignee.a_name AS assignee_name
         FROM c_workflow_delegations d
         JOIN admin assignee ON assignee.a_id = d.assignee_id
         WHERE d.is_active = TRUE AND d.assigner_ag_id IN (${placeholdersAg})`,
        userAgIds
      );
      delegations = dRows;
    }

    console.log('delegations found:', delegations);
    const delegationMap = new Map<number, any>();
    delegations.forEach((d: any) => delegationMap.set(d.assigner_ag_id, d));

    const finalRows: any[] = [];
    rows.forEach((r: any) => {
      finalRows.push(r);
      if (r.a_agency_id && delegationMap.has(r.a_agency_id)) {
        const del = delegationMap.get(r.a_agency_id);
        finalRows.push({
          ...r,
          a_id: del.assignee_id,
          a_name: `${del.assignee_name} (รักษาการแทน ${r.a_name})`,
          isActing: true,
          actingFor: r.a_name
        });
      }
    });
    console.log('FINAL RESULT:');
    console.log(finalRows);
  } else {
    console.log('FINAL RESULT: EMPTY');
  }
  process.exit(0);
}
testApi();

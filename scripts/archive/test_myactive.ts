import db from './src/config/database.js';

async function testApi() {
  const assigneeId = 8;
  const { rows } = await db.query(`
      SELECT
        d.delegation_id,
        d.delegated_role,
        d.notes,
        COALESCE(d.assigner_id, ag_admin.a_id) AS assigner_id,
        COALESCE(assigner.a_name, ag_admin.a_name, assigner_ag.ag_name) AS assigner_name,
        COALESCE(assigner.a_role, ag_admin.a_role, assigner_ag.ag_role) AS assigner_role,
        COALESCE(assigner.a_position, ag_admin.a_position, assigner_ag.ag_name) AS assigner_position
      FROM   c_workflow_delegations d
      LEFT JOIN admin assigner ON assigner.a_id = d.assigner_id
      LEFT JOIN c_agency assigner_ag ON assigner_ag.ag_id = d.assigner_ag_id
      LEFT JOIN admin ag_admin ON ag_admin.a_agency_id = d.assigner_ag_id AND ag_admin.a_status = '1'
      WHERE  d.assignee_id = $1
        AND  d.is_active   = TRUE
      ORDER  BY d.created_at DESC
  `, [assigneeId]);
  
  console.log('my-active:', rows);
  process.exit(0);
}
testApi();

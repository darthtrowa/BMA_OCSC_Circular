import db from './src/config/database.js';
async function run() {
  const agRes = await db.query("SELECT ag_id, ag_name, ag_template_id FROM c_agency WHERE ag_name LIKE '%โครงสร้างและอัตรากำลัง%'");
  if(agRes.rows.length) {
    console.log("Agency:", agRes.rows[0]);
    const templateId = agRes.rows[0].ag_template_id;
    if(templateId) {
      const nodeRes = await db.query("SELECT n.* FROM workflow_nodes n LEFT JOIN workflow_edges e ON n.node_id = e.target_node_id WHERE n.template_id = $1 AND e.edge_id IS NULL LIMIT 1", [templateId]);
      console.log("First Node:", nodeRes.rows[0]);

      // Check users in this agency matching the first node
      const firstNode = nodeRes.rows[0];
      if (firstNode) {
         console.log("Assignee Type:", firstNode.assignee_type, "Target Role:", firstNode.target_role);
         const u = await db.query("SELECT a_id, a_name, a_role, a_position, a_status FROM admin WHERE a_agency_id = $1", [agRes.rows[0].ag_id]);
         console.log("All users in this agency:", u.rows);
         
         const acting = await db.query("SELECT * FROM c_workflow_delegations WHERE assigner_ag_id = $1", [agRes.rows[0].ag_id]);
         console.log("Acting roles in this agency:", acting.rows);
      }
    }
  }
  process.exit(0);
}
run();

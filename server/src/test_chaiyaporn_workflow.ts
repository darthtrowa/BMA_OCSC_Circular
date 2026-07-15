import db from "./config/database.js";
import { WorkflowService } from "./services/workflowService.js";

async function main() {
  const docId = 58;
  const chaiyapornId = 11; // นายชัยพร รัตนดิลก ณ ภูเก็ต (GRP_LEADER)

  try {
    console.log("=== Backing up document 58 ===");
    const originalRes = await db.query(
      "SELECT in_workflow_status, in_current_owner_id, in_flow_state FROM c_information WHERE in_id = $1",
      [docId]
    );
    const original = originalRes.rows[0];
    console.log("Original state:", original);

    console.log("\n=== Setting document 58 to IN_PROGRESS for ชัยพร with flowState = null ===");
    await db.query(
      "UPDATE c_information SET in_workflow_status = 'IN_PROGRESS', in_current_owner_id = $1, in_flow_state = null WHERE in_id = $2",
      [chaiyapornId, docId]
    );

    console.log("\n=== Testing getNextAssignees for ชัยพร (flowState = null) ===");
    const resultOut = await WorkflowService.getNextAssignees(docId, chaiyapornId);
    console.log("autoUpAssignee:", resultOut.autoUpAssignee ? { id: resultOut.autoUpAssignee.a_id, name: resultOut.autoUpAssignee.a_name, role: resultOut.autoUpAssignee.a_role } : null);
    console.log("manualAssignees (null):", resultOut.manualAssignees.map(u => ({ id: u.a_id, name: u.a_name, role: u.a_role })));

    console.log("\n=== Restoring document 58 ===");
    await db.query(
      "UPDATE c_information SET in_workflow_status = $1, in_current_owner_id = $2, in_flow_state = $3 WHERE in_id = $4",
      [original.in_workflow_status, original.in_current_owner_id, original.in_flow_state, docId]
    );

    console.log("\n=== Restore complete ===");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    process.exit(0);
  }
}

main();

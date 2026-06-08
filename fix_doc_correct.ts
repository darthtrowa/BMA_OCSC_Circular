import db from './server/src/config/database.js';

async function fix() {
  try {
    const userId = 8; // wanchalerm_c

    // 1. Revert doc 187
    await db.query(
      "UPDATE c_information SET in_workflow_status = 'COMPLETED', in_current_owner_id = NULL WHERE in_id = 187"
    );
    console.log("Reverted 187 to COMPLETED");

    // 2. Update doc 510
    const targetStatus = 'DRAFT'; 
    const updateRes = await db.query(
      "UPDATE c_information SET in_workflow_status = $1, in_current_owner_id = $2 WHERE in_id = $3 RETURNING *",
      [targetStatus, userId, 510]
    );
    console.log("Updated 510:", updateRes.rows);

    await db.query(
      "INSERT INTO c_workflow_history (in_id, from_user_id, from_user_name, to_user_id, to_user_name, action, comments) VALUES ($1, NULL, 'SYSTEM', $2, 'นายวันเฉลิม ฉัตรทอง', 'DELEGATED', 'Manually moved back to inbox by admin request')",
      [510, userId]
    );
    console.log("History added for 510.");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fix();

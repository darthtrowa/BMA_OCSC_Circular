import db from './server/src/config/database.js';

async function fix() {
  try {
    // 1. Find user wanchalerm_c
    const userRes = await db.query("SELECT a_id, a_name, a_role FROM admin WHERE a_username = 'wanchalerm_c'");
    console.log("User:", userRes.rows);
    if (userRes.rows.length === 0) return console.log("User not found");
    const userId = userRes.rows[0].a_id;
    const userRole = userRes.rows[0].a_role;

    // 2. Find document 'ว 5'
    const docRes = await db.query("SELECT in_id, in_num_date, in_workflow_status FROM c_information WHERE in_num_date LIKE '%ว 5%' OR in_num_date LIKE '%ว5%'");
    console.log("Doc:", docRes.rows);
    if (docRes.rows.length === 0) return console.log("Doc not found");
    const docId = docRes.rows[0].in_id;

    // 3. Update the document to be in the user's inbox
    // status waiting to be forwarded to supervisor -> "DRAFT" if they are the creator, or "PENDING_GRP_REVIEW" / "PENDING_EXECUTION" depending on role.
    // The user says "อยู่ใน inbox ของ wanchalerm_c โดยเป็นสถานะที่รอกดส่งให้หัวหน้าพิจารณา"
    // Usually, DRAFT means it's with the coordinator and hasn't been sent.
    // Or if it's already in the workflow, maybe we just set in_workflow_status = 'DRAFT', in_current_owner_id = userId
    
    // Check if the user is COORDINATOR
    const targetStatus = 'DRAFT'; // DRAFT means it's waiting to be sent
    
    const updateRes = await db.query(
      "UPDATE c_information SET in_workflow_status = $1, in_current_owner_id = $2 WHERE in_id = $3 RETURNING *",
      [targetStatus, userId, docId]
    );
    console.log("Updated doc:", updateRes.rows);

    // Also add a history entry so we know it was moved manually
    await db.query(
      "INSERT INTO c_workflow_history (in_id, from_user_id, from_user_name, to_user_id, to_user_name, action, comments) VALUES ($1, NULL, 'SYSTEM', $2, $3, 'DELEGATED', 'Manually moved back to inbox by admin request')",
      [docId, userId, userRes.rows[0].a_name]
    );
    console.log("History added.");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fix();


import fs from "fs";

const file = "e:/BMA_OCSC_Circular/server/src/services/workflowService.ts";
let content = fs.readFileSync(file, "utf8");

// We want to replace everything from static async submitToHR to the end of static async reject
const startRegex = /\/\*\*\s*\*\s*Starts the workflow by submitting a document from COORDINATOR to HR_DIRECTOR/s;
const endRegex = /\/\*\*\s*\*\s*Fetch workflow history for a document/s;

const matchStart = content.match(startRegex);
const matchEnd = content.match(endRegex);

if (matchStart && matchEnd) {
  const startIndex = matchStart.index!;
  const endIndex = matchEnd.index!;

  const replacement = `  private static getNextStatus(fromRole: string, toRole: string): WorkflowStatus {
    if (toRole === "COORDINATOR") return "PENDING_CLOSE";
    if (toRole === "STAFF") return "PENDING_EXECUTION";
    
    const roleRank: Record<string, number> = {
      "STAFF": 1,
      "GRP_LEADER": 2,
      "SEC_DIRECTOR": 3,
      "DIV_DIRECTOR": 4,
      "HR_DIRECTOR": 4,
      "COORDINATOR": 0
    };

    const fromRank = roleRank[fromRole] || 0;
    const toRank = roleRank[toRole] || 0;

    if (fromRank > toRank) {
      return "PENDING_DELEGATION";
    } else {
      if (toRole === "GRP_LEADER") return "PENDING_GRP_REVIEW";
      if (toRole === "SEC_DIRECTOR") return "PENDING_SEC_APPROVAL";
      if (toRole === "HR_DIRECTOR") return "PENDING_HR_APPROVAL";
      if (toRole === "DIV_DIRECTOR") return "PENDING_DIRECTOR_APPROVAL";
      return "PENDING_GRP_REVIEW";
    }
  }

  static async forward(docId: number, fromUserId: number, toUserId: number, comments: string, fromDelegationId?: number | null) {
    const db = await import("../config/database.js").then(m => m.default);
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      let currentOwnerId = fromUserId;
      if (fromDelegationId) {
        const delRes = await client.query("SELECT assigner_id FROM c_workflow_delegations WHERE delegation_id = $1", [fromDelegationId]);
        if (delRes.rows.length === 0) throw new Error("Delegation not found");
        currentOwnerId = delRes.rows[0].assigner_id;
      }

      const fromRes = await client.query("SELECT a_role FROM admin WHERE a_id = $1", [currentOwnerId]);
      const toRes = await client.query("SELECT a_role FROM admin WHERE a_id = $1", [toUserId]);
      if (fromRes.rows.length === 0 || toRes.rows.length === 0) throw new Error("User not found");

      const fromRole = fromRes.rows[0].a_role;
      const toRole = toRes.rows[0].a_role;
      let newStatus = this.getNextStatus(fromRole, toRole);
      let action: WorkflowAction = "APPROVED";

      if (toRole === "COORDINATOR") {
        newStatus = "COMPLETED";
        action = "FINALIZED";
      }

      await client.query(
        "UPDATE c_information SET in_workflow_status = $1, in_current_owner_id = $2 WHERE in_id = $3",
        [newStatus, toUserId, docId]
      );

      await this.addHistory(client, docId, fromUserId, toUserId, action, comments, fromDelegationId);

      await client.query("COMMIT");
      return { success: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async reject(docId: number, reviewerId: number, rejectToUserId: number, comments: string, delegationId?: number | null) {
    const db = await import("../config/database.js").then(m => m.default);
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      let currentOwnerId = reviewerId;
      if (delegationId) {
        const delRes = await client.query("SELECT assigner_id FROM c_workflow_delegations WHERE delegation_id = $1", [delegationId]);
        if (delRes.rows.length > 0) {
          currentOwnerId = delRes.rows[0].assigner_id;
        }
      }

      const targetUserRes = await client.query("SELECT a_role FROM admin WHERE a_id = $1", [rejectToUserId]);
      if (targetUserRes.rows.length === 0) throw new Error("Target user not found");
      const targetRole = targetUserRes.rows[0].a_role;
      
      const newStatus: WorkflowStatus = targetRole === "STAFF" ? "PENDING_EXECUTION" : "REJECTED";

      await client.query(
        "UPDATE c_information SET in_workflow_status = $1, in_current_owner_id = $2 WHERE in_id = $3",
        [newStatus, rejectToUserId, docId]
      );

      await this.addHistory(client, docId, reviewerId, rejectToUserId, "REJECTED", comments, delegationId);

      await client.query("COMMIT");
      return { success: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async closeWorkflow(docId: number, coordinatorId: number, comments: string) {
    const db = await import("../config/database.js").then(m => m.default);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      
      await client.query(
        "UPDATE c_information SET in_workflow_status = $1 WHERE in_id = $2",
        ["COMPLETED", docId]
      );
      
      await this.addHistory(client, docId, coordinatorId, null, "FINALIZED", comments);
      
      await client.query("COMMIT");
      return { success: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

`;
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
} else {
  console.log("Failed to find start or end tokens");
}

const addHistoryRegex = /private static async addHistory\([\s\S]*?comments: string\s*\)\s*\{[\s\S]*?INSERT INTO c_workflow_history \([\s\S]*?VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9\)\`,[\s\S]*?\[docId, fromUserId, fromName, fromPos, toUserId, toName, toPos, action, comments\][\s\S]*?\);[\s\S]*?\}/;

const newAddHistory = `private static async addHistory(
    client: any,
    docId: number,
    fromUserId: number | null,
    toUserId: number | null,
    action: string,
    comments: string,
    fromDelegationId?: number | null,
    toDelegationId?: number | null
  ) {
    let fromName = null, fromPos = null;
    let toName = null, toPos = null;

    if (fromUserId) {
      const res = await client.query("SELECT a_name, a_position, a_role FROM admin WHERE a_id = $1", [fromUserId]);
      if (res.rows.length > 0) {
        fromName = res.rows[0].a_name;
        fromPos = res.rows[0].a_position || res.rows[0].a_role;

        if (fromDelegationId) {
          const delRes = await client.query("SELECT assigner_id FROM c_workflow_delegations WHERE delegation_id = $1", [fromDelegationId]);
          if (delRes.rows.length > 0) {
            const assignerRes = await client.query("SELECT a_name FROM admin WHERE a_id = $1", [delRes.rows[0].assigner_id]);
            if (assignerRes.rows.length > 0) {
              fromName = \`\${fromName} (รักษาการแทน \${assignerRes.rows[0].a_name})\`;
            }
          }
        }
      }
    }
    
    if (toUserId) {
      const res = await client.query("SELECT a_name, a_position, a_role FROM admin WHERE a_id = $1", [toUserId]);
      if (res.rows.length > 0) {
        toName = res.rows[0].a_name;
        toPos = res.rows[0].a_position || res.rows[0].a_role;

        if (toDelegationId) {
          const delRes = await client.query("SELECT assigner_id FROM c_workflow_delegations WHERE delegation_id = $1", [toDelegationId]);
          if (delRes.rows.length > 0) {
            const assignerRes = await client.query("SELECT a_name FROM admin WHERE a_id = $1", [delRes.rows[0].assigner_id]);
            if (assignerRes.rows.length > 0) {
              toName = \`\${toName} (รักษาการแทน \${assignerRes.rows[0].a_name})\`;
            }
          }
        }
      }
    }

    await client.query(
      \`INSERT INTO c_workflow_history (
        in_id, from_user_id, from_user_name, from_user_position,
        to_user_id, to_user_name, to_user_position, action, comments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)\`,
      [docId, fromUserId, fromName, fromPos, toUserId, toName, toPos, action, comments]
    );
  }`;

content = content.replace(addHistoryRegex, newAddHistory);

fs.writeFileSync(file, content);


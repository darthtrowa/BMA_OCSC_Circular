import db from '../config/database.js';
import { WorkflowAction, WorkflowStatus } from '../types/workflow.js';

export class WorkflowService {
  /**
   * Starts the workflow for an existing document.
   */
  static async startWorkflow(docId: number, adminId: number): Promise<void> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rowCount } = await client.query(
        `UPDATE c_information 
         SET in_workflow_status = $1, in_current_owner_id = $2, in_creator_id = $2
         WHERE in_id = $3`,
        ['DRAFT', adminId, docId]
      );
      if (rowCount === 0) throw new Error('Document not found');

      // Log history
      await this.addHistory(client, docId, adminId, adminId, 'STARTED', 'เริ่มกระบวนการเวียนหนังสือ');

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Starts the workflow by submitting a document from COORDINATOR to HR_DIRECTOR
   */
  static async submitToHR(docId: number, coordinatorId: number, hrDirectorId: number, comments: string) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      // Update document
      await client.query(
        `UPDATE c_information 
         SET in_workflow_status = 'PENDING_HR_APPROVAL', 
             in_current_owner_id = $1 
         WHERE in_id = $2 AND (in_workflow_status = 'DRAFT' OR in_workflow_status IS NULL OR in_workflow_status = 'REJECTED')`,
        [hrDirectorId, docId]
      );

      // Record history
      await this.addHistory(client, docId, coordinatorId, hrDirectorId, 'SUBMITTED', comments);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Starts the workflow by submitting a document from COORDINATOR to GRP_LEADER
   */
  static async submitToGrpLeader(docId: number, coordinatorId: number, grpLeaderId: number, comments: string) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      // Update document
      await client.query(
        `UPDATE c_information 
         SET in_workflow_status = 'PENDING_REVIEW', 
             in_current_owner_id = $1 
         WHERE in_id = $2 AND (in_workflow_status = 'DRAFT' OR in_workflow_status IS NULL OR in_workflow_status = 'REJECTED')`,
        [grpLeaderId, docId]
      );

      // Record history
      await this.addHistory(client, docId, coordinatorId, grpLeaderId, 'SUBMITTED', comments);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delegate a document downwards (e.g., HR -> DIV, DIV -> SEC/GRP, GRP -> STAFF)
   */
  static async delegate(docId: number, fromUserId: number, toUserId: number, comments: string) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Check the role of the target user to determine status
      const userRes = await client.query('SELECT a_role FROM admin WHERE a_id = $1', [toUserId]);
      if (userRes.rows.length === 0) throw new Error('Target user not found');
      
      const targetRole = userRes.rows[0].a_role;
      const newStatus: WorkflowStatus = targetRole === 'STAFF' ? 'PENDING_EXECUTION' : 'PENDING_DELEGATION';

      // Update document
      await client.query(
        `UPDATE c_information 
         SET in_workflow_status = $1, 
             in_current_owner_id = $2 
         WHERE in_id = $3 AND in_current_owner_id = $4`,
        [newStatus, toUserId, docId, fromUserId]
      );

      // Record history
      await this.addHistory(client, docId, fromUserId, toUserId, 'DELEGATED', comments);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * STAFF submits review results back to their manager
   */
  static async submitReview(docId: number, staffId: number, comments: string) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Find staff's parent (manager)
      const userRes = await client.query('SELECT a_parent_id FROM admin WHERE a_id = $1', [staffId]);
      if (userRes.rows.length === 0 || !userRes.rows[0].a_parent_id) {
        throw new Error('Manager not found for this staff');
      }
      const managerId = userRes.rows[0].a_parent_id;

      // Update document
      await client.query(
        `UPDATE c_information 
         SET in_workflow_status = 'PENDING_REVIEW', 
             in_current_owner_id = $1 
         WHERE in_id = $2 AND in_current_owner_id = $3`,
        [managerId, docId, staffId]
      );

      // Record history
      await this.addHistory(client, docId, staffId, managerId, 'REVIEWED', comments);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Approve a review. Moves the document up to the manager's manager, 
   * or finalizes it if approved by HR_DIRECTOR.
   */
  static async approve(docId: number, reviewerId: number, nextOwnerId: number, comments: string, delegationId?: number | null) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      let currentOwnerId = reviewerId;

      if (delegationId) {
        // ACTING: use the assigner's role and parent
        const delRes = await client.query('SELECT assigner_id FROM c_workflow_delegations WHERE delegation_id = $1', [delegationId]);
        if (delRes.rows.length === 0) throw new Error('Delegation not found');
        currentOwnerId = delRes.rows[0].assigner_id;
      }
      let newStatus: WorkflowStatus = 'PENDING_REVIEW';
      let action: WorkflowAction = 'APPROVED';

      // If the selected next owner is the COORDINATOR, it means the workflow is completed
      const targetRes = await client.query('SELECT a_role FROM admin WHERE a_id = $1', [nextOwnerId]);
      if (targetRes.rows.length > 0 && targetRes.rows[0].a_role === 'COORDINATOR') {
        newStatus = 'COMPLETED';
        action = 'FINALIZED';
      }

      if (!nextOwnerId) throw new Error('Next workflow recipient not found');

      // Update document
      await client.query(
        `UPDATE c_information 
         SET in_workflow_status = $1, 
             in_current_owner_id = $2 
         WHERE in_id = $3 AND in_current_owner_id = $4`,
        [newStatus, nextOwnerId, docId, currentOwnerId]
      );

      // Record history
      await this.addHistory(client, docId, reviewerId, nextOwnerId, action, comments);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject a review. Pushes the document back to the person who submitted it.
   */
  static async reject(docId: number, reviewerId: number, rejectToUserId: number, comments: string, delegationId?: number | null) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      let currentOwnerId = reviewerId;
      if (delegationId) {
        const delRes = await client.query('SELECT assigner_id FROM c_workflow_delegations WHERE delegation_id = $1', [delegationId]);
        if (delRes.rows.length > 0) {
          currentOwnerId = delRes.rows[0].assigner_id;
        }
      }

      const targetUserRes = await client.query('SELECT a_role FROM admin WHERE a_id = $1', [rejectToUserId]);
      if (targetUserRes.rows.length === 0) throw new Error('Target user not found');
      const targetRole = targetUserRes.rows[0].a_role;
      
      const newStatus: WorkflowStatus = targetRole === 'STAFF' ? 'PENDING_EXECUTION' : 'REJECTED';

      // Update document
      await client.query(
        `UPDATE c_information 
         SET in_workflow_status = $1, 
             in_current_owner_id = $2 
         WHERE in_id = $3 AND in_current_owner_id = $4`,
        [newStatus, rejectToUserId, docId, currentOwnerId]
      );

      // Record history
      await this.addHistory(client, docId, reviewerId, rejectToUserId, 'REJECTED', comments);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch workflow history for a document
   */
  static async getHistory(docId: number) {
    const res = await db.query(
      `SELECT
         h.*,
         -- ตรวจว่า from_user กำลังรักษาการแทนใครอยู่ในปัจจุบัน
         d.is_active                          AS from_user_is_acting,
         assigner.a_name                     AS from_user_acting_for,
         assigner.a_position                 AS from_user_acting_for_position
       FROM c_workflow_history h
       LEFT JOIN c_workflow_delegations d
              ON d.assignee_id = h.from_user_id
             AND d.is_active = true
       LEFT JOIN admin assigner
              ON assigner.a_id = d.assigner_id
       WHERE h.in_id = $1
       ORDER BY h.created_at ASC`,
      [docId]
    );
    return res.rows;
  }


  /**
   * Helper to insert history with embedded text
   */
  private static async addHistory(
    client: any,
    docId: number,
    fromUserId: number | null,
    toUserId: number | null,
    action: string,
    comments: string
  ) {
    let fromName = null, fromPos = null;
    let toName = null, toPos = null;

    if (fromUserId) {
      const res = await client.query('SELECT a_name, a_position, a_role FROM admin WHERE a_id = $1', [fromUserId]);
      if (res.rows.length > 0) {
        fromName = res.rows[0].a_name;
        fromPos = res.rows[0].a_position || res.rows[0].a_role;
      }
    }
    
    if (toUserId) {
      const res = await client.query('SELECT a_name, a_position, a_role FROM admin WHERE a_id = $1', [toUserId]);
      if (res.rows.length > 0) {
        toName = res.rows[0].a_name;
        toPos = res.rows[0].a_position || res.rows[0].a_role;

        // Check if the target user has an active delegation (they are the assigner)
        const delRes = await client.query(`
          SELECT assignee.a_name AS assignee_name
          FROM c_workflow_delegations d
          JOIN admin assignee ON assignee.a_id = d.assignee_id
          WHERE d.assigner_id = $1 AND d.is_active = TRUE
        `, [toUserId]);

        if (delRes.rows.length > 0) {
          const assigneeName = delRes.rows[0].assignee_name;
          toName = `${assigneeName} (รักษาการแทน ${toName})`;
        }
      }
    }

    await client.query(
      `INSERT INTO c_workflow_history (
        in_id, from_user_id, from_user_name, from_user_position,
        to_user_id, to_user_name, to_user_position, action, comments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [docId, fromUserId, fromName, fromPos, toUserId, toName, toPos, action, comments]
    );
  }
}

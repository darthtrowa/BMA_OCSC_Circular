import db from '../config/database.js';
import { recordAuditLog } from '../utils/auditLogger.js';
import { WorkflowService } from './workflowService.js';

export interface WorkflowNextOption {
  node_id: number | null;
  step_name: string;
  eligible_users: {
    id: number;
    name: string;
    role: string;
    position?: string;
  }[];
}

export class DynamicWorkflowService {
  /**
   * Determine the next options for a document dynamically based on its active template.
   */
  static async getNextOptions(docId: number, currentUserId: number, paId?: number): Promise<WorkflowNextOption[]> {
    throw new Error('ระบบ Dynamic Workflow ถูกยกเลิกและไม่สามารถใช้งานได้แล้ว กรุณาใช้ระบบมาตรฐาน');
  }

  static async getParallelNextOptions(paId: number, currentUserId: number): Promise<WorkflowNextOption[]> {
    throw new Error('ระบบ Dynamic Workflow ถูกยกเลิกและไม่สามารถใช้งานได้แล้ว กรุณาใช้ระบบมาตรฐาน');
  }

  static async dynamicApprove(
    docId: number,
    nextNodeId: number | null,
    nextOwnerId: number | null,
    comments: string,
    currentUserId: number,
    delegation_id?: number,
    paId?: number
  ) {
    throw new Error('ระบบ Dynamic Workflow ถูกยกเลิกและไม่สามารถใช้งานได้แล้ว กรุณาใช้ระบบมาตรฐาน');
  }

  /**
   * Approve and advance to the next dynamic node.
   */
  static async approve(
    docId: number,
    reviewerId: number,
    nextNodeId: number | null,
    nextOwnerId: number | null,
    comments: string,
    delegationId?: number | null,
    paId?: number
  ) {
    if (paId) {
      return this.approveParallel(docId, paId, reviewerId, nextNodeId, nextOwnerId, comments);
    }
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const status = nextNodeId === null ? 'APPROVED' : 'PENDING';

      const updateQuery = `
        UPDATE c_information 
        SET in_workflow_status = $1, 
            in_active_node_id = $2, 
            in_current_owner_id = $3
        WHERE in_id = $4
      `;
      // If workflow ends, there is no next owner. We can set it to null or leave the final approver as owner.
      // Usually, it's better to clear it or set it back to creator. Let's set to null for APPROVED.
      const targetOwner = nextNodeId === null ? null : nextOwnerId;
      
      const { rowCount } = await client.query(updateQuery, [status, nextNodeId, targetOwner, docId]);
      
      if (rowCount === 0) throw new Error('Document not found');

      // Record History (using the existing private method inside WorkflowService, we might need to expose it or duplicate it. 
      // Since it's private in WorkflowService, we'll duplicate the logging logic or make it public. 
      // Let's call a public method or just execute the INSERT here).
      // To be clean, we will implement local addHistory or make WorkflowService's addHistory public.
      await this.addHistory(client, docId, reviewerId, targetOwner, nextNodeId === null ? 'APPROVED' : 'SUBMITTED', comments);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async approveParallel(
    docId: number,
    paId: number,
    reviewerId: number,
    nextNodeId: number | null,
    nextOwnerId: number | null,
    comments: string
  ) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const status = nextNodeId === null ? 'COMPLETED' : 'IN_PROGRESS';
      const updateQuery = `
        UPDATE c_parallel_assignments 
        SET pa_status = $1, 
            pa_active_node_id = $2, 
            current_owner_id = $3,
            updated_at = NOW()
        WHERE pa_id = $4
      `;
      const targetOwner = nextNodeId === null ? null : nextOwnerId;
      
      const { rowCount } = await client.query(updateQuery, [status, nextNodeId, targetOwner, paId]);
      if (rowCount === 0) throw new Error('Parallel Track not found');

      await this.addHistory(client, docId, reviewerId, targetOwner, nextNodeId === null ? 'PARALLEL_COMPLETED' : 'PARALLEL_DYNAMIC_STEP', comments, paId);

      // Check if all tracks are completed
      if (status === 'COMPLETED') {
        const { rows: pendingTracks } = await client.query(
          `SELECT pa_id FROM c_parallel_assignments WHERE in_id = $1 AND pa_status != 'COMPLETED' AND pa_status != 'REJECTED'`,
          [docId]
        );
        if (pendingTracks.length === 0) {
          // All tracks done -> Update main document to APPROVED
          await client.query(
            `UPDATE c_information SET in_workflow_status = 'APPROVED' WHERE in_id = $1`,
            [docId]
          );
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async addHistory(client: any, docId: number, fromUserId: number | null, toUserId: number | null, action: string, comments: string, paId?: number) {
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
      }
    }

    await client.query(
      `INSERT INTO c_workflow_history (
        in_id, pa_id, from_user_id, from_user_name, from_user_position,
        to_user_id, to_user_name, to_user_position, action, comments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [docId, paId || null, fromUserId, fromName, fromPos, toUserId, toName, toPos, action, comments]
    );
  }
}

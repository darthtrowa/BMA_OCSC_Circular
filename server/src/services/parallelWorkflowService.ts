import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface ParallelTrack {
  ag_id: number;
  ag_name?: string;
}

export class ParallelWorkflowService {

  /**
   * COORDINATOR assigns document to N parallel tracks
   */
  static async assignParallel(
    docId: number,
    coordinatorId: number,
    tracks: ParallelTrack[]
  ) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const batchId = uuidv4();

      // Update the document
      await client.query(
        `UPDATE c_information
         SET in_workflow_status = 'PENDING_PARALLEL',
             in_is_parallel = TRUE,
             in_parallel_batch_id = $1,
             in_current_owner_id = NULL
         WHERE in_id = $2`,
        [batchId, docId]
      );

      // Create one row per track
      for (const track of tracks) {
        if (!track.ag_id) throw new Error('เกิดข้อผิดพลาด: ไม่พบรหัสส่วนราชการใน Track');

        let targetUserId: number | null = null;
        // Hierarchy Fallback: Assign to DIV_DIRECTOR or HR_DIRECTOR in that agency (or its child positions)
        const fallbackRes = await client.query(
          `SELECT a.a_id 
           FROM admin a
           LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
           WHERE a.a_status IN ('1', 'true', 'active') 
             AND (a.a_agency_id = $1 OR ag.parent_ag_id = $1) 
             AND a.a_role IN ('DIV_DIRECTOR', 'HR_DIRECTOR') 
           ORDER BY a.a_role ASC 
           LIMIT 1`,
          [track.ag_id]
        );
        if (fallbackRes.rows.length > 0) {
          targetUserId = fallbackRes.rows[0].a_id;
        } else {
          // Check Acting for DIV_DIRECTOR in Hierarchy Flow
          const actingFallbackRes = await client.query(
            `SELECT d.assignee_id 
             FROM c_workflow_delegations d
             LEFT JOIN c_agency ag ON d.assigner_ag_id = ag.ag_id
             WHERE (d.assigner_ag_id = $1 OR ag.parent_ag_id = $1)
               AND d.delegated_role = 'DIV_DIRECTOR' 
               AND d.is_active = TRUE 
             ORDER BY d.delegation_order ASC 
             LIMIT 1`,
            [track.ag_id]
          );
          if (actingFallbackRes.rows.length > 0) {
            targetUserId = actingFallbackRes.rows[0].assignee_id;
          } else {
            throw new Error(`ไม่สามารถกระจายงานได้: ไม่พบผู้อำนวยการหรือผู้รักษาการในกอง ${track.ag_name || track.ag_id}`);
          }
        }

        if (!targetUserId) throw new Error(`ไม่สามารถระบุผู้รับมอบงานสำหรับกอง ${track.ag_name || track.ag_id} ได้`);

        await client.query(
          `INSERT INTO c_parallel_assignments
            (in_id, batch_id, ag_id, ag_name, initial_owner_id, current_owner_id, pa_status, assigned_by, hr_director_id)
           VALUES ($1, $2, $3, $4, $5, $5, 'PENDING', $6, NULL)`,
          [docId, batchId, track.ag_id, track.ag_name || null, targetUserId, coordinatorId]
        );

        // Log history
        await this.addHistory(client, docId, null, coordinatorId, targetUserId, 'PARALLEL_ASSIGNED', 'ส่งให้พิจารณา (ระบบมอบหมายอัตโนมัติ)');
      }

      await client.query('COMMIT');
      return { success: true, batchId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Owner within a track delegates to a subordinate (follows existing chain)
   */
  static async delegateWithinTrack(
    docId: number,
    paId: number,
    fromUserId: number,
    toUserId: number,
    comments: string
  ) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Verify paId belongs to this docId and fromUser is current owner
      const { rows } = await client.query(
        `SELECT pa_id FROM c_parallel_assignments
         WHERE pa_id = $1 AND in_id = $2 AND current_owner_id = $3 AND pa_status IN ('PENDING','IN_PROGRESS')`,
        [paId, docId, fromUserId]
      );
      if (rows.length === 0) throw new Error('ไม่สามารถมอบหมายใน Track นี้ได้');

      // Update current owner
      await client.query(
        `UPDATE c_parallel_assignments SET current_owner_id = $1, pa_status = 'IN_PROGRESS', updated_at = NOW()
         WHERE pa_id = $2`,
        [toUserId, paId]
      );

      await this.addHistory(client, docId, paId, fromUserId, toUserId, 'PARALLEL_DELEGATED', comments);

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
   * Current owner submits result for their parallel track
   */
  static async submitTrackResult(
    docId: number,
    paId: number,
    userId: number,
    resultComments: string
  ) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT pa_id, assigned_by FROM c_parallel_assignments
         WHERE pa_id = $1 AND in_id = $2 AND current_owner_id = $3 AND pa_status IN ('PENDING','IN_PROGRESS')`,
        [paId, docId, userId]
      );
      if (rows.length === 0) throw new Error('ไม่สามารถส่งผลใน Track นี้ได้');

      const assignedBy = rows[0].assigned_by;

      await client.query(
        `UPDATE c_parallel_assignments SET pa_status = 'SUBMITTED', result_comments = $1, updated_at = NOW()
         WHERE pa_id = $2`,
        [resultComments, paId]
      );

      await this.addHistory(client, docId, paId, userId, null, 'PARALLEL_SUBMITTED', resultComments);

      // Check if all tracks are terminal
      await this.checkAndAdvance(client, docId, assignedBy);

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
   * Owner rejects their parallel track (others continue independently)
   */
  static async rejectTrack(
    docId: number,
    paId: number,
    userId: number,
    comments: string
  ) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT pa_id, hr_director_id, assigned_by FROM c_parallel_assignments
         WHERE pa_id = $1 AND in_id = $2 AND current_owner_id = $3 AND pa_status IN ('PENDING','IN_PROGRESS')`,
        [paId, docId, userId]
      );
      if (rows.length === 0) throw new Error('ไม่สามารถตีกลับ Track นี้ได้');

      const assignedBy = rows[0].assigned_by;

      await client.query(
        `UPDATE c_parallel_assignments SET pa_status = 'REJECTED', result_comments = $1, updated_at = NOW()
         WHERE pa_id = $2`,
        [comments, paId]
      );

      await this.addHistory(client, docId, paId, userId, null, 'PARALLEL_REJECTED', comments);

      // Check if all remaining tracks are terminal so we can advance
      await this.checkAndAdvance(client, docId, assignedBy);

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
   * If all tracks are terminal (SUBMITTED or REJECTED), move document back to Coordinator
   */
  private static async checkAndAdvance(client: any, docId: number, coordinatorId: number) {
    const { rows } = await client.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN pa_status IN ('SUBMITTED','REJECTED') THEN 1 ELSE 0 END) AS terminal
       FROM c_parallel_assignments
       WHERE in_id = $1`,
      [docId]
    );

    const total = Number(rows[0].total);
    const terminal = Number(rows[0].terminal);

    if (total > 0 && total === terminal) {
      // Find the active HR_DIRECTOR
      const hrRes = await client.query(
        `SELECT a_id FROM admin WHERE a_status = 'active' AND a_role = 'HR_DIRECTOR' LIMIT 1`
      );
      
      let targetHrId: number | null = null;
      if (hrRes.rows.length > 0) {
        targetHrId = hrRes.rows[0].a_id;
      } else {
        // Fallback: search c_workflow_delegations for active HR_DIRECTOR delegation (sorted by delegation_order)
        const actingRes = await client.query(
          `SELECT assignee_id FROM c_workflow_delegations 
           WHERE delegated_role = 'HR_DIRECTOR' AND is_active = TRUE 
           ORDER BY delegation_order ASC LIMIT 1`
        );
        if (actingRes.rows.length > 0) {
          targetHrId = actingRes.rows[0].assignee_id;
        }
      }

      // If no HR_DIRECTOR found at all, fallback to the coordinator
      const finalOwnerId = targetHrId || coordinatorId;

      // All tracks done → move back to HR_DIRECTOR
      await client.query(
        `UPDATE c_information
         SET in_workflow_status = 'PENDING_HR_APPROVAL',
             in_current_owner_id = $1
         WHERE in_id = $2`,
        [finalOwnerId, docId]
      );
      await this.addHistory(client, docId, null, null, finalOwnerId, 'SUBMITTED',
        'ทุกส่วนราชการปลายทางพิจารณาครบแล้ว — ส่งกลับ ผอ.ศูนย์ฯ (HR_DIRECTOR) เพื่อพิจารณา');
    }
  }

  /**
   * Get all parallel tracks for a document
   */
  static async getParallelTracks(docId: number) {
    const { rows } = await db.query(
      `SELECT
         pa.pa_id, pa.in_id, pa.batch_id,
         pa.ag_id, pa.ag_name,
         pa.pa_status, pa.result_comments,
         pa.created_at, pa.updated_at,
         init.a_id   AS initial_owner_id,
         init.a_name AS initial_owner_name,
         COALESCE(CASE WHEN init_ag.ag_type = 'POSITION' THEN init_ag.ag_name ELSE NULL END, init.a_position) AS initial_owner_position,
         cur.a_id    AS current_owner_id,
         cur.a_name  AS current_owner_name,
         COALESCE(CASE WHEN cur_ag.ag_type = 'POSITION' THEN cur_ag.ag_name ELSE NULL END, cur.a_position) AS current_owner_position,
         assigner.a_name AS assigned_by_name,
         hr.a_name   AS hr_director_name
       FROM c_parallel_assignments pa
       LEFT JOIN admin init     ON pa.initial_owner_id  = init.a_id
       LEFT JOIN c_agency init_ag ON init.a_agency_id = init_ag.ag_id
       LEFT JOIN admin cur      ON pa.current_owner_id  = cur.a_id
       LEFT JOIN c_agency cur_ag  ON cur.a_agency_id  = cur_ag.ag_id
       LEFT JOIN admin assigner ON pa.assigned_by       = assigner.a_id
       LEFT JOIN admin hr       ON pa.hr_director_id    = hr.a_id
       WHERE pa.in_id = $1
       ORDER BY pa.pa_id ASC`,
      [docId]
    );
    return rows;
  }

  /**
   * Helper: insert history entry
   */
  private static async addHistory(
    client: any,
    docId: number,
    paId: number | null,
    fromUserId: number | null,
    toUserId: number | null,
    action: string,
    comments: string
  ) {
    let fromName = null, fromPos = null, toName = null, toPos = null;

    if (fromUserId) {
      const r = await client.query(`
        SELECT a.a_name, a.a_role, 
               COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position 
        FROM admin a 
        LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id 
        WHERE a.a_id = $1`, [fromUserId]);
      if (r.rows.length > 0) { fromName = r.rows[0].a_name; fromPos = r.rows[0].a_position || r.rows[0].a_role; }
    }
    if (toUserId) {
      const r = await client.query(`
        SELECT a.a_name, a.a_role, 
               COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position 
        FROM admin a 
        LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id 
        WHERE a.a_id = $1`, [toUserId]);
      if (r.rows.length > 0) { toName = r.rows[0].a_name; toPos = r.rows[0].a_position || r.rows[0].a_role; }
    }

    await client.query(
      `INSERT INTO c_workflow_history
        (in_id, pa_id, from_user_id, from_user_name, from_user_position, to_user_id, to_user_name, to_user_position, action, comments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [docId, paId, fromUserId, fromName, fromPos, toUserId, toName, toPos, action, comments]
    );
  }
}

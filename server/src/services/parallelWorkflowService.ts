import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface ParallelTrack {
  ag_id?: number;
  ag_name?: string;
  toUserId: number;
}

export class ParallelWorkflowService {

  /**
   * COORDINATOR assigns document to N parallel tracks
   */
  static async assignParallel(
    docId: number,
    coordinatorId: number,
    hrDirectorId: number,
    tracks: ParallelTrack[],
    comments: string
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
        const ownerRes = await client.query(
          'SELECT a_name, a_position, a_role FROM admin WHERE a_id = $1',
          [track.toUserId]
        );
        if (ownerRes.rows.length === 0) throw new Error(`ไม่พบผู้ใช้ ID ${track.toUserId}`);

        await client.query(
          `INSERT INTO c_parallel_assignments
            (in_id, batch_id, ag_id, ag_name, initial_owner_id, current_owner_id, pa_status, assigned_by, hr_director_id)
           VALUES ($1, $2, $3, $4, $5, $5, 'PENDING', $6, $7)`,
          [docId, batchId, track.ag_id || null, track.ag_name || null, track.toUserId, coordinatorId, hrDirectorId]
        );

        // Log history
        await this.addHistory(client, docId, null, coordinatorId, track.toUserId, 'PARALLEL_ASSIGNED', comments);
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
        `SELECT pa_id, hr_director_id FROM c_parallel_assignments
         WHERE pa_id = $1 AND in_id = $2 AND current_owner_id = $3 AND pa_status IN ('PENDING','IN_PROGRESS')`,
        [paId, docId, userId]
      );
      if (rows.length === 0) throw new Error('ไม่สามารถส่งผลใน Track นี้ได้');

      const hrDirectorId = rows[0].hr_director_id;

      await client.query(
        `UPDATE c_parallel_assignments SET pa_status = 'SUBMITTED', result_comments = $1, updated_at = NOW()
         WHERE pa_id = $2`,
        [resultComments, paId]
      );

      await this.addHistory(client, docId, paId, userId, null, 'PARALLEL_SUBMITTED', resultComments);

      // Check if all tracks are terminal
      await this.checkAndAdvance(client, docId, hrDirectorId);

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

      const hrDirectorId = rows[0].hr_director_id;

      await client.query(
        `UPDATE c_parallel_assignments SET pa_status = 'REJECTED', result_comments = $1, updated_at = NOW()
         WHERE pa_id = $2`,
        [comments, paId]
      );

      await this.addHistory(client, docId, paId, userId, null, 'PARALLEL_REJECTED', comments);

      // Check if all remaining tracks are terminal so we can advance
      await this.checkAndAdvance(client, docId, hrDirectorId);

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
   * If all tracks are terminal (SUBMITTED or REJECTED), move document to HR review
   */
  private static async checkAndAdvance(client: any, docId: number, hrDirectorId: number) {
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
      // All tracks done → move to HR
      await client.query(
        `UPDATE c_information
         SET in_workflow_status = 'PENDING_HR_APPROVAL',
             in_current_owner_id = $1
         WHERE in_id = $2`,
        [hrDirectorId, docId]
      );
      await this.addHistory(client, docId, null, null, hrDirectorId, 'SUBMITTED',
        'ทุก Track ส่งผลครบแล้ว — ส่งขึ้น HR Director เพื่ออนุมัติขั้นสุดท้าย');
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
         init.a_position AS initial_owner_position,
         cur.a_id    AS current_owner_id,
         cur.a_name  AS current_owner_name,
         cur.a_position AS current_owner_position,
         assigner.a_name AS assigned_by_name,
         hr.a_name   AS hr_director_name
       FROM c_parallel_assignments pa
       LEFT JOIN admin init     ON pa.initial_owner_id  = init.a_id
       LEFT JOIN admin cur      ON pa.current_owner_id  = cur.a_id
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
      const r = await client.query('SELECT a_name, a_position, a_role FROM admin WHERE a_id = $1', [fromUserId]);
      if (r.rows.length > 0) { fromName = r.rows[0].a_name; fromPos = r.rows[0].a_position || r.rows[0].a_role; }
    }
    if (toUserId) {
      const r = await client.query('SELECT a_name, a_position, a_role FROM admin WHERE a_id = $1', [toUserId]);
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

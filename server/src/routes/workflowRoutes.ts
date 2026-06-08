import express, { Response } from 'express';
import { requireAdmin, requireRole, AdminRequest } from '../middleware/auth.js';
import { WorkflowService } from '../services/workflowService.js';
import { ParallelWorkflowService } from '../services/parallelWorkflowService.js';
import { DynamicWorkflowService } from '../services/dynamicWorkflowService.js';
import { z } from 'zod';
import db from '../config/database.js';
import { recordAuditLog } from '../utils/auditLogger.js';

const router = express.Router();

// Middleware: All routes require authentication
router.use(requireAdmin);

// Schemas
export const StartWorkflowSchema = z.object({
  docId: z.number(),
});

export const forwardSchema = z.object({
  docId: z.number().int().positive(),
  toUserId: z.number().int().positive(),
  comments: z.string().optional().default(''),
  approval_context: z.enum(['SELF', 'ACTING']).optional().default('SELF'),
  delegation_id: z.number().int().positive().optional(),
});

const rejectSchema = z.object({
  docId:            z.number(),
  comments:         z.string().optional().default(''),
  rejectToUserId:   z.number().optional(), // Required only for reject
  // บริบทการลงนาม: SELF = ตนเอง, ACTING = รักษาการแทน
  approval_context: z.enum(['SELF', 'ACTING']).optional().default('SELF'),
  delegation_id:    z.number().int().positive().optional(),
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/workflow/start
// ─────────────────────────────────────────────────────────────
router.post(
  '/start',
  requireAdmin,
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const data = StartWorkflowSchema.parse(req.body);
      const adminId = req.admin!.id;

      await WorkflowService.startWorkflow(data.docId, adminId);
      return res.json({ success: true, message: 'Workflow started successfully' });
    } catch (error: any) {
      console.error('Error starting workflow:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * Forward a document (Rank-based routing)
 */
router.post(
  '/forward',
  requireAdmin,
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId, toUserId, comments, approval_context, delegation_id } = forwardSchema.parse(req.body);
      const reviewerId = req.admin!.id;

      // ── ACTING context: ตรวจสอบ delegation ก่อน ──────────────────────────
      let resolvedDelegationId: number | null = null;
      if (approval_context === 'ACTING') {
        if (!delegation_id) {
          return res.status(400).json({ success: false, message: 'ต้องระบุ delegation_id เมื่อลงนามในฐานะรักษาการ' });
        }
        // Strict verify: delegation ต้อง active และเป็นของผู้ใช้นี้
        const { rows: delRows } = await db.query(
          `SELECT delegation_id, delegated_role, assigner_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE`,
          [delegation_id, reviewerId]
        );
        if (!delRows.length) {
          return res.status(403).json({ success: false, message: 'ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว' });
        }
        resolvedDelegationId = delRows[0].delegation_id;
      }

      await WorkflowService.forward(
        docId, 
        reviewerId, 
        toUserId, 
        comments, 
        resolvedDelegationId
      );
      
      // ── บันทึก audit log พร้อม delegation context ─────────────────────
      recordAuditLog({
        userId:           reviewerId,
        userName:         req.admin!.name,
        action:           'WORKFLOW_FORWARD',
        targetResource:   'workflow',
        targetId:         String(docId),
        payload:          { docId, toUserId, comments, approval_context },
        ipAddress:        (req.ip as string) || null,
        userAgent:        (req.headers['user-agent'] as string) || null,
        isActing:         approval_context === 'ACTING',
        delegation_id:    resolvedDelegationId || undefined
      });

      return res.json({ success: true, message: 'Document forwarded successfully' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * 5. Reject review (moves down the chain)
 */
router.post(
  '/reject',
  requireAdmin,
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId, comments, rejectToUserId, approval_context, delegation_id } = rejectSchema.parse(req.body);
      const reviewerId = req.admin!.id;

      if (!rejectToUserId) {
        return res.status(400).json({ success: false, message: 'rejectToUserId is required' });
      }

      // ── ACTING context: ตรวจสอบ delegation ก่อน ──────────────────────────
      let resolvedDelegationId: number | null = null;
      if (approval_context === 'ACTING') {
        if (!delegation_id) {
          return res.status(400).json({ success: false, message: 'ต้องระบุ delegation_id เมื่อตีกลับในฐานะรักษาการ' });
        }
        const { rows: delRows } = await db.query(
          `SELECT delegation_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE`,
          [delegation_id, reviewerId]
        );
        if (!delRows.length) {
          return res.status(403).json({ success: false, message: 'ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว' });
        }
        resolvedDelegationId = delRows[0].delegation_id;
      }

      await WorkflowService.reject(
        docId,
        reviewerId,
        rejectToUserId!,
        comments,
        resolvedDelegationId
      );

      // ── บันทึก audit log พร้อม delegation context ─────────────────────
      recordAuditLog({
        userId:           reviewerId,
        userName:         req.admin!.name,
        action:           'WORKFLOW_REJECT',
        targetResource:   'workflow',
        targetId:         String(docId),
        payload:          { docId, comments, rejectToUserId, approval_context },
        ipAddress:        (req.ip as string) || null,
        userAgent:        (req.headers['user-agent'] as string) || null,
        isActing:         approval_context === 'ACTING',
        approval_context: approval_context,
        delegation_id:    resolvedDelegationId,
      });

      return res.json({ success: true, message: 'Rejected successfully' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * 6. Get Workflow History for a document
 */
router.get(
  '/:docId/history',
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const docId = parseInt(req.params.docId as string, 10);
      if (isNaN(docId)) return res.status(400).json({ success: false, message: 'Invalid docId' });

      const history = await WorkflowService.getHistory(docId);
      return res.json({ success: true, data: history });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// DYNAMIC WORKFLOW ENDPOINTS
// ─────────────────────────────────────────────────────────────

router.get(
  '/:docId/next-assignees',
  requireAdmin,
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const docId = parseInt(req.params.docId as string, 10);
      if (isNaN(docId)) return res.status(400).json({ success: false, message: 'Invalid docId' });

      const context = req.query.context as string || 'SELF';
      const delegationIdStr = req.query.delegationId as string;
      const delegationId = delegationIdStr ? parseInt(delegationIdStr, 10) : undefined;
      
      const assignees = await WorkflowService.getNextAssignees(
        req.admin!.id, 
        context === 'ACTING' && delegationId ? delegationId : undefined
      );

      return res.json({ success: true, data: assignees });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

router.post(
  '/dynamic-approve',
  requireAdmin,
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId, nextNodeId, nextOwnerId, comments, delegation_id, paId } = req.body;
      const reviewerId = req.admin!.id;

      await DynamicWorkflowService.approve(docId, reviewerId, nextNodeId, nextOwnerId, comments || '', delegation_id, paId);
      return res.json({ success: true, message: 'ดำเนินการสำเร็จ' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * POST /api/admin/workflow/close
 * COORDINATOR ปิดงานพิจารณาหนังสือเวียน
 */
router.post(
  '/close',
  requireRole(['COORDINATOR']),
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId } = z.object({ docId: z.number() }).parse(req.body);
      const coordinatorId = req.admin!.id;
      await WorkflowService.closeWorkflow(docId, coordinatorId, '');
      return res.json({ success: true, message: 'ปิดงานสำเร็จ' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// PARALLEL WORKFLOW ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/workflow/parallel-assign
 * COORDINATOR/HR_DIRECTOR มอบให้หลาย Track พร้อมกัน
 */
router.post(
  '/parallel-assign',
  requireRole(['COORDINATOR']),
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId, tracks } = req.body;
      if (!docId || !Array.isArray(tracks) || tracks.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: `ข้อมูลไม่ครบถ้วน: docId=${docId}, tracks_is_array=${Array.isArray(tracks)}, tracks_length=${tracks?.length}` 
        });
      }
      const coordinatorId = req.admin!.id;
      const result = await ParallelWorkflowService.assignParallel(docId, coordinatorId, tracks);
      return res.json({ success: true, message: `มอบหมายสำเร็จ (${tracks.length} Track)`, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * POST /api/admin/workflow/parallel-delegate
 * Owner ใน Track delegate ลงไปยัง subordinate
 */
router.post(
  '/parallel-delegate',
  requireRole(['HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER']),
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId, paId, toUserId, comments } = req.body;
      if (!docId || !paId || !toUserId) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
      const fromUserId = req.admin!.id;
      await ParallelWorkflowService.delegateWithinTrack(docId, paId, fromUserId, toUserId, comments || '');
      return res.json({ success: true, message: 'มอบหมายใน Track สำเร็จ' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * POST /api/admin/workflow/parallel-submit
 * ผู้รับ Track ส่งผลการดำเนินงาน
 */
router.post(
  '/parallel-submit',
  requireAdmin,
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId, paId, resultComments } = req.body;
      if (!docId || !paId) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
      const userId = req.admin!.id;
      await ParallelWorkflowService.submitTrackResult(docId, paId, userId, resultComments || '');
      return res.json({ success: true, message: 'ส่งผลการดำเนินงานสำเร็จ' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * POST /api/admin/workflow/parallel-reject
 * ผู้รับ Track ตีกลับ (Tracks อื่นทำต่อได้อิสระ)
 */
router.post(
  '/parallel-reject',
  requireAdmin,
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId, paId, comments } = req.body;
      if (!docId || !paId) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
      const userId = req.admin!.id;
      await ParallelWorkflowService.rejectTrack(docId, paId, userId, comments || '');
      return res.json({ success: true, message: 'ตีกลับ Track สำเร็จ' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * GET /api/admin/workflow/:docId/parallel-tracks
 * ดึงสถานะทุก Track ของหนังสือ
 */
router.get(
  '/:docId/parallel-tracks',
  requireAdmin,
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const docId = parseInt(req.params.docId as string, 10);
      if (isNaN(docId)) return res.status(400).json({ success: false, message: 'Invalid docId' });
      const tracks = await ParallelWorkflowService.getParallelTracks(docId);
      return res.json({ success: true, data: tracks });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

export default router;

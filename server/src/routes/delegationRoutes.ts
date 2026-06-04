/**
 * routes/delegationRoutes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * API สำหรับจัดการ Workflow Delegations (การแต่งตั้งผู้รักษาการตามคำสั่งราชการ)
 *
 * Mount path: /api/admin/delegations
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import db from '../config/database.js';
import { requireAdmin, requireSuperAdmin, AdminRole, AdminRequest } from '../middleware/auth.js';
import { recordAuditLog } from '../utils/auditLogger.js';

const router = Router();

// ─── Response helpers ─────────────────────────────────────────────────────────
const ok  = (data: any, msg = 'success') => ({ status: true,  message: msg, response: data });
const err = (msg = 'error')              => ({ status: false, message: msg });

// ─────────────────────────────────────────────────────────────────────────────
// Role hierarchy — ใช้สำหรับ validate "1 ระดับต่ำกว่า" rule
// ยิ่งตัวเลขสูง = ยิ่งระดับต่ำ
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPERADMIN:   0,
  HR_DIRECTOR:  1,
  DIV_DIRECTOR: 2,
  SEC_DIRECTOR: 3,
  GRP_LEADER:   4,
  STAFF:        5,
  COORDINATOR:  5,   // ระดับเทียบเท่า STAFF
  SYSTEM_ADMIN: -1,  // บัญชีระบบ ไม่อยู่ใน hierarchy
};

/**
 * ตรวจสอบว่า assigneeRole อยู่ต่ำกว่า assignerRole พอดี 1 ระดับ
 */
function isOneLevelBelow(assignerRole: AdminRole, assigneeRole: AdminRole): boolean {
  const assignerLevel = ROLE_HIERARCHY[assignerRole];
  const assigneeLevel = ROLE_HIERARCHY[assigneeRole];
  if (assignerLevel === -1 || assigneeLevel === -1) return false;
  return assigneeLevel === assignerLevel + 1;
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────
const assignSchema = z.object({
  assigner_id:  z.number({ required_error: 'ต้องระบุ assigner_id' }).int().positive(),
  assignee_id:  z.number({ required_error: 'ต้องระบุ assignee_id' }).int().positive(),
  notes:        z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/delegations/assign
// แต่งตั้งผู้รักษาการ (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/assign', requireSuperAdmin, async (req: AdminRequest, res: Response): Promise<any> => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = Object.entries(parsed.error.format())
      .filter(([k]) => k !== '_errors')
      .map(([k, v]: [string, any]) => `${k}: ${v?._errors?.join(', ')}`)
      .join(' | ');
    return res.status(400).json({ status: false, message: `ข้อมูลไม่ถูกต้อง: ${details}`, errors: parsed.error.format() });
  }

  const { assigner_id, assignee_id, notes } = parsed.data;

  if (assigner_id === assignee_id) {
    return res.status(400).json(err('ผู้มอบอำนาจและผู้รับมอบอำนาจต้องไม่ใช่บุคคลเดียวกัน'));
  }

  try {
    // ดึง role ของทั้งสองคน
    const { rows: admins } = await db.query(
      `SELECT a.a_id, a.a_name, a.a_role, a.a_agency_id, ag.parent_ag_id 
       FROM admin a 
       LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id 
       WHERE a.a_id = ANY($1::int[]) AND a.a_status = '1'`,
      [[assigner_id, assignee_id]]
    );

    const assigner = admins.find((a: any) => a.a_id === assigner_id);
    const assignee = admins.find((a: any) => a.a_id === assignee_id);

    if (!assigner) return res.status(404).json(err('ไม่พบบัญชีผู้มอบอำนาจ หรือบัญชีถูกระงับ'));
    if (!assignee) return res.status(404).json(err('ไม่พบบัญชีผู้รับมอบอำนาจ หรือบัญชีถูกระงับ'));
    if (!assigner.a_role) return res.status(400).json(err(`ผู้มอบอำนาจ (${assigner.a_name}) ยังไม่มีบทบาทในสายงาน`));
    if (!assignee.a_role) return res.status(400).json(err(`ผู้รับมอบอำนาจ (${assignee.a_name}) ยังไม่มีบทบาทในสายงาน`));

    // ห้าม DIV_DIRECTOR, HR_DIRECTOR เป็นผู้รับมอบอำนาจ (Assignee)
    if (['DIV_DIRECTOR', 'HR_DIRECTOR'].includes(assignee.a_role)) {
      return res.status(400).json(err(`ไม่สามารถแต่งตั้งให้ ${assignee.a_role} เป็นผู้รับมอบอำนาจเพื่อรักษาการแทนได้`));
    }

    // ── Rule: ตรวจสอบระดับจากโครงสร้างส่วนราชการ ──────────────────
    if (['STAFF', 'COORDINATOR'].includes(assignee.a_role)) {
      if (assigner.a_role !== 'GRP_LEADER' || assigner.a_agency_id !== assignee.a_agency_id) {
        return res.status(400).json(err('สำหรับระดับปฏิบัติการ ต้องเลือกผู้รักษาการเป็นหัวหน้าฝ่าย (GRP_LEADER) ในสังกัดเดียวกันเท่านั้น'));
      }
    } else {
      if (assignee.parent_ag_id) {
        if (assigner.a_agency_id !== assignee.parent_ag_id && assigner.a_role !== 'SUPERADMIN') {
          return res.status(400).json(err('ต้องเลือกผู้รักษาการที่อยู่ในสังกัดระดับเหนือขึ้นไป 1 ระดับ (ตามโครงสร้างส่วนราชการ) เท่านั้น'));
        }
      }
    }

    // ── Rule: ห้ามแต่งตั้งซ้ำซ้อน ──────────────────
    // 1. ตรวจสอบว่า assignee_id กำลังรักษาการให้ assigner_id นี้อยู่แล้วหรือไม่
    const { rows: duplicateCheck } = await db.query(
      `SELECT delegation_id FROM c_workflow_delegations WHERE assigner_id = $1 AND assignee_id = $2 AND is_active = TRUE`,
      [assigner_id, assignee_id]
    );
    if (duplicateCheck.length > 0) {
      return res.status(400).json(err(`ผู้ใช้งานนี้กำลังรักษาการแทน ${assigner.a_name} อยู่แล้ว`));
    }

    // delegated_role = assigner.a_role (ผู้รักษาการจะทำหน้าที่ในตำแหน่งของ assigner)
    const delegated_role = assigner.a_role;

    // ── Rule: กำหนดลำดับรักษาการ (delegation_order) ถัดไป ──────────────────
    const { rows: orderCheck } = await db.query(
      `SELECT COALESCE(MAX(delegation_order), 0) + 1 AS next_order FROM c_workflow_delegations WHERE assigner_id = $1 AND is_active = TRUE`,
      [assigner_id]
    );
    const next_order = orderCheck[0].next_order;

    const { rows: [inserted] } = await db.query(
      `INSERT INTO c_workflow_delegations
         (assigner_id, assignee_id, delegated_role, delegation_order, is_active, created_by, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, NOW(), NOW())
       RETURNING delegation_id`,
      [assigner_id, assignee_id, delegated_role, next_order, req.admin!.id, notes || null]
    );

    recordAuditLog({
      userId:         req.admin!.id,
      userName:       req.admin!.name,
      action:         'DELEGATION_ASSIGN',
      targetResource: 'delegations',
      targetId:       String(inserted.delegation_id),
      payload:        { assigner_id, assignee_id, delegated_role },
      ipAddress:      (req.ip as string) || null,
      userAgent:      (req.headers['user-agent'] as string) || null,
    });

    return res.json(ok({
      delegation_id: inserted.delegation_id,
      delegated_role,
      assigner_name:  assigner.a_name,
      assignee_name:  assignee.a_name,
    }, `แต่งตั้ง ${assignee.a_name} รักษาการแทน ${assigner.a_name} (${delegated_role}) สำเร็จ`));

  } catch (e: any) {
    console.error('[DelegationRoutes] assign error:', e.message);
    return res.status(500).json(err('ไม่สามารถบันทึกการแต่งตั้งได้'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/delegations/assigner/:id
// ดึงรายการรักษาการทั้งหมดของเจ้าของตำแหน่งที่ระบุ
// ─────────────────────────────────────────────────────────────────────────────
router.get('/assigner/:id', requireAdmin, async (req: AdminRequest, res: Response): Promise<any> => {
  const assigner_id = parseInt(String(req.params.id), 10);
  if (isNaN(assigner_id)) return res.status(400).json(err('assigner_id ไม่ถูกต้อง'));

  try {
    const { rows } = await db.query(`
      SELECT
        d.delegation_id,
        d.delegation_order,
        d.is_active,
        assignee.a_id       AS assignee_id,
        assignee.a_name     AS assignee_name,
        assignee.a_role     AS assignee_role,
        assignee.a_position AS assignee_position
      FROM   c_workflow_delegations d
      JOIN   admin assignee ON assignee.a_id = d.assignee_id
      WHERE  d.assigner_id = $1 AND d.is_active = TRUE
      ORDER BY d.delegation_order ASC, d.created_at ASC
    `, [assigner_id]);
    
    return res.json(ok(rows));
  } catch (e: any) {
    console.error('[DelegationRoutes] getByAssigner error:', e.message);
    return res.status(500).json(err('ไม่สามารถโหลดข้อมูลรักษาการได้'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/delegations/reorder
// จัดลำดับผู้รักษาการใหม่
// ─────────────────────────────────────────────────────────────────────────────
router.put('/reorder', requireAdmin, async (req: AdminRequest, res: Response): Promise<any> => {
  const { delegation_ids } = req.body;
  
  if (!Array.isArray(delegation_ids)) {
    return res.status(400).json(err('รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น array ของ delegation_id)'));
  }

  try {
    await db.query('BEGIN');
    
    for (let i = 0; i < delegation_ids.length; i++) {
      const del_id = parseInt(delegation_ids[i], 10);
      if (!isNaN(del_id)) {
        await db.query(
          'UPDATE c_workflow_delegations SET delegation_order = $1, updated_at = NOW() WHERE delegation_id = $2',
          [i + 1, del_id]
        );
      }
    }
    
    await db.query('COMMIT');
    return res.json(ok(null, 'บันทึกลำดับรักษาการเรียบร้อยแล้ว'));
  } catch (e: any) {
    await db.query('ROLLBACK');
    console.error('[DelegationRoutes] reorder error:', e.message);
    return res.status(500).json(err('ไม่สามารถบันทึกลำดับใหม่ได้'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/delegations
// ดึงรายการ delegation ทั้งหมด (สำหรับ Management UI — SUPERADMIN)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireSuperAdmin, async (_req: AdminRequest, res: Response): Promise<any> => {
  try {
    const { rows } = await db.query(`
      SELECT
        d.delegation_id,
        d.delegated_role,
        d.is_active,
        d.notes,
        d.created_at,
        d.updated_at,
        assigner.a_id       AS assigner_id,
        assigner.a_name     AS assigner_name,
        assigner.a_role     AS assigner_role,
        assigner.a_position AS assigner_position,
        assignee.a_id       AS assignee_id,
        assignee.a_name     AS assignee_name,
        assignee.a_role     AS assignee_role,
        assignee.a_position AS assignee_position,
        creator.a_name      AS created_by_name
      FROM   c_workflow_delegations d
      JOIN   admin assigner ON assigner.a_id = d.assigner_id
      JOIN   admin assignee ON assignee.a_id = d.assignee_id
      LEFT   JOIN admin creator ON creator.a_id = d.created_by
      ORDER  BY d.is_active DESC, d.created_at DESC
    `);
    return res.json(ok(rows));
  } catch (e: any) {
    console.error('[DelegationRoutes] getAll error:', e.message);
    return res.status(500).json(err('โหลดข้อมูล delegation ไม่สำเร็จ'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/delegations/my-active
// ดึง delegation ที่ active ของ user ที่ login อยู่ (ใช้ใน Frontend)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-active', requireAdmin, async (req: AdminRequest, res: Response): Promise<any> => {
  try {
    const { rows } = await db.query(`
      SELECT
        d.delegation_id,
        d.delegated_role,
        d.notes,
        assigner.a_id       AS assigner_id,
        assigner.a_name     AS assigner_name,
        assigner.a_role     AS assigner_role,
        assigner.a_position AS assigner_position
      FROM   c_workflow_delegations d
      JOIN   admin assigner ON assigner.a_id = d.assigner_id
      WHERE  d.assignee_id = $1
        AND  d.is_active   = TRUE
      ORDER  BY d.created_at DESC
    `, [req.admin!.id]);

    return res.json(ok(rows));
  } catch (e: any) {
    console.error('[DelegationRoutes] myActive error:', e.message);
    return res.status(500).json(err('โหลดข้อมูล delegation ไม่สำเร็จ'));
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/delegations/active-by-role/:role
// ดึง delegation ที่ active สำหรับ role ที่กำหนด (ใช้ใน Workflow Builder)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/active-by-role/:role', requireAdmin, async (req: AdminRequest, res: Response): Promise<any> => {
  const role = req.params.role;
  try {
    const { rows } = await db.query(`
      SELECT
        d.delegation_id,
        d.delegated_role,
        d.notes,
        assignee.a_id       AS assignee_id,
        assignee.a_name     AS assignee_name,
        assignee.a_role     AS assignee_role,
        assigner.a_id       AS assigner_id,
        assigner.a_name     AS assigner_name,
        assigner.a_role     AS assigner_role
      FROM   c_workflow_delegations d
      JOIN   admin assignee ON assignee.a_id = d.assignee_id
      JOIN   admin assigner ON assigner.a_id = d.assigner_id
      WHERE  d.delegated_role = $1
        AND  d.is_active = TRUE
      ORDER BY d.created_at DESC
    `, [role]);
    return res.json(ok(rows));
  } catch (e: any) {
    console.error('[DelegationRoutes] activeByRole error:', e.message);
    return res.status(500).json(err('โหลดข้อมูล delegation ไม่สำเร็จ'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/delegations/my-delegated
// ดึง delegation ที่ user ที่ login อยู่เป็นผู้มอบอำนาจ (Assigner)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-delegated', requireAdmin, async (req: AdminRequest, res: Response): Promise<any> => {
  try {
    const { rows } = await db.query(`
      SELECT
        d.delegation_id,
        d.delegated_role,
        d.notes,
        assignee.a_id       AS assignee_id,
        assignee.a_name     AS assignee_name,
        assignee.a_role     AS assignee_role,
        assignee.a_position AS assignee_position
      FROM   c_workflow_delegations d
      JOIN   admin assignee ON assignee.a_id = d.assignee_id
      WHERE  d.assigner_id = $1
        AND  d.is_active = TRUE
      ORDER BY d.created_at DESC
    `, [req.admin!.id]);
    return res.json(ok(rows));
  } catch (e: any) {
    console.error('[DelegationRoutes] getMyDelegated error:', e.message);
    return res.status(500).json(err('โหลดข้อมูล delegation ของคุณไม่สำเร็จ'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/delegations/:id/toggle
// เปิด/ปิด delegation (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/toggle', requireSuperAdmin, async (req: AdminRequest, res: Response): Promise<any> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json(err('delegation_id ไม่ถูกต้อง'));

  const { is_active } = req.body;
  if (typeof is_active !== 'boolean') {
    return res.status(400).json(err('ต้องส่ง is_active เป็น boolean'));
  }

  try {
    const { rows: existing } = await db.query(
      'SELECT delegation_id FROM c_workflow_delegations WHERE delegation_id = $1', [id]
    );
    if (!existing.length) return res.status(404).json(err('ไม่พบข้อมูล delegation'));

    await db.query(
      'UPDATE c_workflow_delegations SET is_active = $1, updated_at = NOW() WHERE delegation_id = $2',
      [is_active, id]
    );

    recordAuditLog({
      userId:         req.admin!.id,
      userName:       req.admin!.name,
      action:         is_active ? 'DELEGATION_ACTIVATE' : 'DELEGATION_DEACTIVATE',
      targetResource: 'delegations',
      targetId:       String(id),
      payload:        { is_active },
      ipAddress:      (req.ip as string) || null,
      userAgent:      (req.headers['user-agent'] as string) || null,
    });

    return res.json(ok(null, is_active ? 'เปิดใช้งาน delegation แล้ว' : 'ปิดใช้งาน delegation แล้ว'));
  } catch (e: any) {
    console.error('[DelegationRoutes] toggle error:', e.message);
    return res.status(500).json(err('ไม่สามารถเปลี่ยนสถานะ delegation ได้'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/delegations/:id
// ลบรายการ delegation ถาวร (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireSuperAdmin, async (req: AdminRequest, res: Response): Promise<any> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json(err('delegation_id ไม่ถูกต้อง'));

  try {
    const { rowCount } = await db.query(
      'DELETE FROM c_workflow_delegations WHERE delegation_id = $1', [id]
    );

    if (rowCount === 0) return res.status(404).json(err('ไม่พบข้อมูล delegation'));

    recordAuditLog({
      userId:         req.admin!.id,
      userName:       req.admin!.name,
      action:         'DELEGATION_DELETE',
      targetResource: 'delegations',
      targetId:       String(id),
      payload:        null,
      ipAddress:      (req.ip as string) || null,
      userAgent:      (req.headers['user-agent'] as string) || null,
    });

    return res.json(ok(null, 'ลบการเป็นรักษาการเรียบร้อยแล้ว'));
  } catch (e: any) {
    console.error('[DelegationRoutes] delete error:', e.message);
    return res.status(500).json(err('ไม่สามารถลบข้อมูล delegation ได้'));
  }
});

export default router;

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
  order_number: z.string({ required_error: 'ต้องระบุเลขที่คำสั่ง' }).min(1, 'เลขที่คำสั่งต้องไม่ว่าง'),
  notes:        z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/delegations/assign
// แต่งตั้งผู้รักษาการ (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/assign', requireSuperAdmin, async (req: AdminRequest, res: Response): Promise<any> => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: false, message: 'ข้อมูลไม่ถูกต้อง', errors: parsed.error.format() });
  }

  const { assigner_id, assignee_id, order_number, notes } = parsed.data;

  if (assigner_id === assignee_id) {
    return res.status(400).json(err('ผู้มอบอำนาจและผู้รับมอบอำนาจต้องไม่ใช่บุคคลเดียวกัน'));
  }

  try {
    // ดึง role ของทั้งสองคน
    const { rows: admins } = await db.query(
      `SELECT a_id, a_name, a_role FROM admin WHERE a_id = ANY($1::int[]) AND a_status = '1'`,
      [[assigner_id, assignee_id]]
    );

    const assigner = admins.find((a: any) => a.a_id === assigner_id);
    const assignee = admins.find((a: any) => a.a_id === assignee_id);

    if (!assigner) return res.status(404).json(err('ไม่พบบัญชีผู้มอบอำนาจ หรือบัญชีถูกระงับ'));
    if (!assignee) return res.status(404).json(err('ไม่พบบัญชีผู้รับมอบอำนาจ หรือบัญชีถูกระงับ'));
    if (!assigner.a_role) return res.status(400).json(err(`ผู้มอบอำนาจ (${assigner.a_name}) ยังไม่มีบทบาทในสายงาน`));
    if (!assignee.a_role) return res.status(400).json(err(`ผู้รับมอบอำนาจ (${assignee.a_name}) ยังไม่มีบทบาทในสายงาน`));

    // ── Rule: Assignee ต้องต่ำกว่า Assigner พอดี 1 ระดับ ──────────────────
    if (!isOneLevelBelow(assigner.a_role as AdminRole, assignee.a_role as AdminRole)) {
      const aLevel = ROLE_HIERARCHY[assigner.a_role as AdminRole];
      const bLevel = ROLE_HIERARCHY[assignee.a_role as AdminRole];
      return res.status(400).json(err(
        `ผู้รักษาการต้องมีระดับต่ำกว่าผู้มอบอำนาจพอดี 1 ระดับ ` +
        `(${assigner.a_role} = ระดับ ${aLevel}, ${assignee.a_role} = ระดับ ${bLevel})`
      ));
    }

    // delegated_role = assigner.a_role (ผู้รักษาการจะทำหน้าที่ในตำแหน่งของ assigner)
    const delegated_role = assigner.a_role;

    const { rows: [inserted] } = await db.query(
      `INSERT INTO c_workflow_delegations
         (assigner_id, assignee_id, delegated_role, order_number, is_active, created_by, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, NOW(), NOW())
       RETURNING delegation_id`,
      [assigner_id, assignee_id, delegated_role, order_number, req.admin!.id, notes || null]
    );

    recordAuditLog({
      userId:         req.admin!.id,
      userName:       req.admin!.name,
      action:         'DELEGATION_ASSIGN',
      targetResource: 'delegations',
      targetId:       String(inserted.delegation_id),
      payload:        { assigner_id, assignee_id, delegated_role, order_number },
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
// GET /api/admin/delegations
// ดึงรายการ delegation ทั้งหมด (สำหรับ Management UI — SUPERADMIN)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireSuperAdmin, async (_req: AdminRequest, res: Response): Promise<any> => {
  try {
    const { rows } = await db.query(`
      SELECT
        d.delegation_id,
        d.order_number,
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
        d.order_number,
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

export default router;

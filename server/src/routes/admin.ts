/**
 * routes/admin.ts — Admin API
 */
import { Router, Response } from 'express';
import db from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendOtpEmail } from '../services/emailService.js';
import { generateOtp, hashOtp, verifyOtp, otpExpiry, maskEmail } from '../utils/otp.js';
import { requireAdmin, requireSuperAdmin, JWT_SECRET, AdminRequest } from '../middleware/auth.js';
import { summarizePdf } from '../services/aiService.js';
import { syncOCSC } from '../services/botService.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getCachedQuery, clearLookupCache } from '../utils/cache.js';
import { recordAuditLog } from '../utils/auditLogger.js';

const stringOrNumber = z.union([z.string(), z.number()]).optional().nullable();

const circularSchema = z.object({
  in_num_date: z.string({ required_error: 'ระบุเลขที่หนังสือเวียน' }).min(1, 'ระบุเลขที่หนังสือเวียน'),
  in_detail: z.string({ required_error: 'ระบุรายละเอียดหนังสือเวียน' }).min(1, 'ระบุรายละเอียดหนังสือเวียน'),
  in_doc_date: z.string().optional().nullable(),
  in_detail_ag: z.string().optional().nullable(),
  in_etc: z.string().optional().nullable(),
  in_link: z.string().optional().nullable(),
  in_qr_link: z.string().optional().nullable(),
  in_circular_detail: z.string().optional().nullable(),
  in_mkk_id: stringOrNumber,
  in_mw_id: stringOrNumber,
  in_results_id: stringOrNumber,
  in_year_id: stringOrNumber,
  in_status_id: stringOrNumber,
  mkk_ref_link_in: z.string().optional().nullable(),
  mkk_ref_none_in: z.string().optional().nullable(),
  lkk_none: z.string().optional().nullable(),
  ref_none: z.string().optional().nullable(),
  submit_create_circular_hidden: z.any().optional(),
  in_id: stringOrNumber,
  existing_file_in: z.string().optional().nullable(),
}).passthrough();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// STAB-02: Database migrations have been extracted to config/migrations.ts

const ok = (data: any, msg: string = 'success') => ({ status: true, message: msg, response: data });
const err = (msg: string = 'error') => ({ status: false, message: msg });

const toSqlInt = (val: any): number | null => {
  if (val === undefined || val === null || val === '' || val === '-') return null;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
};

// ─── Middleware: Zod Validation ───────────────────────────────
const validate = (schema: z.ZodSchema) => (req: any, res: Response, next: any) => {
  const validationResult = schema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({ status: false, message: 'ข้อมูลไม่ถูกต้อง', errors: validationResult.error.format() });
  }
  next();
};

// ─── Multer (PDF upload) ──────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../../uploads')),
    filename: (_req, file, cb) => {
      // SEC-08: Validate extension server-side + use UUID for unpredictable filenames
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.pdf') {
        return cb(new Error('กรุณาเลือกไฟล์ PDF เท่านั้น'), '');
      }
      let prefix = 'file';
      if (file.fieldname === 'mkk_ref_upload_in') prefix = 'mkk';
      else if (file.fieldname === 'in_original_file') prefix = 'orig';
      else if (file.fieldname === 'in_attachment_file') prefix = 'att';
      cb(null, `${prefix}_${uuidv4()}.pdf`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype === 'application/pdf' && ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('กรุณาเลือกไฟล์ PDF เท่านั้น'));
    }
  },
});

const _uploadFields = upload.fields([
  { name: 'mkk_ref_upload_in', maxCount: 1 },
  { name: 'in_original_file', maxCount: 1 },
  { name: 'in_attachment_file', maxCount: 5 }
]);

const uploadFields = (req: any, res: any, next: any) => {
  _uploadFields(req, res, (err: any) => {
    if (err) {
      console.error('Multer Upload Error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ status: false, message: 'ขนาดไฟล์ใหญ่เกินไป (จำกัด 50MB ต่อไฟล์)' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ status: false, message: 'จำนวนไฟล์แนบท้ายเกินขีดจำกัด หรือฟิลด์ไม่ถูกต้อง' });
      }
      return res.status(400).json({ status: false, message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ (Internal Server Error)' });
    }
    next();
  });
};

// ─── Helper: parse STRING_AGG → object / array ────────────────
const parseFirst = (val: string | null, fields: string[]) => {
  if (!val) return null;
  const parts = val.split(',')[0].split('|#|');
  return Object.fromEntries(fields.map((f, i) => [f, parts[i] || '']));
};

const parseList = (val: string | null, parser: (s: string) => any, delim: string = ',') =>
  val ? val.split(delim).map(parser).filter(Boolean) : [];

// ─────────────────────────────────────────────────────────────
// POST /admin/auth/login
// ─────────────────────────────────────────────────────────────
router.post('/auth/login', async (req: AdminRequest, res: Response) => {
  const { loginUsername, loginPassword } = req.body;
  if (!loginUsername || !loginPassword)
    return res.status(400).json(err('กรุณากรอก Username และ Password'));
  try {
    const { rows } = await db.query(
      `SELECT a.a_id, a.a_name, a.a_username, a.a_password, a.a_status, a.a_permiss, 
              COALESCE(ag.ag_role, 'STAFF') AS a_role,
              a.a_2fa_enabled, a.a_email, a.a_token_version
       FROM admin a
       LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
       WHERE a.a_username=$1`,
      [loginUsername]
    );
    if (!rows.length) return res.status(401).json(err('Username หรือ Password ไม่ถูกต้อง'));

    const admin = rows[0];
    if (admin.a_status === 'false')
      return res.status(403).json(err('บัญชีถูกระงับ กรุณาติดต่อผู้ดูแล'));

    const isMatch = await bcrypt.compare(loginPassword, admin.a_password).catch(() => false);
    if (!isMatch) return res.status(401).json(err('Username หรือ Password ไม่ถูกต้อง'));

    await db.query('UPDATE admin SET a_last_login=NOW() WHERE a_id=$1', [admin.a_id]);

    // ── 2FA Check ────────────────────────────────────────────────────────────
    if (admin.a_2fa_enabled && admin.a_email) {
      // Generate OTP, hash it, store with expiry
      const otp    = generateOtp();
      const hashed = await hashOtp(otp);
      const expiry = otpExpiry();

      await db.query(
        'UPDATE admin SET a_otp_code=$1, a_otp_expiry=$2 WHERE a_id=$3',
        [hashed, expiry, admin.a_id]
      );

      // Send OTP email (fire-and-forget, don't block the response)
      sendOtpEmail(admin.a_email, admin.a_name, otp).catch(e =>
        console.error('[2FA] Failed to send OTP email:', e.message)
      );

      // Issue a short-lived temporary token (valid 10 min, only for OTP step)
      const tmpToken = jwt.sign(
        { id: admin.a_id, step: '2fa_pending' },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      return res.json({
        status: true,
        require_2fa: true,
        tmp_token:   tmpToken,
        email_hint:  maskEmail(admin.a_email),
        message:     'กรุณายืนยัน OTP ที่ส่งไปยังอีเมลของคุณ',
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const token = jwt.sign(
      {
        id: admin.a_id,
        name: admin.a_name,
        permiss: admin.a_permiss,
        role: admin.a_role ?? null,
        token_version: admin.a_token_version,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    recordAuditLog({
      userId: admin.a_id,
      userName: admin.a_name,
      action: 'LOGIN_SUCCESS',
      targetResource: 'auth',
      targetId: null,
      payload: null,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json(ok({
      token,
      id: admin.a_id,
      name: admin.a_name,
      permiss: admin.a_permiss,
      role: admin.a_role ?? null,
    }, 'login success'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/auth/verify-otp
// ─────────────────────────────────────────────────────────────
router.post('/auth/verify-otp', async (req: AdminRequest, res: Response) => {
  const { tmp_token, otp_code } = req.body;
  if (!tmp_token || !otp_code)
    return res.status(400).json(err('ข้อมูลไม่ครบถ้วน'));
  try {
    // Verify the temporary token issued in the login step
    let decoded: any;
    try {
      decoded = jwt.verify(tmp_token, JWT_SECRET) as any;
    } catch {
      return res.status(401).json(err('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'));
    }
    if (decoded.step !== '2fa_pending')
      return res.status(401).json(err('Token ไม่ถูกต้อง'));

    const { rows } = await db.query(
      `SELECT a.a_id, a.a_name, a.a_permiss, COALESCE(ag.ag_role, 'STAFF') AS a_role, a.a_otp_code, a.a_otp_expiry, a.a_token_version, a.a_otp_attempts 
       FROM admin a LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id 
       WHERE a.a_id=$1`,
      [decoded.id]
    );
    if (!rows.length) return res.status(404).json(err('ไม่พบบัญชีผู้ใช้'));

    const admin = rows[0];

    // SEC-09: Lock out after 5 failed OTP attempts
    const attempts = admin.a_otp_attempts || 0;
    if (attempts >= 5) {
      await db.query('UPDATE admin SET a_otp_code=NULL, a_otp_expiry=NULL, a_otp_attempts=0 WHERE a_id=$1', [admin.a_id]);
      return res.status(429).json(err('ลองผิดเกินจำนวนที่กำหนด กรุณาเข้าสู่ระบบใหม่'));
    }

    // Check expiry
    if (!admin.a_otp_expiry || new Date() > new Date(admin.a_otp_expiry))
      return res.status(400).json(err('รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่'));

    // Verify OTP hash
    const valid = await verifyOtp(String(otp_code).trim(), admin.a_otp_code || '');
    if (!valid) {
      // Increment attempt counter on failure
      await db.query('UPDATE admin SET a_otp_attempts = COALESCE(a_otp_attempts, 0) + 1 WHERE a_id=$1', [admin.a_id]);
      return res.status(400).json(err('รหัส OTP ไม่ถูกต้อง'));
    }

    // Clear OTP + reset attempts after successful verification (single-use)
    await db.query(
      'UPDATE admin SET a_otp_code=NULL, a_otp_expiry=NULL, a_otp_attempts=0 WHERE a_id=$1',
      [admin.a_id]
    );

    // Issue the real long-lived JWT
    const token = jwt.sign(
      { id: admin.a_id, name: admin.a_name, permiss: admin.a_permiss, role: admin.a_role ?? null, token_version: admin.a_token_version },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    recordAuditLog({
      userId: admin.a_id,
      userName: admin.a_name,
      action: 'LOGIN_2FA_SUCCESS',
      targetResource: 'auth',
      targetId: null,
      payload: null,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json(ok({
      token,
      id:      admin.a_id,
      name:    admin.a_name,
      permiss: admin.a_permiss,
      role:    admin.a_role ?? null,
    }, 'ยืนยัน OTP สำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/auth/resend-otp
// ─────────────────────────────────────────────────────────────
router.post('/auth/resend-otp', async (req: AdminRequest, res: Response) => {
  const { tmp_token } = req.body;
  if (!tmp_token) return res.status(400).json(err('ไม่มี session token'));
  try {
    let decoded: any;
    try {
      decoded = jwt.verify(tmp_token, JWT_SECRET) as any;
    } catch {
      return res.status(401).json(err('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'));
    }
    if (decoded.step !== '2fa_pending')
      return res.status(401).json(err('Token ไม่ถูกต้อง'));

    const { rows } = await db.query(
      'SELECT a_id, a_name, a_email, a_otp_expiry FROM admin WHERE a_id=$1',
      [decoded.id]
    );
    if (!rows.length || !rows[0].a_email)
      return res.status(404).json(err('ไม่พบบัญชีหรือยังไม่ได้ผูกอีเมล'));

    const admin = rows[0];

    // Rate-limit: block resend if previous OTP still has > 3 min left
    if (admin.a_otp_expiry) {
      const remainMs = new Date(admin.a_otp_expiry).getTime() - Date.now();
      if (remainMs > 3 * 60 * 1000)
        return res.status(429).json(err(`กรุณารอสักครู่ก่อนขอรหัสใหม่`));
    }

    const otp    = generateOtp();
    const hashed = await hashOtp(otp);
    const expiry = otpExpiry();

    await db.query(
      'UPDATE admin SET a_otp_code=$1, a_otp_expiry=$2 WHERE a_id=$3',
      [hashed, expiry, admin.a_id]
    );

    sendOtpEmail(admin.a_email, admin.a_name, otp).catch(e =>
      console.error('[2FA] Resend email failed:', e.message)
    );

    return res.json(ok(null, 'ส่งรหัส OTP ใหม่เรียบร้อยแล้ว'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /admin/users/:id/2fa  — toggle 2FA for a user (admin only)
// PATCH /admin/profile/2fa    — toggle own 2FA
// ─────────────────────────────────────────────────────────────
router.patch('/users/:id/2fa', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body; // boolean
  try {
    const { rows } = await db.query('SELECT a_email FROM admin WHERE a_id=$1', [id]);
    if (!rows.length) return res.status(404).json(err('ไม่พบบัญชีผู้ใช้'));
    if (enabled && !rows[0].a_email)
      return res.status(400).json(err('ต้องกรอกอีเมลก่อนเปิดใช้งาน 2FA'));
    await db.query('UPDATE admin SET a_2fa_enabled=$1 WHERE a_id=$2', [!!enabled, id]);
    return res.json(ok(null, enabled ? 'เปิดใช้งาน 2FA แล้ว' : 'ปิดใช้งาน 2FA แล้ว'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

router.patch('/profile/2fa', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { enabled } = req.body;
  try {
    const { rows } = await db.query('SELECT a_email FROM admin WHERE a_id=$1', [req.admin?.id]);
    if (!rows.length) return res.status(404).json(err('ไม่พบบัญชี'));
    if (enabled && !rows[0].a_email)
      return res.status(400).json(err('ต้องกรอกอีเมลก่อนเปิดใช้งาน 2FA'));
    await db.query('UPDATE admin SET a_2fa_enabled=$1 WHERE a_id=$2', [!!enabled, req.admin?.id]);
    return res.json(ok(null, enabled ? 'เปิดใช้งาน 2FA แล้ว' : 'ปิดใช้งาน 2FA แล้ว'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});


// ─────────────────────────────────────────────────────────────
// USER MANAGEMENT (admin table)
// ─────────────────────────────────────────────────────────────

/** 1. ดึงรายชื่อผู้ใช้ทั้งหมด */
router.get('/users', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    let sql = `
      SELECT 
        a.a_id, a.a_name, a.a_username, a.a_email, a.a_permiss, COALESCE(ag.ag_role, 'STAFF') AS a_role, 
        COALESCE(ag.ag_name, a.a_position) AS a_position, a.a_status, 
        COALESCE(parent_ag.ag_name, ag.ag_name, a.a_agency) AS a_agency, 
        a.a_agency_id, a.a_last_login, a.created_at,
        MIN(d.delegation_id) AS active_delegation_id,
        STRING_AGG(assignee.a_name, ', ') AS active_assignee_name
      FROM admin a
      LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
      LEFT JOIN c_agency parent_ag ON ag.parent_ag_id = parent_ag.ag_id
      LEFT JOIN c_workflow_delegations d ON d.assigner_id = a.a_id AND d.is_active = TRUE
      LEFT JOIN admin assignee ON assignee.a_id = d.assignee_id
    `;
    const params: any[] = [];
    if (req.admin?.permiss !== 'superadmin') {
      sql += ` WHERE a.a_permiss != 'superadmin' `;
    }
    sql += ` GROUP BY a.a_id, ag.ag_role, ag.ag_name, parent_ag.ag_name ORDER BY a.a_id DESC `;
    const { rows } = await db.query(sql, params);
    return res.json(ok(rows));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('โหลดข้อมูลผู้ใช้ไม่ได้'));
  }
});

/** 1b. ดึงรายชื่อผู้ใช้ที่ Active กรองตาม role + hierarchy (สำหรับ Workflow dropdowns) */
router.get('/users/by-role', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const approvalContext = req.query.approval_context as string; // 'SELF' | 'ACTING'
    const delegationId = req.query.delegation_id ? parseInt(req.query.delegation_id as string, 10) : undefined;
    const roles = req.query.roles as string; // comma-separated e.g. "HR_DIRECTOR,GRP_LEADER"
    const sameAgencyOnly = req.query.same_agency === 'true'; // filter to same agency only (for coordinator assignment dropdown)

    // --- Determine effective user (could be the assigner if acting) ---
    let effectiveUserId: number = req.admin!.id;
    let effectiveUserRole: string = req.admin!.role ?? '';

    if (approvalContext === 'ACTING' && delegationId) {
      const { rows: delRows } = await db.query(
        'SELECT assigner_id FROM c_workflow_delegations WHERE delegation_id = $1 AND assignee_id = $2 AND is_active = TRUE',
        [delegationId, req.admin!.id]
      );
      if (delRows.length > 0) {
        effectiveUserId = delRows[0].assigner_id;
      }
    }

    // --- Get effective user's agency + role ---
    const { rows: effRows } = await db.query(
      `SELECT a.a_role, a.a_agency_id, ag.parent_ag_id
       FROM admin a
       LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
       WHERE a.a_id = $1`,
      [effectiveUserId]
    );

    let effectiveUserAgencyId: number | null = null;
    let effectiveUserAgencyParentId: number | null = null;
    if (effRows.length > 0) {
      effectiveUserRole = effRows[0].a_role;
      effectiveUserAgencyId = effRows[0].a_agency_id;
      effectiveUserAgencyParentId = effRows[0].parent_ag_id;
    }

    // --- Get child agencies (subordinates) ---
    let childAgencyIds: number[] = [];
    let ancestorAgencyIds: number[] = [];

    if (effectiveUserAgencyId) {
      const { rows: childRows } = await db.query(
        'SELECT ag_id FROM c_agency WHERE parent_ag_id = $1',
        [effectiveUserAgencyId]
      );
      childAgencyIds = childRows.map((r: any) => r.ag_id);

      // --- Get all ancestor agencies for effective user ---
      const { rows: ancestorRows } = await db.query(
        `WITH RECURSIVE ancestors AS (
           SELECT ag_id, parent_ag_id FROM c_agency WHERE ag_id = $1
           UNION
           SELECT c.ag_id, c.parent_ag_id FROM c_agency c
           INNER JOIN ancestors a ON c.ag_id = a.parent_ag_id
         )
         SELECT ag_id FROM ancestors`,
        [effectiveUserAgencyId]
      );
      ancestorAgencyIds = ancestorRows.map((r: any) => Number(r.ag_id));
    }

    // --- Fetch all active users (filtered by role if provided) ---
    const params: any[] = ['1'];
    let sql = `SELECT a.a_id, a.a_name, COALESCE(c.ag_role, 'STAFF') AS a_role, COALESCE(c.ag_name, a.a_position) AS a_position, a.a_agency_id, c.parent_ag_id 
           FROM admin a 
           LEFT JOIN c_agency c ON a.a_agency_id = c.ag_id 
           WHERE a.a_status = $1`;
    if (roles) {
      const roleList = roles.split(',').map(r => r.trim()).filter(Boolean);
      if (roleList.length > 0) {
        const placeholders = roleList.map((_, i) => `$${i + 2}`).join(', ');
        sql += ` AND COALESCE(c.ag_role, 'STAFF') IN (${placeholders})`;
        params.push(...roleList);
      }
    }
    sql += ` ORDER BY a_name ASC`;
    let { rows } = await db.query(sql, params);

    // --- Always strip SYSTEM_ADMIN and SUPERADMIN ---
    rows = rows.filter((r: any) => r.a_role !== 'SYSTEM_ADMIN' && r.a_role !== 'SUPERADMIN');

    // --- Apply hierarchy filter based on agency structure ---
    if (effectiveUserRole !== 'SUPERADMIN' && effectiveUserRole !== 'SYSTEM_ADMIN') {
      if (effectiveUserRole === 'DIV_DIRECTOR' || effectiveUserRole === 'HR_DIRECTOR') {
        // Directors can see: other directors, coordinator, and their subordinate agencies
        rows = rows.filter((r: any) =>
          r.a_role === 'DIV_DIRECTOR' ||
          r.a_role === 'HR_DIRECTOR' ||
          childAgencyIds.includes(Number(r.a_agency_id))
        );
      } else {
        // Others: can see parent-agency users (supervisor) + child-agency users (subordinates)
        // AND peers IF we are requesting GRP_LEADER
        const isRequestingGrpLeader = roles && roles.includes('GRP_LEADER');
        console.log('[DEBUG] isRequestingGrpLeader:', isRequestingGrpLeader, 'effectiveUserId:', effectiveUserId, 'roles:', roles, 'effectiveUserAgencyParentId:', effectiveUserAgencyParentId);
        rows = rows.filter((r: any) => {
          if (isRequestingGrpLeader && r.a_role === 'GRP_LEADER') {
              console.log('[DEBUG] Checking GRP_LEADER:', r.a_name, 'a_agency_id:', r.a_agency_id, 'effectiveUserAgencyId:', effectiveUserAgencyId, 'parent_ag_id:', r.parent_ag_id, 'effectiveUserAgencyParentId:', effectiveUserAgencyParentId);
              if (Number(r.a_agency_id) === Number(effectiveUserAgencyId)) return true;
              if (effectiveUserAgencyParentId && Number(r.parent_ag_id) === Number(effectiveUserAgencyParentId)) return true;
              if (effectiveUserAgencyParentId && Number(r.a_agency_id) === Number(effectiveUserAgencyParentId)) return true;
              return false;
          }
          
          // Allow seeing Directors (DIV/HR) if they govern any of the user's ancestor agencies
          if ((r.a_role === 'DIV_DIRECTOR' || r.a_role === 'HR_DIRECTOR') && 
              ancestorAgencyIds.includes(Number(r.parent_ag_id))) {
              return true;
          }
          
          // Allow seeing users in the exact same position node
          if (Number(r.a_agency_id) === Number(effectiveUserAgencyId)) return true;
          
          // Allow seeing users in the same parent group (sibling positions)
          if (effectiveUserAgencyParentId && Number(r.parent_ag_id) === Number(effectiveUserAgencyParentId)) return true;
          
          return (effectiveUserAgencyParentId && Number(r.a_agency_id) === Number(effectiveUserAgencyParentId)) ||
                 childAgencyIds.includes(Number(r.a_agency_id));
        });
      }
      // Exclude self always
      rows = rows.filter((r: any) => r.a_id !== effectiveUserId);
    }

    // --- same_agency filter: return only users in same parent agency (for coordinator assignment) ---
    if (sameAgencyOnly && effectiveUserAgencyParentId) {
      rows = rows.filter((r: any) =>
        Number(r.parent_ag_id) === Number(effectiveUserAgencyParentId) ||
        Number(r.a_agency_id) === Number(effectiveUserAgencyParentId)
      );
    }

    console.log('--- BY-ROLE ---', { effectiveUserId, effectiveUserRole, effectiveUserAgencyId, effectiveUserAgencyParentId, childAgencyIds, resultCount: rows.length });

    // --- Attach acting delegates for each visible user ---
    if (rows.length > 0) {
      const userAgIds = [...new Set(rows.map((r: any) => r.a_agency_id).filter(Boolean))];
      let delegations: any[] = [];
      
      if (userAgIds.length > 0) {
        const placeholdersAg = userAgIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
        const { rows: dRows } = await db.query(
          `SELECT d.assigner_ag_id, assignee.a_id AS assignee_id, assignee.a_name AS assignee_name
           FROM c_workflow_delegations d
           JOIN admin assignee ON assignee.a_id = d.assignee_id
           WHERE d.is_active = TRUE AND d.assigner_ag_id IN (${placeholdersAg})`,
          userAgIds
        );
        delegations = dRows;
      }

      const delegationMap = new Map<number, any>();
      delegations.forEach((d: any) => delegationMap.set(d.assigner_ag_id, d));

      const finalRows: any[] = [];
      rows.forEach((r: any) => {
        finalRows.push(r);
        if (r.a_agency_id && delegationMap.has(r.a_agency_id)) {
          const del = delegationMap.get(r.a_agency_id);
          finalRows.push({
            ...r,
            a_id: r.a_id, // Keep original role's ID so backend routes to Acting Inbox correctly
            a_name: `${del.assignee_name} (รักษาการแทน ${r.a_name})`,
            isActing: true,
            actingFor: r.a_name
          });
        }
      });
      return res.json(ok(finalRows));
    }

    return res.json(ok(rows));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('โหลดข้อมูลผู้ใช้ไม่ได้'));
  }
});


/** 2. เพิ่มผู้ใช้ใหม่ */
router.post('/users', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { a_name, a_username, a_email, a_password, a_permiss, a_role, a_status } = req.body;
  if (req.admin?.permiss !== 'superadmin' && a_permiss === 'superadmin') {
    return res.status(403).json(err('คุณไม่มีสิทธิ์เพิ่มผู้ใช้ระดับ SuperAdmin'));
  }
  // SEC-10: Require password with minimum length
  if (!a_password || a_password.length < 8) {
    return res.status(400).json(err('กรุณากำหนดรหัสผ่านอย่างน้อย 8 ตัวอักษร'));
  }
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(a_password, salt);
    await db.query(`
      INSERT INTO admin (a_name, a_username, a_email, a_password, a_permiss, a_role, a_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `, [a_name, a_username, a_email, hash, a_permiss || 'user', a_role || 'STAFF', a_status || '1']);
    return res.json(ok(null, 'เพิ่มผู้ใช้สำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถเพิ่มผู้ใช้ได้'));
  }
});

/** 3. แก้ไขผู้ใช้ */
router.put('/users/:id', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  console.log(`[AdminAPI] Incoming PUT /users/${req.params.id}`, req.body);
  const { id } = req.params;
  const { a_name, a_username, a_email, a_password, a_permiss, a_role, a_status } = req.body;
  try {
    const { rows: existing } = await db.query('SELECT a_permiss FROM admin WHERE a_id = $1', [id]);
    if (!existing.length) return res.status(404).json(err('ไม่พบผู้ใช้'));
    if (req.admin?.permiss !== 'superadmin') {
      if (existing[0].a_permiss === 'superadmin')
        return res.status(403).json(err('คุณไม่มีสิทธิ์จัดการผู้ใช้ระดับ SuperAdmin'));
      if (a_permiss === 'superadmin')
        return res.status(403).json(err('คุณไม่มีสิทธิ์กำหนดสิทธิ์เป็น SuperAdmin'));
    }
    if (a_password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(a_password, salt);
      await db.query(`
        UPDATE admin SET a_name=$1, a_username=$2, a_email=$3, a_password=$4, a_permiss=$5, a_role=$6, a_status=$7, a_token_version = COALESCE(a_token_version, 1) + 1, updated_at=NOW()
        WHERE a_id=($8)::int
      `, [a_name, a_username, a_email, hash, a_permiss, a_role, a_status, id]);
    } else {
      await db.query(`
        UPDATE admin SET a_name=$1, a_username=$2, a_email=$3, a_permiss=$4, a_role=$5, a_status=$6, updated_at=NOW()
        WHERE a_id=($7)::int
      `, [a_name, a_username, a_email, a_permiss, a_role, a_status, id]);
    }

    return res.json(ok(null, 'แก้ไขข้อมูลสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถแก้ไขข้อมูลผู้ใช้ได้'));
  }
});

/** 4. ลบผู้ใช้ */
router.delete('/users/:id', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  if (parseInt(id as string) === req.admin?.id) return res.status(400).json(err('ไม่อนุญาตให้ลบบัญชีที่กำลังเข้าใช้งานอยู่'));
  try {
    const { rows: existing } = await db.query('SELECT a_permiss FROM admin WHERE a_id = $1', [id]);
    if (!existing.length) return res.status(404).json(err('ไม่พบผู้ใช้'));
    if (req.admin?.permiss !== 'superadmin' && existing[0].a_permiss === 'superadmin') {
      return res.status(403).json(err('คุณไม่มีสิทธิ์ลบผู้ใช้ระดับ SuperAdmin'));
    }
    await db.query('DELETE FROM admin WHERE a_id = $1', [id]);
    return res.json(ok(null, 'ลบผู้ใช้สำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถลบผู้ใช้ได้'));
  }
});

/** 5. ย้ายสังกัดผู้ใช้ */
router.patch('/users/:id/agency', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  const { a_agency_id } = req.body;
  try {
    const { rows } = await db.query('SELECT * FROM admin WHERE a_id=$1', [id]);
    if (!rows.length) return res.status(404).json(err('ไม่พบบัญชีผู้ใช้'));
    await db.query('UPDATE admin SET a_agency_id=$1, updated_at=NOW() WHERE a_id=$2', [a_agency_id ? parseInt(a_agency_id) : null, id]);
    return res.json(ok(null, 'อัปเดตสังกัดสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถย้ายสังกัดผู้ใช้ได้'));
  }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/metrics (For AdminJS / Tableau Verification)
// ─────────────────────────────────────────────────────────────
router.get('/metrics', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { rows } = await db.query('SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT 50');
    return res.json(ok(rows));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('โหลดข้อมูล metrics ไม่สำเร็จ'));
  }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/dashboard
// ─────────────────────────────────────────────────────────────
router.get('/dashboard', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    // User requested to remove STAB-01 limit cap
    const limit = parseInt(req.query.limit as string) || 10000;
    const offset = (page - 1) * limit;

    const { rows: [{ total_count }] } = await db.query('SELECT COUNT(*) AS total_count FROM c_information');
    const total = parseInt(total_count);

    const adminId = req.admin!.id;
    const sql = `
      SELECT
        c_information.in_id, c_information.in_num_date, c_information.in_doc_date, c_information.in_detail,
        c_information.in_detail_ag, c_information.in_file_mkk, c_information.in_etc, c_information.in_link,
        c_information.in_qr_link,
        c_information.in_circular_detail, c_information.in_original_link, c_information.in_attachment_link,
        c_information.in_ordering, c_information.updated_at, c_information.created_at, c_information.updated_user,
        c_information.in_workflow_status, c_information.in_current_owner_id, c_information.in_creator_id,
        c_information.in_is_parallel, c_information.in_flow_state,
        EXISTS (
          SELECT 1 FROM c_workflow_history wh
          WHERE wh.in_id = c_information.in_id
            AND wh.from_user_id = $3
            AND wh.action IN ('SUBMITTED','APPROVED','REJECTED','DELEGATED')
        ) AS in_processed_by_me,
        (
          SELECT STRING_AGG(DISTINCT CAST(pa.current_owner_id AS TEXT), ',')
          FROM c_parallel_assignments pa
          WHERE pa.in_id = c_information.in_id AND pa.pa_status IN ('PENDING', 'IN_PROGRESS')
        ) AS parallel_owner_ids,
        STRING_AGG(DISTINCT CONCAT(c_mati_kk.mkk_id,'|#|',c_mati_kk.mkk_name,'|#|',c_mati_kk.mkk_date), ',')   AS mati_kk,
        STRING_AGG(DISTINCT CONCAT(c_mati_work.mw_id,'|#|',c_mati_work.mw_name,'|#|',c_mati_work.mw_date), ',') AS mati_work,
        STRING_AGG(DISTINCT CONCAT(c_results.results_id,'|#|',c_results.results_detail,'|#|',c_results.results_color,'|#|',c_results.results_etc), ',') AS results,
        STRING_AGG(DISTINCT CONCAT(c_year.year_id,'|#|',c_year.year_value), ',')                               AS year,
        STRING_AGG(DISTINCT CONCAT(c_status.status_id,'|#|',c_status.status_value), ',')                      AS status_a,
        STRING_AGG(DISTINCT CONCAT(c_categories.cat_id,'|#|',c_categories.cat_name), ',')                     AS categories,
        STRING_AGG(DISTINCT CONCAT(c_agency.ag_id,'|#|',c_agency.ag_name), ',')                               AS agency,
        STRING_AGG(DISTINCT CONCAT(ref_info.in_id,'|#|',ref_info.in_num_date,'|#|',COALESCE(ref_info.in_doc_date,''),'|#|',ref_info.in_detail), '|||')    AS references_info
      FROM c_information
      LEFT JOIN c_information_categories ON c_information.in_id=c_information_categories.in_id
      LEFT JOIN c_categories             ON c_information_categories.cat_id=c_categories.cat_id
      LEFT JOIN c_information_agency     ON c_information.in_id=c_information_agency.in_id
      LEFT JOIN c_agency                 ON c_information_agency.ag_id=c_agency.ag_id
      LEFT JOIN c_year                   ON c_information.in_year_id=c_year.year_id
      LEFT JOIN c_status                 ON c_information.in_status_id=c_status.status_id
      LEFT JOIN c_mati_work              ON c_information.in_mw_id=c_mati_work.mw_id
      LEFT JOIN c_mati_kk                ON c_information.in_mkk_id=c_mati_kk.mkk_id
      LEFT JOIN c_results                ON c_information.in_results_id=c_results.results_id
      LEFT JOIN c_information_information ON c_information.in_id=c_information_information.in_id
      LEFT JOIN c_information AS ref_info ON c_information_information.in_id_ref=ref_info.in_id
      GROUP BY c_information.in_id, c_year.year_value
      ORDER BY c_year.year_value DESC, c_information.in_id DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows: infoRows } = await db.query(sql, [limit, offset, adminId]);
    const information = infoRows.map((r: any) => ({
      ...r,
      mati_kk: parseFirst(r.mati_kk, ['mkk_id', 'mkk_name', 'mkk_date']),
      mati_work: parseFirst(r.mati_work, ['mw_id', 'mw_name', 'mw_date']),
      results: parseFirst(r.results, ['results_id', 'results_detail', 'results_color', 'results_etc']),
      year: parseFirst(r.year, ['year_id', 'year_value']),
      status_a: parseFirst(r.status_a, ['status_id', 'status_value']),
      categories: parseList(r.categories, (s: string) => { const [cat_id, cat_name] = s.split('|#|'); return cat_id ? { cat_id, cat_name } : null }),
      agency: parseList(r.agency, (s: string) => { const [ag_id, ag_name] = s.split('|#|'); return ag_id ? { ag_id, ag_name } : null }),
      references_info: parseList(r.references_info, (s: string) => { const p = s.split('|#|'); return (p.length >= 4 && p[0]) ? { in_id: p[0], in_num_date: p[1], in_doc_date: p[2] || null, in_detail: p.slice(3).join('|#|') } : null }, '|||'),
    }));

    const [year, results, mati_work, mati_kk, agency, categories, status] = await Promise.all([
      getCachedQuery('SELECT year_id, year_value FROM c_year ORDER BY year_value DESC'),
      getCachedQuery('SELECT results_id, results_detail, results_etc FROM c_results ORDER BY results_ordering ASC'),
      getCachedQuery('SELECT mw_id, mw_name, mw_date FROM c_mati_work ORDER BY mw_date DESC, mw_id DESC'),
      getCachedQuery('SELECT mkk_id, mkk_name, mkk_date FROM c_mati_kk ORDER BY mkk_date DESC, mkk_id DESC'),
      getCachedQuery("SELECT ag_id, ag_name, parent_ag_id, ag_type FROM c_agency WHERE ag_status = 'active' ORDER BY agency_ordering ASC"),
      getCachedQuery('SELECT cat_id, cat_name FROM c_categories ORDER BY cat_ordering ASC'),
      getCachedQuery('SELECT status_id, status_value FROM c_status ORDER BY status_ordering ASC'),
    ]);

    return res.json(ok({
      information,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      year: year.rows,
      results: results.rows,
      mati_work: mati_work.rows,
      mati_kk: mati_kk.rows,
      agency: agency.rows,
      categories: categories.rows,
      status: status.rows,
    }));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('โหลดข้อมูลไม่สำเร็จ'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/ocsc-circular/create
// ─────────────────────────────────────────────────────────────
router.post('/ocsc-circular/create', requireAdmin, uploadFields, validate(circularSchema), async (req: AdminRequest, res: Response) => {
  try {
    const b = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!b.submit_create_circular_hidden) return res.status(400).json(err('Submit Not Allowed'));

    let in_file_mkk: string;
    if (b.mkk_ref_link_in?.trim()) in_file_mkk = b.mkk_ref_link_in.trim();
    else if (files?.mkk_ref_upload_in?.[0]) in_file_mkk = files.mkk_ref_upload_in[0].filename;
    else if (b.mkk_ref_none_in === '-') in_file_mkk = '-';
    else return res.status(400).json(err('ไม่ได้ระบุไฟล์มติ'));

    const in_etc = b.in_etc?.trim() || '-';
    const in_link = b.in_link?.trim() || (b.lkk_none === '-' ? '-' : null);
    if (!in_link) return res.status(400).json(err('กรุณาระบุ Link หรือเลือก "ไม่มี Link"'));

    const { rows: [{ max_order }] } = await db.query('SELECT MAX(in_ordering) AS max_order FROM c_information');
    const newOrder = (max_order ?? 0) + 1;
    const in_circular_detail = b.in_circular_detail?.trim() || '-';

    let in_original_link = b.in_original_link?.trim() || '-';
    if (files?.in_original_file?.[0]) in_original_link = files.in_original_file[0].filename;

    let attachmentLinks: string[] = [];
    if (b.kept_attachment_links !== undefined || b['kept_attachment_links[]'] !== undefined) {
      attachmentLinks = [].concat(b['kept_attachment_links[]'] || b.kept_attachment_links || []);
    } else {
      let legacyLink = b.in_attachment_link?.trim() || '-';
      if (legacyLink !== '-') {
        try {
          const parsed = JSON.parse(legacyLink);
          if (Array.isArray(parsed)) attachmentLinks = parsed;
          else attachmentLinks = [legacyLink];
        } catch {
          attachmentLinks = [legacyLink];
        }
      }
    }

    if (files?.in_attachment_file?.length) {
      files.in_attachment_file.forEach(f => attachmentLinks.push(f.filename));
    }

    const in_qr_link = b.in_qr_link?.trim() || '-';

    let in_attachment_link = attachmentLinks.length > 0 ? JSON.stringify(attachmentLinks) : '-';

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows: [{ in_id }] } = await client.query(
        `INSERT INTO c_information (in_num_date,in_doc_date,in_detail,in_detail_ag,in_etc,in_link,in_qr_link,in_file_mkk,updated_user,in_mkk_id,in_mw_id,in_results_id,in_year_id,in_status_id,created_at,updated_at,in_ordering,in_circular_detail,in_original_link,in_attachment_link,in_workflow_status,in_current_owner_id,in_creator_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW(),$15,$16,$17,$18,$19,$20,$20) RETURNING in_id`,
        [
          b.in_num_date, b.in_doc_date || null, b.in_detail, b.in_detail_ag, in_etc, in_link, in_qr_link, in_file_mkk, req.admin?.name, 
          toSqlInt(b.in_mkk_id), toSqlInt(b.in_mw_id), toSqlInt(b.in_results_id), 
          toSqlInt(b.in_year_id), toSqlInt(b.in_status_id), 
          newOrder, in_circular_detail, in_original_link, in_attachment_link,
          'DRAFT', req.admin?.id
        ]
      );

      const agIds = [].concat(b['ag_id[]'] || b.ag_id || []);
      const catIds = [].concat(b['cat_id[]'] || b.cat_id || []);
      for (const id of agIds) await client.query('INSERT INTO c_information_agency (in_id,ag_id) VALUES ($1,$2)', [in_id, toSqlInt(id)]);
      for (const id of catIds) await client.query('INSERT INTO c_information_categories (in_id,cat_id) VALUES ($1,$2)', [in_id, toSqlInt(id)]);

      const refIds = [].concat(b['in_id_ref[]'] || b.in_id_ref || []);
      if (b.ref_none !== '-' && refIds.length)
        for (const rid of refIds) await client.query('INSERT INTO c_information_information (in_id,in_id_ref) VALUES ($1,$2)', [in_id, toSqlInt(rid)]);

      await client.query('COMMIT');
      return res.json(ok(in_id, 'เพิ่มหนังสือเวียนสำเร็จ'));
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error('Create Circular Full Error:', e);
    return res.status(500).json(err('เกิดข้อผิดพลาดในการเพิ่มข้อมูล (Internal Server Error)'));
  }
});

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// POST /admin/ocsc-circular/summarize
// ─────────────────────────────────────────────────────────────
router.post('/ocsc-circular/summarize', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { pdfPath, mainPdf, attachments } = req.body;
  
  // Backward compatibility with older frontend requests
  const payload = (mainPdf !== undefined || attachments !== undefined) 
    ? { mainPdf, attachments: attachments || [] }
    : { mainPdf: pdfPath, attachments: [] };

  if (!payload.mainPdf && payload.attachments.length === 0) {
    return res.status(400).json(err('ไม่พบข้อมูลไฟล์ PDF สำหรับการอ่าน'));
  }

  try {
    const summary = await summarizePdf(payload);
    return res.json(ok(summary, 'สรุปผลสำเร็จ'));
  } catch (e: any) {
    console.error('Summarize Error:', e);
    return res.status(500).json(err('ไม่สามารถสรุปผลได้ (Internal Server Error)'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/ocsc-circular/upload-single
// ─────────────────────────────────────────────────────────────
router.post('/ocsc-circular/upload-single', requireAdmin, (req: AdminRequest, res: Response) => {
  const uploadSingle = upload.fields([
    { name: 'in_original_file', maxCount: 1 },
    { name: 'in_attachment_file', maxCount: 1 },
    { name: 'mkk_ref_upload_in', maxCount: 1 },
  ]);
  uploadSingle(req, res, (err: any) => {
    if (err) {
      console.error('Single Upload Error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ status: false, message: 'ขนาดไฟล์ใหญ่เกินไป (จำกัด 50MB)' });
      }
      return res.status(400).json({ status: false, message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ (Internal Server Error)' });
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const firstFile = Object.values(files || {}).flat()[0];
    if (!firstFile) {
      return res.status(400).json({ status: false, message: 'กรุณาเลือกไฟล์สำหรับอัปโหลด' });
    }
    return res.json(ok({ filename: firstFile.filename }, 'อัปโหลดไฟล์สำเร็จ'));
  });
});

// ─────────────────────────────────────────────────────────────
// POST /admin/ocsc-circular/update
// ─────────────────────────────────────────────────────────────
router.post('/ocsc-circular/update', requireAdmin, uploadFields, validate(circularSchema), async (req: AdminRequest, res: Response) => {
  try {
    const b = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!b.submit_create_circular_hidden || !b.in_id) return res.status(400).json(err('ข้อมูลไม่ครบ'));

    let in_file_mkk: string;
    if (b.mkk_ref_link_in?.trim()) in_file_mkk = b.mkk_ref_link_in.trim();
    else if (files?.mkk_ref_upload_in?.[0]) in_file_mkk = files.mkk_ref_upload_in[0].filename;
    else if (b.mkk_ref_none_in === '-') in_file_mkk = '-';
    else if (b.existing_file_in?.trim()) in_file_mkk = b.existing_file_in.trim();
    else return res.status(400).json(err('ไม่ได้ระบุไฟล์มติ'));

    const in_etc = b.in_etc?.trim() || '-';
    const in_link = b.in_link?.trim() || (b.lkk_none === '-' ? '-' : '-');
    const in_circular_detail = b.in_circular_detail?.trim() || '-';

    let in_original_link = b.in_original_link?.trim() || '-';
    if (files?.in_original_file?.[0]) in_original_link = files.in_original_file[0].filename;

    let attachmentLinks: string[] = [];
    if (b.kept_attachment_links !== undefined || b['kept_attachment_links[]'] !== undefined) {
      attachmentLinks = [].concat(b['kept_attachment_links[]'] || b.kept_attachment_links || []);
    } else {
      let legacyLink = b.in_attachment_link?.trim() || '-';
      if (legacyLink !== '-') {
        try {
          const parsed = JSON.parse(legacyLink);
          if (Array.isArray(parsed)) attachmentLinks = parsed;
          else attachmentLinks = [legacyLink];
        } catch {
          attachmentLinks = [legacyLink];
        }
      }
    }

    if (files?.in_attachment_file?.length) {
      files.in_attachment_file.forEach(f => attachmentLinks.push(f.filename));
    }

    const in_qr_link = b.in_qr_link?.trim() || '-';

    let in_attachment_link = attachmentLinks.length > 0 ? JSON.stringify(attachmentLinks) : '-';

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE c_information SET in_num_date=$1,in_doc_date=$2,in_detail=$3,in_detail_ag=$4,in_etc=$5,in_link=$6,in_qr_link=$7,in_file_mkk=$8,updated_user=$9,in_mkk_id=$10,in_mw_id=$11,in_results_id=$12,in_year_id=$13,in_status_id=$14,in_circular_detail=$15,in_original_link=$16,in_attachment_link=$17,updated_at=NOW() WHERE in_id=$18`,
        [
          b.in_num_date, b.in_doc_date || null, b.in_detail, b.in_detail_ag, in_etc, in_link, in_qr_link, in_file_mkk, req.admin?.name, 
          toSqlInt(b.in_mkk_id), toSqlInt(b.in_mw_id), toSqlInt(b.in_results_id), 
          toSqlInt(b.in_year_id), toSqlInt(b.in_status_id), 
          in_circular_detail, in_original_link, in_attachment_link, toSqlInt(b.in_id)
        ]
      );

      const agIds = [].concat(b['ag_id[]'] || b.ag_id || []);
      const catIds = [].concat(b['cat_id[]'] || b.cat_id || []);
      await client.query('DELETE FROM c_information_agency WHERE in_id=$1', [toSqlInt(b.in_id)]);
      await client.query('DELETE FROM c_information_categories WHERE in_id=$1', [toSqlInt(b.in_id)]);
      for (const id of agIds) await client.query('INSERT INTO c_information_agency (in_id,ag_id) VALUES ($1,$2)', [toSqlInt(b.in_id), toSqlInt(id)]);
      for (const id of catIds) await client.query('INSERT INTO c_information_categories (in_id,cat_id) VALUES ($1,$2)', [toSqlInt(b.in_id), toSqlInt(id)]);

      const refIds = [].concat(b['in_id_ref[]'] || b.in_id_ref || []);
      if (b.ref_none !== '-' && refIds.length) {
        await client.query('DELETE FROM c_information_information WHERE in_id=$1', [toSqlInt(b.in_id)]);
        for (const rid of refIds) await client.query('INSERT INTO c_information_information (in_id,in_id_ref) VALUES ($1,$2)', [toSqlInt(b.in_id), toSqlInt(rid)]);
      } else if (b.ref_none === '-') {
        await client.query('DELETE FROM c_information_information WHERE in_id=$1', [toSqlInt(b.in_id)]);
      }

      await client.query('COMMIT');
      return res.json(ok('success', 'แก้ไขหนังสือเวียนสำเร็จ'));
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error('Update Circular Full Error:', e);
    return res.status(500).json(err('เกิดข้อผิดพลาดในการแก้ไขข้อมูล (Internal Server Error)'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/ocsc-circular/delete
// ─────────────────────────────────────────────────────────────
router.post('/ocsc-circular/delete', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const raw = req.body.in_id;
    if (!raw) return res.status(400).json(err('ไม่ได้ระบุ ID'));
    let in_id: number;
    try {
      in_id = parseInt(Buffer.from(raw.slice(34, raw.length - 51), 'base64').toString('utf8'));
    } catch {
      in_id = parseInt(raw);
    }
    if (isNaN(in_id)) return res.status(400).json(err('ID ไม่ถูกต้อง'));

    const used = await db.query('SELECT 1 FROM c_information_information WHERE in_id_ref=$1', [in_id]);
    if (used.rows.length) return res.status(400).json(err('หนังสือเวียนนี้ถูกอ้างอิงอยู่ ไม่สามารถลบได้'));

    // SEC-05: Wrap in transaction for data integrity
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM c_information_information WHERE in_id=$1', [in_id]);
      await client.query('DELETE FROM c_information_agency WHERE in_id=$1', [in_id]);
      await client.query('DELETE FROM c_information_categories WHERE in_id=$1', [in_id]);
      await client.query('DELETE FROM c_information WHERE in_id=$1', [in_id]);
      await client.query('COMMIT');

      return res.json(ok(in_id, 'ลบหนังสือเวียนสำเร็จ'));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('เกิดข้อผิดพลาด'));
  }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/profile
// ─────────────────────────────────────────────────────────────
router.get('/profile', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { rows } = await db.query(
      `SELECT a.a_name, a.a_username, a.a_email, a.a_permiss, COALESCE(ag.ag_role, 'STAFF') AS a_role, a.a_position, a.a_2fa_enabled, a.a_agency_id 
       FROM admin a LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id 
       WHERE a.a_id=$1`, 
      [req.admin?.id]
    );
    if (!rows.length) return res.status(404).json(err('ไม่พบข้อมูล'));
    return res.json(ok(rows[0]));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/profile
// ─────────────────────────────────────────────────────────────
router.post('/profile', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    // SEC-07: Removed a_role from self-service update — only superadmin can assign roles
    const { a_name, a_email, a_position } = req.body;
    if (!a_name?.trim()) return res.status(400).json(err('กรุณากรอกชื่อ'));
    await db.query('UPDATE admin SET a_name=$1, a_email=$2, a_position=$3 WHERE a_id=$4', [a_name.trim(), a_email, a_position, req.admin?.id]);
    return res.json(ok('success', 'บันทึกสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/profile/change-password
// ─────────────────────────────────────────────────────────────
router.post('/profile/change-password', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { old_password, new_password, confirm_password } = req.body;
    if (!old_password || !new_password || !confirm_password)
      return res.status(400).json(err('กรุณากรอกข้อมูลให้ครบ'));
    if (new_password !== confirm_password)
      return res.status(400).json(err('รหัสผ่านใหม่ไม่ตรงกัน'));
    if (new_password.length < 6)
      return res.status(400).json(err('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'));

    const { rows } = await db.query('SELECT a_password FROM admin WHERE a_id=$1', [req.admin?.id]);
    if (!rows.length) return res.status(404).json(err('ไม่พบบัญชี'));

    const isMatch = await bcrypt.compare(old_password, rows[0].a_password).catch(() => false);
    if (!isMatch) return res.status(400).json(err('รหัสผ่านเดิมไม่ถูกต้อง'));

    const newHash = await bcrypt.hash(new_password, await bcrypt.genSalt(10));
    await db.query('UPDATE admin SET a_password=$1, a_token_version = COALESCE(a_token_version, 1) + 1 WHERE a_id=$2', [newHash, req.admin?.id]);

    return res.json(ok('success', 'เปลี่ยนรหัสผ่านสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

// ─────────────────────────────────────────────────────────────
// MASTER DATA ACTIONS
// ─────────────────────────────────────────────────────────────
const masterConfigs: any = {
  year: { table: 'c_year', pk: 'year_id', val: 'year_value', order: 'year_ordering' },
  results: { table: 'c_results', pk: 'results_id', val: 'results_detail', order: 'results_ordering' },
  agency: { table: 'c_agency', pk: 'ag_id', val: 'ag_name', order: 'agency_ordering' },
  categories: { table: 'c_categories', pk: 'cat_id', val: 'cat_name', order: 'cat_ordering' },
  mkk: { table: 'c_mati_kk', pk: 'mkk_id', val: 'mkk_name', date: 'mkk_date', order: 'mkk_ordering' },
  mw: { table: 'c_mati_work', pk: 'mw_id', val: 'mw_name', date: 'mw_date', order: 'mw_ordering' },
  status: { table: 'c_status', pk: 'status_id', val: 'status_value', order: 'status_ordering' },
};

router.post('/master/action', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { action, type, id, value } = req.body;
    const conf = masterConfigs[type];
    if (!conf) return res.status(400).json(err('Invalid Master Data Type'));

    // Securely extract identifiers from the whitelist (conf)
    const { table, pk, val, order, date } = conf;

    if (action === 'create') {
      const { rows: [{ max_val }] } = await db.query(`SELECT MAX(${order}) AS max_val FROM ${table}`);
      const { value2 } = req.body;
      let insertedId = null;
      if (type === 'results') {
        const r = await db.query(`INSERT INTO ${table} (${val}, results_etc, ${order}, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW()) RETURNING ${pk}`, [value, value2 || '-', (max_val ?? 0) + 1]);
        insertedId = r.rows[0][pk];
      } else if (date) {
        const dateVal = (!value2 || value2 === '2222-01-01') ? '2222-01-01' : value2;
        const r = await db.query(`INSERT INTO ${table} (${val}, ${date}, ${order}, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW()) RETURNING ${pk}`, [value, dateVal, (max_val ?? 0) + 1]);
        insertedId = r.rows[0][pk];
      } else if (type === 'categories') {
        const r = await db.query(`INSERT INTO ${table} (${val}, cat_ref, ${order}, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW()) RETURNING ${pk}`, [value, value2 || '-', (max_val ?? 0) + 1]);
        insertedId = r.rows[0][pk];
      } else {
        const r = await db.query(`INSERT INTO ${table} (${val},${order},created_at,updated_at) VALUES ($1,$2,NOW(),NOW()) RETURNING ${pk}`, [value, (max_val ?? 0) + 1]);
        insertedId = r.rows[0][pk];
      }
      clearLookupCache();
      return res.json(ok({ id: insertedId }, 'เพิ่มข้อมูลสำเร็จ'));
    }
    if (action === 'update') {
      if (!id) return res.status(400).json(err('ID Required'));
      const { value2 } = req.body;
      if (type === 'results') {
        await db.query(`UPDATE ${table} SET ${val}=$1, results_etc=$2, updated_at=NOW() WHERE ${pk}=$3`, [value, value2 || '-', id]);
      } else if (date) {
        const dateVal = (!value2 || value2 === '2222-01-01') ? '2222-01-01' : value2;
        await db.query(`UPDATE ${table} SET ${val}=$1, ${date}=$2, updated_at=NOW() WHERE ${pk}=$3`, [value, dateVal, id]);
      } else {
        await db.query(`UPDATE ${table} SET ${val}=$1,updated_at=NOW() WHERE ${pk}=$2`, [value, id]);
      }
      clearLookupCache();
      return res.json(ok('success', 'แก้ไขสำเร็จ'));
    }
    if (action === 'delete') {
      if (!id) return res.status(400).json(err('ID Required'));
      try {
        await db.query(`DELETE FROM ${table} WHERE ${pk}=$1`, [id]);
        clearLookupCache();
        return res.json(ok('success', 'ลบสำเร็จ'));
      } catch (e: any) {
        if (e.code === '23503') return res.status(400).json(err('ข้อมูลนี้ถูกใช้งานอยู่ ไม่สามารถลบได้'));
        throw e;
      }
    }
    return res.status(400).json(err('Invalid Action'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

// ─────────────────────────────────────────────────────────────
// BOT FINDINGS QUEUE
// ─────────────────────────────────────────────────────────────

router.get('/bot-findings', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    // Dynamically update PENDING bot findings to IMPORTED if a matching circular exists in c_information
    await db.query(`
      UPDATE c_bot_findings bf
      SET bot_status = 'IMPORTED'
      WHERE bf.bot_status = 'PENDING'
        AND EXISTS (
          SELECT 1 
          FROM c_information ci
          LEFT JOIN c_year cy ON ci.in_year_id = cy.year_id
          WHERE 
            ci.in_link = bf.bot_url 
            OR ci.in_original_link = bf.bot_url
            OR (
              bf.bot_payload->>'doc_num' IS NOT NULL 
              AND bf.bot_payload->>'year' IS NOT NULL
              AND ci.in_num_date ILIKE '%' || (bf.bot_payload->>'doc_num') || '%'
              AND cy.year_value ILIKE '%' || (bf.bot_payload->>'year') || '%'
            )
        )
    `);

    const { rows } = await db.query(`
      SELECT bot_id, bot_title, bot_url, bot_date, bot_status, created_at, bot_payload 
      FROM c_bot_findings 
      WHERE bot_status = 'PENDING'
      ORDER BY bot_id DESC
    `);
    return res.json(ok(rows));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

let isSyncing = false;
router.post('/bot-findings/sync', requireAdmin, async (req: AdminRequest, res: Response) => {
  if (isSyncing) return res.status(429).json(err('กำลังซิงค์ข้อมูล กรุณารอสักครู่'));
  isSyncing = true;
  try {
    const result = await syncOCSC();
    if (result.success) {
      return res.json(ok({ count: result.count }, `ซิงค์ข้อมูลสำเร็จ พบเรื่องใหม่ ${result.count} เรื่อง`));
    }
    console.error('[Bot Sync Error]', result.error);
    return res.status(500).json(err('เกิดข้อผิดพลาดในการซิงค์'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  } finally {
    isSyncing = false;
  }
});

router.post('/bot-findings/:id/action', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  const { action } = req.body; // 'IMPORT' | 'IGNORE'

  if (action !== 'IMPORT' && action !== 'IGNORE') {
    return res.status(400).json(err('Action ต้องเป็น IMPORT หรือ IGNORE เท่านั้น'));
  }

  try {
    const { rows } = await db.query(
      'SELECT bot_id, bot_title, bot_url, bot_date, bot_status, created_at, bot_payload FROM c_bot_findings WHERE bot_id = $1',
      [id]
    );
    if (!rows.length) return res.status(404).json(err('ไม่พบข้อมูลหนังสือเวียนจากบอต'));
    const botRecord = rows[0];

    if (action === 'IGNORE') {
      await db.query('UPDATE c_bot_findings SET bot_status = $1 WHERE bot_id = $2', ['IGNORED', id]);
      return res.json(ok(null, 'ละเว้นหนังสือเวียนเรียบร้อยแล้ว'));
    }

    if (action === 'IMPORT') {
      // Create a draft record in c_information
      const { rows: [{ max_order }] } = await db.query('SELECT MAX(in_ordering) AS max_order FROM c_information');
      const newOrder = (max_order ?? 0) + 1;

      // Extract details assuming title format...
      // Since it's from the bot, we put standard values in required fields and mark as DRAFT
      await db.query(`
        INSERT INTO c_information (
          in_num_date, in_detail, in_detail_ag, in_etc, in_link, in_file_mkk,
          updated_user, in_mkk_id, in_mw_id, in_results_id, in_year_id, in_status_id,
          created_at, updated_at, in_ordering, in_circular_detail, in_original_link, in_attachment_link,
          in_workflow_status
        ) VALUES (
          $1, $2, '-', '-', $3, '-',
          $4, NULL, NULL, NULL, NULL, NULL,
          NOW(), NOW(), $5, '-', '-', '-',
          'DRAFT'
        )
      `, [
        botRecord.bot_title, botRecord.bot_title, botRecord.bot_url,
        req.admin?.name || 'Bot', newOrder
      ]);

      await db.query('UPDATE c_bot_findings SET bot_status = $1 WHERE bot_id = $2', ['IMPORTED', id]);
      return res.json(ok(null, 'นำเข้าเป็นฉบับร่างเรียบร้อยแล้ว'));
    }

  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

/**
 * PATCH /admin/bot-findings/:id/save-draft
 * บันทึกแบบร่าง: อัปเดต bot_payload ด้วยข้อมูลที่ผู้ใช้แก้ไข
 * ไม่สร้าง c_information ไม่เปลี่ยน bot_status (คาอยู่ใน queue)
 */
router.patch('/bot-findings/:id/save-draft', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  const { in_num_date, in_doc_date, in_detail, in_year_id, in_link, categories, agencies } = req.body;
  try {
    // Build a corrected payload object to merge back into bot_payload
    const correctedPayload = {
      doc_num:        in_num_date  || undefined,
      extracted_date: in_doc_date  || undefined,
      title:          in_detail    || undefined,
      year_id:        in_year_id   || undefined,
      original_pdf:   in_link      || undefined,
      saved_categories: categories || undefined,
      saved_agencies:   agencies   || undefined,
    };

    // Merge corrected data into existing bot_payload (jsonb || jsonb)
    await db.query(
      `UPDATE c_bot_findings
       SET bot_payload = COALESCE(bot_payload, '{}'::jsonb) || $1::jsonb
       WHERE bot_id = $2`,
      [JSON.stringify(correctedPayload), id]
    );
    return res.json(ok(null, 'บันทึกแบบร่างสำเร็จ — งานยังคาอยู่ในคิวบอต'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

router.delete('/bot-findings/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM c_bot_findings WHERE bot_id = $1', [id]);
    return res.json(ok(null, 'ลบข้อมูลสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

router.post('/bot-findings/import', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { bot_id, in_num_date, in_doc_date, in_detail, in_year_id, in_link, categories, agencies, assigned_coordinator_id, is_draft } = req.body;

  try {
    const { rows } = await db.query(
      'SELECT bot_id, bot_title, bot_url, bot_date, bot_status, created_at, bot_payload FROM c_bot_findings WHERE bot_id = $1',
      [bot_id]
    );
    if (!rows.length) return res.status(404).json(err('ไม่พบข้อมูลคิวงานบอต'));

    const { rows: [{ max_order }] } = await db.query('SELECT MAX(in_ordering) AS max_order FROM c_information');
    const newOrder = (max_order ?? 0) + 1;
    const adminId = req.admin?.id;

    // is_draft=true → current_owner = creator (stays in creator's inbox, not forwarded)
    // assigned_coordinator_id provided → assign to that coordinator
    // otherwise → assign to self
    const currentOwnerId = is_draft ? adminId : (assigned_coordinator_id || adminId);

    const { rows: inserted } = await db.query(`
      INSERT INTO c_information (
        in_num_date, in_doc_date, in_detail, in_detail_ag, in_etc, in_link, in_file_mkk,
        updated_user, in_mkk_id, in_mw_id, in_results_id, in_year_id, in_status_id,
        created_at, updated_at, in_ordering, in_circular_detail, in_original_link, in_attachment_link,
        in_workflow_status, in_current_owner_id, in_creator_id
      ) VALUES (
        $1, $2, $3, '-', '-', $4, '-',
        $5, NULL, NULL, NULL, $6, NULL,
        NOW(), NOW(), $7, '-', '-', '-',
        'DRAFT', $8, $9
      ) RETURNING in_id
    `, [
      in_num_date, in_doc_date || null, in_detail, in_link,
      req.admin?.name || 'Admin', in_year_id || null, newOrder,
      currentOwnerId, adminId
    ]);

    const newInId = inserted[0].in_id;

    if (categories && categories.length > 0) {
      for (const catId of categories) {
        await db.query(`
          INSERT INTO c_information_categories (in_id, cat_id)
          VALUES ($1, $2)
        `, [newInId, catId]);
      }
    }

    if (agencies && agencies.length > 0) {
      for (const agId of agencies) {
        await db.query(`
          INSERT INTO c_information_agency (in_id, ag_id)
          VALUES ($1, $2)
        `, [newInId, agId]);
      }
    }

    await db.query('UPDATE c_bot_findings SET bot_status = $1 WHERE bot_id = $2', ['IMPORTED', bot_id]);
    clearLookupCache();
    return res.json(ok({ in_id: newInId }, 'นำเข้าข้อมูลสู่ระบบสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('Server Error'));
  }
});

// ─────────────────────────────────────────────────────────────
// AGENCY TREE MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * PUT /admin/agency-tree/reorder
 * จัดเรียงลำดับใหม่ (Drag and Drop) ภายใน parent เดียวกัน
 */
router.put('/agency-tree/reorder', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { nodes } = req.body;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json(err('ข้อมูลไม่ถูกต้อง'));
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const node of nodes) {
      await client.query(
        'UPDATE c_agency SET agency_ordering = $1, updated_at = NOW() WHERE ag_id = $2',
        [node.agency_ordering, node.ag_id]
      );
    }
    await client.query('COMMIT');
    clearLookupCache();
    return res.json(ok(null, 'บันทึกลำดับสำเร็จ'));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json(err('ไม่สามารถบันทึกลำดับได้'));
  } finally {
    client.release();
  }
});

/**
 * GET /admin/agency-tree
 * ดึงโครงสร้างส่วนราชการทั้งหมดเป็น flat list พร้อม level/path (Recursive CTE)
 */
router.get('/agency-tree', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const { rows } = await db.query(`
      WITH RECURSIVE tree AS (
        SELECT
          ag_id, ag_name, ag_code, ag_status, parent_ag_id, ag_type, ag_role,
          agency_ordering, 1 AS ag_level,
          ag_id::TEXT AS ag_path
        FROM c_agency
        WHERE parent_ag_id IS NULL

        UNION ALL

        SELECT
          c.ag_id, c.ag_name, c.ag_code, c.ag_status, c.parent_ag_id, c.ag_type, c.ag_role,
          c.agency_ordering, t.ag_level + 1,
          t.ag_path || '.' || c.ag_id::TEXT
        FROM c_agency c
        INNER JOIN tree t ON c.parent_ag_id = t.ag_id
      )
      SELECT
        t.*,
        (SELECT COUNT(*) FROM c_agency WHERE parent_ag_id = t.ag_id) AS children_count,
        (SELECT COUNT(*) FROM admin WHERE a_agency_id = t.ag_id AND a_status = '1') AS direct_member_count
      FROM tree t
      ORDER BY t.ag_path
    `);
    return res.json(ok(rows));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('โหลดโครงสร้างส่วนราชการไม่สำเร็จ'));
  }
});

/**
 * POST /admin/agency-tree
 * สร้างส่วนราชการใหม่
 */
router.post('/agency-tree', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { ag_name, ag_code, parent_ag_id, ag_status, ag_type, ag_role } = req.body;
  if (!ag_name?.trim()) return res.status(400).json(err('กรุณาระบุชื่อส่วนราชการ'));
  try {
    const { rows: [{ max_order }] } = await db.query(
      'SELECT COALESCE(MAX(agency_ordering), 0) AS max_order FROM c_agency'
    );
    const { rows: [inserted] } = await db.query(
      `INSERT INTO c_agency (ag_name, ag_code, parent_ag_id, ag_status, ag_type, ag_role, agency_ordering, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING ag_id`,
      [
        ag_name.trim(),
        ag_code?.trim() || null,
        parent_ag_id ? parseInt(parent_ag_id) : null,
        ag_status || 'active',
        ag_type || 'AGENCY',
        ag_role || null,
        max_order + 1,
      ]
    );
    clearLookupCache();
    return res.json(ok({ ag_id: inserted.ag_id }, 'เพิ่มส่วนราชการสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถเพิ่มส่วนราชการได้'));
  }
});

/**
 * PUT /admin/agency-tree/:id
 * แก้ไขข้อมูลส่วนราชการ
 */
router.put('/agency-tree/:id', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { ag_name, ag_code, parent_ag_id, ag_status, ag_type, ag_role } = req.body;
  if (!ag_name?.trim()) return res.status(400).json(err('กรุณาระบุชื่อส่วนราชการ'));
  if (parent_ag_id && parseInt(parent_ag_id) === id)
    return res.status(400).json(err('ไม่สามารถตั้งค่าหน่วยงานแม่เป็นตัวเองได้'));
  try {
    // ป้องกัน circular reference — parent ต้องไม่เป็น descendant ของตัวเอง
    if (parent_ag_id) {
      const { rows: descendants } = await db.query(`
        WITH RECURSIVE desc_tree AS (
          SELECT ag_id FROM c_agency WHERE parent_ag_id = $1
          UNION ALL
          SELECT c.ag_id FROM c_agency c INNER JOIN desc_tree d ON c.parent_ag_id = d.ag_id
        )
        SELECT ag_id FROM desc_tree WHERE ag_id = $2
      `, [id, parseInt(parent_ag_id)]);
      if (descendants.length > 0)
        return res.status(400).json(err('ไม่สามารถย้ายส่วนราชการไปอยู่ภายใต้หน่วยงานย่อยของตัวเองได้'));
    }
    await db.query(
      `UPDATE c_agency SET ag_name=$1, ag_code=$2, parent_ag_id=$3, ag_status=$4, ag_type=$5, ag_role=$6, updated_at=NOW() WHERE ag_id=$7`,
      [
        ag_name.trim(),
        ag_code?.trim() || null,
        parent_ag_id ? parseInt(parent_ag_id) : null,
        ag_status || 'active',
        ag_type || 'AGENCY',
        ag_role || null,
        id,
      ]
    );
    clearLookupCache();
    return res.json(ok(null, 'แก้ไขข้อมูลส่วนราชการสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถแก้ไขข้อมูลได้'));
  }
});

/**
 * PATCH /admin/agency-tree/:id/status
 * เปลี่ยนสถานะ (active / disbanded)
 */
router.patch('/agency-tree/:id/status', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { ag_status } = req.body;
  if (!['active', 'disbanded'].includes(ag_status))
    return res.status(400).json(err('สถานะไม่ถูกต้อง (active หรือ disbanded เท่านั้น)'));
  try {
    await db.query('UPDATE c_agency SET ag_status=$1, updated_at=NOW() WHERE ag_id=$2', [ag_status, id]);
    clearLookupCache();
    return res.json(ok(null, ag_status === 'active' ? 'เปิดใช้งานแล้ว' : 'ยุบเลิกแล้ว'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถเปลี่ยนสถานะได้'));
  }
});

/**
 * DELETE /admin/agency-tree/:id
 * ลบถาวร — block ถ้ามีหน่วยงานลูก หรือมี account สังกัดอยู่
 */
router.delete('/agency-tree/:id', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id));
  try {
    // ตรวจสอบหน่วยงานลูก
    const { rows: children } = await db.query(
      'SELECT ag_id, ag_name FROM c_agency WHERE parent_ag_id = $1 LIMIT 1', [id]
    );
    if (children.length > 0)
      return res.status(400).json(err(
        `ไม่สามารถลบส่วนราชการนี้ได้ เนื่องจากยังมีส่วนราชการภายใต้สังกัดนี้อยู่ (เช่น "${children[0].ag_name}") กรุณาย้ายหรือลบหน่วยงานที่สังกัดก่อน`
      ));
    // ตรวจสอบ account ที่สังกัด
    const { rows: members } = await db.query(
      'SELECT a_id, a_name FROM admin WHERE a_agency_id = $1 LIMIT 1', [id]
    );
    if (members.length > 0)
      return res.status(400).json(err(
        `ไม่สามารถลบส่วนราชการนี้ได้ เนื่องจากยังมีบัญชีผู้ใช้สังกัดอยู่ (เช่น "${members[0].a_name}") กรุณาย้ายสังกัดผู้ใช้งานก่อน`
      ));
    await db.query('DELETE FROM c_agency WHERE ag_id = $1', [id]);
    clearLookupCache();
    return res.json(ok(null, 'ลบส่วนราชการสำเร็จ'));
  } catch (e: any) {
    if (e.code === '23503') return res.status(400).json(err('ส่วนราชการนี้มีประวัติผูกกับหนังสือเวียน หรือข้อมูลอื่นๆ ไปแล้ว ไม่สามารถลบถาวรได้ (แนะนำให้ใช้การตั้งสถานะเป็น "ยุบเลิก" แทนการลบครับ)'));
    console.error(e);
    return res.status(500).json(err('ไม่สามารถลบข้อมูลได้'));
  }
});

/**
 * GET /admin/agency-tree/:id/members
 * ดึง account สังกัดหน่วยงานนี้ รวมสังกัดย่อยทั้งหมด
 */
router.get('/agency-tree/:id/members', requireAdmin, async (req: AdminRequest, res: Response) => {
  const id = parseInt(String(req.params.id));
  try {
    // สร้าง set ของ ag_id ทั้งหมดในสายสังกัด (รวมตัวเอง)
    const { rows: agencyIds } = await db.query(`
      WITH RECURSIVE sub_tree AS (
        SELECT ag_id FROM c_agency WHERE ag_id = $1
        UNION ALL
        SELECT c.ag_id FROM c_agency c INNER JOIN sub_tree s ON c.parent_ag_id = s.ag_id
      )
      SELECT ag_id FROM sub_tree
    `, [id]);

    const ids = agencyIds.map((r: any) => r.ag_id);
    if (ids.length === 0) return res.json(ok([]));

    const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(',');
    const { rows: members } = await db.query(`
      SELECT
        a.a_id, a.a_name, a.a_username, a.a_email,
        COALESCE(ag.ag_role, 'STAFF') AS a_role, a.a_position, a.a_status, a.a_permiss,
        a.a_agency_id,
        ag.ag_name AS agency_name
      FROM admin a
      LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
      WHERE a.a_agency_id IN (${placeholders})
      ORDER BY ag.ag_name ASC, a.a_name ASC
    `, ids);

    return res.json(ok(members));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('โหลดรายชื่อสมาชิกไม่สำเร็จ'));
  }
});

export default router;


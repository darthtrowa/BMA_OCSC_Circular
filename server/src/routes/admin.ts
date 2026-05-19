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
import { requireAdmin, JWT_SECRET, AdminRequest } from '../middleware/auth.js';
import { summarizePdf } from '../services/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const ok = (data: any, msg: string = 'success') => ({ status: true, message: msg, response: data });
const err = (msg: string = 'error') => ({ status: false, message: msg });

const toSqlInt = (val: any): number | null => {
  if (val === undefined || val === null || val === '' || val === '-') return null;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
};

// ─── Multer (PDF upload) ──────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../../uploads')),
    filename: (_req, file, cb) => {
      let prefix = 'file';
      if (file.fieldname === 'mkk_ref_upload_in') prefix = 'mkk';
      else if (file.fieldname === 'in_original_file') prefix = 'orig';
      else if (file.fieldname === 'in_attachment_file') prefix = 'att';
      cb(null, prefix + Date.now() + path.extname(file.originalname).toLowerCase());
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('กรุณาเลือกไฟล์ PDF เท่านั้น')),
});

const uploadFields = upload.fields([
  { name: 'mkk_ref_upload_in', maxCount: 1 },
  { name: 'in_original_file', maxCount: 1 },
  { name: 'in_attachment_file', maxCount: 1 }
]);

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
    const { rows } = await db.query('SELECT * FROM admin WHERE a_username=$1', [loginUsername]);
    if (!rows.length) return res.status(401).json(err('Username หรือ Password ไม่ถูกต้อง'));

    const admin = rows[0];
    if (admin.a_status === 'false')
      return res.status(403).json(err('บัญชีถูกระงับ กรุณาติดต่อผู้ดูแล'));

    // รองรับ hash เดิมที่มี random prefix 20 ตัว + $2y$ prefix
    const passStart = admin.a_password.indexOf('$2');
    const rawHash = passStart >= 0 ? admin.a_password.substring(passStart) : admin.a_password;
    const normHash = rawHash.replace(/^\$2y\$/, '$2b$');
    const isMatch = await bcrypt.compare(loginPassword, normHash).catch(() => false);
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
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json(ok({
      token,
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
      'SELECT a_id, a_name, a_permiss, a_role, a_otp_code, a_otp_expiry FROM admin WHERE a_id=$1',
      [decoded.id]
    );
    if (!rows.length) return res.status(404).json(err('ไม่พบบัญชีผู้ใช้'));

    const admin = rows[0];

    // Check expiry
    if (!admin.a_otp_expiry || new Date() > new Date(admin.a_otp_expiry))
      return res.status(400).json(err('รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่'));

    // Verify OTP hash
    const valid = await verifyOtp(String(otp_code).trim(), admin.a_otp_code || '');
    if (!valid) return res.status(400).json(err('รหัส OTP ไม่ถูกต้อง'));

    // Clear OTP after successful verification (single-use)
    await db.query(
      'UPDATE admin SET a_otp_code=NULL, a_otp_expiry=NULL WHERE a_id=$1',
      [admin.a_id]
    );

    // Issue the real long-lived JWT
    const token = jwt.sign(
      { id: admin.a_id, name: admin.a_name, permiss: admin.a_permiss, role: admin.a_role ?? null },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json(ok({
      token,
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
router.patch('/users/:id/2fa', requireAdmin, async (req: AdminRequest, res: Response) => {
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
router.get('/users', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    let sql = `
      SELECT a_id, a_name, a_username, a_email, a_permiss, a_role, a_position, a_status, a_agency, a_last_login, created_at 
      FROM admin 
    `;
    const params: any[] = [];
    if (req.admin?.permiss !== 'superadmin') {
      sql += ` WHERE a_permiss != 'superadmin' `;
    }
    sql += ` ORDER BY a_id DESC `;
    const { rows } = await db.query(sql, params);
    return res.json(ok(rows));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('โหลดข้อมูลผู้ใช้ไม่ได้'));
  }
});

/** 2. เพิ่มผู้ใช้ใหม่ */
router.post('/users', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { a_name, a_username, a_email, a_password, a_permiss, a_role, a_position, a_status, a_agency } = req.body;
  if (req.admin?.permiss !== 'superadmin' && a_permiss === 'superadmin') {
    return res.status(403).json(err('คุณไม่มีสิทธิ์เพิ่มผู้ใช้ระดับ SuperAdmin'));
  }
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(a_password || '123456', salt);
    const finalHash = "01234567890123456789" + hash;
    await db.query(`
      INSERT INTO admin (a_name, a_username, a_email, a_password, a_permiss, a_role, a_position, a_status, a_agency, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    `, [a_name, a_username, a_email, finalHash, a_permiss || 'user', a_role || 'STAFF', a_position || '', a_status || '1', a_agency]);
    return res.json(ok(null, 'เพิ่มผู้ใช้สำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถเพิ่มผู้ใช้ได้'));
  }
});

/** 3. แก้ไขผู้ใช้ */
router.put('/users/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  console.log(`[AdminAPI] Incoming PUT /users/${req.params.id}`, req.body);
  const { id } = req.params;
  const { a_name, a_username, a_email, a_password, a_permiss, a_role, a_position, a_status, a_agency } = req.body;
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
      const finalHash = "01234567890123456789" + hash;
      await db.query(`
        UPDATE admin SET a_name=$1, a_username=$2, a_email=$3, a_password=$4, a_permiss=$5, a_role=$6, a_position=$7, a_status=$8, a_agency=$9, updated_at=NOW()
        WHERE a_id=($10)::int
      `, [a_name, a_username, a_email, finalHash, a_permiss, a_role, a_position, a_status, a_agency, id]);
    } else {
      await db.query(`
        UPDATE admin SET a_name=$1, a_username=$2, a_email=$3, a_permiss=$4, a_role=$5, a_position=$6, a_status=$7, a_agency=$8, updated_at=NOW()
        WHERE a_id=($9)::int
      `, [a_name, a_username, a_email, a_permiss, a_role, a_position, a_status, a_agency, id]);
    }

    return res.json(ok(null, 'แก้ไขข้อมูลสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถแก้ไขข้อมูลผู้ใช้ได้'));
  }
});

/** 4. ลบผู้ใช้ */
router.delete('/users/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
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

// ─────────────────────────────────────────────────────────────
// GET /admin/dashboard
// ─────────────────────────────────────────────────────────────
router.get('/dashboard', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const sql = `
      SELECT
        c_information.in_id, c_information.in_num_date, c_information.in_detail,
        c_information.in_detail_ag, c_information.in_file_mkk, c_information.in_etc, c_information.in_link,
        c_information.in_circular_detail, c_information.in_original_link, c_information.in_attachment_link,
        c_information.in_ordering, c_information.updated_at, c_information.created_at, c_information.updated_user,
        STRING_AGG(DISTINCT CONCAT(c_mati_kk.mkk_id,'|#|',c_mati_kk.mkk_name,'|#|',c_mati_kk.mkk_date), ',')   AS mati_kk,
        STRING_AGG(DISTINCT CONCAT(c_mati_work.mw_id,'|#|',c_mati_work.mw_name,'|#|',c_mati_work.mw_date), ',') AS mati_work,
        STRING_AGG(DISTINCT CONCAT(c_results.results_id,'|#|',c_results.results_detail,'|#|',c_results.results_color,'|#|',c_results.results_etc), ',') AS results,
        STRING_AGG(DISTINCT CONCAT(c_year.year_id,'|#|',c_year.year_value), ',')                               AS year,
        STRING_AGG(DISTINCT CONCAT(c_status.status_id,'|#|',c_status.status_value), ',')                      AS status_a,
        STRING_AGG(DISTINCT CONCAT(c_categories.cat_id,'|#|',c_categories.cat_name), ',')                     AS categories,
        STRING_AGG(DISTINCT CONCAT(c_agency.ag_id,'|#|',c_agency.ag_name), ',')                               AS agency,
        STRING_AGG(DISTINCT CONCAT(ref_info.in_id,'|#|',ref_info.in_num_date,'|#|',ref_info.in_detail), '|||')    AS references_info
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
    `;
    const { rows: infoRows } = await db.query(sql);
    const information = infoRows.map((r: any) => ({
      ...r,
      mati_kk: parseFirst(r.mati_kk, ['mkk_id', 'mkk_name', 'mkk_date']),
      mati_work: parseFirst(r.mati_work, ['mw_id', 'mw_name', 'mw_date']),
      results: parseFirst(r.results, ['results_id', 'results_detail', 'results_color', 'results_etc']),
      year: parseFirst(r.year, ['year_id', 'year_value']),
      status_a: parseFirst(r.status_a, ['status_id', 'status_value']),
      categories: parseList(r.categories, (s: string) => { const [cat_id, cat_name] = s.split('|#|'); return cat_id ? { cat_id, cat_name } : null }),
      agency: parseList(r.agency, (s: string) => { const [ag_id, ag_name] = s.split('|#|'); return ag_id ? { ag_id, ag_name } : null }),
      references_info: parseList(r.references_info, (s: string) => { const p = s.split('|#|'); return (p.length >= 3 && p[0]) ? { in_id: p[0], in_num_date: p[1], in_detail: p.slice(2).join('|#|') } : null }, '|||'),
    }));

    const [year, results, mati_work, mati_kk, agency, categories, status] = await Promise.all([
      db.query('SELECT year_id, year_value FROM c_year ORDER BY year_value DESC'),
      db.query('SELECT results_id, results_detail, results_etc FROM c_results ORDER BY results_ordering ASC'),
      db.query('SELECT mw_id, mw_name, mw_date FROM c_mati_work ORDER BY mw_date DESC, mw_id DESC'),
      db.query('SELECT mkk_id, mkk_name, mkk_date FROM c_mati_kk ORDER BY mkk_date DESC, mkk_id DESC'),
      db.query('SELECT ag_id, ag_name FROM c_agency ORDER BY agency_ordering ASC'),
      db.query('SELECT cat_id, cat_name FROM c_categories ORDER BY cat_ordering ASC'),
      db.query('SELECT status_id, status_value FROM c_status ORDER BY status_ordering ASC'),
    ]);

    return res.json(ok({
      information,
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
// POST /admin/circular/create
// ─────────────────────────────────────────────────────────────
router.post('/circular/create', requireAdmin, uploadFields, async (req: AdminRequest, res: Response) => {
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

    let in_attachment_link = b.in_attachment_link?.trim() || '-';
    if (files?.in_attachment_file?.[0]) in_attachment_link = files.in_attachment_file[0].filename;

    const { rows: [{ in_id }] } = await db.query(
      `INSERT INTO c_information (in_num_date,in_detail,in_detail_ag,in_etc,in_link,in_file_mkk,updated_user,in_mkk_id,in_mw_id,in_results_id,in_year_id,in_status_id,created_at,updated_at,in_ordering,in_circular_detail,in_original_link,in_attachment_link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW(),$13,$14,$15,$16) RETURNING in_id`,
      [
        b.in_num_date, b.in_detail, b.in_detail_ag, in_etc, in_link, in_file_mkk, req.admin?.name, 
        toSqlInt(b.in_mkk_id), toSqlInt(b.in_mw_id), toSqlInt(b.in_results_id), 
        toSqlInt(b.in_year_id), toSqlInt(b.in_status_id), 
        newOrder, in_circular_detail, in_original_link, in_attachment_link
      ]
    );

    const agIds = [].concat(b['ag_id[]'] || b.ag_id || []);
    const catIds = [].concat(b['cat_id[]'] || b.cat_id || []);
    for (const id of agIds) await db.query('INSERT INTO c_information_agency (in_id,ag_id) VALUES ($1,$2)', [in_id, toSqlInt(id)]);
    for (const id of catIds) await db.query('INSERT INTO c_information_categories (in_id,cat_id) VALUES ($1,$2)', [in_id, toSqlInt(id)]);

    const refIds = [].concat(b['in_id_ref[]'] || b.in_id_ref || []);
    if (b.ref_none !== '-' && refIds.length)
      for (const rid of refIds) await db.query('INSERT INTO c_information_information (in_id,in_id_ref) VALUES ($1,$2)', [in_id, toSqlInt(rid)]);

    return res.json(ok(in_id, 'เพิ่มหนังสือเวียนสำเร็จ'));
  } catch (e: any) {
    console.error('Create Circular Full Error:', e);
    return res.status(500).json(err('เกิดข้อผิดพลาดในการเพิ่ม: ' + e.message));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/circular/summarize
// ─────────────────────────────────────────────────────────────
router.post('/circular/summarize', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { pdfPath } = req.body;
  if (!pdfPath) return res.status(400).json(err('ไม่พบข้อมูลไฟล์ PDF'));
  try {
    const summary = await summarizePdf(pdfPath);
    return res.json(ok(summary, 'สรุปผลสำเร็จ'));
  } catch (e: any) {
    console.error(e);
    return res.status(500).json(err(e.message || 'ไม่สามารถสรุปผลได้'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/circular/update
// ─────────────────────────────────────────────────────────────
router.post('/circular/update', requireAdmin, uploadFields, async (req: AdminRequest, res: Response) => {
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

    let in_attachment_link = b.in_attachment_link?.trim() || '-';
    if (files?.in_attachment_file?.[0]) in_attachment_link = files.in_attachment_file[0].filename;

    await db.query(
      `UPDATE c_information SET in_num_date=$1,in_detail=$2,in_detail_ag=$3,in_etc=$4,in_link=$5,in_file_mkk=$6,updated_user=$7,in_mkk_id=$8,in_mw_id=$9,in_results_id=$10,in_year_id=$11,in_status_id=$12,in_circular_detail=$13,in_original_link=$14,in_attachment_link=$15,updated_at=NOW() WHERE in_id=$16`,
      [
        b.in_num_date, b.in_detail, b.in_detail_ag, in_etc, in_link, in_file_mkk, req.admin?.name, 
        toSqlInt(b.in_mkk_id), toSqlInt(b.in_mw_id), toSqlInt(b.in_results_id), 
        toSqlInt(b.in_year_id), toSqlInt(b.in_status_id), 
        in_circular_detail, in_original_link, in_attachment_link, toSqlInt(b.in_id)
      ]
    );

    const agIds = [].concat(b['ag_id[]'] || b.ag_id || []);
    const catIds = [].concat(b['cat_id[]'] || b.cat_id || []);
    await db.query('DELETE FROM c_information_agency WHERE in_id=$1', [toSqlInt(b.in_id)]);
    await db.query('DELETE FROM c_information_categories WHERE in_id=$1', [toSqlInt(b.in_id)]);
    for (const id of agIds) await db.query('INSERT INTO c_information_agency (in_id,ag_id) VALUES ($1,$2)', [toSqlInt(b.in_id), toSqlInt(id)]);
    for (const id of catIds) await db.query('INSERT INTO c_information_categories (in_id,cat_id) VALUES ($1,$2)', [toSqlInt(b.in_id), toSqlInt(id)]);

    const refIds = [].concat(b['in_id_ref[]'] || b.in_id_ref || []);
    if (b.ref_none !== '-' && refIds.length) {
      await db.query('DELETE FROM c_information_information WHERE in_id=$1', [toSqlInt(b.in_id)]);
      for (const rid of refIds) await db.query('INSERT INTO c_information_information (in_id,in_id_ref) VALUES ($1,$2)', [toSqlInt(b.in_id), toSqlInt(rid)]);
    } else if (b.ref_none === '-') {
      await db.query('DELETE FROM c_information_information WHERE in_id=$1', [toSqlInt(b.in_id)]);
    }

    return res.json(ok('success', 'แก้ไขหนังสือเวียนสำเร็จ'));
  } catch (e: any) {
    console.error('Update Circular Full Error:', e);
    return res.status(500).json(err('เกิดข้อผิดพลาดในการแก้ไข: ' + e.message));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/circular/delete
// ─────────────────────────────────────────────────────────────
router.post('/circular/delete', requireAdmin, async (req: AdminRequest, res: Response) => {
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

    await db.query('DELETE FROM c_information_information WHERE in_id=$1', [in_id]);
    await db.query('DELETE FROM c_information_agency WHERE in_id=$1', [in_id]);
    await db.query('DELETE FROM c_information_categories WHERE in_id=$1', [in_id]);
    await db.query('DELETE FROM c_information WHERE in_id=$1', [in_id]);

    return res.json(ok(in_id, 'ลบหนังสือเวียนสำเร็จ'));
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
    const { rows } = await db.query('SELECT a_name, a_username, a_email, a_permiss, a_role, a_position, a_2fa_enabled FROM admin WHERE a_id=$1', [req.admin?.id]);
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
    const { a_name, a_email, a_role, a_position } = req.body;
    if (!a_name?.trim()) return res.status(400).json(err('กรุณากรอกชื่อ'));
    await db.query('UPDATE admin SET a_name=$1, a_email=$2, a_role=$3, a_position=$4 WHERE a_id=$5', [a_name.trim(), a_email, a_role, a_position, req.admin?.id]);
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

    const fullHash = rows[0].a_password;
    const hashStart = fullHash.indexOf('$2');
    const rawHash = hashStart >= 0 ? fullHash.substring(hashStart) : fullHash;
    const normHash = rawHash.replace(/^\$2y\$/, '$2b$');
    const isMatch = await bcrypt.compare(old_password, normHash).catch(() => false);
    if (!isMatch) return res.status(400).json(err('รหัสผ่านเดิมไม่ถูกต้อง'));

    const prefix = hashStart >= 0 ? fullHash.substring(0, hashStart) : '';
    const newHash = await bcrypt.hash(new_password, await bcrypt.genSalt(10));
    await db.query('UPDATE admin SET a_password=$1 WHERE a_id=$2', [prefix + newHash, req.admin?.id]);

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
      if (type === 'results') {
        await db.query(`INSERT INTO ${table} (${val}, results_etc, ${order}, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, [value, value2 || '-', (max_val ?? 0) + 1]);
      } else if (date) {
        const dateVal = (!value2 || value2 === '2222-01-01') ? '2222-01-01' : value2;
        await db.query(`INSERT INTO ${table} (${val}, ${date}, ${order}, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, [value, dateVal, (max_val ?? 0) + 1]);
      } else if (type === 'categories') {
        await db.query(`INSERT INTO ${table} (${val}, cat_ref, ${order}, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, [value, value2 || '-', (max_val ?? 0) + 1]);
      } else {
        await db.query(`INSERT INTO ${table} (${val},${order},created_at,updated_at) VALUES ($1,$2,NOW(),NOW())`, [value, (max_val ?? 0) + 1]);
      }
      return res.json(ok('success', 'เพิ่มข้อมูลสำเร็จ'));
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
      return res.json(ok('success', 'แก้ไขสำเร็จ'));
    }
    if (action === 'delete') {
      if (!id) return res.status(400).json(err('ID Required'));
      try {
        await db.query(`DELETE FROM ${table} WHERE ${pk}=$1`, [id]);
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

export default router;


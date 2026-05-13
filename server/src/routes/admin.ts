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
import { requireAdmin, JWT_SECRET, AdminRequest } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const ok = (data: any, msg: string = 'success') => ({ status: true, message: msg, response: data });
const err = (msg: string = 'error') => ({ status: false, message: msg });

// ─── Multer (PDF upload) ──────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../../uploads')),
    filename: (_req, file, cb) => cb(null, 'mkk' + Date.now() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('กรุณาเลือกไฟล์ PDF เท่านั้น')),
});

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
    const rawHash = admin.a_password.substring(admin.a_password.indexOf('$2'));
    const normHash = rawHash.replace(/^\$2y\$/, '$2b$');
    const isMatch = await bcrypt.compare(loginPassword, normHash).catch(() => false);
    if (!isMatch) return res.status(401).json(err('Username หรือ Password ไม่ถูกต้อง'));

    await db.query('UPDATE admin SET a_last_login=NOW() WHERE a_id=$1', [admin.a_id]);

    const token = jwt.sign(
      { id: admin.a_id, name: admin.a_name, permiss: admin.a_permiss },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json(ok({ token, name: admin.a_name, permiss: admin.a_permiss }, 'login success'));
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
      SELECT a_id, a_name, a_username, a_permiss, a_status, a_agency, a_last_login, created_at 
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
  const { a_name, a_username, a_password, a_permiss, a_status, a_agency } = req.body;
  if (req.admin?.permiss !== 'superadmin' && a_permiss === 'superadmin') {
    return res.status(403).json(err('คุณไม่มีสิทธิ์เพิ่มผู้ใช้ระดับ SuperAdmin'));
  }
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(a_password || '123456', salt);
    const finalHash = "01234567890123456789" + hash;
    await db.query(`
      INSERT INTO admin (a_name, a_username, a_password, a_permiss, a_status, a_agency, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    `, [a_name, a_username, finalHash, a_permiss || 'user', a_status || '1', a_agency]);
    return res.json(ok(null, 'เพิ่มผู้ใช้สำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('ไม่สามารถเพิ่มผู้ใช้ได้'));
  }
});

/** 3. แก้ไขผู้ใช้ */
router.put('/users/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  const { a_name, a_username, a_password, a_permiss, a_status, a_agency } = req.body;
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
        UPDATE admin SET a_name=$1, a_username=$2, a_password=$3, a_permiss=$4, a_status=$5, a_agency=$6, updated_at=NOW()
        WHERE a_id=$7
      `, [a_name, a_username, finalHash, a_permiss, a_status, a_agency, id]);
    } else {
      await db.query(`
        UPDATE admin SET a_name=$1, a_username=$2, a_permiss=$3, a_status=$4, a_agency=$5, updated_at=NOW()
        WHERE a_id=$6
      `, [a_name, a_username, a_permiss, a_status, a_agency, id]);
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
      GROUP BY c_information.in_id
      ORDER BY c_information.in_ordering DESC
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
router.post('/circular/create', requireAdmin, upload.single('mkk_ref_upload_in'), async (req: AdminRequest, res: Response) => {
  try {
    const b = req.body;
    if (!b.submit_create_circular_hidden) return res.status(400).json(err('Submit Not Allowed'));

    let in_file_mkk: string;
    if (b.mkk_ref_link_in?.trim()) in_file_mkk = b.mkk_ref_link_in.trim();
    else if (req.file) in_file_mkk = req.file.filename;
    else if (b.mkk_ref_none_in === '-') in_file_mkk = '-';
    else return res.status(400).json(err('ไม่ได้ระบุไฟล์มติ'));

    const in_etc = b.in_etc?.trim() || '-';
    const in_link = b.in_link?.trim() || (b.lkk_none === '-' ? '-' : null);
    if (!in_link) return res.status(400).json(err('กรุณาระบุ Link หรือเลือก "ไม่มี Link"'));

    const { rows: [{ max_order }] } = await db.query('SELECT MAX(in_ordering) AS max_order FROM c_information');
    const newOrder = (max_order ?? 0) + 1;

    const { rows: [{ in_id }] } = await db.query(
      `INSERT INTO c_information (in_num_date,in_detail,in_detail_ag,in_etc,in_link,in_file_mkk,updated_user,in_mkk_id,in_mw_id,in_results_id,in_year_id,in_status_id,created_at,updated_at,in_ordering)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW(),$13) RETURNING in_id`,
      [b.in_num_date, b.in_detail, b.in_detail_ag, in_etc, in_link, in_file_mkk, req.admin?.name, b.in_mkk_id, b.in_mw_id, b.in_results_id, b.in_year_id, b.in_status_id, newOrder]
    );

    const agIds = [].concat(b['ag_id[]'] || b.ag_id || []);
    const catIds = [].concat(b['cat_id[]'] || b.cat_id || []);
    for (const id of agIds) await db.query('INSERT INTO c_information_agency (in_id,ag_id) VALUES ($1,$2)', [in_id, id]);
    for (const id of catIds) await db.query('INSERT INTO c_information_categories (in_id,cat_id) VALUES ($1,$2)', [in_id, id]);

    const refIds = [].concat(b['in_id_ref[]'] || b.in_id_ref || []);
    if (b.ref_none !== '-' && refIds.length)
      for (const rid of refIds) await db.query('INSERT INTO c_information_information (in_id,in_id_ref) VALUES ($1,$2)', [in_id, rid]);

    return res.json(ok(in_id, 'เพิ่มหนังสือเวียนสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('เกิดข้อผิดพลาด'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/circular/update
// ─────────────────────────────────────────────────────────────
router.post('/circular/update', requireAdmin, upload.single('mkk_ref_upload_in'), async (req: AdminRequest, res: Response) => {
  try {
    const b = req.body;
    if (!b.submit_create_circular_hidden || !b.in_id) return res.status(400).json(err('ข้อมูลไม่ครบ'));

    let in_file_mkk: string;
    if (b.mkk_ref_link_in?.trim()) in_file_mkk = b.mkk_ref_link_in.trim();
    else if (req.file) in_file_mkk = req.file.filename;
    else if (b.mkk_ref_none_in === '-') in_file_mkk = '-';
    else if (b.existing_file_in?.trim()) in_file_mkk = b.existing_file_in.trim();
    else return res.status(400).json(err('ไม่ได้ระบุไฟล์มติ'));

    const in_etc = b.in_etc?.trim() || '-';
    const in_link = b.in_link?.trim() || (b.lkk_none === '-' ? '-' : '-');

    await db.query(
      `UPDATE c_information SET in_num_date=$1,in_detail=$2,in_detail_ag=$3,in_etc=$4,in_link=$5,in_file_mkk=$6,updated_user=$7,in_mkk_id=$8,in_mw_id=$9,in_results_id=$10,in_year_id=$11,in_status_id=$12,updated_at=NOW() WHERE in_id=$13`,
      [b.in_num_date, b.in_detail, b.in_detail_ag, in_etc, in_link, in_file_mkk, req.admin?.name, b.in_mkk_id, b.in_mw_id, b.in_results_id, b.in_year_id, b.in_status_id, b.in_id]
    );

    const agIds = [].concat(b['ag_id[]'] || b.ag_id || []);
    const catIds = [].concat(b['cat_id[]'] || b.cat_id || []);
    await db.query('DELETE FROM c_information_agency WHERE in_id=$1', [b.in_id]);
    await db.query('DELETE FROM c_information_categories WHERE in_id=$1', [b.in_id]);
    for (const id of agIds) await db.query('INSERT INTO c_information_agency (in_id,ag_id) VALUES ($1,$2)', [b.in_id, id]);
    for (const id of catIds) await db.query('INSERT INTO c_information_categories (in_id,cat_id) VALUES ($1,$2)', [b.in_id, id]);

    const refIds = [].concat(b['in_id_ref[]'] || b.in_id_ref || []);
    if (b.ref_none !== '-' && refIds.length) {
      await db.query('DELETE FROM c_information_information WHERE in_id=$1', [b.in_id]);
      for (const rid of refIds) await db.query('INSERT INTO c_information_information (in_id,in_id_ref) VALUES ($1,$2)', [b.in_id, rid]);
    } else if (b.ref_none === '-') {
      await db.query('DELETE FROM c_information_information WHERE in_id=$1', [b.in_id]);
    }

    return res.json(ok('success', 'แก้ไขหนังสือเวียนสำเร็จ'));
  } catch (e) {
    console.error(e);
    return res.status(500).json(err('เกิดข้อผิดพลาด'));
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
    const { rows } = await db.query('SELECT a_name, a_username, a_permiss FROM admin WHERE a_id=$1', [req.admin?.id]);
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
    const { a_name } = req.body;
    if (!a_name?.trim()) return res.status(400).json(err('กรุณากรอกชื่อ'));
    await db.query('UPDATE admin SET a_name=$1 WHERE a_id=$2', [a_name.trim(), req.admin?.id]);
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
  mkk: { table: 'c_mati_kk', pk: 'mkk_id', val: 'mkk_name', order: 'mkk_ordering' },
  mw: { table: 'c_mati_work', pk: 'mw_id', val: 'mw_name', order: 'mw_ordering' },
  status: { table: 'c_status', pk: 'status_id', val: 'status_value', order: 'status_ordering' },
};

router.post('/master/action', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { action, type, id, value } = req.body;
    const conf = masterConfigs[type];
    if (!conf) return res.status(400).json(err('Invalid Master Data Type'));

    if (action === 'create') {
      const { rows: [{ max_val }] } = await db.query(`SELECT MAX(${conf.order}) AS max_val FROM ${conf.table}`);
      const { value2 } = req.body;
      if (type === 'results') {
        await db.query(`INSERT INTO ${conf.table} (${conf.val}, results_etc, ${conf.order}, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, [value, value2 || '-', (max_val ?? 0) + 1]);
      } else {
        await db.query(`INSERT INTO ${conf.table} (${conf.val},${conf.order},created_at,updated_at) VALUES ($1,$2,NOW(),NOW())`, [value, (max_val ?? 0) + 1]);
      }
      return res.json(ok('success', 'เพิ่มข้อมูลสำเร็จ'));
    }
    if (action === 'update') {
      if (!id) return res.status(400).json(err('ID Required'));
      const { value2 } = req.body;
      if (type === 'results') {
        await db.query(`UPDATE ${conf.table} SET ${conf.val}=$1, results_etc=$2, updated_at=NOW() WHERE ${conf.pk}=$3`, [value, value2 || '-', id]);
      } else {
        await db.query(`UPDATE ${conf.table} SET ${conf.val}=$1,updated_at=NOW() WHERE ${conf.pk}=$2`, [value, id]);
      }
      return res.json(ok('success', 'แก้ไขสำเร็จ'));
    }
    if (action === 'delete') {
      if (!id) return res.status(400).json(err('ID Required'));
      try {
        await db.query(`DELETE FROM ${conf.table} WHERE ${conf.pk}=$1`, [id]);
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

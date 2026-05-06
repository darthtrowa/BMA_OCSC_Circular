/**
 * routes/public.js — Public API (ไม่ต้อง login)
 * GET  /api/filters        → dropdown สำหรับหน้าค้นหา
 * GET  /api/stats          → สถิติรวม
 * POST /api/search         → ค้นหาหนังสือเวียน
 */
const router = require('express').Router()
const db     = require('../config/database')

const ok  = (data, msg = 'success') => ({ status: true,  message: msg,   response: data })
const err = (msg = 'error')         => ({ status: false, message: msg })

// ─── helper: map row จาก STRING_AGG → object ──────────────────
const parseFirst = (val, fields) => {
  if (!val) return null
  const parts = val.split(',')[0].split(':')
  return Object.fromEntries(fields.map((f, i) => [f, parts[i] || '']))
}
const parseList = (val, parser, delim = ',') =>
  val ? val.split(delim).map(parser).filter(Boolean) : []

// ─────────────────────────────────────────────────────────────
// GET /api/filters
// ─────────────────────────────────────────────────────────────
router.get('/filters', async (req, res) => {
  try {
    const [year, results, mati_work, mati_kk, agency, categories, status] = await Promise.all([
      db.query('SELECT year_id, year_value FROM c_year ORDER BY year_ordering ASC'),
      db.query("SELECT results_id, results_detail FROM c_results ORDER BY results_ordering ASC"),
      db.query('SELECT mw_id, mw_name, mw_date FROM c_mati_work ORDER BY mw_ordering ASC'),
      db.query('SELECT mkk_id, mkk_name, mkk_date FROM c_mati_kk ORDER BY mkk_ordering ASC'),
      db.query('SELECT ag_id, ag_name FROM c_agency ORDER BY agency_ordering ASC'),
      db.query('SELECT cat_id, cat_name FROM c_categories ORDER BY cat_ordering ASC'),
      db.query('SELECT status_id, status_value FROM c_status ORDER BY status_ordering ASC'),
    ])
    return res.json(ok({
      year:       year.rows,
      results:    results.rows,
      mati_work:  mati_work.rows,
      mati_kk:    mati_kk.rows,
      agency:     agency.rows,
      categories: categories.rows,
      status:     status.rows,
    }))
  } catch (e) {
    console.error(e)
    return res.status(500).json(err('โหลดข้อมูลตัวกรองไม่ได้'))
  }
})

// ─────────────────────────────────────────────────────────────
// GET /api/stats
// ─────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [all, use, adjust, notuse, pending, missing] = await Promise.all([
      db.query('SELECT COUNT(*) AS c FROM c_information'),
      db.query('SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=2'),
      db.query('SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=4'),
      db.query('SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=5'),
      db.query('SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=12'),
      db.query('SELECT COUNT(*) AS c FROM c_information WHERE in_results_id=11'),
    ])
    return res.json(ok({
      count_all:     parseInt(all.rows[0].c),
      count_use:     parseInt(use.rows[0].c),
      count_adjust:  parseInt(adjust.rows[0].c),
      count_notuse:  parseInt(notuse.rows[0].c),
      count_pending: parseInt(pending.rows[0].c),
      count_missing: parseInt(missing.rows[0].c),
    }))
  } catch (e) {
    console.error(e)
    return res.status(500).json(err('โหลดสถิติไม่ได้'))
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/search
// ─────────────────────────────────────────────────────────────
router.post('/search', async (req, res) => {
  try {
    const input    = req.body
    const params   = []
    const where    = ["1=1"]
    let   idx      = 1

    const toArr = (v) => Array.isArray(v) ? v : (v ? [v] : [])
    const addIn = (values, col) => {
      const arr = toArr(values)
      if (!arr.length) return
      where.push(`${col} IN (${arr.map(() => `$${idx++}`).join(',')})`)
      params.push(...arr)
    }

    addIn(input.in_year_id,    'c_information.in_year_id')
    addIn(input.in_mkk_id,     'c_information.in_mkk_id')
    addIn(input.in_results_id, 'c_information.in_results_id')
    addIn(input.in_mw_id,      'c_information.in_mw_id')
    addIn(input.in_status_id,  'c_information.in_status_id')

    const agIds = toArr(input.ag_id)
    if (agIds.length) {
      where.push(`EXISTS (SELECT 1 FROM c_information_agency WHERE c_information_agency.in_id=c_information.in_id AND c_information_agency.ag_id IN (${agIds.map(() => `$${idx++}`).join(',')}))`)
      params.push(...agIds)
    }

    const catIds = toArr(input.cat_id)
    if (catIds.length) {
      where.push(`EXISTS (SELECT 1 FROM c_information_categories WHERE c_information_categories.in_id=c_information.in_id AND c_information_categories.cat_id IN (${catIds.map(() => `$${idx++}`).join(',')}))`)
      params.push(...catIds)
    }

    if (input.in_num_date) { where.push(`c_information.in_num_date ILIKE $${idx++}`); params.push(`%${input.in_num_date}%`) }
    if (input.in_detail)   { where.push(`c_information.in_detail   ILIKE $${idx++}`); params.push(`%${input.in_detail}%`) }

    const sql = `
      SELECT
        c_information.in_id, c_information.in_num_date, c_information.in_detail,
        c_information.in_detail_ag, c_information.in_file_mkk, c_information.in_etc, c_information.in_link,
        c_information.updated_at,
        STRING_AGG(DISTINCT CONCAT(c_mati_kk.mkk_name,':',c_mati_kk.mkk_date), ',')    AS mati_kk,
        STRING_AGG(DISTINCT CONCAT(c_mati_work.mw_name,':',c_mati_work.mw_date), ',')  AS mati_work,
        STRING_AGG(DISTINCT CONCAT(c_results.results_id,':',c_results.results_detail,':',c_results.results_color), ',') AS results,
        STRING_AGG(DISTINCT c_year.year_value, ',')                                     AS year,
        STRING_AGG(DISTINCT c_status.status_value, ',')                                 AS status_a,
        STRING_AGG(DISTINCT CONCAT(c_categories.cat_id,':',c_categories.cat_name), ',') AS categories,
        STRING_AGG(DISTINCT CONCAT(c_agency.ag_id,':',c_agency.ag_name), ',')           AS agency,
        STRING_AGG(DISTINCT CONCAT(ref_info.in_num_date,':',ref_info.in_detail), '|||')   AS references_info
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
      WHERE ${where.join(' AND ')}
      GROUP BY c_information.in_id
      ORDER BY c_information.in_id DESC
    `

    const { rows } = await db.query(sql, params)

    const circular_kp = rows.map(r => ({
      ...r,
      mati_kk:         parseFirst(r.mati_kk,   ['mkk_name','mkk_date']),
      mati_work:       parseFirst(r.mati_work,  ['mw_name','mw_date']),
      results:         parseFirst(r.results,    ['results_id','results_detail','results_color']),
      year:            r.year    ? { year_value: r.year.split(',')[0] }     : null,
      status_a:        r.status_a ? { status_value: r.status_a.split(',')[0] } : null,
      categories:      parseList(r.categories,    s => { const [cat_id,cat_name]=s.split(':'); return cat_id?{cat_id,cat_name}:null }),
      agency:          parseList(r.agency,         s => { const [ag_id,ag_name]=s.split(':'); return ag_id?{ag_id,ag_name}:null }),
      references_info: parseList(r.references_info,s => { const i=s.indexOf(':'); return (i>0 && s.slice(0,i))?{in_num_date:s.slice(0,i),in_detail:s.slice(i+1)}:null }, '|||'),
    }))

    return res.json(ok({ circular_kp, total: circular_kp.length }))
  } catch (e) {
    console.error(e)
    return res.status(500).json(err('ค้นหาไม่สำเร็จ'))
  }
})

module.exports = router

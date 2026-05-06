import { useState } from 'react'
import moment from 'moment/min/moment-with-locales'
moment.locale('th')

function processFileLink(text) {
  if (!text || text === '-') return '-'
  if (text.startsWith('http')) return <a href={text} target="_blank" rel="noreferrer" className="text-decoration-underline">ลิงก์</a>
  return <a href={`/uploads/${text}`} target="_blank" rel="noreferrer" className="text-decoration-underline">ไฟล์ PDF</a>
}

function formatMati(obj, nameKey, dateKey) {
  if (!obj) return '-'
  const name = obj[nameKey] || ''
  const d = obj[dateKey]
  const isDummyDate = d && moment(d).format('YYYY-MM-DD') === '2222-01-01'
  
  if (!d || isDummyDate || name.includes('รอเข้า')) return name || '-'
  return `ครั้งที่ ${name} วันที่ ${moment(d).locale('th').add(543, 'year').format('DD MMM YYYY')}`
}

function ExpandedRow({ item }) {
  return (
    <tr className="expanded-detail">
      <td colSpan={5} className="p-0">
        <div className="p-3 bg-light border-top">
          <table className="table table-sm mb-0">
            <tbody>
              <tr><td className="text-success fw-semibold" style={{ width: 200 }}>มติคณะทำงาน</td><td>{formatMati(item.mati_work, 'mw_name', 'mw_date')} {processFileLink(item.mati_work?.mw_ref)}</td></tr>
              <tr><td className="text-success fw-semibold">มติ ก.ก</td><td>{formatMati(item.mati_kk, 'mkk_name', 'mkk_date')} {processFileLink(item.mati_kk?.mkk_ref)}</td></tr>
              <tr><td className="text-success fw-semibold">มติ ก.ก (เฉพาะเรื่อง)</td><td>{processFileLink(item.in_file_mkk)}</td></tr>
              <tr><td className="text-success fw-semibold">ผู้รับผิดชอบ</td>
                <td>{(item.agency||[]).map(a=><span key={a.ag_name} className="badge bg-dark me-1">{a.ag_name}</span>)}</td></tr>
              <tr><td className="text-success fw-semibold">เหตุผลจากส่วนราชการ</td><td>{item.in_detail_ag||'-'}</td></tr>
              <tr><td className="text-success fw-semibold">หมวดหมู่</td>
                <td>{(item.categories||[]).map(c=>
                  c.cat_ref && c.cat_ref!=='-'
                    ? <a key={c.cat_name} href={c.cat_ref} target="_blank" rel="noreferrer" className="me-2 text-decoration-underline">{c.cat_name}</a>
                    : <span key={c.cat_name} className="me-2">{c.cat_name}</span>
                )}</td></tr>
              <tr><td className="text-success fw-semibold">การอ้างถึง</td>
                <td>{(item.references_info||[]).length===0 ? 'ไม่มี' :
                  (item.references_info).map((r,i)=>(
                    <div key={i} className="card bg-pale-blue p-2 mb-1">
                      <span className="text-blue">เลขที่หนังสือ {r.in_num_date}</span>
                      <p className="text-navy mb-0">{r.in_detail}</p>
                    </div>
                  ))}</td></tr>
              <tr><td className="text-success fw-semibold">หมายเหตุ</td><td>{item.in_etc||'-'}</td></tr>
              <tr><td className="text-success fw-semibold">LINK เว็บไซต์ต้นทาง</td>
                <td>{item.in_link&&item.in_link!=='-'
                  ? <a href={item.in_link} target="_blank" rel="noreferrer" className="text-decoration-underline">{item.in_link}</a>
                  : '-'}</td></tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

export default function ResultTable({ data }) {
  const [expanded, setExpanded]   = useState(new Set())
  const [page, setPage]           = useState(1)
  const [perPage, setPerPage]     = useState(15)
  const [search, setSearch]       = useState('')

  const filtered = data.filter(item =>
    !search ||
    (item.in_num_date||'').toLowerCase().includes(search.toLowerCase()) ||
    (item.in_detail||'').toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / perPage)
  const paged = filtered.slice((page-1)*perPage, page*perPage)

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="mt-4">
      <div className="card shadow-sm">
        <div className="card-header bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="fw-semibold">
            ผลการค้นหา <span className="badge bg-primary ms-1">{filtered.length}</span> รายการ
          </span>
          <div className="d-flex gap-2 align-items-center">
            <select className="form-select form-select-sm" style={{ width: 'auto' }}
              value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1) }}>
              {[15,10,20,50].map(n=><option key={n} value={n}>แสดง {n} รายการ</option>)}
            </select>
            <input type="text" className="form-control form-control-sm" placeholder="ค้นหาในตาราง..."
              style={{ width: 200 }} value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th style={{ width: 220 }}>เลขที่หนังสือ</th>
                  <th>เรื่อง</th>
                  <th>ผลการพิจารณา</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted py-4">ไม่พบข้อมูล</td></tr>
                )}
                {paged.map(item => {
                  const isOpen = expanded.has(item.in_id)
                  const agencyNames = (item.agency||[]).map(a=>a.ag_name).join(', ')
                  const resVal = item.results?.results_detail||'-'
                  let resColor = item.results?.results_color||'000'
                  if (resVal === 'นำมาปรับใช้') resColor = 'ffab00'
                  else if (resVal === 'นำมาใช้' || resVal === 'นำมาใช้โดยอนุโลม') resColor = '71dd37'
                  
                  const pastelColor = `#${resColor}15` // 15 = hex alpha for ~8% opacity
                  
                  return (
                    <>
                        <tr
                        key={item.in_id}
                        className={isOpen ? 'table-active' : ''}
                        onClick={() => toggleExpand(item.in_id)}
                        style={{ 
                          cursor: 'pointer',
                          backgroundColor: isOpen ? undefined : pastelColor,
                          transition: 'background-color 0.3s ease'
                        }}
                      >
                        <td className="text-center align-middle">
                          <i className={`bx ${isOpen ? 'bx-chevron-down text-primary' : 'bx-chevron-right text-muted'} fs-4`}></i>
                        </td>
                        <td className="align-middle">
                          {(() => {
                            const splitDate = (str) => {
                              if (str.includes(' ลงวันที่ ')) return str.split(' ลงวันที่ ')
                              if (str.includes(' ลว. ')) return str.split(' ลว. ')
                              if (str.includes(' ลว.')) return str.split(' ลว.')
                              return [str, '']
                            }
                            const parts = splitDate(item.in_num_date || '')
                            return (
                              <>
                                <div className="fw-bold">{parts[0]}</div>
                                {parts[1] && <div className="fw-bold text-muted">ลงวันที่ {parts[1]}</div>}
                                {(item.references_info || []).length > 0 && (
                                  <div className="mt-2 d-flex flex-column gap-1" style={{ maxWidth: '300px' }}>
                                    {item.references_info.map((r, i) => (
                                      <span key={i} className="badge bg-soft-red text-danger border-0 font-monospace text-wrap" style={{ fontSize: '0.65rem', whiteSpace: 'normal', textAlign: 'left', display: 'block' }}>
                                        อ้างถึง: {r.in_num_date}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </td>
                        <td className="align-middle">
                          <div className="mb-1">{item.in_detail}</div>
                          {agencyNames && (
                            <div className="small fw-semibold" style={{ color: '#065f46' }}>
                              <i className='bx bx-buildings me-1'></i>{agencyNames}
                            </div>
                          )}
                        </td>
                        <td className="align-middle text-center">
                          <span className="badge rounded-pill px-3 py-2" style={{ backgroundColor: resColor.startsWith('#') ? resColor : `#${resColor}`, color: '#fff', fontSize: '0.75rem' }}>
                            <i className={`bx ${resVal === 'ไม่ใช้' ? 'bx-x-circle' : 'bx-check-circle'} me-1`}></i>
                            {resVal}
                          </span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="expanded-detail">
                          <td colSpan={4} className="p-0">
                            <div className="p-3 border-top" style={{ backgroundColor: pastelColor }}>
                              <table className="table table-sm mb-0">
                                <tbody>
                                  <tr><td className="text-success fw-semibold" style={{ width: 200 }}>มติคณะทำงาน</td><td>{formatMati(item.mati_work, 'mw_name', 'mw_date')} {processFileLink(item.mati_work?.mw_ref)}</td></tr>
                                  <tr><td className="text-success fw-semibold">มติ ก.ก</td><td>{formatMati(item.mati_kk, 'mkk_name', 'mkk_date')} {processFileLink(item.mati_kk?.mkk_ref)}</td></tr>
                                  <tr><td className="text-success fw-semibold">มติ ก.ก (เฉพาะเรื่อง)</td><td>{processFileLink(item.in_file_mkk)}</td></tr>
                                  <tr><td className="text-success fw-semibold">ผู้รับผิดชอบ</td>
                                    <td>{(item.agency||[]).map(a=><span key={a.ag_name} className="badge bg-dark me-1">{a.ag_name}</span>)}</td></tr>
                                  <tr><td className="text-success fw-semibold">เหตุผลจากส่วนราชการ</td><td>{item.in_detail_ag||'-'}</td></tr>
                                  <tr><td className="text-success fw-semibold">หมวดหมู่</td>
                                    <td>{(item.categories||[]).map(c=>
                                      c.cat_ref && c.cat_ref!=='-'
                                        ? <a key={c.cat_name} href={c.cat_ref} target="_blank" rel="noreferrer" className="me-2 text-decoration-underline">{c.cat_name}</a>
                                        : <span key={c.cat_name} className="me-2">{c.cat_name}</span>
                                    )}</td></tr>
                                  <tr><td className="text-success fw-semibold">การอ้างถึง</td>
                                    <td>{(item.references_info||[]).length===0 ? 'ไม่มี' :
                                      (item.references_info).map((r,i)=>(
                                        <div key={i} className="card bg-white border-0 shadow-sm p-2 mb-1">
                                          <span className="text-blue small fw-bold">เลขที่หนังสือ {r.in_num_date}</span>
                                          <p className="text-navy mb-0 small">{r.in_detail}</p>
                                        </div>
                                      ))}</td></tr>
                                  <tr><td className="text-success fw-semibold">หมายเหตุ</td><td>{item.in_etc||'-'}</td></tr>
                                  <tr><td className="text-success fw-semibold">LINK เว็บไซต์ต้นทาง</td>
                                    <td>{item.in_link&&item.in_link!=='-'
                                      ? <a href={item.in_link} target="_blank" rel="noreferrer" className="text-decoration-underline">{item.in_link}</a>
                                      : '-'}</td></tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer bg-white d-flex align-items-center justify-content-between">
            <small className="text-muted">
              แสดง {Math.min((page-1)*perPage+1, filtered.length)}–{Math.min(page*perPage, filtered.length)} จาก {filtered.length} รายการ
            </small>
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${page<=1?'disabled':''}`}>
                  <button className="page-link" onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button>
                </li>
                {Array.from({length:Math.min(totalPages,5)}).map((_,i)=>{
                  const p = page<=3 ? i+1 : page-2+i
                  if (p>totalPages) return null
                  return (
                    <li key={p} className={`page-item ${p===page?'active':''}`}>
                      <button className="page-link" onClick={()=>setPage(p)}>{p}</button>
                    </li>
                  )
                })}
                <li className={`page-item ${page>=totalPages?'disabled':''}`}>
                  <button className="page-link" onClick={()=>setPage(p=>p+1)}>หน้าต่อไป</button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import moment from 'moment/min/moment-with-locales'
import { publicApi } from '../../api/apiService'
moment.locale('th')

function processFileLink(text) {
  if (!text || text === '-') return null
  if (text.startsWith('http')) return <a href={text} target="_blank" rel="noreferrer" className="text-decoration-underline ms-1">ลิงก์</a>
  return <a href={`/uploads/${text}`} target="_blank" rel="noreferrer" className="text-decoration-underline ms-1">ไฟล์ PDF</a>
}

function formatMati(obj, nameKey, dateKey) {
  if (!obj) return null
  const name = obj[nameKey] || ''
  const d = obj[dateKey]
  const isDummyDate = d && moment(d).format('YYYY-MM-DD') === '2222-01-01'
  
  if (!d || isDummyDate || name.includes('รอเข้า')) return name || null
  return `ครั้งที่ ${name} วันที่ ${moment(d).locale('th').add(543, 'year').format('DD MMM YYYY')}`
}

function CircularDetailsTable({ item, onRefClick }) {
  const mwText = formatMati(item.mati_work, 'mw_name', 'mw_date')
  const mwLink = processFileLink(item.mati_work?.mw_ref)
  const mkkText = formatMati(item.mati_kk, 'mkk_name', 'mkk_date')
  const mkkLink = processFileLink(item.mati_kk?.mkk_ref)
  const mkkFile = processFileLink(item.in_file_mkk)

  return (
    <table className="table table-sm mb-0">
      <tbody>
        <tr>
          <td className="text-success fw-semibold" style={{ width: 200 }}>มติคณะทำงาน</td>
          <td>{mwText || mwLink ? <>{mwText} {mwLink}</> : '-'}</td>
        </tr>
        <tr>
          <td className="text-success fw-semibold">มติ ก.ก</td>
          <td>{mkkText || mkkLink ? <>{mkkText} {mkkLink}</> : '-'}</td>
        </tr>
        <tr>
          <td className="text-success fw-semibold">มติ ก.ก (เฉพาะเรื่อง)</td>
          <td>{mkkFile || '-'}</td>
        </tr>
        <tr>
          <td className="text-success fw-semibold">ผู้รับผิดชอบ</td>
          <td>{(item.agency||[]).map(a=>a.ag_name).join(', ') || '-'}</td>
        </tr>
        <tr><td className="text-success fw-semibold">เหตุผลจากส่วนราชการ</td><td>{item.in_detail_ag||'-'}</td></tr>
        <tr><td className="text-success fw-semibold">หมวดหมู่</td>
          <td>{(item.categories||[]).length > 0 ? (item.categories||[]).map((c, idx) => (
            <span key={idx}>
              {c.cat_ref && c.cat_ref!=='-'
                ? <a href={c.cat_ref} target="_blank" rel="noreferrer" className="text-decoration-underline">{c.cat_name}</a>
                : c.cat_name}
              {idx < item.categories.length - 1 ? ', ' : ''}
            </span>
          )) : '-'}</td></tr>
        <tr><td className="text-success fw-semibold">การอ้างถึง</td>
          <td>{(item.references_info||[]).length===0 ? 'ไม่มี' :
            (item.references_info).map((r,i)=>(
              <div key={i} className="mb-2 p-2 rounded hover-bg-light" style={{ cursor: r.in_id ? 'pointer' : 'default' }} onClick={() => r.in_id && onRefClick(r.in_id)}>
                <div className="text-blue fw-bold text-decoration-underline small">เลขที่หนังสือ {r.in_num_date}</div>
                <div className="text-navy small">{r.in_detail}</div>
              </div>
            ))}</td></tr>
        <tr><td className="text-success fw-semibold">หมายเหตุ</td><td>{item.in_etc||'-'}</td></tr>
        <tr><td className="text-success fw-semibold">LINK เว็บไซต์ต้นทาง</td>
          <td>{item.in_link&&item.in_link!=='-'
            ? <a href={item.in_link} target="_blank" rel="noreferrer" className="text-decoration-underline">{item.in_link}</a>
            : '-'}</td></tr>
      </tbody>
    </table>
  )
}

export default function ResultTable({ data }) {
  const [expanded, setExpanded]   = useState(new Set())
  const [page, setPage]           = useState(1)
  const [perPage, setPerPage]     = useState(15)
  const [search, setSearch]       = useState('')
  const [activeRefData, setActiveRefData] = useState(null)
  const [loadingRef, setLoadingRef] = useState(false)

  const handleRefClick = async (id) => {
    setActiveRefData(null) // Reset to show loading
    setLoadingRef(true)
    try {
      const result = await publicApi.getCircular(id)
      if (result) {
        setActiveRefData(result)
      } else {
        alert('ไม่พบข้อมูลหนังสือเวียนที่อ้างถึง')
      }
    } catch (err) {
      console.error('Error fetching reference:', err)
      alert('ไม่สามารถโหลดข้อมูลได้ในขณะนี้')
    } finally {
      setLoadingRef(false)
    }
  }

  const closeRefModal = () => {
    setActiveRefData(null)
  }

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
                  
                  const mwText = formatMati(item.mati_work, 'mw_name', 'mw_date')
                  const mwLink = processFileLink(item.mati_work?.mw_ref)
                  const mkkText = formatMati(item.mati_kk, 'mkk_name', 'mkk_date')
                  const mkkLink = processFileLink(item.mati_kk?.mkk_ref)
                  const mkkFile = processFileLink(item.in_file_mkk)

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
                                {item.references_info && item.references_info.length > 0 && (
                                  <div className="mt-2 d-flex flex-column gap-1" style={{ maxWidth: '300px' }}>
                                    {item.references_info.map((r, i) => (
                                      <span 
                                        key={i} 
                                        className="badge bg-soft-red text-danger border-0 font-monospace text-wrap" 
                                        style={{ fontSize: '0.65rem', whiteSpace: 'normal', textAlign: 'left', display: 'block' }}
                                      >
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
                          {item.results?.results_etc && item.results.results_etc !== '-' && (
                            <div className="mt-1 small text-muted fst-italic" style={{ fontSize: '0.7rem', maxWidth: '200px' }}>
                              {item.results.results_etc}
                            </div>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="expanded-detail">
                          <td colSpan={4} className="p-0">
                            <div className="p-3 border-top" style={{ backgroundColor: pastelColor }}>
                              <CircularDetailsTable item={item} onRefClick={handleRefClick} />
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

      {/* Reference Modal */}
      {activeRefData && (
        <>
          <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999 }} onClick={closeRefModal}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header bg-light border-bottom-0">
                  <h5 className="modal-title text-primary fw-bold">
                    <i className='bx bx-file me-2'></i>
                    ข้อมูลหนังสือเวียนอ้างถึง
                  </h5>
                  <button type="button" className="btn-close" onClick={closeRefModal}></button>
                </div>
                <div className="modal-body p-4 position-relative">
                  {loadingRef && (
                    <div className="position-absolute top-0 start-0 w-100 h-100 bg-white bg-opacity-75 d-flex align-items-center justify-content-center" style={{ zIndex: 10 }}>
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  )}
                  <div className="mb-4">
                    <h5 className="fw-bold mb-1">{activeRefData.in_num_date}</h5>
                    <p className="text-muted mb-0">{activeRefData.in_detail}</p>
                  </div>
                  
                  <div className="mb-3">
                    <div className="d-flex align-items-center">
                      <span className="fw-semibold me-2">ผลการพิจารณา:</span>
                      {activeRefData.results ? (
                        <span className="badge rounded-pill px-3 py-2" style={{ backgroundColor: activeRefData.results.results_color?.startsWith('#') ? activeRefData.results.results_color : `#${activeRefData.results.results_color}`, color: '#fff', fontSize: '0.8rem' }}>
                          <i className={`bx ${activeRefData.results.results_detail === 'ไม่ใช้' ? 'bx-x-circle' : 'bx-check-circle'} me-1`}></i>
                          {activeRefData.results.results_detail}
                        </span>
                      ) : '-'}
                    </div>
                    {activeRefData.results?.results_etc && activeRefData.results.results_etc !== '-' && (
                      <div className="mt-2 small text-muted fst-italic" style={{ fontSize: '0.8rem', paddingLeft: '90px' }}>
                        {activeRefData.results.results_etc}
                      </div>
                    )}
                  </div>

                  <CircularDetailsTable item={activeRefData} onRefClick={handleRefClick} />
                </div>
                <div className="modal-footer border-top-0 bg-light">
                  <button type="button" className="btn btn-secondary" onClick={closeRefModal}>ปิดหน้าต่าง</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'
import CircularModal from './CircularModal'
import moment from 'moment/min/moment-with-locales'
moment.locale('th')

export default function CircularSection({ allData, loading, onReload, initialResultId, onBaseFilteredChange, onFilterResultChange }) {
  const [search, setSearch]           = useState('')
  const [filterResult, setFilter]     = useState('')
  const [filterYear, setFilterYear]   = useState('')
  const [filterAg, setFilterAg]       = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [editItem, setEditItem]       = useState(null)
  const [page, setPage]               = useState(1)
  const perPage = 20

  // Sync filterResult เมื่อ initialResultId เปลี่ยน (กดจาก Stats Card) — แค่ set ตรงๆ ไม่ toggle
  useEffect(() => {
    setFilter(initialResultId === 'all' || initialResultId === undefined ? '' : String(initialResultId))
    setPage(1)
  }, [initialResultId])

  const info = allData?.information || []

  // Base filtered: กรองปี/ผู้รับผิดชอบ/ค้นหา แต่ยังไม่กรองผลการพิจารณา
  const baseFiltered = info.filter(item => {
    const matchSearch = !search ||
      (item.in_num_date||'').toLowerCase().includes(search.toLowerCase()) ||
      (item.in_detail||'').toLowerCase().includes(search.toLowerCase())
    const matchYear = !filterYear || item.year?.year_id == filterYear
    const matchAg   = !filterAg   || (item.agency||[]).some(a => a.ag_id == filterAg)
    return matchSearch && matchYear && matchAg
  })

  // Full filtered: เพิ่มการกรองด้วยผลการพิจารณา
  const filtered = baseFiltered.filter(item =>
    !filterResult || item.results?.results_id == filterResult
  )

  // รายงาน filtered (รวม filterResult แล้ว) ขึ้นไปหา parent —
  // ทำให้ Stats Card นับจากข้อมูลที่แสดงจริง และผลการพิจารณาที่ไม่ตรงกันจะแสดง 0
  useEffect(() => {
    onBaseFilteredChange?.(filtered)
  }, [allData, search, filterYear, filterAg, filterResult])  // eslint-disable-line react-hooks/exhaustive-deps
  const totalPages = Math.ceil(filtered.length / perPage)
  const paged = filtered.slice((page-1)*perPage, page*perPage)

  const handleDelete = (item) => {
    const prefix  = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const suffix  = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const encoded = prefix + btoa(String(item.in_id)) + suffix

    Swal.fire({
      title: 'ลบหนังสือเวียน?', icon: 'warning',
      showCancelButton: true, confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก', confirmButtonColor: '#de0508'
    }).then(async r => {
      if (!r.isConfirmed) return
      try {
        const data = await adminApi.deleteCircular(encoded)
        if (data.status) {
          Swal.fire({ icon: 'success', text: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false })
          onReload()
        } else {
          Swal.fire('ผิดพลาด', data.message, 'error')
        }
      } catch (err) {
        Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
      }
    })
  }

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-white">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h6 className="mb-0 fw-bold">
            <i className='bx bx-file-blank me-2 text-primary'></i>จัดการหนังสือเวียน ก.พ.
          </h6>
          <button className="btn btn-sm btn-primary" onClick={() => { setEditItem(null); setShowModal(true) }}>
            <i className='bx bx-plus me-1'></i>เพิ่ม
          </button>
        </div>
        <div className="row g-2">
          <div className="col-sm-3">
            <select className="form-select form-select-sm" value={filterYear}
              onChange={e => { setFilterYear(e.target.value); setPage(1) }}>
              <option value="">ทุกปี พ.ศ.</option>
              {(allData?.year||[]).map(y => (
                <option key={y.year_id} value={y.year_id}>{y.year_value}</option>
              ))}
            </select>
          </div>
          <div className="col-sm-3">
            <select className="form-select form-select-sm" value={filterResult}
              onChange={e => {
                const val = e.target.value
                setFilter(val)
                setPage(1)
                // แจ้งขึ้นไปหา parent เพื่อ sync activeResultId
                onFilterResultChange?.(val)
              }}>
              <option value="">ทุกผลการพิจารณา</option>
              {(allData?.results||[]).map(r => (
                <option key={r.results_id} value={r.results_id}>{r.results_detail}</option>
              ))}
            </select>
          </div>
          <div className="col-sm-3">
            <select className="form-select form-select-sm" value={filterAg}
              onChange={e => { setFilterAg(e.target.value); setPage(1) }}>
              <option value="">ทุกผู้รับผิดชอบ</option>
              {(allData?.agency||[]).map(a => (
                <option key={a.ag_id} value={a.ag_id}>{a.ag_name}</option>
              ))}
            </select>
          </div>
          <div className="col-sm-3">
            <input type="text" className="form-control form-control-sm" placeholder="ค้นหาเลขที่หนังสือ / เรื่อง"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
      </div>

      <div className="card-body p-0">
        {loading ? (
          <div className="text-center py-5">
            <span className="spinner-border text-primary" />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th><th style={{ width: 220 }}>เลขที่หนังสือ</th>
                  <th>เรื่อง</th><th>ผลการพิจารณา</th><th>สถานะ</th>
                  <th style={{ width: 100 }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">ไม่พบข้อมูล</td></tr>
                )}
                {paged.map((item, idx) => {
                  const resVal     = item.results?.results_detail || '-'
                  let resColor   = item.results?.results_color || '000'
                  if (resVal === 'นำมาปรับใช้') resColor = 'ffab00'
                  else if (resVal === 'นำมาใช้' || resVal === 'นำมาใช้โดยอนุโลม') resColor = '71dd37'
                  const statusVal  = item.status_a?.status_value || '-'
                  const agencyNames = (item.agency||[]).map(a=>a.ag_name).join(', ')
                  return (
                    <tr key={item.in_id}>
                      <td className="text-muted">{(page-1)*perPage+idx+1}</td>
                      <td>
                        {(() => {
                          const parts = (item.in_num_date || '').split(' ลงวันที่ ')
                          return (
                            <>
                              <div className="fw-semibold">{parts[0]}</div>
                              {parts[1] && <div className="fw-semibold text-muted">ลงวันที่ {parts[1]}</div>}
                              {(item.references_info || []).length > 0 && (
                                <div className="mt-1" style={{ fontSize: '0.75rem', color: '#800000', lineHeight: 1.2 }}>
                                  อ้างถึง: {item.references_info.map(r => r.in_num_date).join(', ')}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </td>
                      <td>
                        {item.in_detail}
                        {agencyNames && <><br/><small className="text-muted">{agencyNames}</small></>}
                      </td>
                      <td><span style={{ color: `#${resColor}`, fontWeight: 600 }}>{resVal}</span></td>
                      <td>
                        <span className={`badge ${statusVal==='ใช้งาน'?'bg-success':'bg-danger'}`}>
                          {statusVal}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-warning me-1" onClick={() => { setEditItem(item); setShowModal(true) }}>
                          <i className='bx bx-edit'></i>
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)}>
                          <i className='bx bx-trash'></i>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="card-footer bg-white d-flex justify-content-between align-items-center">
          <small className="text-muted">
            แสดง {Math.min((page-1)*perPage+1,filtered.length)}–{Math.min(page*perPage,filtered.length)} จาก {filtered.length}
          </small>
          <nav><ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${page<=1?'disabled':''}`}>
              <button className="page-link" onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button>
            </li>
            {Array.from({length:Math.min(totalPages,5)}).map((_,i)=>{
              const p = Math.max(1,page-2)+i
              if(p>totalPages) return null
              return <li key={p} className={`page-item ${p===page?'active':''}`}>
                <button className="page-link" onClick={()=>setPage(p)}>{p}</button>
              </li>
            })}
            <li className={`page-item ${page>=totalPages?'disabled':''}`}>
              <button className="page-link" onClick={()=>setPage(p=>p+1)}>หน้าต่อไป</button>
            </li>
          </ul></nav>
        </div>
      )}

      {showModal && (
        <CircularModal
          allData={allData}
          editItem={editItem}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onReload() }}
        />
      )}
    </div>
  )
}

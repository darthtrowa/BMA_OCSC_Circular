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
  const perPage = 15

  // Sync filterResult when initialResultId changes (from Stats Card)
  useEffect(() => {
    setFilter(initialResultId === 'all' || initialResultId === undefined ? '' : String(initialResultId))
    setPage(1)
  }, [initialResultId])

  const info = allData?.information || []

  // Base filtered: year/agency/search
  const baseFiltered = info.filter(item => {
    const matchSearch = !search ||
      (item.in_num_date||'').toLowerCase().includes(search.toLowerCase()) ||
      (item.in_detail||'').toLowerCase().includes(search.toLowerCase()) ||
      (item.year?.year_value||'').toLowerCase().includes(search.toLowerCase())
    const matchYear = !filterYear || item.year?.year_id == filterYear
    const matchAg   = !filterAg   || (item.agency||[]).some(a => a.ag_id == filterAg)
    return matchSearch && matchYear && matchAg
  })

  // Full filtered: include results_id
  const filtered = baseFiltered.filter(item =>
    !filterResult || item.results?.results_id == filterResult
  )

  useEffect(() => {
    onBaseFilteredChange?.(filtered)
  }, [allData, search, filterYear, filterAg, filterResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(filtered.length / perPage)
  const paged = filtered.slice((page-1)*perPage, page*perPage)

  const handleDelete = (item) => {
    const prefix  = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const suffix  = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const encoded = prefix + btoa(String(item.in_id)) + suffix

    Swal.fire({
      title: 'ยืนยันการลบข้อมูล?',
      text: "คุณต้องการลบหนังสือเวียนนี้ใช่หรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ลบเลย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      borderRadius: '1rem'
    }).then(async r => {
      if (!r.isConfirmed) return
      try {
        const data = await adminApi.deleteCircular(encoded)
        if (data.status) {
          Swal.fire({ icon: 'success', text: 'ลบข้อมูลสำเร็จ', timer: 1500, showConfirmButton: false })
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
    <div className="card border-0 mb-4 overflow-visible">
      <div className="card-header bg-white border-0 p-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
          <div>
            <h4 className="mb-1 fw-bold text-dark">หนังสือเวียน ก.พ.</h4>
            <p className="text-muted mb-0 small">จัดการและติดตามสถานะหนังสือเวียนทั้งหมดในระบบ</p>
          </div>
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => { setEditItem(null); setShowModal(true) }}>
            <i className='bx bx-plus-circle fs-5'></i>
            <span>เพิ่มหนังสือเวียนใหม่</span>
          </button>
        </div>

        {/* Search & Filters Bar (Reverted to Single Row) */}
        <div className="bg-light p-3 rounded-xl shadow-sm border border-white">
          <div className="row g-3">
            <div className="col-lg-4">
              <div className="input-group input-group-merge">
                <span className="input-group-text bg-white border-end-0" style={{ borderRadius: '0.75rem 0 0 0.75rem', height: '45px' }}>
                  <i className="bx bx-search text-muted"></i>
                </span>
                <input 
                  type="text" 
                  className="form-control border-start-0 ps-0" 
                  style={{ borderRadius: '0 0.75rem 0.75rem 0', height: '45px' }}
                  placeholder="ค้นหาเลขที่หนังสือ หรือ ชื่อเรื่อง..."
                  value={search} 
                  onChange={e => { setSearch(e.target.value); setPage(1) }} 
                />
              </div>
            </div>
            <div className="col-sm-6 col-lg-2">
              <select className="form-select" style={{ borderRadius: '0.75rem', height: '45px' }} value={filterYear}
                onChange={e => { setFilterYear(e.target.value); setPage(1) }}>
                <option value="">ปี พ.ศ. ทั้งหมด</option>
                {(allData?.year||[]).map(y => (
                  <option key={y.year_id} value={y.year_id}>{y.year_value}</option>
                ))}
              </select>
            </div>
            <div className="col-sm-6 col-lg-3">
              <select className="form-select" style={{ borderRadius: '0.75rem', height: '45px' }} value={filterResult}
                onChange={e => {
                  const val = e.target.value
                  setFilter(val)
                  setPage(1)
                  onFilterResultChange?.(val)
                }}>
                <option value="">ผลการพิจารณาทุกแบบ</option>
                {(allData?.results||[]).map(r => (
                  <option key={r.results_id} value={r.results_id}>{r.results_detail}</option>
                ))}
              </select>
            </div>
            <div className="col-lg-3">
              <select className="form-select" style={{ borderRadius: '0.75rem', height: '45px' }} value={filterAg}
                onChange={e => { setFilterAg(e.target.value); setPage(1) }}>
                <option value="">ผู้รับผิดชอบทั้งหมด</option>
                {(allData?.agency||[]).map(a => (
                  <option key={a.ag_id} value={a.ag_id}>{a.ag_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body p-0">
        {loading ? (
          <div className="text-center py-5" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="spinner-border text-primary mx-auto" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted fw-medium">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th className="ps-4">#</th>
                  <th>เลขที่หนังสือ / วันที่</th>
                  <th>เรื่อง / ผู้รับผิดชอบ</th>
                  <th>ผลการพิจารณา</th>
                  <th>สถานะ</th>
                  <th className="text-end pe-4">เครื่องมือ</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-5">ไม่พบข้อมูลที่ค้นหา</td></tr>
                )}
                {paged.map((item, idx) => {
                  const resVal     = item.results?.results_detail || '-'
                  let resColor   = item.results?.results_color || '64748b'
                  if (resVal === 'นำมาปรับใช้') resColor = 'f59e0b'
                  else if (resVal.includes('นำมาใช้')) resColor = '10b981'
                  
                  const statusVal  = item.status_a?.status_value || '-'
                  const agencyNames = (item.agency||[]).map(a=>a.ag_name).join(', ')
                  const splitDate = (str) => {
                    if (str.includes(' ลงวันที่ ')) return str.split(' ลงวันที่ ')
                    if (str.includes(' ลว. ')) return str.split(' ลว. ')
                    if (str.includes(' ลว.')) return str.split(' ลว.')
                    return [str, '']
                  }
                  const parts = splitDate(item.in_num_date || '')

                  return (
                    <tr key={item.in_id}>
                      <td className="ps-4 text-muted">{(page-1)*perPage+idx+1}</td>
                      <td>
                        <div className="fw-bold text-dark">{parts[0]}</div>
                        {parts[1] && <div className="small text-muted"><i className='bx bx-calendar-event me-1'></i>ลงวันที่ {parts[1]}</div>}
                        {(item.references_info || []).length > 0 && (
                          <div className="mt-1 d-flex flex-column gap-1" style={{ maxWidth: '300px' }}>
                            {item.references_info.map((r, i) => (
                              <span key={i} className="badge bg-soft-red text-danger border-0 font-monospace text-wrap" style={{ fontSize: '0.65rem', whiteSpace: 'normal', textAlign: 'left', display: 'block' }}>
                                อ้างถึง: {r.in_num_date}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="text-truncate-2 mb-1" style={{ maxWidth: '350px', whiteSpace: 'normal' }}>{item.in_detail}</div>
                        {agencyNames && (
                          <div className="small fw-medium" style={{ color: '#065f46' }}>
                            <i className='bx bx-buildings me-1'></i>{agencyNames}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="fw-bold px-2 py-1 rounded" style={{ color: `#${resColor}`, background: `#${resColor}15`, fontSize: '0.85rem' }}>
                          {resVal}
                        </span>
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${statusVal==='ใช้งาน'?'bg-success':'bg-danger'}`}>
                          {statusVal}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-2">
                          <button className="btn btn-icon btn-sm btn-outline-warning rounded-circle" onClick={() => { setEditItem(item); setShowModal(true) }}>
                            <i className='bx bx-edit-alt'></i>
                          </button>
                          <button className="btn btn-icon btn-sm btn-outline-danger rounded-circle" onClick={() => handleDelete(item)}>
                            <i className='bx bx-trash'></i>
                          </button>
                        </div>
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
        <div className="card-footer bg-white border-0 p-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
          <div className="text-muted small">
            แสดง <strong>{Math.min((page-1)*perPage+1,filtered.length)}</strong> ถึง <strong>{Math.min(page*perPage,filtered.length)}</strong> จากทั้งหมด <strong>{filtered.length}</strong> รายการ
          </div>
          <nav>
            <ul className="pagination pagination-primary mb-0 gap-1">
              <li className={`page-item ${page<=1?'disabled':''}`}>
                <button className="page-link rounded-circle border-0" onClick={()=>setPage(p=>p-1)}><i className='bx bx-chevron-left'></i></button>
              </li>
              {Array.from({length:Math.min(totalPages, 5)}).map((_,i)=>{
                const p = Math.max(1, Math.min(page-2, totalPages-4)) + i
                if(p < 1 || p > totalPages) return null
                return (
                  <li key={p} className={`page-item ${p===page?'active':''}`}>
                    <button className="page-link rounded-circle border-0" onClick={()=>setPage(p)}>{p}</button>
                  </li>
                )
              })}
              <li className={`page-item ${page>=totalPages?'disabled':''}`}>
                <button className="page-link rounded-circle border-0" onClick={()=>setPage(p=>p+1)}><i className='bx bx-chevron-right'></i></button>
              </li>
            </ul>
          </nav>
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

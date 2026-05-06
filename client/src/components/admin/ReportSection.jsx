import { useState } from 'react'

export default function ReportSection({ allData }) {
  const [yearFilter, setYearFilter]     = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [agFilter, setAgFilter]         = useState('')
  const [search, setSearch]             = useState('')

  const info = allData?.information || []

  const filtered = info.filter(item => {
    const matchYear   = !yearFilter   || item.year?.year_id == yearFilter
    const matchResult = !resultFilter || item.results?.results_id == resultFilter
    const matchAg     = !agFilter     || (item.agency||[]).some(a => a.ag_id == agFilter)
    const matchSearch = !search ||
      (item.in_num_date||'').toLowerCase().includes(search.toLowerCase()) ||
      (item.in_detail||'').toLowerCase().includes(search.toLowerCase())
    return matchYear && matchResult && matchAg && matchSearch
  })

  const counts = {
    all:     filtered.length,
    use:     filtered.filter(i=>i.results?.results_id==2).length,
    adjust:  filtered.filter(i=>i.results?.results_id==4).length,
    notuse:  filtered.filter(i=>i.results?.results_id==5).length,
    pending: filtered.filter(i=>i.results?.results_id==12).length,
    missing: filtered.filter(i=>i.results?.results_id==11).length,
  }

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-white">
        <h6 className="mb-0 fw-bold">
          <i className='bx bx-bar-chart-alt-2 me-2 text-primary'></i>รายงาน
        </h6>
      </div>
      <div className="card-body">
        {/* Filters */}
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <label className="form-label small">ปี พ.ศ.</label>
            <select className="form-select form-select-sm" value={yearFilter} onChange={e=>setYearFilter(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {(allData?.year||[]).map(y=><option key={y.year_id} value={y.year_id}>{y.year_value}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small">ผลการพิจารณา</label>
            <select className="form-select form-select-sm" value={resultFilter} onChange={e=>setResultFilter(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {(allData?.results||[]).map(r=><option key={r.results_id} value={r.results_id}>{r.results_detail}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small">ผู้รับผิดชอบ</label>
            <select className="form-select form-select-sm" value={agFilter} onChange={e=>setAgFilter(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {(allData?.agency||[]).map(a=><option key={a.ag_id} value={a.ag_id}>{a.ag_name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small">ค้นหา</label>
            <input type="text" className="form-control form-control-sm" placeholder="เลขที่หนังสือ / เรื่อง"
              value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
        </div>

        {/* Summary */}
        <div className="row g-2 mb-4">
          {[
            { label:'ทั้งหมด', val: counts.all, color:'primary' },
            { label:'นำมาใช้', val: counts.use, color:'success' },
            { label:'นำมาปรับใช้', val: counts.adjust, color:'warning' },
            { label:'ไม่ใช้', val: counts.notuse, color:'danger' },
            { label:'รอผล', val: counts.pending, color:'orange' },
            { label:'ตกหล่น', val: counts.missing, color:'dark' },
          ].map(c=>(
            <div key={c.label} className="col-6 col-md-2">
              <div className={`card border-${c.color} text-center py-2`}>
                <div className={`fw-bold fs-4 text-${c.color}`}>{c.val}</div>
                <small className="text-muted">{c.label}</small>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="table table-sm table-bordered">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th style={{ width: 220 }}>เลขที่หนังสือ</th>
                <th>เรื่อง</th>
                <th>ผลการพิจารณา</th>
                <th>ผู้รับผิดชอบ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && (
                <tr><td colSpan={6} className="text-center text-muted">ไม่พบข้อมูล</td></tr>
              )}
              {filtered.slice(0,200).map((item,i)=>{
                const resVal  = item.results?.results_detail||'-'
                const resColor= item.results?.results_color||'000'
                const statusVal = item.status_a?.status_value||'-'
                return (
                  <tr key={item.in_id}>
                    <td>{i+1}</td>
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
                    <td>{item.in_detail}</td>
                    <td><span style={{color:`#${resColor}`,fontWeight:600}}>{resVal}</span></td>
                    <td>{(item.agency||[]).map(a=><span key={a.ag_name} className="badge bg-dark me-1">{a.ag_name}</span>)}</td>
                    <td><span className={`badge ${statusVal==='ใช้งาน'?'bg-success':'bg-danger'}`}>{statusVal}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length>200 && <p className="text-muted small text-end">แสดง 200 รายการแรกจาก {filtered.length} รายการ</p>}
        </div>
      </div>
    </div>
  )
}

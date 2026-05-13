import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'
import CircularModal from './CircularModal'
import moment from 'moment/min/moment-with-locales'
moment.locale('th')

interface CircularSectionProps {
  allData: any;
  loading: boolean;
  onReload: () => void;
  initialResultId?: string;
  onBaseFilteredChange?: (filtered: any[]) => void;
  onFilterResultChange?: (val: string) => void;
}

export default function CircularSection({ 
  allData, loading, onReload, initialResultId, onBaseFilteredChange, onFilterResultChange 
}: CircularSectionProps) {
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
    onBaseFilteredChange?.(baseFiltered)
  }, [allData, search, filterYear, filterAg]) // eslint-disable-line react-hooks/exhaustive-deps

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
      cancelButtonColor: '#64748b'
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
    <div className="bg-white rounded-3xl shadow-sm mb-6 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h4 className="text-xl font-bold text-slate-800 m-0 font-saochingcha">หนังสือเวียน ก.พ.</h4>
            <p className="text-slate-500 m-0 text-sm">จัดการและติดตามสถานะหนังสือเวียนทั้งหมดในระบบ</p>
          </div>
          <button 
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition shadow-sm hover:shadow"
            onClick={() => { setEditItem(null); setShowModal(true) }}
          >
            <i className='bx bx-plus-circle text-xl'></i>
            <span>เพิ่มหนังสือเวียนใหม่</span>
          </button>
        </div>

        {/* Search & Filters Bar */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="bx bx-search text-slate-400 text-lg"></i>
              </div>
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm"
                placeholder="ค้นหาเลขที่หนังสือ หรือ ชื่อเรื่อง..."
                value={search} 
                onChange={e => { setSearch(e.target.value); setPage(1) }} 
              />
            </div>
            <div className="md:col-span-2">
              <select 
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm appearance-none"
                value={filterYear}
                onChange={e => { setFilterYear(e.target.value); setPage(1) }}
              >
                <option value="">ปี พ.ศ. ทั้งหมด</option>
                {(allData?.year||[]).map((y: any) => (
                  <option key={y.year_id} value={y.year_id}>{y.year_value}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <select 
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm appearance-none"
                value={filterResult}
                onChange={e => {
                  const val = e.target.value
                  setFilter(val)
                  setPage(1)
                  onFilterResultChange?.(val)
                }}
              >
                <option value="">ผลการพิจารณาทุกแบบ</option>
                {(allData?.results||[]).map((r: any) => (
                  <option key={r.results_id} value={r.results_id}>{r.results_detail}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <select 
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm appearance-none"
                value={filterAg}
                onChange={e => { setFilterAg(e.target.value); setPage(1) }}
              >
                <option value="">ผู้รับผิดชอบทั้งหมด</option>
                {(allData?.agency||[]).map((a: any) => (
                  <option key={a.ag_id} value={a.ag_id}>{a.ag_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-20">
            <i className='bx bx-loader-alt animate-spin text-4xl text-emerald-600 mb-4'></i>
            <p className="text-slate-500 font-medium m-0">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold w-16">#</th>
                <th className="px-6 py-4 font-semibold">เลขที่หนังสือ / วันที่</th>
                <th className="px-6 py-4 font-semibold">เรื่อง / ผู้รับผิดชอบ</th>
                <th className="px-6 py-4 font-semibold">ผลการพิจารณา</th>
                <th className="px-6 py-4 font-semibold">สถานะ</th>
                <th className="px-6 py-4 font-semibold text-right">เครื่องมือ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paged.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">ไม่พบข้อมูลที่ค้นหา</td></tr>
              )}
              {paged.map((item: any, idx: number) => {
                const resVal     = item.results?.results_detail || '-'
                let resColor   = item.results?.results_color || '64748b'
                if (resVal === 'ไม่นำมาใช้') resColor = 'ef4444'
                else if (resVal === 'นำมาปรับใช้') resColor = 'f59e0b'
                else if (resVal.includes('นำมาใช้')) resColor = '10b981'
                
                const statusVal  = item.status_a?.status_value || '-'
                const agencyNames = (item.agency||[]).map((a:any)=>a.ag_name).join(', ')
                const splitDate = (str: string) => {
                  if (str.includes(' ลงวันที่ ')) return str.split(' ลงวันที่ ')
                  if (str.includes(' ลว. ')) return str.split(' ลว. ')
                  if (str.includes(' ลว.')) return str.split(' ลว.')
                  return [str, '']
                }
                const parts = splitDate(item.in_num_date || '')

                return (
                  <tr key={item.in_id} className="hover:bg-slate-50 border-b border-slate-100 transition last:border-0">
                    <td className="px-6 py-4 text-slate-400">{(page-1)*perPage+idx+1}</td>
                    <td className="px-6 py-4 align-top">
                      <div className="font-bold text-slate-800">{parts[0]}</div>
                      {parts[1] && <div className="text-xs text-slate-500 mt-1"><i className='bx bx-calendar-event mr-1'></i>ลงวันที่ {parts[1]}</div>}
                      {(item.references_info || []).length > 0 && (
                        <div className="mt-2 flex flex-col gap-1 max-w-[300px]">
                          {item.references_info.map((r: any, i: number) => (
                            <span key={i} className="px-2 py-1 bg-red-50 text-red-600 text-[0.65rem] font-mono rounded inline-block break-words">
                              อ้างถึง: {r.in_num_date}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="text-slate-700 line-clamp-2 max-w-[350px] mb-2">{item.in_detail}</div>
                      {agencyNames && (
                        <div className="text-xs font-medium text-emerald-700 flex items-start gap-1">
                          <i className='bx bx-buildings mt-0.5'></i>
                          <span className="leading-snug">{agencyNames}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <span 
                        className="px-2.5 py-1 text-xs font-bold rounded-lg"
                        style={{ color: `#${resColor}`, backgroundColor: `#${resColor}15` }}
                      >
                        {resVal}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusVal==='ใช้งาน'?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>
                        {statusVal}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 transition flex items-center justify-center" 
                          onClick={() => { setEditItem(item); setShowModal(true) }}
                          title="แก้ไข"
                        >
                          <i className='bx bx-edit-alt'></i>
                        </button>
                        <button 
                          className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition flex items-center justify-center" 
                          onClick={() => handleDelete(item)}
                          title="ลบ"
                        >
                          <i className='bx bx-trash'></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="text-sm text-slate-500">
            แสดง <span className="font-bold text-slate-700">{Math.min((page-1)*perPage+1,filtered.length)}</span> ถึง <span className="font-bold text-slate-700">{Math.min(page*perPage,filtered.length)}</span> จากทั้งหมด <span className="font-bold text-slate-700">{filtered.length}</span> รายการ
          </div>
          <nav className="flex items-center gap-1">
            <button 
              className={`w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 transition ${page<=1?'opacity-50 cursor-not-allowed pointer-events-none':''}`}
              onClick={()=>setPage(p=>p-1)}
            >
              <i className='bx bx-chevron-left text-lg'></i>
            </button>
            
            {Array.from({length:Math.min(totalPages, 5)}).map((_,i)=>{
              const p = Math.max(1, Math.min(page-2, totalPages-4)) + i
              if(p < 1 || p > totalPages) return null
              return (
                <button 
                  key={p} 
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition ${p===page ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                  onClick={()=>setPage(p)}
                >
                  {p}
                </button>
              )
            })}
            
            <button 
              className={`w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 transition ${page>=totalPages?'opacity-50 cursor-not-allowed pointer-events-none':''}`}
              onClick={()=>setPage(p=>p+1)}
            >
              <i className='bx bx-chevron-right text-lg'></i>
            </button>
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

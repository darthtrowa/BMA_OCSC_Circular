import { useState } from 'react'
import moment from 'moment/min/moment-with-locales'
import { publicApi, BASE_URL } from '../../api/apiService'
moment.locale('th')

function processFileLink(text: string) {
  if (!text || text === '-') return null
  if (text.startsWith('http')) return <a href={text} target="_blank" rel="noreferrer" className="text-sky-600 hover:text-sky-800 underline decoration-sky-600/30 underline-offset-2 ml-2 text-sm inline-flex items-center"><i className='bx bx-link-external mr-1'></i>ลิงก์</a>
  return <a href={`${BASE_URL}/uploads/${text}`} target="_blank" rel="noreferrer" className="text-rose-600 hover:text-rose-800 underline decoration-rose-600/30 underline-offset-2 ml-2 text-sm inline-flex items-center"><i className='bx bxs-file-pdf mr-1'></i>หนังสือเวียนต้นฉบับ</a>
}

interface CircularItem {
  in_id: number;
  in_num_date: string;
  in_detail: string;
  in_circular_detail?: string;
  in_detail_ag?: string;
  in_file_mkk?: string;
  in_etc?: string;
  in_link?: string;
  in_original_link?: string;
  in_attachment_link?: string;
  updated_at?: string;
  created_at?: string;
  agency?: { ag_id: number; ag_name: string }[];
  categories?: { cat_id: number; cat_name: string; cat_ref?: string }[];
  year?: { year_id: number; year_value: string };
  results?: { results_id: number; results_detail: string; results_color: string };
  mati_work?: { mw_id: number; mw_name: string; mw_date: string; mw_ref?: string };
  mati_kk?: { mkk_id: number; mkk_name: string; mkk_date: string; mkk_ref?: string };
  references_info?: { in_id: number; in_num_date: string; in_detail: string }[];
}

function formatMati(obj: any, nameKey: string, dateKey: string) {
  if (!obj) return null
  const name = obj[nameKey] || ''
  const d = obj[dateKey]
  const isDummyDate = d && moment(d).format('YYYY-MM-DD') === '2222-01-01'
  
  if (!d || isDummyDate || name.includes('รอเข้า')) {
    return name && name !== 'ไม่ระบุ' ? name : null
  }
  return `ครั้งที่ ${name} วันที่ ${moment(d).locale('th').add(543, 'year').format('DD MMM YYYY')}`
}

interface CircularDetailsTableProps {
  item: CircularItem;
  onRefClick: (id: number) => void;
}

function CircularDetailsTable({ item, onRefClick }: CircularDetailsTableProps) {
  const mwText = formatMati(item.mati_work, 'mw_name', 'mw_date')
  const mwLink = processFileLink(item.mati_work?.mw_ref || '')
  const mkkText = formatMati(item.mati_kk, 'mkk_name', 'mkk_date')
  const mkkLink = processFileLink(item.mati_kk?.mkk_ref || '')
  const mkkFile = processFileLink(item.in_file_mkk || '')

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-sm text-left border-collapse">
        <tbody className="divide-y divide-slate-100">
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 w-48 whitespace-nowrap">มติคณะทำงาน</td>
            <td className="py-2.5 text-slate-700">{mwText || mwLink ? <span className="flex items-center gap-1">{mwText} {mwLink}</span> : '-'}</td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap">มติ ก.ก</td>
            <td className="py-2.5 text-slate-700">{mkkText || mkkLink ? <span className="flex items-center gap-1">{mkkText} {mkkLink}</span> : '-'}</td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap">มติ ก.ก (เฉพาะเรื่อง)</td>
            <td className="py-2.5 text-slate-700">{mkkFile || '-'}</td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap">ผู้รับผิดชอบ</td>
            <td className="py-2.5 text-slate-700">{(item.agency||[]).map((a)=>a.ag_name).join(', ') || '-'}</td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap align-top">รายละเอียดของหนังสือเวียน</td>
            <td className="py-2.5 text-slate-700" style={{ whiteSpace: 'pre-wrap' }}>{item.in_circular_detail||'-'}</td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap align-top">การพิจารณาจากส่วนราชการ</td>
            <td className="py-2.5 text-slate-700" style={{ whiteSpace: 'pre-wrap' }}>{item.in_detail_ag||'-'}</td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap align-top">หมวดหมู่</td>
            <td className="py-2.5 text-slate-700">
              {(item.categories||[]).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {(item.categories||[]).map((c, idx) => (
                    <span key={idx} className="inline-block">
                      {c.cat_ref && c.cat_ref!=='-'
                        ? <a href={c.cat_ref} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-800 underline decoration-emerald-600/30 underline-offset-2">{c.cat_name}</a>
                        : c.cat_name}
                      {idx < (item.categories?.length || 0) - 1 ? <span className="text-slate-300 mr-1">,</span> : ''}
                    </span>
                  ))}
                </div>
              ) : '-'}
            </td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap align-top">การอ้างถึง</td>
            <td className="py-2.5 text-slate-700">
              {(item.references_info||[]).length===0 ? '-' : (
                <div className="space-y-2">
                  {(item.references_info || []).map((r, i)=>(
                    <div 
                      key={i} 
                      className={`p-3 rounded-xl border border-slate-100 bg-slate-50 ${r.in_id ? 'cursor-pointer hover:bg-emerald-50 hover:border-emerald-100 transition' : ''}`}
                      onClick={() => r.in_id && onRefClick(r.in_id)}
                    >
                      <div className="font-semibold text-sky-700 text-sm mb-1">
                        <span className="underline decoration-sky-700/30 underline-offset-2">เลขที่หนังสือ {r.in_num_date}</span>
                      </div>
                      <div className="text-slate-600 text-xs line-clamp-2">{r.in_detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap align-top">หมายเหตุ</td>
            <td className="py-2.5 text-slate-700">{item.in_etc||'-'}</td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap">LINK เว็บไซต์ต้นทาง</td>
            <td className="py-2.5 text-slate-700">
              {processFileLink(item.in_link) || '-'}
            </td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap">หนังสือเวียนต้นฉบับ (สำนักงาน ก.พ.)</td>
            <td className="py-2.5 text-slate-700">
              {processFileLink(item.in_original_link) || '-'}
            </td>
          </tr>
          <tr className="hover:bg-slate-50 transition">
            <td className="py-2.5 pr-4 font-semibold text-emerald-700 whitespace-nowrap">เอกสารแนบท้าย</td>
            <td className="py-2.5 text-slate-700">
              {processFileLink(item.in_attachment_link) || '-'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function ResultCards({ data }: { data: CircularItem[] }) {
  const [expanded, setExpanded]   = useState<Set<number>>(new Set())
  const [page, setPage]           = useState(1)
  const [perPage, setPerPage]     = useState(10)
  const [search, setSearch]       = useState('')
  const [activeRefData, setActiveRefData] = useState<CircularItem | null>(null)
  const [loadingRef, setLoadingRef] = useState(false)

  const handleRefClick = async (id: number) => {
    setActiveRefData(null)
    setLoadingRef(true)
    try {
      const result = await publicApi.getCircular(id)
      if (result) setActiveRefData(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingRef(false)
    }
  }

  const filtered = data.filter(item =>
    !search ||
    (item.in_num_date||'').toLowerCase().includes(search.toLowerCase()) ||
    (item.in_detail||'').toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / perPage)
  const paged = filtered.slice((page-1)*perPage, page*perPage)

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <span className="font-semibold text-slate-500">
          พบข้อมูลทั้งหมด <span className="text-emerald-600 font-bold text-xl">{filtered.length}</span> รายการ
        </span>
        <div className="flex gap-3 items-center">
          <select 
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            value={perPage} 
            onChange={e => { setPerPage(+e.target.value); setPage(1) }}
          >
            {[10, 20, 50].map(n=><option key={n} value={n}>แสดง {n} รายการ</option>)}
          </select>
          <div className="relative">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'></i>
            <input 
              type="text" 
              className="pl-10 pr-4 py-2 w-56 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" 
              placeholder="ค้นหาในผลลัพธ์..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {paged.map((item) => {
          const isOpen = expanded.has(item.in_id)
          const agencyNames = (item.agency||[]).map((a)=>a.ag_name).join(', ')
          const resVal = item.results?.results_detail||'-'
          const resId = item.results?.results_id
          
          // Map color based on StatsCards definition
          let resColor = '#64748b' // Default slate
          if (resId == 2) resColor = '#10b981'      // นำมาใช้
          else if (resId == 4) resColor = '#f59e0b' // นำมาปรับใช้
          else if (resId == 5) resColor = '#ef4444' // ไม่ใช้
          else if (resId == 12) resColor = '#f97316' // รอผล
          else if (resId == 11) resColor = '#64748b' // ตกหล่น
          
          return (
            <div key={item.in_id} className="col-span-1">
              <div 
                className={`bg-white rounded-2xl shadow-sm transition-all overflow-hidden border ${isOpen ? 'ring-2 ring-emerald-500/50 border-transparent' : 'border-slate-100 hover:shadow-md'}`}
                style={{ cursor: 'pointer', borderLeftWidth: '6px', borderLeftColor: resColor }}
                onClick={() => toggleExpand(item.in_id)}
              >
                <div className="p-5 md:p-6">
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold mb-2 text-slate-800 text-lg leading-snug truncate whitespace-normal">
                        {item.in_num_date}
                      </h5>
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <span className="flex items-center">
                          <i className='bx bx-buildings mr-1.5 text-slate-400'></i>
                          {agencyNames || 'ไม่ระบุผู้รับผิดชอบ'}
                        </span>
                      </div>
                    </div>
                    <span 
                      className="px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 border"
                      style={{ backgroundColor: `${resColor}15`, color: resColor, borderColor: `${resColor}30` }}
                    >
                      {resVal}
                    </span>
                  </div>

                  <p className={`text-slate-700 mb-4 text-base ${!isOpen ? 'line-clamp-2' : ''}`}>
                    {item.in_detail}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {item.year?.year_value && (
                      <span className="bg-slate-50 text-slate-500 border border-slate-200 py-1.5 px-3 rounded-full text-xs font-medium">
                        ปี พ.ศ. {item.year.year_value}
                      </span>
                    )}
                    {(item.categories||[]).map((c, i) => (
                      <span key={i} className="bg-sky-50 text-sky-600 border border-sky-100 py-1.5 px-3 rounded-full text-xs font-medium">
                        {c.cat_name}
                      </span>
                    ))}
                  </div>

                  {((item.in_original_link && item.in_original_link !== '-') || 
                    (item.in_attachment_link && item.in_attachment_link !== '-') || 
                    (item.in_file_mkk && item.in_file_mkk !== '-')) && (
                    <div className="flex flex-wrap gap-2 mb-4" onClick={e => e.stopPropagation()}>
                      {item.in_original_link && item.in_original_link !== '-' && (
                        <a 
                          href={`${BASE_URL}/uploads/${item.in_original_link}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200/50 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                        >
                          <i className='bx bxs-file-pdf text-sm text-rose-500'></i>
                          <span>หนังสือเวียนต้นฉบับ</span>
                        </a>
                      )}
                      {item.in_attachment_link && item.in_attachment_link !== '-' && (
                        <a 
                          href={`${BASE_URL}/uploads/${item.in_attachment_link}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200/50 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                        >
                          <i className='bx bxs-file-pdf text-sm text-amber-500'></i>
                          <span>หนังสือเวียนต้นฉบับ</span>
                        </a>
                      )}
                      {item.in_file_mkk && item.in_file_mkk !== '-' && (
                        <a 
                          href={item.in_file_mkk.startsWith('http') ? item.in_file_mkk : `${BASE_URL}/uploads/${item.in_file_mkk}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 border border-sky-200/50 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                        >
                          <i className='bx bxs-file-pdf text-sm text-sky-500'></i>
                          <span>มติ ก.ก. เฉพาะเรื่อง</span>
                        </a>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-2">
                    <div className="text-slate-400 text-xs flex gap-3">
                      <span className="flex items-center">
                        <i className='bx bx-calendar mr-1.5'></i>
                        อัปเดตล่าสุด: {moment(item.updated_at || item.created_at).locale('th').add(543, 'year').format('DD MMM YYYY')}
                      </span>
                    </div>
                    <div className="text-emerald-600 font-semibold text-sm flex items-center group-hover:text-emerald-700">
                      {isOpen ? 'ย่อข้อมูล' : 'ดูรายละเอียดเพิ่มเติม'}
                      <i className={`bx ${isOpen ? 'bx-chevron-up' : 'bx-chevron-down'} ml-1 text-lg`}></i>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-5 p-4 md:p-5 bg-slate-50/80 rounded-xl border border-slate-100 animate__animated animate__fadeIn animate__faster">
                      <CircularDetailsTable item={item} onRefClick={handleRefClick} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {paged.length === 0 && (
          <div className="py-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <i className='bx bx-search text-3xl'></i>
            </div>
            <div className="text-slate-500 font-medium">ไม่พบข้อมูลที่ตรงตามเงื่อนไข</div>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <nav>
            <ul className="flex items-center gap-1">
              <li>
                <button 
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition ${page<=1 ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 bg-white shadow-sm border border-slate-100'}`}
                  onClick={()=>setPage(p=>p-1)}
                  disabled={page<=1}
                >
                  <i className='bx bx-chevron-left text-xl'></i>
                </button>
              </li>
              {Array.from({length: Math.min(totalPages, 5)}).map((_,i)=>{
                const p = page<=3 ? i+1 : page-2+i
                if (p>totalPages) return null
                return (
                  <li key={p}>
                    <button 
                      className={`w-10 h-10 flex items-center justify-center rounded-full font-semibold transition ${p===page ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 bg-white shadow-sm border border-slate-100'}`}
                      onClick={()=>setPage(p)}
                    >
                      {p}
                    </button>
                  </li>
                )
              })}
              <li>
                <button 
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition ${page>=totalPages ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 bg-white shadow-sm border border-slate-100'}`}
                  onClick={()=>setPage(p=>p+1)}
                  disabled={page>=totalPages}
                >
                  <i className='bx bx-chevron-right text-xl'></i>
                </button>
              </li>
            </ul>
          </nav>
          <small className="text-slate-400 font-medium">
            แสดง {Math.min((page-1)*perPage+1, filtered.length)}–{Math.min(page*perPage, filtered.length)} จาก {filtered.length} รายการ
          </small>
        </div>
      )}

      {activeRefData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate__animated animate__fadeIn animate__faster" onClick={() => setActiveRefData(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate__animated animate__zoomIn animate__faster" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h5 className="m-0 font-bold text-lg text-emerald-800 flex items-center font-saochingcha">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mr-3">
                  <i className='bx bx-file text-xl'></i>
                </div>
                ข้อมูลอ้างถึง
              </h5>
              <button 
                type="button" 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition" 
                onClick={() => setActiveRefData(null)}
              >
                <i className='bx bx-x text-xl'></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <h5 className="font-bold mb-2 text-slate-800">{activeRefData.in_num_date}</h5>
              <p className="text-slate-600 mb-6">{activeRefData.in_detail}</p>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                <CircularDetailsTable item={activeRefData} onRefClick={handleRefClick} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

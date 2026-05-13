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
    <div className="bg-white rounded-3xl shadow-sm mb-8 overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h5 className="m-0 font-bold text-lg text-slate-800 flex items-center font-saochingcha">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mr-3">
            <i className='bx bx-bar-chart-alt-2 text-xl'></i>
          </div>
          รายงานและสถิติ
        </h5>
      </div>
      
      <div className="p-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ปี พ.ศ.</label>
            <select 
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none" 
              value={yearFilter} 
              onChange={e=>setYearFilter(e.target.value)}
            >
              <option value="">ทั้งหมด</option>
              {(allData?.year||[]).map((y: any)=><option key={y.year_id} value={y.year_id}>{y.year_value}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ผลการพิจารณา</label>
            <select 
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none" 
              value={resultFilter} 
              onChange={e=>setResultFilter(e.target.value)}
            >
              <option value="">ทั้งหมด</option>
              {(allData?.results||[]).map((r: any)=><option key={r.results_id} value={r.results_id}>{r.results_detail}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ผู้รับผิดชอบ</label>
            <select 
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none" 
              value={agFilter} 
              onChange={e=>setAgFilter(e.target.value)}
            >
              <option value="">ทั้งหมด</option>
              {(allData?.agency||[]).map((a: any)=><option key={a.ag_id} value={a.ag_id}>{a.ag_name}</option>)}
            </select>
          </div>
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ค้นหา</label>
            <div className="absolute top-[28px] left-0 pl-3 flex items-center pointer-events-none">
              <i className="bx bx-search text-slate-400"></i>
            </div>
            <input 
              type="text" 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
              placeholder="เลขที่หนังสือ / เรื่อง..."
              value={search} 
              onChange={e=>setSearch(e.target.value)} 
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label:'ทั้งหมด', val: counts.all, color:'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label:'นำมาใช้', val: counts.use, color:'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label:'นำมาปรับใช้', val: counts.adjust, color:'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
            { label:'ไม่ใช้', val: counts.notuse, color:'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
            { label:'รอผล', val: counts.pending, color:'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
            { label:'ตกหล่น', val: counts.missing, color:'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
          ].map(c=>(
            <div key={c.label} className={`col-span-1 rounded-2xl border ${c.border} ${c.bg} p-4 text-center transition hover:shadow-sm`}>
              <div className={`font-bold text-2xl mb-1 ${c.color}`}>{c.val.toLocaleString()}</div>
              <div className="text-xs font-semibold text-slate-500">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
                  <th className="px-4 py-3 font-semibold w-64">เลขที่หนังสือ</th>
                  <th className="px-4 py-3 font-semibold">เรื่อง</th>
                  <th className="px-4 py-3 font-semibold">ผลการพิจารณา</th>
                  <th className="px-4 py-3 font-semibold">ผู้รับผิดชอบ</th>
                  <th className="px-4 py-3 font-semibold text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filtered.length===0 && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-12">ไม่พบข้อมูลที่ค้นหา</td></tr>
                )}
                {filtered.slice(0,200).map((item: any, i: number)=>{
                  const resVal  = item.results?.results_detail||'-'
                  const resColor= item.results?.results_color||'64748b'
                  const statusVal = item.status_a?.status_value||'-'
                  return (
                    <tr key={item.in_id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 transition">
                      <td className="px-4 py-3 text-slate-400 text-center">{i+1}</td>
                      <td className="px-4 py-3 align-top">
                        {(() => {
                          const parts = (item.in_num_date || '').split(' ลงวันที่ ')
                          return (
                            <>
                              <div className="font-bold text-slate-800">{parts[0]}</div>
                              {parts[1] && <div className="text-xs text-slate-500 mt-0.5">ลงวันที่ {parts[1]}</div>}
                              {(item.references_info || []).length > 0 && (
                                <div className="mt-1 text-[0.7rem] text-rose-600 bg-rose-50 px-2 py-0.5 rounded inline-block">
                                  อ้างถึง: {item.references_info.map((r: any) => r.in_num_date).join(', ')}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-slate-700 line-clamp-2 max-w-[400px]">{item.in_detail}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span 
                          className="px-2 py-1 text-xs font-bold rounded"
                          style={{ color: `#${resColor}`, backgroundColor: `#${resColor}15` }}
                        >
                          {resVal}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {(item.agency||[]).map((a: any)=><span key={a.ag_name} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{a.ag_name}</span>)}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-center">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${statusVal==='ใช้งาน'?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>
                          {statusVal}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        {filtered.length>200 && <p className="text-slate-400 text-xs text-right mt-3 m-0">แสดง 200 รายการแรกจาก {filtered.length} รายการ</p>}
      </div>
    </div>
  )
}

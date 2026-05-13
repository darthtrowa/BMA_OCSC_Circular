import React, { useMemo } from 'react'

export default function ExecutiveDashboard({ allData, loading }) {
  if (loading) return (
    <div className="flex justify-center items-center h-[300px]">
      <i className='bx bx-loader-alt animate-spin text-4xl text-emerald-600'></i>
    </div>
  )

  // Calculate some stats from allData
  const stats = useMemo(() => {
    if (!allData || !allData.information) return {}
    
    const info = allData.information
    const total = info.length
    
    // Group by status (This is a simplified version, in real app we'd use status_id)
    const finalized = info.filter(item => {
      const statusStr = item.status_a?.status_value || ''
      const isStatusFinalized = statusStr.includes('เสร็จสิ้น') || statusStr.includes('พิจารณาแล้ว')
      
      const mkkName = item.mati_kk?.mkk_name || ''
      const excludeMkk = ['ไม่ระบุ', 'รอเข้า ก.ก.', 'รอเข้าคณะทำงานฯ พิจารณา', '']
      const isMkkFinalized = mkkName && !excludeMkk.includes(mkkName)

      return isStatusFinalized || isMkkFinalized
    }).length

    const categoriesCount = (allData.categories || []).map(cat => ({
      name: cat.cat_name,
      count: info.filter(item => (item.categories || []).some(c => c.cat_id == cat.cat_id)).length
    })).sort((a, b) => b.count - a.count)

    return {
      total,
      finalized,
      inProgress: total - finalized,
      recentFindings: info.slice(0, 5),
      categoriesCount
    }
  }, [allData])

  return (
    <div className="animate__animated animate__fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {/* KPI Cards */}
        <div className="bg-white rounded-2xl shadow-sm h-full overflow-hidden flex flex-col">
          <div className="p-6 flex items-center flex-1">
            <div className="shrink-0 bg-emerald-50 p-3 rounded-xl mr-4 text-emerald-600">
              <i className='bx bx-file-blank text-3xl'></i>
            </div>
            <div>
              <h6 className="text-xs font-semibold uppercase text-slate-500 mb-1 tracking-wider">หนังสือเวียนทั้งหมด</h6>
              <h3 className="font-bold text-2xl text-slate-800 m-0">{stats.total || 0}</h3>
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100">
            <div className="h-full bg-emerald-600" style={{ width: '100%' }}></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm h-full overflow-hidden flex flex-col">
          <div className="p-6 flex items-center flex-1">
            <div className="shrink-0 bg-teal-50 p-3 rounded-xl mr-4 text-teal-500">
              <i className='bx bx-check-circle text-3xl'></i>
            </div>
            <div>
              <h6 className="text-xs font-semibold uppercase text-slate-500 mb-1 tracking-wider">พิจารณาเสร็จสิ้น</h6>
              <h3 className="font-bold text-2xl text-slate-800 m-0">{stats.finalized || 0}</h3>
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100">
            <div className="h-full bg-teal-500" style={{ width: `${(stats.finalized / stats.total) * 100 || 0}%` }}></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm h-full overflow-hidden flex flex-col">
          <div className="p-6 flex items-center flex-1">
            <div className="shrink-0 bg-amber-50 p-3 rounded-xl mr-4 text-amber-500">
              <i className='bx bx-time-five text-3xl'></i>
            </div>
            <div>
              <h6 className="text-xs font-semibold uppercase text-slate-500 mb-1 tracking-wider">อยู่ระหว่างพิจารณา</h6>
              <h3 className="font-bold text-2xl text-slate-800 m-0">{stats.inProgress || 0}</h3>
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100">
            <div className="h-full bg-amber-500" style={{ width: `${(stats.inProgress / stats.total) * 100 || 0}%` }}></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm h-full overflow-hidden flex flex-col">
          <div className="p-6 flex items-center flex-1">
            <div className="shrink-0 bg-sky-50 p-3 rounded-xl mr-4 text-sky-500">
              <i className='bx bx-calendar-check text-3xl'></i>
            </div>
            <div>
              <h6 className="text-xs font-semibold uppercase text-slate-500 mb-1 tracking-wider">หนังสือมาใหม่ (7 วัน)</h6>
              <h3 className="font-bold text-2xl text-slate-800 m-0">
                {allData?.information?.filter((i: any) => {
                  const diff = (new Date().getTime() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24)
                  return diff <= 7
                }).length || 0}
              </h3>
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100">
            <div className="h-full bg-sky-500" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl shadow-sm h-full flex flex-col">
            <div className="pt-6 px-6 pb-4 flex justify-between items-center">
              <h5 className="m-0 font-semibold text-lg text-slate-800 font-saochingcha">สถิติแยกตามหมวดหมู่</h5>
              <i className='bx bx-dots-vertical-rounded text-slate-400'></i>
            </div>
            <div className="px-6 pb-6 overflow-y-auto max-h-96 custom-scrollbar flex-1">
              {stats.categoriesCount?.map((cat: any, idx: number) => (
                <div key={idx} className="mb-4">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm text-slate-500">{cat.name}</span>
                    <span className="font-semibold text-slate-700">{cat.count}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ 
                        width: `${(cat.count / stats.total) * 100}%`, 
                        opacity: Math.max(0.3, 1 - (idx * 0.05))
                      }}
                    ></div>
                  </div>
                </div>
              ))}
              {(!stats.categoriesCount || stats.categoriesCount.length === 0) && (
                <div className="text-center py-10 text-slate-400">ไม่มีข้อมูลหมวดหมู่</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity / Findings */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl shadow-sm h-full flex flex-col overflow-hidden">
            <div className="pt-6 px-6 pb-4 flex justify-between items-center">
              <h5 className="m-0 font-semibold text-lg text-slate-800 font-saochingcha">หนังสือเวียนล่าสุดที่ตรวจพบ</h5>
              <button className="px-4 py-1.5 text-sm font-semibold border border-emerald-500 text-emerald-600 rounded-full hover:bg-emerald-50 transition">ดูทั้งหมด</button>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-max">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide border-y border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">เลขที่ / เรื่อง</th>
                    <th className="px-6 py-4 font-semibold">วันที่ตรวจพบ</th>
                    <th className="px-6 py-4 font-semibold">สถานะการพิจารณา</th>
                    <th className="px-6 py-4 font-semibold text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {stats.recentFindings?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 border-b border-slate-50">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{item.in_num_date}</span>
                          <span className="text-slate-500 truncate max-w-xs">{item.in_detail}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-50 text-slate-500">
                        {new Date(item.created_at).toLocaleDateString('th-TH')}
                      </td>
                      <td className="px-6 py-4 border-b border-slate-50">
                        {(() => {
                          const statusStr = item.status_a?.status_value || ''
                          const isStatusFinalized = statusStr.includes('เสร็จสิ้น') || statusStr.includes('พิจารณาแล้ว')
                          const mkkName = item.mati_kk?.mkk_name || ''
                          const excludeMkk = ['ไม่ระบุ', 'รอเข้า ก.ก.', 'รอเข้าคณะทำงานฯ พิจารณา', '']
                          const isMkkFinalized = mkkName && !excludeMkk.includes(mkkName)
                          
                          const isFinal = isStatusFinalized || isMkkFinalized
                          const displayStatus = isFinal ? 'พิจารณาเสร็จสิ้น' : (statusStr || 'อยู่ระหว่างพิจารณา')

                          return (
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${isFinal ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'}`}>
                              {displayStatus}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 border-b border-slate-50 text-right">
                        <button className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition flex items-center justify-center inline-flex" title="ดูรายละเอียด">
                          <i className='bx bx-right-arrow-alt text-lg'></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!stats.recentFindings || stats.recentFindings.length === 0) && (
                    <tr><td colSpan={4} className="text-center py-10 text-slate-400 border-b border-slate-50">ไม่มีรายการล่าสุด</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 text-white p-8 rounded-3xl overflow-hidden relative shadow-lg">
          <div className="relative z-10">
            <h4 className="font-bold text-2xl mb-2 text-white">พร้อมสำหรับการพิจารณารอบถัดไปหรือยัง?</h4>
            <p className="m-0 text-emerald-100 max-w-2xl text-lg">ใช้ระบบ AI ในการช่วยสรุปเนื้อหาและเปรียบเทียบระเบียบเพื่อให้การทำงานรวดเร็วขึ้นถึง 3 เท่า</p>
          </div>
          <i className='bx bxs-zap absolute -right-6 -top-6 text-[180px] text-emerald-900/20 transform rotate-12'></i>
        </div>
      </div>
    </div>
  )
}

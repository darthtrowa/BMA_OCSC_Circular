// resultId ที่ตรงกับ results_id ในฐานข้อมูล
// all=null, use=2, adjust=4, notuse=5, pending=12, missing=11
const CARD_DEFS = [
  { id: 'all',     label: 'ทั้งหมด',          resultId: null, color: '#4361ee', icon: 'bx-collection', key: 'all' },
  { id: 'use',     label: 'นำมาใช้',           resultId: 2,    color: '#10b981', icon: 'bx-check-double', key: 'use' },
  { id: 'adjust',  label: 'นำมาปรับใช้',       resultId: 4,    color: '#f59e0b', icon: 'bx-edit-alt', key: 'adjust' },
  { id: 'notuse',  label: 'ไม่ใช้',            resultId: 5,    color: '#ef4444', icon: 'bx-x-circle', key: 'notuse' },
  { id: 'pending', label: 'รอผล',             resultId: 12,   color: '#f97316', icon: 'bx-time-five', key: 'pending' },
  { id: 'missing', label: 'ตกหล่น',           resultId: 11,   color: '#64748b', icon: 'bx-error-circle', key: 'missing' },
]

// คำนวณสถิติจากอาร์เรย์ข้อมูล
function computeCounts(items) {
  return {
    all:     items.length,
    use:     items.filter(i => i.results?.results_id == 2).length,
    adjust:  items.filter(i => i.results?.results_id == 4).length,
    notuse:  items.filter(i => i.results?.results_id == 5).length,
    pending: items.filter(i => i.results?.results_id == 12).length,
    missing: items.filter(i => i.results?.results_id == 11).length,
  }
}

export { CARD_DEFS, computeCounts }

export default function StatsCards({ data, resultsData, activeCardId, onCardClick }) {
  // ถ้ามี resultsData (ผลค้นหา) ให้นับจากนั้น ไม่เช่นนั้นใช้ data จาก API
  const countsFromSearch = resultsData ? computeCounts(resultsData) : null

  const getValue = (card) => {
    if (countsFromSearch) return countsFromSearch[card.id]
    return data ? (data[`count_${card.id}`] ?? 0) : null
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      {CARD_DEFS.map(card => {
        const isActive = activeCardId === card.id
        const val = getValue(card)
        return (
          <div key={card.id} className="col-span-1">
            <div
              className={`relative h-full rounded-2xl overflow-hidden transition-all duration-300 ease-out ${isActive ? 'text-white shadow-xl shadow-emerald-900/10' : 'bg-white shadow-sm hover:shadow-md hover:-translate-y-1'}`}
              style={{
                cursor: onCardClick ? 'pointer' : 'default',
                transform: isActive ? 'translateY(-8px)' : 'none',
                backgroundColor: isActive ? card.color : '#fff',
              }}
              onClick={() => onCardClick && onCardClick(card)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/25' : 'bg-slate-100'}`}
                    >
                      <i className={`bx ${card.icon} text-2xl`} style={{ color: isActive ? '#fff' : card.color }}></i>
                    </div>
                    <p className={`text-sm font-bold m-0 ${isActive ? 'text-white' : 'text-slate-600'}`}>{card.label}</p>
                  </div>
                  {isActive && <span className="px-2 py-0.5 bg-white rounded-full shadow-sm text-[10px] font-black uppercase tracking-wider" style={{ color: card.color }}>Active</span>}
                </div>
                <div>
                  <h3 className={`font-bold text-2xl mb-0 ${isActive ? 'text-white' : ''}`} style={{ color: !isActive ? card.color : undefined }}>
                    {val !== null ? val.toLocaleString() : <i className='bx bx-loader-alt animate-spin text-xl'></i>}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

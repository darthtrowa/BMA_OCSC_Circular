export default function DashboardStats({ allData, loading, onFilter, activeResultId, baseFilteredData }) {
  // Use baseFilteredData if available (from table filtering), else use all information
  const source = baseFilteredData ?? allData?.information ?? []

  const counts = {
    all:     source.length,
    use:     source.filter(i => i.results?.results_id == 2).length,
    adjust:  source.filter(i => i.results?.results_id == 4).length,
    notuse:  source.filter(i => i.results?.results_id == 5).length,
    pending: source.filter(i => i.results?.results_id == 12).length,
    missing: source.filter(i => i.results?.results_id == 11).length,
  }

  const cards = [
    { id: 'all',     label: 'ทั้งหมด',       key: 'all',     color: '#4361ee', icon: 'bx-collection', resultId: 'all' },
    { id: 'use',     label: 'นำมาใช้',        key: 'use',     color: '#10b981', icon: 'bx-check-double', resultId: 2     },
    { id: 'adjust',  label: 'นำมาปรับใช้',    key: 'adjust',  color: '#f59e0b', icon: 'bx-edit-alt', resultId: 4     },
    { id: 'notuse',  label: 'ไม่ใช้',         key: 'notuse',  color: '#ef4444', icon: 'bx-x-circle', resultId: 5     },
    { id: 'pending', label: 'รอผล',           key: 'pending', color: '#f97316', icon: 'bx-time-five', resultId: 12    },
    { id: 'missing', label: 'ตกหล่น',         key: 'missing', color: '#64748b', icon: 'bx-error-circle', resultId: 11    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      {cards.map(card => {
        // eslint-disable-next-line eqeqeq
        const isActive = activeResultId !== undefined && activeResultId == card.resultId
        return (
          <div key={card.id} className="col-span-1">
            <button
              className={`w-full text-left relative h-full rounded-2xl overflow-hidden transition-all duration-300 ease-out ${isActive ? 'text-white shadow-xl shadow-emerald-900/10' : 'bg-white shadow-sm hover:shadow-md hover:-translate-y-1'}`}
              style={{
                transform: isActive ? 'translateY(-8px)' : 'none',
                backgroundColor: isActive ? card.color : '#fff'
              }}
              onClick={() => onFilter && onFilter(card.resultId)}
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
                    {loading ? <i className='bx bx-loader-alt animate-spin text-xl'></i> : counts[card.key].toLocaleString()}
                  </h3>
                </div>
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}

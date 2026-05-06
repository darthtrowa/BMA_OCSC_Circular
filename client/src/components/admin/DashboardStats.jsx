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
    <div className="row g-4 mb-5">
      {cards.map(card => {
        // eslint-disable-next-line eqeqeq
        const isActive = activeResultId !== undefined && activeResultId == card.resultId
        return (
          <div key={card.id} className="col-6 col-md-4 col-lg-3 col-xl">
            <div
              className={`card h-100 border-0 ${isActive ? 'text-white shadow-lg' : 'bg-white'}`}
              style={{
                cursor: 'pointer',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, background-color 0.3s ease',
                transform: isActive ? 'translateY(-8px)' : 'none',
                backgroundColor: isActive ? card.color : '#fff'
              }}
              onClick={() => onFilter && onFilter(card.resultId)}
            >
              <div className="card-body p-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div 
                    className={`rounded-xl d-flex align-items-center justify-content-center ${isActive ? 'bg-white bg-opacity-25' : 'bg-light'}`}
                    style={{ width: '48px', height: '48px' }}
                  >
                    <i className={`bx ${card.icon} fs-3`} style={{ color: isActive ? '#fff' : card.color }}></i>
                  </div>
                  {isActive && <span className="badge bg-white rounded-pill px-3 shadow-sm" style={{ color: card.color }}>Active</span>}
                </div>
                <div>
                  <h2 className={`fw-bold mb-1 ${isActive ? 'text-white' : ''}`} style={{ color: !isActive ? card.color : undefined }}>
                    {loading ? <span className="spinner-border spinner-border-sm" /> : counts[card.key].toLocaleString()}
                  </h2>
                  <p className={`mb-0 fw-medium ${isActive ? 'text-white text-opacity-75' : 'text-muted'}`}>{card.label}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

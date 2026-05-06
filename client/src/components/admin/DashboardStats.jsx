export default function DashboardStats({ allData, loading, onFilter, activeResultId, baseFilteredData }) {
  // ใช้ baseFilteredData ถ้ามี (ผลจากการกรองในตาราง) ไม่เช่นนั้นใช้ข้อมูลทั้งหมด
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
    { id: 'all',     label: 'ทั้งหมด',       key: 'all',     color: '#696cff', bg: '#e7e7ff', resultId: 'all' },
    { id: 'use',     label: 'นำมาใช้',        key: 'use',     color: '#71dd37', bg: '#e6ffe6', resultId: 2     },
    { id: 'adjust',  label: 'นำมาปรับใช้',    key: 'adjust',  color: '#ffab00', bg: '#fff7e0', resultId: 4     },
    { id: 'notuse',  label: 'ไม่ใช้',         key: 'notuse',  color: '#ff3e1d', bg: '#ffe4e0', resultId: 5     },
    { id: 'pending', label: 'รอผล',           key: 'pending', color: '#f67d3c', bg: '#fff0e8', resultId: 12    },
    { id: 'missing', label: 'ตกหล่น',         key: 'missing', color: '#233446', bg: '#e8eef3', resultId: 11    },
  ]

  return (
    <div className="row g-3 mb-4">
      {cards.map(card => {
        // eslint-disable-next-line eqeqeq
        const isActive = activeResultId !== undefined && activeResultId == card.resultId
        return (
          <div key={card.id} className="col-6 col-md-4 col-lg-3 col-xl">
            <div
              className="card h-100 border-0 shadow-sm"
              style={{
                cursor: 'pointer',
                borderLeft: `4px solid ${card.color}`,
                outline: isActive ? `2px solid ${card.color}` : 'none',
                transform: isActive ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease',
                background: isActive ? card.bg : '#fff',
              }}
              onClick={() => onFilter && onFilter(card.resultId)}
            >
              <div className="card-body text-center py-3">
                <h3 className="fw-bold mb-0" style={{ color: card.color }}>
                  {loading ? <span className="spinner-border spinner-border-sm" /> : counts[card.key].toLocaleString()}
                </h3>
                <small className="text-muted">{card.label}</small>
                {isActive && <div style={{ fontSize: '0.65rem', color: card.color, fontWeight: 600 }}>◀ กำลังแสดง</div>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

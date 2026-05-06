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
    <section className="py-3">
      <div className="container">
        <div className="row g-4 stats-row">
          {CARD_DEFS.map(card => {
            const isActive = activeCardId === card.id
            const val = getValue(card)
            return (
              <div key={card.id} className="col-6 col-md-4 col-lg-3 col-xl">
                <div
                  className={`card h-100 border-0 ${isActive ? 'text-white shadow-lg' : 'bg-white shadow-sm'}`}
                  style={{
                    cursor: onCardClick ? 'pointer' : 'default',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, background-color 0.3s ease',
                    transform: isActive ? 'translateY(-8px)' : 'none',
                    backgroundColor: isActive ? card.color : '#fff',
                    borderRadius: '1.25rem'
                  }}
                  onClick={() => onCardClick && onCardClick(card)}
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
                        {val !== null ? val.toLocaleString() : <span className="spinner-border spinner-border-sm" />}
                      </h2>
                      <p className={`mb-0 fw-medium ${isActive ? 'text-white text-opacity-75' : 'text-muted'}`}>{card.label}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

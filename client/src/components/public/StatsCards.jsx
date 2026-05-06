// resultId ที่ตรงกับ results_id ในฐานข้อมูล
// all=null, use=2, adjust=4, notuse=5, pending=12, missing=11
const CARD_DEFS = [
  { id: 'all',     label: 'ทั้งหมด',          resultId: null, color: 'primary',  hexColor: null,      icon: 'bx-file-blank',   bg: 'bg-soft-blue'   },
  { id: 'use',     label: 'นำมาใช้',           resultId: 2,    color: 'success',  hexColor: '#71dd37', icon: 'bx-check-circle', bg: 'bg-soft-green'  },
  { id: 'adjust',  label: 'นำมาปรับใช้',       resultId: 4,    color: 'warning',  hexColor: '#ffab00', icon: 'bx-edit',         bg: 'bg-soft-yellow' },
  { id: 'notuse',  label: 'ไม่ใช้',            resultId: 5,    color: 'danger',   hexColor: null,      icon: 'bx-x-circle',     bg: 'bg-soft-red'    },
  { id: 'pending', label: 'รอผลการพิจารณา',    resultId: 12,   color: 'orange',   hexColor: null,      icon: 'bx-time-five',    bg: 'bg-soft-orange' },
  { id: 'missing', label: 'ตกหล่น',            resultId: 11,   color: 'dark',     hexColor: null,      icon: 'bx-error-circle', bg: 'bg-soft-purple' },
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
    <section className="py-3 bg-pale-primary">
      <div className="container">
        <div className={`row g-3 stats-row ${(data || resultsData) ? 'stats-loaded' : ''}`}>
          {CARD_DEFS.map(card => {
            const isActive = activeCardId === card.id
            const color = card.hexColor || `var(--bs-${card.color})`
            const val = getValue(card)
            return (
              <div key={card.id} className="col-6 col-md-4 col-lg-2">
                <div
                  className="card stats-card h-100 border-0 shadow-sm"
                  style={{
                    cursor: onCardClick ? 'pointer' : 'default',
                    outline: isActive ? `2px solid ${color}` : 'none',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                    transition: 'all 0.2s ease',
                    background: isActive ? (card.id === 'all' ? '#eef2ff' : '') : '',
                  }}
                  onClick={() => onCardClick && onCardClick(card)}
                >
                  <div className="card-body d-flex align-items-center gap-3 p-3">
                    <div
                      className={`stats-icon-wrap ${card.bg} rounded-circle`}
                      style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <i className={`bx ${card.icon}`} style={{ fontSize: '1.5rem', color }}></i>
                    </div>
                    <div>
                      <div className="stats-label text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        {card.label}
                      </div>
                      <div className="stats-number" style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.1, color }}>
                        {val !== null ? val.toLocaleString() : '—'}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                        {isActive ? <span style={{ color, fontWeight: 600 }}>◀ กำลังแสดง</span> : 'เรื่อง'}
                      </div>
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

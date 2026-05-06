export default function UserStats({ users, loading }) {
  const counts = {
    all: users.length,
    super: users.filter(u => u.a_permiss === 'superadmin').length,
    admin: users.filter(u => u.a_permiss === 'admin').length,
    active: users.filter(u => u.a_status === 'true').length,
    suspended: users.filter(u => u.a_status === 'false').length,
  }

  const cards = [
    { id: 'all', label: 'ผู้ใช้งานทั้งหมด', count: counts.all, icon: 'bx-group', color: 'primary' },
    { id: 'super', label: 'SuperAdmin', count: counts.super, icon: 'bx-shield-quarter', color: 'danger' },
    { id: 'admin', label: 'Admin ทั่วไป', count: counts.admin, icon: 'bx-user', color: 'info' },
    { id: 'active', label: 'ใช้งานปกติ', count: counts.active, icon: 'bx-check-circle', color: 'success' },
    { id: 'suspended', label: 'ระงับการใช้งาน', count: counts.suspended, icon: 'bx-x-circle', color: 'secondary' },
  ]

  if (loading) {
    return (
      <div className="row g-3 mb-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="col-6 col-md-4 col-lg-3 col-xl">
            <div className="card h-100 border-0 shadow-sm animate-pulse">
              <div className="card-body py-3">
                <div className="bg-light rounded w-50 h-px-20 mb-2"></div>
                <div className="bg-light rounded w-25 h-px-30"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="row g-3 mb-4">
      {cards.map(card => (
        <div key={card.id} className="col-6 col-md-4 col-lg-3 col-xl">
          <div className={`card h-100 border-0 shadow-sm border-bottom border-3 border-${card.color}`}>
            <div className="card-body py-3">
              <div className="d-flex align-items-center mb-1">
                <div className={`avatar flex-shrink-0 me-2`}>
                  <span className={`avatar-initial rounded bg-label-${card.color}`}>
                    <i className={`bx ${card.icon} fs-4`}></i>
                  </span>
                </div>
                <span className="fw-semibold d-block text-muted small">{card.label}</span>
              </div>
              <div className="d-flex align-items-baseline">
                <h4 className={`card-title mb-0 me-2 text-${card.color}`}>{card.count.toLocaleString()}</h4>
                <small className="text-muted">คน</small>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="col-span-1">
            <div className="bg-white rounded-2xl p-4 shadow-sm animate-pulse h-full">
              <div className="bg-slate-200 rounded w-1/2 h-5 mb-4"></div>
              <div className="bg-slate-200 rounded w-1/3 h-8"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const getBorderColor = (c: string) => {
    switch(c) {
      case 'primary': return 'border-blue-500'
      case 'danger': return 'border-rose-500'
      case 'info': return 'border-sky-500'
      case 'success': return 'border-emerald-500'
      case 'secondary': return 'border-slate-400'
      default: return 'border-slate-200'
    }
  }

  const getTextColor = (c: string) => {
    switch(c) {
      case 'primary': return 'text-blue-600'
      case 'danger': return 'text-rose-600'
      case 'info': return 'text-sky-600'
      case 'success': return 'text-emerald-600'
      case 'secondary': return 'text-slate-600'
      default: return 'text-slate-800'
    }
  }

  const getBgColor = (c: string) => {
    switch(c) {
      case 'primary': return 'bg-blue-50'
      case 'danger': return 'bg-rose-50'
      case 'info': return 'bg-sky-50'
      case 'success': return 'bg-emerald-50'
      case 'secondary': return 'bg-slate-50'
      default: return 'bg-slate-50'
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
      {cards.map(card => (
        <div key={card.id} className="col-span-1">
          <div className={`bg-white rounded-2xl h-full shadow-sm border-b-4 ${getBorderColor(card.color)} transition-transform hover:-translate-y-1 hover:shadow-md`}>
            <div className="p-4">
              <div className="flex items-center mb-3">
                <div className={`w-10 h-10 rounded-xl ${getBgColor(card.color)} flex items-center justify-center mr-3 shrink-0`}>
                  <i className={`bx ${card.icon} text-xl ${getTextColor(card.color)}`}></i>
                </div>
                <span className="font-semibold text-slate-500 text-sm">{card.label}</span>
              </div>
              <div className="flex items-baseline">
                <h4 className={`text-2xl font-bold m-0 mr-2 ${getTextColor(card.color)}`}>{card.count.toLocaleString()}</h4>
                <small className="text-slate-400 font-medium">คน</small>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

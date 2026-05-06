import { LOGO_URL } from '../../api/apiService'

export default function Sidebar({ activeSection, onNavigate, permiss, onLogout, onProfile, onPassword }) {
  const isSuperAdmin = permiss === 'superadmin'

  const masterTypes = [
    { key: 'year', label: 'ปี พ.ศ.', icon: 'bx-calendar' },
    { key: 'results', label: 'ผลการพิจารณา', icon: 'bx-check-square' },
    { key: 'agency', label: 'ผู้รับผิดชอบ', icon: 'bx-buildings' },
    { key: 'categories', label: 'หมวดหมู่', icon: 'bx-category' },
    { key: 'mkk', label: 'มติ ก.ก.', icon: 'bx-book' },
    { key: 'mw', label: 'มติคณะทำงาน', icon: 'bx-group' },
    { key: 'status', label: 'สถานะการใช้งาน', icon: 'bx-toggle-left' },
  ]

  const navItem = (secId, label, icon, show = true) =>
    show && (
      <li className="menu-item" key={secId}>
        <a
          href="#"
          className={`menu-link ${activeSection === secId ? 'active' : ''}`}
          onClick={e => { e.preventDefault(); onNavigate(secId) }}
        >
          <i className={`menu-icon tf-icons bx ${icon}`}></i>
          <div className="menu-text">{label}</div>
        </a>
      </li>
    )

  return (
    <aside className="layout-menu menu-vertical menu">
      {/* Logo Section */}
      <div className="app-brand">
        <div className="app-brand-logo bg-green rounded-circle d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px', backgroundColor: '#065f46', overflow: 'hidden' }}>
          <img 
            src={LOGO_URL} 
            alt="Logo" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          <i className='bx bx-spreadsheet fs-4 text-white' style={{ display: 'none' }}></i>
        </div>
        <span className="app-brand-text">CSC Circular</span>
      </div>

      <ul className="menu-inner">
        {/* Main Section */}
        <li className="menu-header">Dashboard</li>
        {navItem('sec-circular', 'หนังสือเวียน', 'bx-file-blank', isSuperAdmin)}
        
        <li className="menu-item">
          <a href="/" className="menu-link" target="_blank" rel="noreferrer">
            <i className="menu-icon tf-icons bx bx-globe"></i>
            <div className="menu-text">หน้าค้นหาสำหรับประชาชน</div>
          </a>
        </li>

        {/* Master Data Section */}
        {isSuperAdmin && (
          <>
            <li className="menu-header">ข้อมูลหลักระบบ</li>
            {masterTypes.map(t => navItem(`sec-master-${t.key}`, t.label, t.icon))}

            <li className="menu-header">จัดการระบบ</li>
            {navItem('sec-users', 'จัดการผู้ใช้งาน', 'bx-user-circle', isSuperAdmin)}
          </>
        )}
      </ul>
      
      {/* Sidebar Footer or Version info could go here */}
      <div className="p-3 text-center">
        <small className="text-muted" style={{ fontSize: '0.7rem' }}>v2.0 Hyper-Productive</small>
      </div>
    </aside>
  )
}

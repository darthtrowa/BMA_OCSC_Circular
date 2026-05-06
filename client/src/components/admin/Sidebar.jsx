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
          <div>{label}</div>
        </a>
      </li>
    )

  return (
    <aside className="layout-menu menu-vertical menu bg-menu-theme">
      {/* Logo */}
      <div className="app-brand demo">
        <a href="/" className="app-brand-link">
          <span className="app-brand-text menu-text fw-bold">
            <i className='bx bx-file-blank me-1 text-primary'></i>CSC Circular
          </span>
        </a>
        <button className="layout-menu-toggle menu-link text-large ms-auto d-block d-xl-none">
          <i className='bx bx-chevron-left'></i>
        </button>
      </div>
      <div className="menu-divider mt-0"></div>

      <div className="menu-inner-shadow"></div>

      <ul className="menu-inner py-1">
        {/* หนังสือเวียน */}
        {navItem('sec-circular', 'หนังสือเวียน', 'bx-file-blank', isSuperAdmin)}
        <li className="menu-item">
          <a href="/" className="menu-link" target="_blank" rel="noreferrer">
            <i className="menu-icon tf-icons bx bx-world"></i>
            <div>หน้าค้นหา</div>
          </a>
        </li>
        {/* Master Data */}
        {isSuperAdmin && (
          <>
            <li className="menu-header small text-uppercase">
              <span className="menu-header-text">ข้อมูลหลัก</span>
            </li>
            {masterTypes.map(t => navItem(`sec-master-${t.key}`, t.label, t.icon))}

            <li className="menu-header small text-uppercase">
              <span className="menu-header-text">ผู้ใช้งาน</span>
            </li>
            {navItem('sec-users', 'จัดการผู้ใช้งาน', 'bx-user-plus', isSuperAdmin)}
          </>
        )}

      </ul>
    </aside>
  )
}

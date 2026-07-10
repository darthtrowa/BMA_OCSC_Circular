import { useState, useEffect } from 'react'
import { LOGO_URL } from '../../api/apiService'

export default function Sidebar({ activeSection, onNavigate, permiss, role, inboxCount = 0, actingCount = 0, trackingCount = 0, onLogout, onProfile, onPassword, isCollapsed = false }) {
  const isSuperAdmin = permiss === 'superadmin' || permiss === 'admin'

  const [openInbox, setOpenInbox] = useState(false)
  const [openMaster, setOpenMaster] = useState(false)
  const [openManage, setOpenManage] = useState(false)

  // Auto-expand when active
  useEffect(() => {
    if (activeSection.startsWith('sec-workflow-inbox')) setOpenInbox(true)
    if (activeSection.startsWith('sec-master-')) setOpenMaster(true)
    if (activeSection === 'sec-users' || activeSection === 'sec-agency-structure') setOpenManage(true)
  }, [activeSection])

  const masterTypes = [
    { key: 'year', label: 'ปี พ.ศ.', icon: 'bx-calendar' },
    { key: 'results', label: 'ผลการพิจารณา', icon: 'bx-check-square' },
    { key: 'agency', label: 'ผู้รับผิดชอบ', icon: 'bx-buildings' },
    { key: 'categories', label: 'หมวดหมู่', icon: 'bx-category' },
    { key: 'mkk', label: 'มติ ก.ก.', icon: 'bx-book' },
    { key: 'mw', label: 'มติคณะทำงาน', icon: 'bx-group' },
    { key: 'status', label: 'สถานะการใช้งาน', icon: 'bx-toggle-left' },
  ]

  const navItem = (secId: string, label: string, icon: string, show = true, count = 0, isSub = false) =>
    show && (
      <li key={secId}>
        <a
          href="#"
          className={`group flex items-center justify-between rounded-xl py-2.5 px-3 text-xs font-semibold transition ${activeSection === secId ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-700'}`}
          onClick={e => { e.preventDefault(); onNavigate(secId) }}
        >
          <div className="flex items-center gap-x-3">
            <i className={`bx ${icon} text-lg ${activeSection === secId ? 'text-emerald-700' : 'text-slate-400 group-hover:text-emerald-600'}`}></i>
            {label}
          </div>
          {count > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-1 ring-white">
              {count}
            </span>
          )}
        </a>
      </li>
    )

  return (
    <aside className={`hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 shadow-sm z-50 transition-all duration-300 ${isCollapsed ? 'lg:-translate-x-full lg:opacity-0 lg:pointer-events-none' : 'lg:translate-x-0 lg:opacity-100'}`}>
      {/* Logo Section */}
      <div className="flex h-16 shrink-0 items-center px-6 gap-3 mt-4 mb-4">
        <div className="w-10 h-10 bg-white rounded-xl overflow-hidden shadow-sm relative">
          <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="absolute inset-0 w-full h-full object-contain p-1"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'block';
            }}
          />
          <i className='bx bx-spreadsheet text-2xl text-white hidden'></i>
        </div>
        <span className="font-bold text-lg text-slate-800 tracking-tight">OCSC Circular</span>
      </div>

      <nav className="flex flex-1 flex-col px-4 pb-4 overflow-y-auto custom-scrollbar">
        <ul className="flex flex-1 flex-col gap-y-2">
          {/* Main Section */}
          {navItem('sec-overview', 'ภาพรวมระบบ', 'bx-grid-alt', isSuperAdmin, 0)}
          {navItem('sec-circular', 'หนังสือเวียน', 'bx-file-blank', true, 0)}
          
          <li className="mt-2">
            <button
              className={`flex w-full items-center justify-between p-2 text-xs font-bold uppercase tracking-wider transition ${openInbox ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}
              onClick={() => setOpenInbox(!openInbox)}
            >
              <div className="flex items-center gap-2">
                <span>กล่องข้อความงาน</span>
                {(inboxCount + (isSuperAdmin ? 0 : actingCount)) > 0 && !openInbox && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                    {inboxCount + (isSuperAdmin ? 0 : actingCount)}
                  </span>
                )}
              </div>
              <i className={`bx bx-chevron-${openInbox ? 'down' : 'right'} text-lg`}></i>
            </button>
            {openInbox && (
              <ul className="mt-1 space-y-1 ml-2 border-l-2 border-slate-100 pl-2">
                {navItem('sec-workflow-inbox-inbox', 'Inbox', 'bx-task', true, inboxCount, true)}
                {navItem('sec-workflow-inbox-acting', 'Acting Inbox', 'bx-shield-quarter', !isSuperAdmin, actingCount, true)}
                {navItem('sec-workflow-inbox-tracking', 'งานที่ดำเนินการแล้ว', 'bx-send', true, trackingCount, true)}
              </ul>
            )}
          </li>

          {navItem('sec-bot-queue', 'คิวงานบอต', 'bx-bot', isSuperAdmin || role === 'SYSTEM_ADMIN' || role === 'COORDINATOR', 0)}
          {navItem('sec-simulator', 'เครื่องมือจำลอง Workflow', 'bx-tachometer', isSuperAdmin || role === 'SYSTEM_ADMIN' || role === 'COORDINATOR', 0)}
          
          <li>
            <a href="/bma_ocsc_circular/" className="group flex items-center gap-x-3 rounded-xl py-2.5 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-emerald-700 transition" target="_blank" rel="noreferrer">
              <i className="bx bx-globe text-lg text-slate-400 group-hover:text-emerald-600"></i>
              ระบบค้นหา
            </a>
          </li>

          {/* Master Data Section */}
          {isSuperAdmin && (
            <>
              <li className="mt-4">
                <button
                  className="flex w-full items-center justify-between p-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition"
                  onClick={() => setOpenMaster(!openMaster)}
                >
                  <span>ข้อมูลหลักระบบ</span>
                  <i className={`bx bx-chevron-${openMaster ? 'down' : 'right'} text-lg`}></i>
                </button>
                {openMaster && (
                  <ul className="mt-1 space-y-1 ml-2 border-l-2 border-slate-100 pl-2">
                    {masterTypes.map(t => navItem(`sec-master-${t.key}`, t.label, t.icon, true, 0, true))}
                  </ul>
                )}
              </li>

              <li className="mt-2">
                <button
                  className="flex w-full items-center justify-between p-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition"
                  onClick={() => setOpenManage(!openManage)}
                >
                  <span>จัดการระบบ</span>
                  <i className={`bx bx-chevron-${openManage ? 'down' : 'right'} text-lg`}></i>
                </button>
                {openManage && (
                  <ul className="mt-1 space-y-1 ml-2 border-l-2 border-slate-100 pl-2">
                    {navItem('sec-agency-structure', 'โครงสร้างส่วนราชการ', 'bx-sitemap', isSuperAdmin, 0, true)}
                    {navItem('sec-users', 'จัดการผู้ใช้งาน', 'bx-user-circle', isSuperAdmin, 0, true)}
                  </ul>
                )}
              </li>
            </>
          )}
        </ul>
      </nav>
      
      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-100 text-center">
        <span className="text-xs font-medium text-slate-400">v2.0 © 2025 ศูนย์สารสนเทศทรัพยากรบุคคล สำนักงาน ก.ก.</span>
      </div>
    </aside>
  )
}

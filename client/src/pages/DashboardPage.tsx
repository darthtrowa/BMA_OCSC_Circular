import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { adminApi } from '../api/apiService'
import Sidebar from '../components/admin/Sidebar'
import DashboardStats from '../components/admin/DashboardStats'
import CircularSection from '../components/admin/CircularSection'
import MasterDataSection from '../components/admin/MasterDataSection'
import UserSection from '../components/admin/UserSection'
import ProfileModal from '../components/admin/ProfileModal'
import PasswordModal from '../components/admin/PasswordModal'
import ExecutiveDashboard from '../components/admin/ExecutiveDashboard'
import BotQueueSection from '../components/admin/BotQueueSection'
import WorkflowInboxSection from '../components/admin/WorkflowInboxSection'
import AgencyTreeSection from '../components/admin/AgencyTreeSection'
import Swal from 'sweetalert2'

export default function DashboardPage() {
  const { admin, login, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = admin?.permiss === 'superadmin' || admin?.permiss === 'admin'
  const [activeSection, setActiveSection]     = useState(isAdmin ? 'sec-overview' : 'sec-circular')
  const [activeResultId, setActiveResultId]   = useState<string | number>('all')
  const [baseFilteredData, setBaseFilteredData] = useState<any>(null)  // ข้อมูลกรองจาก CircularSection
  const [allData, setAllData]                 = useState<any>(null)
  const [loading, setLoading]                 = useState(true)
  const profileRef  = useRef<any>(null)
  const passwordRef = useRef<any>(null)

  const [dropdownOpen, setDropdownOpen] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await adminApi.getDashboardData()
      if (data) {
        const lastItems = ["ไม่ระบุ", "*ไม่พิจารณา", "ไม่พิจารณา"];
        const sortList = (list, key) => {
          if (!list) return [];
          const top = list.filter(i => !lastItems.some(last => (i[key] || '').includes(last)));
          const bottom = list.filter(i => lastItems.some(last => (i[key] || '').includes(last)));
          return [...top, ...bottom];
        };
        data.results = sortList(data.results, 'results_detail');
        data.mati_kk = sortList(data.mati_kk, 'mkk_name');
        data.mati_work = sortList(data.mati_work, 'mw_name');
      }
      setAllData(data)
    } catch {
      Swal.fire('Error', 'โหลดข้อมูลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    loadData()
    syncProfile()
  }, [])

  // ── Sync Profile to ensure role is always up-to-date in AuthContext ──
  const syncProfile = async () => {
    try {
      const res = await adminApi.getProfile()
      if (res.status && res.response) {
        const dbRole = res.response.a_role || 'STAFF'
        // If the context role doesn't match the database, update the context immediately
        if (admin && admin.role !== dbRole) {
          login(admin.token, admin.name, admin.permiss, dbRole)
        }
      }
    } catch {}
  }

  // ปิด dropdown เมื่อคลิกที่อื่น
  useEffect(() => {
    const closeDropdown = () => setDropdownOpen(false)
    if (dropdownOpen) {
      window.addEventListener('click', closeDropdown)
    }
    return () => window.removeEventListener('click', closeDropdown)
  }, [dropdownOpen])

  const handleStatFilter = (resultId) => {
    setActiveSection('sec-circular')
    // toggle: ถ้ากด card เดิมซ้ำ → reset เป็น 'all'
    setActiveResultId(prev => (prev === resultId ? 'all' : resultId))
  }

  // รับค่าจาก dropdown ใน CircularSection แล้ว sync activeResultId
  // val = '' สำหรับ "ทั้งหมด" | 'ตัวเลข' เช่น '2', '4' เป็น string
  const handleFilterResultChange = (val) => {
    // เปลี่ยน activeResultId ให้ตรงกับ dropdown
    // initialResultId จะถูกส่งลงไปเป็นค่าเดิมที่ filterResult มีอยู่แล้ว → useEffectไม่ทำอะไร
    setActiveResultId(val === '' ? 'all' : Number(val))
  }

  const doLogout = () => {
    Swal.fire({
      title: 'ออกจากระบบ?', icon: 'warning',
      showCancelButton: true, confirmButtonText: 'ออกจากระบบ', cancelButtonText: 'ยกเลิก'
    }).then(r => {
      if (r.isConfirmed) { logout(); navigate('/admin/login') }
    })
  }

  const info = allData?.information || []
  const pendingTasksCount = info.filter((item: any) => Number(item.in_current_owner_id) === Number(admin?.id)).length

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-saochingcha text-slate-800">
      <Sidebar
        activeSection={activeSection}
        onNavigate={(sec) => { setActiveSection(sec); setActiveResultId('all') }}
        permiss={admin?.permiss}
        role={admin?.role}
        inboxCount={pendingTasksCount}
        onLogout={doLogout}
        onProfile={() => profileRef.current?.open()}
        onPassword={() => passwordRef.current?.open()}
      />
      
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden ml-0 lg:ml-64">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-end gap-x-4 border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <div className="relative">
            <button 
              className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-xl transition"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDropdownOpen(!dropdownOpen) }}
            >
              <i className='bx bx-user-circle text-2xl text-slate-500'></i>
              <div className="text-sm text-left">
                <span className="text-slate-500 block leading-none mb-1">สวัสดีคุณ</span>
                <span className="font-bold block leading-none">{admin?.name}</span>
              </div>
              {admin?.permiss === 'superadmin' ? (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full ml-2">SuperAdmin</span>
              ) : admin?.permiss === 'admin' ? (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full ml-2">ผู้ดูแลระบบ</span>
              ) : null}
              <i className='bx bx-chevron-down text-slate-400'></i>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">ข้อมูลผู้ใช้งาน</div>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button 
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition"
                    onClick={(e) => { e.preventDefault(); profileRef.current?.open(); setDropdownOpen(false) }}
                  >
                    <i className="bx bx-user text-lg"></i> โปรไฟล์
                  </button>
                  <button 
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition"
                    onClick={(e) => { e.preventDefault(); passwordRef.current?.open(); setDropdownOpen(false) }}
                  >
                    <i className="bx bx-lock-alt text-lg"></i> เปลี่ยนรหัสผ่าน
                  </button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button 
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition font-medium"
                    onClick={(e) => { e.preventDefault(); doLogout(); setDropdownOpen(false) }}
                  >
                    <i className="bx bx-power-off text-lg"></i> ออกจากระบบ
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {activeSection === 'sec-overview' && (
              <ExecutiveDashboard 
                allData={allData} 
                loading={loading} 
              />
            )}
            {activeSection !== 'sec-users' && activeSection !== 'sec-overview' && activeSection !== 'sec-bot-queue' && activeSection !== 'sec-workflow-inbox' && activeSection !== 'sec-agency-structure' && (
              <div className="mt-4">
                <DashboardStats
                  allData={allData}
                  loading={loading}
                  onFilter={handleStatFilter}
                  activeResultId={activeResultId}
                  baseFilteredData={baseFilteredData}
                />
              </div>
            )}
            {activeSection === 'sec-circular' && (
              <CircularSection
                allData={allData}
                loading={loading}
                onReload={loadData}
                initialResultId={activeResultId}
                onBaseFilteredChange={setBaseFilteredData}
                onFilterResultChange={handleFilterResultChange}
              />
            )}
            {activeSection === 'sec-bot-queue' && (
              <BotQueueSection allData={allData} />
            )}
            {activeSection === 'sec-workflow-inbox' && (
              <WorkflowInboxSection
                allData={allData}
                loading={loading}
                onReload={loadData}
              />
            )}
            {activeSection.startsWith('sec-master-') && (
              <MasterDataSection
                type={activeSection.replace('sec-master-', '')}
                allData={allData}
                onReload={loadData}
              />
            )}
            {activeSection === 'sec-users' && (
              <UserSection permiss={admin?.permiss} />
            )}
            {activeSection === 'sec-agency-structure' && (
              <AgencyTreeSection />
            )}
          </div>
        </main>
      </div>

      <ProfileModal ref={profileRef} />
      <PasswordModal ref={passwordRef} />
    </div>
  )
}

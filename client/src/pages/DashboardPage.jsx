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
import Swal from 'sweetalert2'

import UserStats from '../components/admin/UserStats'

export default function DashboardPage() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection]     = useState('sec-circular')
  const [activeResultId, setActiveResultId]   = useState('all')
  const [baseFilteredData, setBaseFilteredData] = useState(null)  // ข้อมูลกรองจาก CircularSection
  const [allData, setAllData]                 = useState(null)
  const [users, setUsers]                     = useState([])
  const [loading, setLoading]                 = useState(true)
  const [usersLoading, setUsersLoading]       = useState(false)
  const profileRef  = useRef()
  const passwordRef = useRef()

  const [dropdownOpen, setDropdownOpen] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await adminApi.getDashboardData()
      setAllData(data)
      
      // ถ้าเป็น superadmin ให้โหลดข้อมูลผู้ใช้งานด้วย
      if (admin?.permiss === 'superadmin') {
        setUsersLoading(true)
        const userData = await adminApi.getUsers()
        if (userData.status) setUsers(userData.response)
        setUsersLoading(false)
      }
    } catch {
      Swal.fire('Error', 'โหลดข้อมูลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

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

  return (
    <div className="layout-wrapper layout-content-navbar admin-layout">
      <div className="layout-container">
        <Sidebar
          activeSection={activeSection}
          onNavigate={(sec) => { setActiveSection(sec); setActiveResultId('all') }}
          permiss={admin?.permiss}
          onLogout={doLogout}
          onProfile={() => profileRef.current?.open()}
          onPassword={() => passwordRef.current?.open()}
        />
        <div className="layout-page">
          <nav className="layout-navbar container-xxl navbar navbar-expand-xl navbar-detached align-items-center bg-navbar-theme">
            <div className="navbar-nav-right d-flex align-items-center w-100" id="navbar-collapse">
              {/* Right Side Only: Move Welcome Text here and attach Dropdown */}
              <ul className="navbar-nav flex-row align-items-center ms-auto">
                <li className={`nav-item navbar-dropdown dropdown-user dropdown ${dropdownOpen ? 'show' : ''}`}>
                  <a className="nav-link dropdown-toggle hide-arrow p-0 d-flex align-items-center" href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDropdownOpen(!dropdownOpen) }}>
                    <span className="text-muted">
                      <i className='bx bx-user-circle me-1'></i>
                      สวัสดีคุณ <strong>{admin?.name}</strong>
                      {admin?.permiss === 'superadmin' && (
                        <span className="badge bg-danger ms-2">SuperAdmin</span>
                      )}
                    </span>
                  </a>
                  <ul className={`dropdown-menu dropdown-menu-end ${dropdownOpen ? 'show' : ''}`} style={{ position: 'absolute', right: 0, top: '100%', display: dropdownOpen ? 'block' : 'none', minWidth: '200px' }}>
                    <li>
                      <div className="dropdown-header">ข้อมูลผู้ใช้งาน</div>
                    </li>
                    <li><div className="dropdown-divider"></div></li>
                    <li>
                      <a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); profileRef.current?.open() }}>
                        <i className="bx bx-user me-2"></i>
                        <span className="align-middle">โปรไฟล์</span>
                      </a>
                    </li>
                    <li>
                      <a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); passwordRef.current?.open() }}>
                        <i className="bx bx-lock-alt me-2"></i>
                        <span className="align-middle">เปลี่ยนรหัสผ่าน</span>
                      </a>
                    </li>
                    <li><div className="dropdown-divider"></div></li>
                    <li>
                      <a className="dropdown-item text-danger" href="#" onClick={(e) => { e.preventDefault(); doLogout() }}>
                        <i className="bx bx-power-off me-2"></i>
                        <span className="align-middle">ออกจากระบบ</span>
                      </a>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </nav>
          <div className="content-wrapper">
            <div className="container-xxl flex-grow-1 container-p-y">
              {activeSection === 'sec-users' ? (
                <UserStats users={users} loading={usersLoading} />
              ) : (
                <DashboardStats
                  allData={allData}
                  loading={loading}
                  onFilter={handleStatFilter}
                  activeResultId={activeResultId}
                  baseFilteredData={baseFilteredData}
                />
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
              {activeSection.startsWith('sec-master-') && (
                <MasterDataSection
                  type={activeSection.replace('sec-master-', '')}
                  allData={allData}
                  onReload={loadData}
                />
              )}
              {activeSection === 'sec-users' && (
                <UserSection users={users} loading={usersLoading} />
              )}
            </div>
          </div>
        </div>
      </div>
      <ProfileModal ref={profileRef} onUpdated={() => {}} />
      <PasswordModal ref={passwordRef} />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { adminApi, agencyApi } from '../../api/apiService'
import Swal from 'sweetalert2'
import moment from 'moment/min/moment-with-locales'
import { useAuth } from '../../contexts/AuthContext'
moment.locale('th')

export default function UserSection({ permiss }) {
  const [users, setUsers] = useState([])
  const [agencies, setAgencies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  
  const [formData, setFormData] = useState({
    a_name: '',
    a_username: '',
    a_email: '',
    a_password: '',
    a_permiss: 'user',
    a_role: 'STAFF',
    a_position: '',
    a_status: '1',
    a_agency: '',
    a_agency_id: ''
  })

  useEffect(() => {
    loadUsers()
    loadAgencies()
  }, [])

  const loadAgencies = async () => {
    try {
      const flatData = await agencyApi.getTree()
      if (!flatData) return setAgencies([])

      // 1. สร้าง Tree เพื่อจัดกลุ่มและเรียงตาม agency_ordering
      const map = new Map<number, any>()
      flatData.forEach((n: any) => map.set(n.ag_id, { ...n, children: [] }))
      const roots: any[] = []
      
      map.forEach(n => {
        if (n.parent_ag_id && map.has(n.parent_ag_id)) {
          map.get(n.parent_ag_id)!.children!.push(n)
        } else {
          roots.push(n)
        }
      })

      roots.sort((a, b) => (a.agency_ordering || 0) - (b.agency_ordering || 0))
      map.forEach(n => n.children!.sort((a, b) => (a.agency_ordering || 0) - (b.agency_ordering || 0)))

      // 2. แปลงกลับเป็น Flat List พร้อมตัดตัวที่ status ไม่ใช่ active ออก
      const flatten = (nodes: any[], currentLevel = 1): any[] => {
        let result: any[] = []
        nodes.forEach(n => {
          if (n.ag_status === 'active') {
            result.push({ ...n, ag_level: currentLevel })
            if (n.children && n.children.length > 0) {
              result = result.concat(flatten(n.children, currentLevel + 1))
            }
          }
        })
        return result
      }
      
      const orderedActiveAgencies = flatten(roots)
      setAgencies(orderedActiveAgencies)
    } catch (err) {
      console.error('Error loading agencies:', err)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await adminApi.getUsers()
      setUsers(data || [])
    } catch (err) {
      console.error(err)
      Swal.fire('Error', 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        a_name: user.a_name || '',
        a_username: user.a_username || '',
        a_email: user.a_email || '',
        a_password: '',
        a_permiss: user.a_permiss || 'user',
        a_role: user.a_role || 'STAFF',
        a_position: user.a_position || '',
        a_status: user.a_status || '1',
        a_agency: user.a_agency || '',
        a_agency_id: user.a_agency_id ? String(user.a_agency_id) : ''
      })
    } else {
      setEditingUser(null)
      setFormData({
        a_name: '',
        a_username: '',
        a_email: '',
        a_password: '',
        a_permiss: 'user',
        a_role: 'STAFF',
        a_position: '',
        a_status: '1',
        a_agency: '',
        a_agency_id: ''
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!formData.a_name || !formData.a_username) {
      return Swal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning')
    }
    if (!editingUser && !formData.a_password) {
      return Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสผ่านสำหรับผู้ใช้ใหม่', 'warning')
    }

    setSaving(true)
    try {
      if (editingUser) {
        await adminApi.updateUser(editingUser.a_id, formData)
        Swal.fire({ title: 'สำเร็จ', text: 'แก้ไขข้อมูลผู้ใช้เรียบร้อยแล้ว', icon: 'success', timer: 1500 })
      } else {
        await adminApi.createUser(formData)
        Swal.fire({ title: 'สำเร็จ', text: 'เพิ่มผู้ใช้งานใหม่เรียบร้อยแล้ว', icon: 'success', timer: 1500 })
      }
      setShowModal(false)
      await loadUsers() // รอให้โหลดข้อมูลใหม่เสร็จก่อน
    } catch (err) {
      console.error(err)
      Swal.fire('Error', 'บันทึกข้อมูลไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (user) => {
    if (user.a_permiss === 'superadmin') {
      return Swal.fire('แจ้งเตือน', 'ไม่สามารถลบ Super Admin ได้', 'error')
    }

    Swal.fire({
      title: 'ยืนยันการลบ?',
      text: `ต้องการลบผู้ใช้งาน ${user.a_name} ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await adminApi.deleteUser(user.a_id)
          Swal.fire('ลบแล้ว!', 'ลบผู้ใช้งานเรียบร้อยแล้ว', 'success')
          loadUsers()
        } catch (err) {
          console.error(err)
          Swal.fire('Error', 'ไม่สามารถลบข้อมูลได้', 'error')
        }
      }
    })
  }



  return (
    <div className="bg-white rounded-3xl shadow-sm mb-8 overflow-hidden animate__animated animate__fadeIn">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h5 className="m-0 font-bold text-lg text-slate-800 flex items-center font-saochingcha">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mr-3">
            <i className='bx bx-user-circle text-xl'></i>
          </div>
          จัดการผู้ใช้งาน
        </h5>
        <button
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
          onClick={() => handleOpenModal()}
        >
          <i className='bx bx-plus text-lg'></i> เพิ่มผู้ใช้งาน
        </button>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse min-w-max">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold w-16">#</th>
              <th className="px-6 py-4 font-semibold">ชื่อ-นามสกุล</th>
              <th className="px-6 py-4 font-semibold">สังกัด</th>
              <th className="px-6 py-4 font-semibold">Username</th>
              <th className="px-6 py-4 font-semibold">สิทธิ์</th>
              <th className="px-6 py-4 font-semibold">สถานะ</th>
              <th className="px-6 py-4 font-semibold">ล็อกอินล่าสุด</th>
              <th className="px-6 py-4 font-semibold text-right w-32">จัดการ</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-20">
                  <i className='bx bx-loader-alt animate-spin text-4xl text-emerald-600'></i>
                  <p className="text-slate-500 font-medium mt-4">กำลังโหลดข้อมูล...</p>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400">ไม่พบข้อมูลผู้ใช้งาน</td></tr>
            ) : (
              users.map((u: any, i: number) => (
                <tr key={u.a_id} className="hover:bg-slate-50 border-b border-slate-100 transition last:border-0">
                  <td className="px-6 py-4 text-slate-400">{i + 1}</td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-800">{u.a_name}</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">{u.a_position || 'ไม่ระบุตำแหน่ง'}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{u.a_agency || <span className="text-slate-400">-</span>}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded font-mono text-[11px] block w-fit mb-1">{u.a_username}</span>
                    <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{u.a_email || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full w-fit ${u.a_permiss === 'superadmin' ? 'bg-rose-100 text-rose-700' :
                        u.a_permiss === 'admin' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                        {u.a_permiss === 'superadmin' ? 'SUPERADMIN' : u.a_permiss === 'admin' ? 'ADMIN' : 'USER'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.a_status === '1' || u.a_status === 'true' ?
                      <span className="flex items-center text-emerald-600 text-xs font-bold"><i className='bx bxs-check-circle text-base mr-1'></i>ปกติ</span> :
                      <span className="flex items-center text-rose-600 text-xs font-bold"><i className='bx bxs-x-circle text-base mr-1'></i>ระงับ</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {u.a_last_login ? moment(u.a_last_login).locale('th').add(543, 'year').format('DD MMM YY HH:mm') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 transition flex items-center justify-center"
                        title="แก้ไข"
                        onClick={() => handleOpenModal(u)}
                      >
                        <i className='bx bx-edit-alt text-lg'></i>
                      </button>

                      {u.a_permiss !== 'superadmin' && (
                        <button
                          className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition flex items-center justify-center"
                          title="ลบ"
                          onClick={() => handleDelete(u)}
                        >
                          <i className='bx bx-trash text-lg'></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sidebar เพิ่ม/แก้ไข */}
      {showModal && createPortal(
        <>
          <div className="fixed inset-0 z-[299] bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="fixed right-0 top-0 h-full z-[300] w-full max-w-xl flex flex-col bg-slate-50 shadow-2xl animate__animated animate__slideInRight animate__faster">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <i className={`bx ${editingUser ? 'bx-edit' : 'bx-user-plus'} text-xl`}></i>
                </div>
                <div>
                  <h5 className="m-0 font-bold text-slate-800 text-base leading-tight">
                    {editingUser ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้งานใหม่'}
                  </h5>
                  <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                    {editingUser ? 'จัดการข้อมูลบัญชีและสิทธิ์การใช้งาน' : 'เพิ่มบัญชีผู้ใช้งานใหม่เข้าสู่ระบบ'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition"
                onClick={() => setShowModal(false)}
              >
                <i className='bx bx-x text-xl'></i>
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
              <form id="userForm" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    value={formData.a_name}
                    onChange={e => setFormData({ ...formData, a_name: e.target.value })}
                    required
                    placeholder="เช่น นายสมชาย ใจดี"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อผู้ใช้ (Username)</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      value={formData.a_username}
                      onChange={e => setFormData({ ...formData, a_username: e.target.value })}
                      required
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">อีเมล (สำหรับ 2FA)</label>
                    <input
                      type="email"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      value={formData.a_email}
                      onChange={e => setFormData({ ...formData, a_email: e.target.value })}
                      placeholder="example@bma.go.th"
                    />
                  </div>
                </div>



                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    รหัสผ่าน {editingUser && <span className="text-emerald-600 text-xs font-normal ml-2">(ปล่อยว่างถ้าไม่ต้องการเปลี่ยน)</span>}
                  </label>
                  <input
                    type="password"
                    name="new-password"
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    value={formData.a_password}
                    onChange={e => setFormData({ ...formData, a_password: e.target.value })}
                    required={!editingUser}
                  />
                </div>




                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">สิทธิ์การเข้าระบบ (Security)</label>
                    <select
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none"
                      value={formData.a_permiss}
                      onChange={e => setFormData({ ...formData, a_permiss: e.target.value })}
                    >
                      <option value="user">เจ้าหน้าที่ทั่วไป (Staff User)</option>
                      <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                      {permiss === 'superadmin' && (
                        <option value="superadmin">ผู้ดูแลระบบสูงสุด (Superadmin)</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">สถานะ</label>
                    <select
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none"
                      value={formData.a_status}
                      onChange={e => setFormData({ ...formData, a_status: e.target.value })}
                    >
                      <option value="1">ปกติ (Active)</option>
                      <option value="0">ระงับ (Disabled)</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
                onClick={() => setShowModal(false)}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="userForm"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><i className='bx bx-loader-alt animate-spin text-lg'></i> กำลังบันทึก...</>
                ) : (
                  <><i className='bx bx-save text-lg'></i> บันทึกข้อมูล</>
                )}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}


    </div>
  )
}

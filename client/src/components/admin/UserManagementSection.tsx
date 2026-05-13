import { useState, useEffect } from 'react'
import { adminApi } from '../../api/apiService'
import Swal from 'sweetalert2'
import moment from 'moment/min/moment-with-locales'
moment.locale('th')

export default function UserManagementSection() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  
  const [formData, setFormData] = useState({
    a_name: '',
    a_username: '',
    a_password: '',
    a_permiss: 'user',
    a_status: '1'
  })

  useEffect(() => {
    loadUsers()
  }, [])

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
        a_password: '', // ไม่แสดงรหัสเดิม
        a_permiss: user.a_permiss || 'user',
        a_status: user.a_status || '1'
      })
    } else {
      setEditingUser(null)
      setFormData({
        a_name: '',
        a_username: '',
        a_password: '',
        a_permiss: 'user',
        a_status: '1'
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

    try {
      if (editingUser) {
        await adminApi.updateUser(editingUser.a_id, formData)
        Swal.fire('สำเร็จ', 'แก้ไขข้อมูลผู้ใช้เรียบร้อยแล้ว', 'success')
      } else {
        await adminApi.createUser(formData)
        Swal.fire('สำเร็จ', 'เพิ่มผู้ใช้งานใหม่เรียบร้อยแล้ว', 'success')
      }
      setShowModal(false)
      loadUsers()
    } catch (err) {
      console.error(err)
      Swal.fire('Error', 'บันทึกข้อมูลไม่สำเร็จ', 'error')
    }
  }

  const handleDelete = (user) => {
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
    <div className="card border-0 shadow-sm animate__animated animate__fadeIn">
      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
        <h5 className="mb-0 fw-bold text-primary">
          <i className='bx bx-user-circle me-2'></i>จัดการผู้ใช้งาน
        </h5>
        <button className="btn btn-primary btn-sm" onClick={() => handleOpenModal()}>
          <i className='bx bx-plus me-1'></i>เพิ่มผู้ใช้งาน
        </button>
      </div>
      
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>ชื่อ-นามสกุล</th>
                <th>Username</th>
                <th>สิทธิ์</th>
                <th>สถานะ</th>
                <th>ล็อกอินล่าสุด</th>
                <th className="text-center" style={{ width: 150 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-4">กำลังโหลด...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-muted">ไม่พบข้อมูลผู้ใช้งาน</td></tr>
              ) : (
                users.map((u, i) => (
                  <tr key={u.a_id}>
                    <td>{u.a_id}</td>
                    <td><span className="fw-semibold">{u.a_name}</span></td>
                    <td><code>{u.a_username}</code></td>
                    <td>
                      <span className={`badge ${u.a_permiss === 'admin' ? 'bg-danger' : 'bg-info'}`}>
                        {u.a_permiss === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่'}
                      </span>
                    </td>
                    <td>
                      {u.a_status === '1' ? 
                        <span className="text-success"><i className='bx bxs-check-circle me-1'></i>ปกติ</span> : 
                        <span className="text-danger"><i className='bx bxs-x-circle me-1'></i>ระงับ</span>
                      }
                    </td>
                    <td className="small text-muted">
                      {u.a_last_login ? moment(u.a_last_login).add(543, 'year').format('DD MMM YY HH:mm') : '-'}
                    </td>
                    <td className="text-center">
                      <button className="btn btn-sm btn-outline-warning me-1" onClick={() => handleOpenModal(u)}>
                        <i className='bx bx-edit-alt'></i>
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(u)}>
                        <i className='bx bx-trash'></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal เพิ่ม/แก้ไข */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {editingUser ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้งานใหม่'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">ชื่อ-นามสกุล</label>
                    <input type="text" className="form-control" 
                      value={formData.a_name} 
                      onChange={e => setFormData({...formData, a_name: e.target.value})}
                      required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">ชื่อผู้ใช้ (Username)</label>
                    <input type="text" className="form-control" 
                      value={formData.a_username} 
                      onChange={e => setFormData({...formData, a_username: e.target.value})}
                      required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      รหัสผ่าน {editingUser && <span className="text-muted">(ปล่อยว่างถ้าไม่ต้องการเปลี่ยน)</span>}
                    </label>
                    <input type="password" name="new-password" placeholder="••••••••" className="form-control" 
                      value={formData.a_password} 
                      onChange={e => setFormData({...formData, a_password: e.target.value})}
                      required={!editingUser} />
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label small fw-bold">สิทธิ์การใช้งาน</label>
                      <select className="form-select" 
                        value={formData.a_permiss}
                        onChange={e => setFormData({...formData, a_permiss: e.target.value})}>
                        <option value="user">เจ้าหน้าที่ (User)</option>
                        <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label small fw-bold">สถานะ</label>
                      <select className="form-select" 
                        value={formData.a_status}
                        onChange={e => setFormData({...formData, a_status: e.target.value})}>
                        <option value="1">ปกติ (Active)</option>
                        <option value="0">ระงับ (Disabled)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light border-0">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                  <button type="submit" className="btn btn-primary px-4">บันทึกข้อมูล</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useImperativeHandle, forwardRef } from 'react'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'
import { useAuth } from '../../contexts/AuthContext'

const ProfileModal = forwardRef(({ onUpdated }, ref) => {
  const { admin } = useAuth()
  const [show, setShow]       = useState(false)
  const [name, setName]       = useState('')
  const [profile, setProfile] = useState(null)
  const [saving, setSaving]   = useState(false)

  useImperativeHandle(ref, () => ({
    open: () => {
      loadProfile()
      setShow(true)
    }
  }))

  const loadProfile = async () => {
    try {
      const data = await adminApi.getProfile()
      if (data.status) {
        setProfile(data.response)
        setName(data.response.a_name || '')
      }
    } catch {}
  }

  const handleSave = async () => {
    if (!name.trim()) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกชื่อ' })
    setSaving(true)
    try {
      const data = await adminApi.updateProfile(name.trim())
      if (data.status) {
        setShow(false)
        Swal.fire({ icon: 'success', text: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false })
        onUpdated && onUpdated(name.trim())
      } else {
        Swal.fire('ผิดพลาด', data.message, 'error')
      }
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!show) return null

  return (
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title"><i className='bx bx-user me-2'></i>โปรไฟล์ของฉัน</h5>
            <button className="btn-close" onClick={() => setShow(false)} />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label fw-semibold">ชื่อ <span className="text-danger">*</span></label>
              <input className="form-control" value={name} onChange={e=>setName(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">ชื่อผู้ใช้งาน</label>
              <input className="form-control" value={profile?.a_username||''} disabled />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">สิทธิ์การใช้งาน</label>
              <input className="form-control" value={profile?.a_permiss==='superadmin'?'SuperAdmin':'Admin'} disabled />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShow(false)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-2"/>กำลังบันทึก...</> : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
ProfileModal.displayName = 'ProfileModal'
export default ProfileModal

import { useState, useImperativeHandle, forwardRef } from 'react'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'

const PasswordModal = forwardRef((_, ref) => {
  const [show, setShow]     = useState(false)
  const [form, setForm]     = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)

  useImperativeHandle(ref, () => ({ open: () => { setForm({ old_password:'', new_password:'', confirm_password:'' }); setShow(true) } }))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.old_password || !form.new_password || !form.confirm_password)
      return Swal.fire({ icon: 'warning', text: 'กรุณากรอกข้อมูลให้ครบ' })
    if (form.new_password !== form.confirm_password)
      return Swal.fire({ icon: 'warning', text: 'รหัสผ่านใหม่ไม่ตรงกัน' })
    if (form.new_password.length < 6)
      return Swal.fire({ icon: 'warning', text: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' })
    setSaving(true)
    try {
      const data = await adminApi.changePassword(form)
      if (data.status) {
        setShow(false)
        Swal.fire({ icon: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จ', timer: 1500, showConfirmButton: false })
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
            <h5 className="modal-title"><i className='bx bx-lock-alt me-2'></i>เปลี่ยนรหัสผ่าน</h5>
            <button className="btn-close" onClick={() => setShow(false)} />
          </div>
          <div className="modal-body">
            {['old_password','new_password','confirm_password'].map(k=>(
              <div key={k} className="mb-3">
                <label className="form-label fw-semibold">
                  {k==='old_password'?'รหัสผ่านเดิม':k==='new_password'?'รหัสผ่านใหม่':'ยืนยันรหัสผ่านใหม่'}
                  <span className="text-danger"> *</span>
                </label>
                <input type="password" className="form-control" value={form[k]} onChange={e=>set(k,e.target.value)} />
              </div>
            ))}
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
PasswordModal.displayName = 'PasswordModal'
export default PasswordModal

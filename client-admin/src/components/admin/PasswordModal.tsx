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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate__animated animate__fadeIn animate__faster">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate__animated animate__zoomIn animate__faster">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h5 className="m-0 font-bold text-lg text-slate-800 flex items-center font-saochingcha">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mr-3">
              <i className='bx bx-lock-alt text-xl'></i>
            </div>
            เปลี่ยนรหัสผ่าน
          </h5>
          <button 
            type="button" 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition" 
            onClick={() => setShow(false)}
          >
            <i className='bx bx-x text-xl'></i>
          </button>
        </div>
        <div className="p-6 space-y-5">
          {['old_password','new_password','confirm_password'].map(k=>(
            <div key={k}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {k==='old_password'?'รหัสผ่านเดิม':k==='new_password'?'รหัสผ่านใหม่':'ยืนยันรหัสผ่านใหม่'}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <input 
                type="password" 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                value={form[k as keyof typeof form]} 
                onChange={e=>set(k,e.target.value)} 
              />
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button 
            className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition" 
            onClick={() => setShow(false)}
          >
            ยกเลิก
          </button>
          <button 
            className="px-5 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? (
              <><i className='bx bx-loader-alt animate-spin text-lg'></i>กำลังบันทึก...</>
            ) : (
              <><i className='bx bx-save text-lg'></i>บันทึก</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
})
PasswordModal.displayName = 'PasswordModal'
export default PasswordModal

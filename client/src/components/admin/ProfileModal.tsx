import { forwardRef, useImperativeHandle, useState } from 'react'
import { adminApi } from '../../api/apiService'
import { useAuth } from '../../contexts/AuthContext'
import Swal from 'sweetalert2'

interface ProfileModalProps {
  onUpdated?: (newName: string) => void;
}

interface ProfileData {
  a_username?: string;
  a_permiss?: string;
  a_2fa_enabled?: boolean;
}

const ProfileModal = forwardRef<{ open: () => void }, ProfileModalProps>(({ onUpdated }, ref) => {
  useAuth() // Access context for side effects if needed
  const [show, setShow]       = useState(false)
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [role, setRole]       = useState('STAFF')
  const [position, setPosition] = useState('')
  const [profile, setProfile] = useState<ProfileData | null>(null)
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
        setEmail(data.response.a_email || '')
        setRole(data.response.a_role || 'STAFF')
        setPosition(data.response.a_position || '')
      }
    } catch {}
  }

  const handleSave = async () => {
    if (!name.trim()) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกชื่อ' })
    setSaving(true)
    try {
      const data = await adminApi.updateProfile(name.trim(), email.trim(), role, position)
      if (data.status) {
        setShow(false)
        Swal.fire({ icon: 'success', text: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false })
        onUpdated && onUpdated(name.trim())
      } else {
        Swal.fire('ผิดพลาด', data.message, 'error')
      }
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      Swal.fire('ผิดพลาด', apiMsg || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate__animated animate__fadeIn animate__faster">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col animate__animated animate__zoomIn animate__faster">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h5 className="m-0 font-bold text-lg text-slate-800 flex items-center font-saochingcha">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mr-3">
              <i className='bx bx-user text-xl'></i>
            </div>
            โปรไฟล์ของฉัน
          </h5>
          <button 
            type="button" 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition" 
            onClick={() => setShow(false)}
          >
            <i className='bx bx-x text-xl'></i>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {/* Row 1 */}
            <div>
              <label htmlFor="profile_name" className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อ-นามสกุล <span className="text-rose-500">*</span></label>
              <input 
                id="profile_name"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                value={name} 
                onChange={e=>setName(e.target.value)} 
                placeholder="ระบุชื่อและนามสกุล"
              />
            </div>
            <div>
              <label htmlFor="profile_email" className="block text-sm font-semibold text-slate-700 mb-1.5">อีเมล (Email)</label>
              <input 
                id="profile_email"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                value={email} 
                onChange={e=>setEmail(e.target.value)} 
                placeholder="example@bma.go.th"
              />
            </div>

            {/* Row 2 */}
            <div>
              <label htmlFor="profile_role" className="block text-sm font-semibold text-slate-700 mb-1.5">บทบาทในสายงาน (Workflow Role)</label>
              <div className="relative">
                <select
                  id="profile_role"
                  className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-bold text-blue-800 transition"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                >
                  <option value="HR_DIRECTOR">ผอ. ควบคุมการพิจารณาหนังสือเวียน (HR_DIRECTOR)</option>
                  <option value="DIV_DIRECTOR">ผอ. กองที่พิจารณาหนังสือเวียน (DIV_DIRECTOR)</option>
                  <option value="SEC_DIRECTOR">ผอ. ส่วนภายใต้กอง (SEC_DIRECTOR)</option>
                  <option value="GRP_LEADER">หัวหน้าฝ่าย/กลุ่มงาน (GRP_LEADER)</option>
                  <option value="STAFF">เจ้าหน้าที่พิจารณาหนังสือเวียน (STAFF)</option>
                  <option value="COORDINATOR">เจ้าหน้าที่ประสานงาน (COORDINATOR)</option>
                  <option value="SYSTEM_ADMIN">ผู้ดูแลระบบ/กำหนดสิทธิ์ (SYSTEM_ADMIN)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-blue-500">
                  <i className='bx bx-chevron-down text-lg'></i>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="profile_position" className="block text-sm font-semibold text-slate-700 mb-1.5">ตำแหน่งทางการ (Official Position)</label>
              <input 
                id="profile_position"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                value={position} 
                onChange={e=>setPosition(e.target.value)} 
                placeholder="เช่น นักทรัพยากรบุคคลปฏิบัติการ"
              />
            </div>

            {/* Row 3 - Read Only Info */}
            <div>
              <label htmlFor="profile_username" className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อผู้ใช้งาน (Username)</label>
              <div id="profile_username" className="flex items-center px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500">
                <i className='bx bx-lock-alt mr-2'></i>
                {profile?.a_username || '-'}
              </div>
            </div>
            <div>
              <label htmlFor="profile_permiss" className="block text-sm font-semibold text-slate-700 mb-1.5">ระดับสิทธิ์ (Permission Level)</label>
              <div id="profile_permiss" className="flex items-center px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500">
                <i className='bx bx-shield-alt-2 mr-2'></i>
                {profile?.a_permiss === 'superadmin' ? 'ผู้ดูแลระบบสูงสุด (SuperAdmin)' :                  profile?.a_permiss === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 
                  'ผู้ใช้งานทั่วไป (User)'}
              </div>
            </div>

            {/* Row 4 - 2FA Security Section */}
            <div className="md:col-span-2 pt-2">
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                    <i className='bx bx-shield-quarter text-xl'></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900 m-0 leading-none mb-1">ยืนยันตัวตน 2 ชั้น (2FA)</p>
                    <p className="text-[10px] text-emerald-600 m-0">เพิ่มความปลอดภัยด้วยรหัส OTP ทางอีเมลเมื่อเข้าสู่ระบบ</p>
                  </div>
                </div>
                <div className="form-check form-switch m-0">
                  <input 
                    id="toggle_2fa"
                    className="form-check-input h-6 w-11 cursor-pointer" 
                    type="checkbox" 
                    role="switch"
                    aria-checked={profile?.a_2fa_enabled || false}
                    aria-label="เปิด/ปิด ยืนยันตัวตน 2 ชั้น (2FA)"
                    checked={profile?.a_2fa_enabled || false}
                    onChange={async (e) => {
                      const newVal = e.target.checked
                      try {
                        const res = await adminApi.toggle2fa(newVal)
                        if (res.status) {
                          setProfile({ ...profile, a_2fa_enabled: newVal })
                          Swal.fire({ icon: 'success', text: res.message, timer: 1500, showConfirmButton: false })
                        }
                      } catch (err: unknown) {
                        const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                        Swal.fire('Error', apiMsg || 'ไม่สามารถเปลี่ยนสถานะได้', 'error')
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button 
            type="button"
            className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition" 
            onClick={() => setShow(false)}
          >
            ยกเลิก
          </button>
          <button 
            type="button"
            className="px-6 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? (
              <><i className='bx bx-loader-alt animate-spin text-lg'></i>กำลังบันทึก...</>
            ) : (
              <><i className='bx bx-save text-lg'></i>บันทึกข้อมูล</>
            )}
          </button>
        </div>

      </div>
    </div>
  )
})
ProfileModal.displayName = 'ProfileModal'
export default ProfileModal

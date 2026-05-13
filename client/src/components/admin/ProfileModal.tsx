import { useState, useImperativeHandle, forwardRef } from 'react'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'
import { useAuth } from '../../contexts/AuthContext'

interface ProfileModalProps {
  onUpdated?: (newName: string) => void;
}

const ProfileModal = forwardRef<any, ProfileModalProps>(({ onUpdated }, ref) => {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate__animated animate__fadeIn animate__faster">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate__animated animate__zoomIn animate__faster">
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
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อ <span className="text-rose-500">*</span></label>
            <input 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
              value={name} 
              onChange={e=>setName(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อผู้ใช้งาน</label>
            <input 
              className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed" 
              value={profile?.a_username||''} 
              disabled 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">สิทธิ์การใช้งาน</label>
            <input 
              className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed" 
              value={profile?.a_permiss==='superadmin'?'SuperAdmin':'Admin'} 
              disabled 
            />
          </div>
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
ProfileModal.displayName = 'ProfileModal'
export default ProfileModal

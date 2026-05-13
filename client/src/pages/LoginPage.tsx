import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { useAuth } from '../contexts/AuthContext'
import { adminApi } from '../api/apiService'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ loginUsername: '', loginPassword: '' })
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.loginUsername.trim()) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกชื่อผู้ใช้งาน' })
    if (!form.loginPassword) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกรหัสผ่าน' })
    setLoading(true)
    try {
      const result = await adminApi.login(form.loginUsername, form.loginPassword)
      if (result.status) {
        const { token, name, permiss } = result.response
        login(token, name, permiss)
        Swal.fire({ icon: 'success', text: `สวัสดีคุณ ${name}`, timer: 1500, showConfirmButton: false })
        setTimeout(() => navigate('/admin/dashboard'), 1600)
      } else {
        Swal.fire({ icon: 'error', text: result.message })
      }
    } catch (err) {
      Swal.fire({ icon: 'error', text: err.response?.data?.message || 'เกิดข้อผิดพลาด' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-saochingcha p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900 via-emerald-800 to-teal-900"></div>

      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-emerald-700 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative w-full max-w-md z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20">
          {/* Header */}
          <div className="bg-emerald-800 text-white text-center py-8 px-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
                <i className='bx bx-building-house text-4xl text-white'></i>
              </div>
              <h4 className="text-2xl font-bold mb-1 tracking-tight">OCSC Circular</h4>
              <p className="text-emerald-100/80 text-sm m-0">ระบบบริหารผลการพิจารณาหนังสือเวียนของสำนักงาน ก.พ.</p>
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            <h5 className="text-center text-slate-500 font-semibold mb-6">เข้าสู่ระบบผู้ดูแล</h5>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="loginUsername">
                  ชื่อผู้ใช้งาน
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className='bx bx-user text-slate-400 text-lg'></i>
                  </div>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    id="loginUsername"
                    name="loginUsername"
                    placeholder="กรอกชื่อผู้ใช้งาน..."
                    value={form.loginUsername}
                    onChange={handleChange}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="loginPassword">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className='bx bx-lock text-slate-400 text-lg'></i>
                  </div>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    id="loginPassword"
                    name="loginPassword"
                    placeholder="กรอกรหัสผ่าน..."
                    value={form.loginPassword}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-emerald-600 transition focus:outline-none"
                    onClick={() => setShowPwd(!showPwd)}
                    tabIndex={-1}
                  >
                    <i className={`bx ${showPwd ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                disabled={loading}
              >
                {loading ? (
                  <><i className='bx bx-loader-alt animate-spin text-xl'></i>กำลังตรวจสอบ...</>
                ) : (
                  <><i className='bx bx-log-in text-xl'></i>เข้าสู่ระบบ</>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <p className="text-center text-slate-500 text-xs font-medium m-0 flex items-center justify-center gap-1.5">
                <i className='bx bx-shield-check text-emerald-500 text-lg'></i>
                เข้าสู่ระบบเฉพาะผู้ได้รับอนุญาตเท่านั้น
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-emerald-100/60 mt-6 text-xs font-medium">
          © {new Date().getFullYear()} สำนักงาน ก.ก.
        </p>
      </div>
    </div>
  )
}

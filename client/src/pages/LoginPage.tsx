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

  // ── 2FA States ──────────────────────────────────────────────
  const [is2fa, setIs2fa] = useState(false)
  const [tmpToken, setTmpToken] = useState('')
  const [emailHint, setEmailHint] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.loginUsername.trim()) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกชื่อผู้ใช้งาน' })
    if (!form.loginPassword) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกรหัสผ่าน' })
    setLoading(true)
    try {
      const result = await adminApi.login(form.loginUsername, form.loginPassword)
      if (result.status) {
        if (result.require_2fa) {
          setIs2fa(true)
          setTmpToken(result.tmp_token)
          setEmailHint(result.email_hint)
          Swal.fire({ icon: 'info', text: result.message, timer: 2000, showConfirmButton: false })
        } else {
          const { token, id, name, permiss, role } = result.response
          login(token, id, name, permiss, role)
          Swal.fire({ icon: 'success', text: `สวัสดีคุณ ${name}`, timer: 1500, showConfirmButton: false })
          setTimeout(() => navigate('/admin/dashboard'), 1600)
        }
      } else {
        Swal.fire({ icon: 'error', text: result.message })
      }
    } catch (err) {
      Swal.fire({ icon: 'error', text: err.response?.data?.message || 'เกิดข้อผิดพลาด' })
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otpCode || otpCode.length < 6) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกรหัส OTP 6 หลัก' })
    setLoading(true)
    try {
      const result = await adminApi.verifyOtp(tmpToken, otpCode)
      if (result.status) {
        const { token, id, name, permiss, role } = result.response
        login(token, id, name, permiss, role)
        Swal.fire({ icon: 'success', text: 'ยืนยันตัวตนสำเร็จ', timer: 1500, showConfirmButton: false })
        setTimeout(() => navigate('/admin/dashboard'), 1600)
      } else {
        Swal.fire({ icon: 'error', text: result.message })
      }
    } catch (err) {
      Swal.fire({ icon: 'error', text: err.response?.data?.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' })
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    try {
      const result = await adminApi.resendOtp(tmpToken)
      if (result.status) {
        Swal.fire({ icon: 'success', text: 'ส่งรหัสใหม่เรียบร้อยแล้ว', timer: 1500, showConfirmButton: false })
        setResendCooldown(60)
        const timer = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch (err) {
      Swal.fire({ icon: 'error', text: err.response?.data?.message || 'ไม่สามารถส่งรหัสใหม่ได้' })
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
            {!is2fa ? (
              <>
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
              </>
            ) : (
              <div className="animate__animated animate__fadeIn">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-100">
                    <i className='bx bx-mail-send text-3xl'></i>
                  </div>
                  <h5 className="text-slate-800 font-bold mb-2">ยืนยันรหัส OTP</h5>
                  <p className="text-slate-500 text-sm leading-relaxed px-4">
                    เราได้ส่งรหัสยืนยันตัวตน 6 หลักไปยังอีเมล <br/>
                    <span className="text-emerald-600 font-bold">{emailHint}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div>
                    <input
                      type="text"
                      className="w-full text-center text-3xl font-bold tracking-[12px] py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition uppercase"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={loading || otpCode.length < 6}
                  >
                    {loading ? (
                      <><i className='bx bx-loader-alt animate-spin text-xl'></i>กำลังยืนยัน...</>
                    ) : (
                      <><i className='bx bx-check-shield text-xl'></i>ยืนยันรหัส OTP</>
                    )}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      className={`text-sm font-semibold transition ${resendCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-emerald-600 hover:text-emerald-700'}`}
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0}
                    >
                      {resendCooldown > 0 ? `ขอรหัสใหม่ได้ใน ${resendCooldown} วินาที` : 'ยังไม่ได้รับรหัส? ส่งอีกครั้ง'}
                    </button>
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-600 transition underline underline-offset-4"
                      onClick={() => setIs2fa(false)}
                    >
                      ยกเลิกและกลับไปหน้าล็อกอิน
                    </button>
                  </div>
                </form>
              </div>
            )}

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

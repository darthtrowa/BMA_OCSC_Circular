import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { useAuth } from '../contexts/AuthContext'
import { adminApi } from '../api/apiService'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]       = useState({ loginUsername: '', loginPassword: '' })
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.loginUsername.trim()) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกชื่อผู้ใช้งาน' })
    if (!form.loginPassword)        return Swal.fire({ icon: 'warning', text: 'กรุณากรอกรหัสผ่าน' })
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
    <div className="login-wrapper">
      <div className="login-bg" />
      <div className="container d-flex align-items-center justify-content-center min-vh-100">
        <div className="col-lg-5 col-md-7 col-11">
          <div className="card shadow-xl border-0 rounded-4 overflow-hidden">
            {/* Header */}
            <div className="card-header bg-navy text-white text-center py-4 border-0">
              <i className='bx bx-building-house fs-1 mb-2 d-block'></i>
              <h4 className="mb-1 fw-bold font-saochingcha">BMA Circular</h4>
              <small className="opacity-75">ระบบค้นหาหนังสือเวียน ก.พ. กทม.</small>
            </div>

            {/* Body */}
            <div className="card-body p-5">
              <h5 className="text-center mb-4 text-muted">เข้าสู่ระบบผู้ดูแล</h5>

              <form onSubmit={handleSubmit}>
                <div className="form-floating mb-3">
                  <input
                    type="text"
                    className="form-control"
                    id="loginUsername"
                    name="loginUsername"
                    placeholder="Username"
                    value={form.loginUsername}
                    onChange={handleChange}
                    autoFocus
                  />
                  <label htmlFor="loginUsername">
                    <i className='bx bx-user me-1'></i>ชื่อผู้ใช้งาน
                  </label>
                </div>

                <div className="form-floating mb-4 position-relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="form-control"
                    id="loginPassword"
                    name="loginPassword"
                    placeholder="Password"
                    value={form.loginPassword}
                    onChange={handleChange}
                  />
                  <label htmlFor="loginPassword">
                    <i className='bx bx-lock me-1'></i>รหัสผ่าน
                  </label>
                  <button
                    type="button"
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y pe-3 text-muted"
                    style={{ zIndex: 10 }}
                    onClick={() => setShowPwd(!showPwd)}
                    tabIndex={-1}
                  >
                    <i className={`bx ${showPwd ? 'bx-hide' : 'bx-show'} fs-5`}></i>
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2 fw-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="spinner-border spinner-border-sm me-2" />กำลังตรวจสอบ...</>
                  ) : (
                    <><i className='bx bx-log-in me-2'></i>เข้าสู่ระบบ</>
                  )}
                </button>
              </form>

              <hr className="my-4" />
              <p className="text-center text-muted mb-0" style={{ fontSize: '0.85rem' }}>
                <i className='bx bx-shield-check me-1 text-success'></i>
                เข้าสู่ระบบเฉพาะผู้ได้รับอนุญาตเท่านั้น
              </p>
            </div>
          </div>

          <p className="text-center text-white mt-4 opacity-75" style={{ fontSize: '0.8rem' }}>
            © {new Date().getFullYear()} สำนักงาน ก.ก.
          </p>
        </div>
      </div>
    </div>
  )
}

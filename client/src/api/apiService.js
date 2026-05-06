/**
 * apiService.js
 * Service layer สำหรับเชื่อมต่อกับ REST API จริง (Database)
 */

import axios from 'axios'

const BASE_URL = 'http://localhost:3000' // บังคับชี้ไปที่ Backend จริง (Port 3000)
export const LOGO_URL = `${BASE_URL}/image/bmalogo2.jpg`

// ─── Axios instance (สำหรับเชื่อมต่อ Database จริง) ───────────────────────────
const http = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_name')
      localStorage.removeItem('admin_permiss')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  }
)

// ─── Public API ───────────────────────────────────────────────────────────────
export const publicApi = {
  /** โหลด filter dropdowns */
  getFilters: async () => {
    const { data } = await http.get('/api/filters')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  /** โหลดสถิติ */
  getStats: async () => {
    const { data } = await http.get('/api/stats')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  /** ค้นหาหนังสือเวียน */
  search: async (payload) => {
    const { data } = await http.post('/api/search', payload)
    return data.response?.circular_kp ?? []
  },

  /** Chat AI */
  chat: async (message, sessionKey) => {
    const { data } = await http.post('/api/chat', { message, sessionKey })
    return data
  },
}

// ─── Admin API ────────────────────────────────────────────────────────────────
export const adminApi = {
  /** เข้าสู่ระบบ */
  login: async (username, password) => {
    const { data } = await http.post('/admin/auth/login', {
      loginUsername: username,
      loginPassword: password,
      login_submit_hidden: 'Save',
    })
    return data
  },

  /** โหลดข้อมูลทั้งหมดสำหรับ Dashboard */
  getDashboardData: async () => {
    const { data } = await http.get('/admin/dashboard')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  /** สร้างหนังสือเวียน */
  createCircular: async (formData) => {
    const { data } = await http.post('/admin/circular/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  /** อัปเดตหนังสือเวียน */
  updateCircular: async (formData) => {
    const { data } = await http.post('/admin/circular/update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  /** ลบหนังสือเวียน */
  deleteCircular: async (encodedId) => {
    const { data } = await http.post('/admin/circular/delete', { in_id: encodedId })
    return data
  },

  /** จัดการ Master Data (CRUD) */
  masterAction: async (action, type, id, value) => {
    const { data } = await http.post('/admin/master/action', { action, type, id, value })
    return data
  },

  /** โหลดโปรไฟล์ */
  getProfile: async () => {
    const { data } = await http.get('/admin/profile')
    return data
  },

  /** อัปเดตโปรไฟล์ */
  updateProfile: async (name) => {
    const { data } = await http.post('/admin/profile', { a_name: name })
    return data
  },

  /** เปลี่ยนรหัสผ่าน */
  changePassword: async (payload) => {
    const { data } = await http.post('/admin/profile/change-password', payload)
    return data
  },

  /** ดึงข้อมูลผู้ใช้งานทั้งหมด */
  getUsers: async () => {
    const { data } = await http.get('/admin/users')
    return data
  },
}

// ─── Helper ───────────────────────────────────────────────────────────────────
export function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

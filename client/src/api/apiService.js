/**
 * apiService.js
 * Service layer ที่รวมการเรียก API ไว้ที่เดียว
 *
 * MODE: 'mock'  → ใช้ข้อมูลจำลอง (standalone, ไม่ต้อง backend)
 * MODE: 'real'  → เรียก REST API จริง (ต้องตั้งค่า VITE_API_BASE_URL ใน .env)
 *
 * เปลี่ยน mode โดยตั้งค่า VITE_API_MODE=real ใน .env
 */

import axios from 'axios'
import {
  MOCK_FILTERS,
  MOCK_STATS,
  MOCK_ADMIN_DATA,
  MOCK_ADMIN_USER,
} from './mockData'

const MODE = import.meta.env.VITE_API_MODE || 'mock'
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// ─── Axios instance (ใช้เมื่อ MODE = 'real') ─────────────────────────────────
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

// ─── Mock helpers ─────────────────────────────────────────────────────────────
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))

// ─── Public API ───────────────────────────────────────────────────────────────
export const publicApi = {
  /**
   * โหลด filter dropdowns
   */
  getFilters: async () => {
    if (MODE === 'mock') {
      await delay()
      return MOCK_FILTERS
    }
    const { data } = await http.get('/api/filters')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  /**
   * โหลดสถิติ
   */
  getStats: async () => {
    if (MODE === 'mock') {
      await delay(200)
      return MOCK_STATS
    }
    const { data } = await http.get('/api/stats')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  /**
   * ค้นหาหนังสือเวียน
   */
  search: async (payload) => {
    if (MODE === 'mock') {
      await delay(500)
      const { in_year_id, ag_id, cat_id, in_mkk_id, in_results_id,
              in_num_date, in_detail } = payload

      return MOCK_ADMIN_DATA.information.filter((item) => {
        if (in_year_id?.length && !in_year_id.includes(item.year?.year_id)) return false
        if (ag_id?.length && !item.agency?.some((a) => ag_id.includes(a.ag_id))) return false
        if (cat_id?.length && !item.categories?.some((c) => cat_id.includes(c.cat_id))) return false
        if (in_mkk_id?.length && !in_mkk_id.includes(item.mati_kk?.mkk_id)) return false
        if (in_results_id?.length && !in_results_id.includes(item.results?.results_id)) return false
        if (in_num_date && !(item.in_num_date || '').toLowerCase().includes(in_num_date.toLowerCase())) return false
        if (in_detail && !(item.in_detail || '').toLowerCase().includes(in_detail.toLowerCase())) return false
        return true
      })
    }
    const { data } = await http.post('/api/search', payload)
    return data.response?.circular_kp ?? []
  },

  /**
   * Chat AI
   */
  chat: async (message, sessionKey) => {
    if (MODE === 'mock') {
      await delay(800)
      return {
        status: true,
        sessionKey: sessionKey || 'mock-session-001',
        response: `[Demo Mode] ได้รับข้อความ: "${message}" — ระบบ AI ยังไม่ได้เชื่อมต่อ กรุณาตั้งค่า VITE_API_MODE=real และ VITE_API_BASE_URL ใน .env`,
      }
    }
    const { data } = await http.post('/api/chat', { message, sessionKey })
    return data
  },
}

// ─── Admin API ────────────────────────────────────────────────────────────────
export const adminApi = {
  /**
   * เข้าสู่ระบบ
   */
  login: async (username, password) => {
    if (MODE === 'mock') {
      await delay(600)
      if (username === 'admin' && password === 'admin') {
        return { status: true, response: MOCK_ADMIN_USER }
      }
      return { status: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Demo: admin/admin)' }
    }
    const { data } = await http.post('/admin/auth/login', {
      loginUsername: username,
      loginPassword: password,
      login_submit_hidden: 'Save',
    })
    return data
  },

  /**
   * โหลดข้อมูลทั้งหมดสำหรับ Dashboard
   */
  getDashboardData: async () => {
    if (MODE === 'mock') {
      await delay(400)
      return MOCK_ADMIN_DATA
    }
    const { data } = await http.get('/admin/dashboard')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  /**
   * สร้างหนังสือเวียน
   */
  createCircular: async (formData) => {
    if (MODE === 'mock') {
      await delay(500)
      return { status: true, message: '[Demo] บันทึกสำเร็จ (ข้อมูลไม่ได้ถูกบันทึกจริงใน mock mode)' }
    }
    const { data } = await http.post('/admin/circular/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  /**
   * อัปเดตหนังสือเวียน
   */
  updateCircular: async (formData) => {
    if (MODE === 'mock') {
      await delay(500)
      return { status: true, message: '[Demo] อัปเดตสำเร็จ (ข้อมูลไม่ได้ถูกอัปเดตจริงใน mock mode)' }
    }
    const { data } = await http.post('/admin/circular/update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  /**
   * ลบหนังสือเวียน
   */
  deleteCircular: async (encodedId) => {
    if (MODE === 'mock') {
      await delay(400)
      return { status: true, message: '[Demo] ลบสำเร็จ (mock mode)' }
    }
    const { data } = await http.post('/admin/circular/delete', { in_id: encodedId })
    return data
  },

  /**
   * จัดการ Master Data (CRUD)
   */
  masterAction: async (action, type, id, value) => {
    if (MODE === 'mock') {
      await delay(400)
      return { status: true, message: `[Demo] ${action} สำเร็จ (mock mode)` }
    }
    const { data } = await http.post('/admin/master/action', { action, type, id, value })
    return data
  },

  /**
   * โหลดโปรไฟล์
   */
  getProfile: async () => {
    if (MODE === 'mock') {
      await delay(300)
      return { status: true, response: { a_name: 'ผู้ดูแลระบบ', a_username: 'admin', a_permiss: 'superadmin' } }
    }
    const { data } = await http.get('/admin/profile')
    return data
  },

  /**
   * อัปเดตโปรไฟล์
   */
  updateProfile: async (name) => {
    if (MODE === 'mock') {
      await delay(400)
      return { status: true, message: '[Demo] บันทึกสำเร็จ (mock mode)' }
    }
    const { data } = await http.post('/admin/profile', { a_name: name })
    return data
  },

  /**
   * เปลี่ยนรหัสผ่าน
   */
  changePassword: async (payload) => {
    if (MODE === 'mock') {
      await delay(400)
      return { status: true, message: '[Demo] เปลี่ยนรหัสผ่านสำเร็จ (mock mode)' }
    }
    const { data } = await http.post('/admin/profile/change-password', payload)
    return data
  },

  /**
   * ดึงข้อมูลผู้ใช้งานทั้งหมด
   */
  getUsers: async () => {
    if (MODE === 'mock') {
      await delay(400)
      return { status: true, response: [MOCK_ADMIN_USER] }
    }
    const { data } = await http.get('/admin/users')
    return data
  },
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function parseJwt(token) {
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

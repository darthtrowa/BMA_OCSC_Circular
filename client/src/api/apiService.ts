/**
 * apiService.ts
 * Service layer สำหรับเชื่อมต่อกับ REST API จริง (Database)
 */

import axios from 'axios'

export const BASE_URL = 'http://localhost:3000' 
export const LOGO_URL = `${BASE_URL}/image/bmalogo2.jpg`

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

export interface ApiResponse<T> {
  status: boolean;
  message: string;
  response: T;
}

export const publicApi = {
  getFilters: async (): Promise<any> => {
    const { data } = await http.get<ApiResponse<any>>('/api/filters')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  getStats: async (): Promise<any> => {
    const { data } = await http.get<ApiResponse<any>>('/api/stats')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  search: async (payload: any): Promise<any[]> => {
    const { data } = await http.post<ApiResponse<any>>('/api/search', payload)
    return data.response?.circular_kp ?? []
  },

  getCircular: async (id: number | string): Promise<any> => {
    const { data } = await http.get<ApiResponse<any>>(`/api/circular/${id}`)
    if (!data.status) throw new Error(data.message)
    return data.response
  },
}

export const adminApi = {
  login: async (username: string, password: string): Promise<any> => {
    const { data } = await http.post('/admin/auth/login', {
      loginUsername: username,
      loginPassword: password,
      login_submit_hidden: 'Save',
    })
    return data
  },

  /** Step 2 of 2FA: submit OTP code + tmp_token */
  verifyOtp: async (tmpToken: string, otpCode: string): Promise<any> => {
    const { data } = await http.post('/admin/auth/verify-otp', {
      tmp_token: tmpToken,
      otp_code:  otpCode,
    })
    return data
  },

  /** Resend OTP (rate-limited by server) */
  resendOtp: async (tmpToken: string): Promise<any> => {
    const { data } = await http.post('/admin/auth/resend-otp', { tmp_token: tmpToken })
    return data
  },

  /** Toggle 2FA for own profile */
  toggle2fa: async (enabled: boolean): Promise<any> => {
    const { data } = await http.patch('/admin/profile/2fa', { enabled })
    return data
  },

  /** Toggle 2FA for another user (admin only) */
  toggleUser2fa: async (userId: number | string, enabled: boolean): Promise<any> => {
    const { data } = await http.patch(`/admin/users/${userId}/2fa`, { enabled })
    return data
  },

  getDashboardData: async (): Promise<any> => {
    const { data } = await http.get<ApiResponse<any>>('/admin/dashboard')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  createCircular: async (formData: FormData): Promise<any> => {
    const { data } = await http.post('/admin/circular/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  updateCircular: async (formData: FormData): Promise<any> => {
    const { data } = await http.post('/admin/circular/update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  deleteCircular: async (encodedId: string | number): Promise<any> => {
    const { data } = await http.post('/admin/circular/delete', { in_id: encodedId })
    return data
  },

  summarizeCircular: async (pdfPath: string): Promise<any> => {
    const { data } = await http.post('/admin/circular/summarize', { pdfPath })
    return data
  },

  masterAction: async (action: string, type: string, id: any, value: any, value2?: any): Promise<any> => {
    const { data } = await http.post('/admin/master/action', { action, type, id, value, value2 })
    return data
  },

  getUsers: (): Promise<any[]> => http.get<ApiResponse<any[]>>('/admin/users').then(res => res.data.response),
  createUser: (payload: any): Promise<any> => http.post('/admin/users', payload).then(res => res.data),
  updateUser: (id: string | number, payload: any): Promise<any> => http.put(`/admin/users/${id}`, payload).then(res => res.data),
  deleteUser: (id: string | number): Promise<any> => http.delete(`/admin/users/${id}`).then(res => res.data),

  getProfile: async (): Promise<any> => {
    const { data } = await http.get('/admin/profile')
    return data
  },

  updateProfile: async (name: string, email: string, role: string, position: string): Promise<any> => {
    const { data } = await http.post('/admin/profile', { a_name: name, a_email: email, a_role: role, a_position: position })
    return data
  },

  changePassword: async (payload: any): Promise<any> => {
    const { data } = await http.post('/admin/profile/change-password', payload)
    return data
  },
}

export function parseJwt(token: string): any {
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

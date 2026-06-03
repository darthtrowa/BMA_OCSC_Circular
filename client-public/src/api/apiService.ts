/**
 * apiService.ts
 * Public-only API layer — no admin/workflow/agency endpoints
 */

import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
export const LOGO_URL = `${BASE_URL}/image/bmalogo2.jpg`

const http = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

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

/**
 * apiService.ts
 * Admin-only API layer — no public endpoints
 */

import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
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
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login') && !err.config?.url?.includes('/auth/verify-otp')) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_name')
      localStorage.removeItem('admin_permiss')
      window.location.href = '/circular/admin/'
    }
    return Promise.reject(err)
  }
)

export interface ApiResponse<T> {
  status: boolean;
  message: string;
  response: T;
}

export const adminApi = {
  login: async (username: string, password: string): Promise<any> => {
    const { data } = await http.post('/api/admin/auth/login', {
      loginUsername: username,
      loginPassword: password,
      login_submit_hidden: 'Save',
    })
    return data
  },

  /** Step 2 of 2FA: submit OTP code + tmp_token */
  verifyOtp: async (tmpToken: string, otpCode: string): Promise<any> => {
    const { data } = await http.post('/api/admin/auth/verify-otp', {
      tmp_token: tmpToken,
      otp_code:  otpCode,
    })
    return data
  },

  /** Resend OTP (rate-limited by server) */
  resendOtp: async (tmpToken: string): Promise<any> => {
    const { data } = await http.post('/api/admin/auth/resend-otp', { tmp_token: tmpToken })
    return data
  },

  /** Toggle 2FA for own profile */
  toggle2fa: async (enabled: boolean): Promise<any> => {
    const { data } = await http.patch('/api/admin/profile/2fa', { enabled })
    return data
  },

  /** Toggle 2FA for another user (admin only) */
  toggleUser2fa: async (userId: number | string, enabled: boolean): Promise<any> => {
    const { data } = await http.patch(`/api/admin/users/${userId}/2fa`, { enabled })
    return data
  },

  getDashboardData: async (): Promise<any> => {
    const { data } = await http.get<ApiResponse<any>>('/api/admin/dashboard')
    if (!data.status) throw new Error(data.message)
    return data.response
  },

  createCircular: async (formData: FormData): Promise<any> => {
    const { data } = await http.post('/api/admin/circular/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  updateCircular: async (formData: FormData): Promise<any> => {
    const { data } = await http.post('/api/admin/circular/update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  deleteCircular: async (encodedId: string | number): Promise<any> => {
    const { data } = await http.post('/api/admin/circular/delete', { in_id: encodedId })
    return data
  },

  summarizeCircular: async (payload: { mainPdf?: string, attachments?: string[] }): Promise<any> => {
    const { data } = await http.post('/api/admin/circular/summarize', payload)
    return data
  },

  uploadSingle: async (formData: FormData): Promise<any> => {
    const { data } = await http.post('/api/admin/circular/upload-single', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  masterAction: async (action: string, type: string, id: any, value: any, value2?: any): Promise<any> => {
    const { data } = await http.post('/api/admin/master/action', { action, type, id, value, value2 })
    return data
  },

  getUsers: (): Promise<any[]> => http.get<ApiResponse<any[]>>('/api/admin/users').then(res => res.data.response),
  getUsersByRole: (roles: string[]): Promise<any[]> =>
    http.get<ApiResponse<any[]>>(`/api/admin/users/by-role?roles=${roles.join(',')}`).then(res => res.data.response),
  createUser: (payload: any): Promise<any> => http.post('/api/admin/users', payload).then(res => res.data),
  updateUser: (id: string | number, payload: any): Promise<any> => http.put(`/api/admin/users/${id}`, payload).then(res => res.data),
  deleteUser: (id: string | number): Promise<any> => http.delete(`/api/admin/users/${id}`).then(res => res.data),

  getProfile: async (): Promise<any> => {
    const { data } = await http.get('/api/admin/profile')
    return data
  },

  updateProfile: async (name: string, email: string, role: string, position: string): Promise<any> => {
    const { data } = await http.post('/api/admin/profile', { a_name: name, a_email: email, a_role: role, a_position: position })
    return data
  },

  changePassword: async (payload: any): Promise<any> => {
    const { data } = await http.post('/api/admin/profile/change-password', payload)
    return data
  },

  syncBotFindings: async (): Promise<any> => {
    const { data } = await http.post('/api/admin/bot-findings/sync')
    return data
  },

  getBotFindings: async (): Promise<any> => {
    const { data } = await http.get('/api/admin/bot-findings')
    return data
  },

  actionBotFinding: async (id: string | number, action: string): Promise<any> => {
    const { data } = await http.post(`/api/admin/bot-findings/${id}/action`, { action })
    return data
  },

  deleteBotFinding: async (id: string | number): Promise<any> => {
    const { data } = await http.delete(`/api/admin/bot-findings/${id}`)
    return data
  },

  importBotFinding: async (payload: any): Promise<any> => {
    const { data } = await http.post(`/api/admin/bot-findings/import`, payload)
    return data
  },
}

export const workflowApi = {
  startWorkflow: async (docId: number): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/start', { docId });
    return data;
  },

  submitToHr: async (docId: number, hrDirectorId: number, comments?: string): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/submit-to-hr', { docId, hrDirectorId, comments });
    return data;
  },

  delegate: async (docId: number, toUserId: number, comments?: string): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/delegate', { docId, toUserId, comments });
    return data;
  },

  submitReview: async (docId: number, comments?: string): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/submit-review', { docId, comments });
    return data;
  },

  approve: async (docId: number, comments?: string, approval_context?: 'SELF' | 'ACTING', delegation_id?: number): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/approve', {
      docId,
      comments,
      approval_context: approval_context ?? 'SELF',
      delegation_id: delegation_id ?? undefined,
    });
    return data;
  },

  reject: async (docId: number, rejectToUserId: number, comments?: string): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/reject', { docId, rejectToUserId, comments });
    return data;
  },

  getHistory: async (docId: number): Promise<any> => {
    const { data } = await http.get(`/api/admin/workflow/${docId}/history`);
    return data;
  },

  // ── Parallel Workflow ──────────────────────────────────────
  assignParallel: async (
    docId: number,
    hrDirectorId: number,
    tracks: { ag_id?: number; ag_name?: string; toUserId: number }[],
    comments?: string
  ): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/parallel-assign', { docId, hrDirectorId, tracks, comments });
    return data;
  },

  parallelDelegate: async (docId: number, paId: number, toUserId: number, comments?: string): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/parallel-delegate', { docId, paId, toUserId, comments });
    return data;
  },

  parallelSubmit: async (docId: number, paId: number, resultComments?: string): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/parallel-submit', { docId, paId, resultComments });
    return data;
  },

  parallelReject: async (docId: number, paId: number, comments?: string): Promise<any> => {
    const { data } = await http.post('/api/admin/workflow/parallel-reject', { docId, paId, comments });
    return data;
  },

  getParallelTracks: async (docId: number): Promise<any> => {
    const { data } = await http.get(`/api/admin/workflow/${docId}/parallel-tracks`);
    return data;
  },
};

export const agencyApi = {
  getTree: (): Promise<any[]> =>
    http.get<ApiResponse<any[]>>('/api/admin/agency-tree').then(res => res.data.response),

  create: (payload: { ag_name: string; ag_code?: string; parent_ag_id?: number | null; ag_status?: string }): Promise<any> =>
    http.post('/api/admin/agency-tree', payload).then(res => res.data),

  update: (id: number, payload: { ag_name: string; ag_code?: string; parent_ag_id?: number | null; ag_status?: string }): Promise<any> =>
    http.put(`/api/admin/agency-tree/${id}`, payload).then(res => res.data),

  updateStatus: (id: number, ag_status: 'active' | 'disbanded'): Promise<any> =>
    http.patch(`/api/admin/agency-tree/${id}/status`, { ag_status }).then(res => res.data),

  remove: (id: number): Promise<any> =>
    http.delete(`/api/admin/agency-tree/${id}`).then(res => res.data),

  getMembers: (id: number): Promise<any[]> =>
    http.get<ApiResponse<any[]>>(`/api/admin/agency-tree/${id}/members`).then(res => res.data.response),

  reorder: (nodes: { ag_id: number; agency_ordering: number }[]): Promise<any> =>
    http.put('/api/admin/agency-tree/reorder', { nodes }).then(res => res.data),
};

// ─────────────────────────────────────────────────────────────────────────────
// Delegation API (Acting Role Management)
// ─────────────────────────────────────────────────────────────────────────────
export interface DelegationItem {
  delegation_id:    number;
  order_number:     string;
  delegated_role:   string;
  is_active?:       boolean;
  notes?:           string;
  assigner_id:      number;
  assigner_name:    string;
  assigner_role:    string;
  assigner_position?: string;
  assignee_id?:     number;
  assignee_name?:   string;
  assignee_role?:   string;
  created_by_name?: string;
  created_at?:      string;
}

export const delegationApi = {
  /** ดึง delegation ทั้งหมด (SUPERADMIN) */
  getAll: (): Promise<DelegationItem[]> =>
    http.get<ApiResponse<DelegationItem[]>>('/api/admin/delegations').then(res => res.data.response),

  /** ดึง delegation ที่ active ของ user ที่ login อยู่ */
  getMyActive: (): Promise<DelegationItem[]> =>
    http.get<ApiResponse<DelegationItem[]>>('/api/admin/delegations/my-active').then(res => res.data.response),

  /** แต่งตั้งผู้รักษาการ (SUPERADMIN) */
  assign: (payload: {
    assigner_id:  number;
    assignee_id:  number;
    order_number: string;
    notes?:       string;
  }): Promise<any> =>
    http.post('/api/admin/delegations/assign', payload).then(res => res.data),

  /** เปิด/ปิด delegation */
  toggle: (id: number, is_active: boolean): Promise<any> =>
    http.patch(`/api/admin/delegations/${id}/toggle`, { is_active }).then(res => res.data),
};
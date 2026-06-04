/**
 * workflowApi.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * API service for the Dynamic Workflow Engine (Templates + Inbox + Approve)
 * Extends the existing apiService.ts pattern without modifying it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const http = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      !err.config?.url?.includes('/auth/login') &&
      !err.config?.url?.includes('/auth/verify-otp')
    ) {
      localStorage.removeItem('admin_token');
      window.location.href = '/circular/admin/';
    }
    return Promise.reject(err);
  },
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssigneeType = 'USER' | 'ROLE' | 'AGENCY_HIERARCHY';
export type ApprovalContext = 'SELF' | 'ACTING';
export type CircularAction = 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';

/** Matches the NodeInput schema expected by POST /api/admin/workflows/templates */
export interface TemplateNodeInput {
  client_id: string;
  step_name: string;
  assignee_type: AssigneeType;
  target_value?: string | null;
  ui_pos_x: number;
  ui_pos_y: number;
}

/** Matches the EdgeInput schema expected by POST /api/admin/workflows/templates */
export interface TemplateEdgeInput {
  source_client_id: string;
  target_client_id: string;
  condition_value?: string | null;
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  nodes: TemplateNodeInput[];
  edges: TemplateEdgeInput[];
}

export interface TemplateListItem {
  template_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  node_count: number;
  edge_count: number;
}

export interface TemplateNode {
  node_id: number;
  step_name: string;
  assignee_type: AssigneeType;
  target_role: string | null;
  target_agency_id: number | null;
  target_user_id: number | null;
  target_user_name: string | null;
  target_agency_name: string | null;
  ui_pos_x: number;
  ui_pos_y: number;
}

export interface TemplateEdge {
  edge_id: number;
  source_node_id: number;
  target_node_id: number;
  condition_value: string | null;
}

export interface TemplateDetail extends TemplateListItem {
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

export interface CircularApprovePayload {
  circular_id: number;
  action: CircularAction;
  comment?: string;
  approval_context: ApprovalContext;
  delegation_id?: number;
  next_owner_id?: number;
}

// ─── API Methods ───────────────────────────────────────────────────────────────

export const workflowEngineApi = {
  /** Save a full workflow template (nodes + edges) in one atomic transaction */
  createTemplate: async (payload: CreateTemplatePayload): Promise<{ template_id: number; name: string }> => {
    const { data } = await http.post('/api/admin/workflows/templates', payload);
    if (!data.status) throw new Error(data.message);
    return data.response;
  },

  /** List all templates */
  listTemplates: async (): Promise<TemplateListItem[]> => {
    const { data } = await http.get('/api/admin/workflows/templates');
    if (!data.status) throw new Error(data.message);
    return data.response;
  },

  /** Get a single template with all nodes and edges (for React Flow rendering) */
  getTemplate: async (templateId: number): Promise<TemplateDetail> => {
    const { data } = await http.get(`/api/admin/workflows/templates/${templateId}`);
    if (!data.status) throw new Error(data.message);
    return data.response;
  },

  /** Toggle template active status */
  toggleTemplate: async (templateId: number, is_active: boolean): Promise<void> => {
    const { data } = await http.patch(`/api/admin/workflows/templates/${templateId}/toggle`, { is_active });
    if (!data.status) throw new Error(data.message);
  },

  /** Hard-delete a template */
  deleteTemplate: async (templateId: number): Promise<void> => {
    const { data } = await http.delete(`/api/admin/workflows/templates/${templateId}`);
    if (!data.status) throw new Error(data.message);
  },

  /** Fetch active acting delegations for a specific role (Situational Awareness in Workflow Builder) */
  getActiveDelegationsByRole: async (role: string): Promise<any[]> => {
    const { data } = await http.get(`/api/admin/delegations/active-by-role/${role}`);
    if (!data.status) throw new Error(data.message);
    return data.response;
  },

  /** Approve / Reject a circular with context-based acting role check */
  approveCircular: async (payload: CircularApprovePayload): Promise<void> => {
    const { data } = await http.post('/api/admin/workflows/circular/approve', payload);
    if (!data.status) throw new Error(data.message);
  },
};

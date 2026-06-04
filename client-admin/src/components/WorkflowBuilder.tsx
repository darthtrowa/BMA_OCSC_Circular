/**
 * WorkflowBuilder.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Drag-and-drop Workflow Template Builder powered by @xyflow/react
 *
 * Layout:
 *   ┌──────────────────────────────────────┬─────────────────┐
 *   │  75% — React Flow Canvas             │ 25% — Sidebar   │
 *   │  (drag nodes, draw edges)            │ (node props)    │
 *   └──────────────────────────────────────┴─────────────────┘
 *
 * Features:
 *   • Custom node type: WorkflowStepNode (role/user/agency icon + label)
 *   • Click a node → populate sidebar with its props
 *   • Sidebar inputs mutate node data in real-time on the canvas
 *   • "Save Template" → POST /api/admin/workflows/templates
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Panel,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { FiUser, FiUsers, FiGitBranch, FiPlus, FiSave, FiTrash2, FiAlertCircle } from 'react-icons/fi';
import { workflowEngineApi, type AssigneeType, type CreateTemplatePayload } from '../api/workflowEngineApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowNodeData {
  step_name: string;
  assignee_type: AssigneeType;
  /** Raw value: role name | agency id | user id */
  target_value: string;
  [key: string]: unknown; // Required by React Flow's NodeData constraint
}

type WFNode = Node<WorkflowNodeData>;
type WFEdge = Edge;

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSIGNEE_TYPE_OPTIONS: { value: AssigneeType; label: string }[] = [
  { value: 'ROLE',             label: 'ตำแหน่ง (Role)' },
  { value: 'USER',             label: 'ผู้ใช้เฉพาะ (User)' },
  { value: 'AGENCY_HIERARCHY', label: 'สายบังคับบัญชา (Agency)' },
];

const ROLE_OPTIONS = [
  'HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF', 'COORDINATOR',
];

const ASSIGNEE_ICON_MAP: Record<AssigneeType, React.ReactElement> = {
  USER:             <FiUser   size={14} />,
  ROLE:             <FiUsers  size={14} />,
  AGENCY_HIERARCHY: <FiGitBranch size={14} />,
};

const ASSIGNEE_COLOR_MAP: Record<AssigneeType, string> = {
  USER:             '#6366f1',
  ROLE:             '#10b981',
  AGENCY_HIERARCHY: '#f59e0b',
};

// ─── Custom Node Component ────────────────────────────────────────────────────

function WorkflowStepNode({ data, selected }: NodeProps<WFNode>) {
  const { step_name, assignee_type, target_value } = data as WorkflowNodeData;
  const color = ASSIGNEE_COLOR_MAP[assignee_type] ?? '#6366f1';

  return (
    <div
      style={{
        background:   selected ? '#1e293b' : '#0f172a',
        border:       `2px solid ${selected ? color : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px',
        padding:      '12px 16px',
        minWidth:     '180px',
        boxShadow:    selected ? `0 0 0 3px ${color}33` : '0 4px 20px rgba(0,0,0,0.4)',
        transition:   'all 0.15s ease',
        fontFamily:   "'Inter', 'Sarabun', sans-serif",
      }}
    >
      {/* Top handle (incoming) */}
      <Handle type="target" position={Position.Top} style={{ background: color, borderColor: color }} />

      {/* Header badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          '24px',
            height:         '24px',
            borderRadius:   '6px',
            background:     `${color}22`,
            color,
          }}
        >
          {ASSIGNEE_ICON_MAP[assignee_type]}
        </span>
        <span
          style={{
            fontSize:    '10px',
            fontWeight:  600,
            color:       color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {assignee_type.replace('_', ' ')}
        </span>
      </div>

      {/* Step name */}
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3 }}>
        {step_name || <span style={{ color: '#475569', fontStyle: 'italic' }}>ชื่อขั้นตอน...</span>}
      </p>

      {/* Target value */}
      {target_value && (
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8' }}>
          {target_value}
        </p>
      )}

      {/* Bottom handle (outgoing) */}
      <Handle type="source" position={Position.Bottom} style={{ background: color, borderColor: color }} />
    </div>
  );
}

const nodeTypes = { workflowStep: WorkflowStepNode };

// ─── Utility: generate a unique client-side ID ────────────────────────────────
let nodeCounter = 0;
const newNodeId = () => `node-${++nodeCounter}`;

// ─── Main Component ────────────────────────────────────────────────────────────

interface WorkflowBuilderProps {
  /** Pre-load an existing template for editing */
  initialTemplateId?: number;
  onSaveSuccess?: (templateId: number) => void;
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialTemplateId, onSaveSuccess }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<WFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WFEdge>([]);

  const [selectedNode, setSelectedNode]   = useState<WFNode | null>(null);
  const [selectedEdge, setSelectedEdge]   = useState<WFEdge | null>(null);
  const [templateName, setTemplateName]   = useState<string>('');
  const [templateDesc, setTemplateDesc]   = useState<string>('');

  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Acting Delegation State ───────────────────────────────────────────────
  const [activeDelegations, setActiveDelegations] = useState<any[]>([]);
  const [loadingDelegations, setLoadingDelegations] = useState(false);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // ── Auto-clear toast ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Load existing template ────────────────────────────────────────────────
  useEffect(() => {
    if (!initialTemplateId) return;
    workflowEngineApi.getTemplate(initialTemplateId).then((tpl) => {
      setTemplateName(tpl.name);
      setTemplateDesc(tpl.description ?? '');

      const loadedNodes: WFNode[] = tpl.nodes.map((n) => ({
        id:   String(n.node_id),
        type: 'workflowStep',
        position: { x: n.ui_pos_x, y: n.ui_pos_y },
        data: {
          step_name:     n.step_name,
          assignee_type: n.assignee_type,
          target_value:  n.target_role ?? n.target_user_name ?? n.target_agency_name ?? '',
        },
      }));

      const loadedEdges: WFEdge[] = tpl.edges.map((e) => ({
        id:     `e-${e.edge_id}`,
        source: String(e.source_node_id),
        target: String(e.target_node_id),
        label:  e.condition_value ?? undefined,
      }));

      setNodes(loadedNodes);
      setEdges(loadedEdges);
    }).catch(() => setToast({ type: 'error', msg: 'โหลด Template ไม่สำเร็จ' }));
  }, [initialTemplateId]);

  // ── Add a new node to the canvas ──────────────────────────────────────────
  const addNode = useCallback(() => {
    const id = newNodeId();
    const newNode: WFNode = {
      id,
      type: 'workflowStep',
      position: { x: 120 + Math.random() * 200, y: 80 + Math.random() * 200 },
      data: { step_name: 'ขั้นตอนใหม่', assignee_type: 'ROLE', target_value: '' },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  }, [setNodes]);

  // ── Connect two nodes ─────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection }, eds)),
    [setEdges],
  );

  // ── Select node → populate sidebar ────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as WFNode);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge as WFEdge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // ── Fetch Acting Delegations when a ROLE node is selected ─────────────────
  useEffect(() => {
    if (!selectedNode) {
      setActiveDelegations([]);
      return;
    }
    const { assignee_type, target_value } = selectedNode.data as WorkflowNodeData;
    if (assignee_type === 'ROLE' && target_value) {
      setLoadingDelegations(true);
      workflowEngineApi.getActiveDelegationsByRole(target_value)
        .then(data => setActiveDelegations(data || []))
        .catch(err => console.error('Failed to load delegations:', err))
        .finally(() => setLoadingDelegations(false));
    } else {
      setActiveDelegations([]);
    }
  }, [selectedNode?.id, (selectedNode?.data as WorkflowNodeData | undefined)?.target_value, (selectedNode?.data as WorkflowNodeData | undefined)?.assignee_type]);

  // ── Sidebar: update node data in real time ────────────────────────────────
  const updateSelectedNodeData = useCallback(
    (patch: Partial<WorkflowNodeData>) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, ...patch } }
            : n,
        ),
      );
      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...patch } } : null);
    },
    [selectedNode, setNodes],
  );

  // ── Delete selected node ──────────────────────────────────────────────────
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  }, [selectedNode, setNodes, setEdges]);

  // ── Delete selected edge ──────────────────────────────────────────────────
  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
    setSelectedEdge(null);
  }, [selectedEdge, setEdges]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!templateName.trim()) {
      setToast({ type: 'error', msg: 'กรุณาระบุชื่อ Workflow Template' });
      return;
    }
    if (nodes.length === 0) {
      setToast({ type: 'error', msg: 'ต้องมีอย่างน้อย 1 Node บนแคนวาส' });
      return;
    }

    const payload: CreateTemplatePayload = {
      name:        templateName.trim(),
      description: templateDesc.trim(),
      nodes: nodes.map((n) => ({
        client_id:     n.id,
        step_name:     (n.data as WorkflowNodeData).step_name,
        assignee_type: (n.data as WorkflowNodeData).assignee_type,
        target_value:  (n.data as WorkflowNodeData).target_value || null,
        ui_pos_x:      n.position.x,
        ui_pos_y:      n.position.y,
      })),
      edges: edges.map((e) => ({
        source_client_id: e.source,
        target_client_id: e.target,
        condition_value:  (e.label as string) ?? null,
      })),
    };

    setSaving(true);
    try {
      const result = await workflowEngineApi.createTemplate(payload);
      setToast({ type: 'success', msg: `บันทึก Template "${result.name}" สำเร็จแล้ว` });
      onSaveSuccess?.(result.template_id);
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message ?? 'บันทึกไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Sidebar synced data ───────────────────────────────────────────────────
  const syncedNode = selectedNode
    ? (nodes.find((n) => n.id === selectedNode.id) ?? null)
    : null;

  const sidebarData: WorkflowNodeData = syncedNode?.data as WorkflowNodeData ?? {
    step_name: '', assignee_type: 'ROLE', target_value: '',
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display:        'flex',
        height:         '100vh',
        background:     '#0f172a',
        fontFamily:     "'Inter', 'Sarabun', sans-serif",
        color:          '#f1f5f9',
      }}
    >
      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position:     'fixed',
            top:          '20px',
            left:         '50%',
            transform:    'translateX(-50%)',
            zIndex:       9999,
            padding:      '12px 24px',
            borderRadius: '12px',
            background:   toast.type === 'success' ? '#064e3b' : '#7f1d1d',
            border:       `1px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`,
            color:        toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
            fontWeight:   600,
            fontSize:     '14px',
            boxShadow:    '0 10px 25px rgba(0,0,0,0.5)',
          }}
        >
          {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
        </div>
      )}

      {/* ── 75% React Flow Canvas ────────────────────────────────────────── */}
      <div ref={reactFlowWrapper} style={{ flex: 3, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          defaultEdgeOptions={{
            style: { stroke: '#475569', strokeWidth: 2 },
            markerEnd: { type: 'arrowclosed', color: '#475569' } as any,
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} color="#1e293b" />
          <Controls style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
          <MiniMap
            style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
            nodeColor={(n) => ASSIGNEE_COLOR_MAP[(n.data as WorkflowNodeData).assignee_type] ?? '#6366f1'}
          />

          {/* ── Top Panel: Template metadata + actions ─────────────────── */}
          <Panel position="top-left" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              id="template-name-input"
              placeholder="ชื่อ Workflow Template *"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              style={inputStyle}
            />
            <input
              id="template-desc-input"
              placeholder="คำอธิบาย (ถ้ามี)"
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              style={{ ...inputStyle, width: '200px' }}
            />
            <button
              id="add-node-btn"
              onClick={addNode}
              style={btnStyle('#6366f1')}
              title="เพิ่ม Node ใหม่"
            >
              <FiPlus size={16} /> เพิ่ม Node
            </button>
            <button
              id="save-template-btn"
              onClick={handleSave}
              disabled={saving}
              style={btnStyle('#10b981', saving)}
            >
              <FiSave size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึก Template'}
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* ── 25% Property Sidebar ─────────────────────────────────────────── */}
      <aside
        style={{
          flex:            1,
          maxWidth:        '300px',
          minWidth:        '260px',
          background:      '#0f172a',
          borderLeft:      '1px solid #1e293b',
          padding:         '24px 20px',
          overflowY:       'auto',
          display:         'flex',
          flexDirection:   'column',
          gap:             '20px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
            คุณสมบัติ {selectedEdge ? 'การเชื่อมโยง (Edge)' : 'Node'}
          </h2>
        </div>

        {!syncedNode && !selectedEdge ? (
          <div
            style={{
              flex:        1,
              display:     'flex',
              flexDirection: 'column',
              alignItems:  'center',
              justifyContent: 'center',
              gap:         '12px',
              color:       '#475569',
              textAlign:   'center',
              padding:     '20px 0',
            }}
          >
            <FiAlertCircle size={32} />
            <p style={{ margin: 0, fontSize: '13px' }}>คลิกที่ Node หรือเส้นบนแคนวาส<br />เพื่อดูและแก้ไขคุณสมบัติ</p>
          </div>
        ) : selectedEdge ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Edge Info */}
            <div style={{ padding: '12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', fontWeight: 600 }}>เส้นการมอบหมายงาน</p>
              <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#64748b' }}>
                ID: <code style={{ color: '#94a3b8' }}>{selectedEdge.id}</code>
              </p>
            </div>

            {/* Delete Edge */}
            <button
              id="delete-edge-btn"
              onClick={deleteSelectedEdge}
              style={{
                ...btnStyle('#ef4444'),
                width:          '100%',
                justifyContent: 'center',
                padding: '10px 16px',
              }}
            >
              <FiTrash2 size={14} /> ลบเส้นการมอบหมายนี้
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Step Name */}
            <div>
              <label style={labelStyle} htmlFor="sidebar-step-name">ชื่อขั้นตอน *</label>
              <input
                id="sidebar-step-name"
                value={sidebarData.step_name}
                onChange={(e) => updateSelectedNodeData({ step_name: e.target.value })}
                placeholder="เช่น: ผอ.กอง อนุมัติ"
                style={sidebarInputStyle}
              />
            </div>

            {/* Assignee Type */}
            <div>
              <label style={labelStyle} htmlFor="sidebar-assignee-type">ประเภทผู้รับผิดชอบ</label>
              <select
                id="sidebar-assignee-type"
                value={sidebarData.assignee_type}
                onChange={(e) => updateSelectedNodeData({ assignee_type: e.target.value as AssigneeType, target_value: '' })}
                style={sidebarInputStyle}
              >
                {ASSIGNEE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Target Value — dynamically changes based on assignee_type */}
            <div>
              <label style={labelStyle} htmlFor="sidebar-target-value">
                {sidebarData.assignee_type === 'ROLE'             && 'ชื่อตำแหน่ง (Role)'}
                {sidebarData.assignee_type === 'USER'             && 'รหัสผู้ใช้ (Admin ID)'}
                {sidebarData.assignee_type === 'AGENCY_HIERARCHY' && 'รหัสหน่วยงาน (Agency ID)'}
              </label>

              {sidebarData.assignee_type === 'ROLE' ? (
                <select
                  id="sidebar-target-value"
                  value={sidebarData.target_value}
                  onChange={(e) => updateSelectedNodeData({ target_value: e.target.value })}
                  style={sidebarInputStyle}
                >
                  <option value="">-- เลือกตำแหน่ง --</option>
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <input
                  id="sidebar-target-value"
                  value={sidebarData.target_value}
                  onChange={(e) => updateSelectedNodeData({ target_value: e.target.value })}
                  placeholder={sidebarData.assignee_type === 'USER' ? 'เช่น: 42' : 'เช่น: 7'}
                  style={sidebarInputStyle}
                />
              )}
            </div>

            {/* Acting Delegation UI (Situational Awareness) */}
            {sidebarData.assignee_type === 'ROLE' && sidebarData.target_value && (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>ผู้รักษาการปัจจุบัน</label>
                  <a
                    href="/circular/admin/dashboard/users"
                    target="_blank"
                    style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="ไปที่ระบบจัดการผู้ใช้งานเพื่อตั้งค่ารักษาการ"
                  >
                    ตั้งค่า <FiPlus size={10} />
                  </a>
                </div>
                
                {loadingDelegations ? (
                  <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '10px' }}>กำลังโหลด...</div>
                ) : activeDelegations.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                    ไม่มีผู้รักษาการในตำแหน่งนี้
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {activeDelegations.map((del) => (
                      <div key={del.delegation_id} style={{ fontSize: '11px', padding: '6px 8px', background: '#0f172a', borderRadius: '4px', borderLeft: '2px solid #8b5cf6' }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{del.assignee_name}</span>
                        <div style={{ color: '#94a3b8', marginTop: '2px', fontSize: '10px' }}>
                          แทน {del.assigner_name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Node ID (read-only) */}
            <div style={{ padding: '10px', background: '#1e293b', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                Node ID: <code style={{ color: '#94a3b8' }}>{syncedNode.id}</code>
              </p>
            </div>

            {/* Delete Node */}
            <button
              id="delete-node-btn"
              onClick={deleteSelectedNode}
              style={{
                ...btnStyle('#ef4444'),
                width:          '100%',
                justifyContent: 'center',
              }}
            >
              <FiTrash2 size={14} /> ลบ Node นี้
            </button>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            สัญลักษณ์
          </p>
          {ASSIGNEE_TYPE_OPTIONS.map((o) => (
            <div key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                display:        'inline-flex',
                alignItems:     'center',
                justifyContent: 'center',
                width:          '20px',
                height:         '20px',
                borderRadius:   '4px',
                background:     `${ASSIGNEE_COLOR_MAP[o.value]}22`,
                color:          ASSIGNEE_COLOR_MAP[o.value],
              }}>
                {ASSIGNEE_ICON_MAP[o.value]}
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{o.label}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

// ─── Inline style helpers (avoids Tailwind dependency for ReactFlow integration) ─

const inputStyle: React.CSSProperties = {
  background:   '#1e293b',
  border:       '1px solid #334155',
  borderRadius: '8px',
  color:        '#f1f5f9',
  padding:      '8px 12px',
  fontSize:     '13px',
  outline:      'none',
  width:        '180px',
  fontFamily:   "'Inter', 'Sarabun', sans-serif",
};

const sidebarInputStyle: React.CSSProperties = {
  width:        '100%',
  background:   '#1e293b',
  border:       '1px solid #334155',
  borderRadius: '8px',
  color:        '#f1f5f9',
  padding:      '8px 12px',
  fontSize:     '13px',
  outline:      'none',
  fontFamily:   "'Inter', 'Sarabun', sans-serif",
  boxSizing:    'border-box',
};

const labelStyle: React.CSSProperties = {
  display:      'block',
  marginBottom: '6px',
  fontSize:     '12px',
  fontWeight:   600,
  color:        '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const btnStyle = (color: string, disabled = false): React.CSSProperties => ({
  display:        'inline-flex',
  alignItems:     'center',
  gap:            '6px',
  padding:        '8px 14px',
  background:     disabled ? '#1e293b' : `${color}22`,
  border:         `1px solid ${disabled ? '#334155' : color}`,
  borderRadius:   '8px',
  color:          disabled ? '#475569' : color,
  fontSize:       '13px',
  fontWeight:     600,
  cursor:         disabled ? 'not-allowed' : 'pointer',
  transition:     'all 0.15s ease',
  fontFamily:     "'Inter', 'Sarabun', sans-serif",
  whiteSpace:     'nowrap',
});

export default WorkflowBuilder;

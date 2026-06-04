/**
 * WorkflowBuilderPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-page route wrapper for the WorkflowBuilder.
 * Shows a template list on the left and the builder on the right.
 *
 * Route: /dashboard/workflow-builder  (protected)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCheckCircle, FiClock, FiEdit2, FiGitBranch, FiPlusCircle, FiToggleLeft, FiToggleRight, FiTrash2, FiAlertCircle } from 'react-icons/fi';
import WorkflowBuilder from '../components/WorkflowBuilder';
import WorkflowActionModal from '../components/WorkflowActionModal';
import { workflowEngineApi, type CircularApprovePayload, type TemplateListItem } from '../api/workflowEngineApi';
import { delegationApi, type DelegationItem } from '../api/apiService';

type PageView = 'list' | 'builder';

const WorkflowBuilderPage: React.FC = () => {
  const [view, setView]                   = useState<PageView>('list');
  const [templates, setTemplates]         = useState<TemplateListItem[]>([]);
  const [loading, setLoading]             = useState(false);
  const [editId, setEditId]               = useState<number | undefined>(undefined);

  // Demo: approval modal state
  const [modalOpen, setModalOpen]         = useState(false);
  const [myDelegations, setMyDelegations] = useState<DelegationItem[]>([]);
  const [demoCircularId]                  = useState<number>(1); // replace with real ID in production

  const [errorMsg, setErrorMsg]           = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
    // Load user's active delegations for the approval modal demo
    delegationApi.getMyActive()
      .then(setMyDelegations)
      .catch(() => setMyDelegations([]));
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await workflowEngineApi.listTemplates();
      setTemplates(list);
    } catch (e: any) {
      setErrorMsg(e.message || 'Error loading templates');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (tpl: TemplateListItem) => {
    try {
      await workflowEngineApi.toggleTemplate(tpl.template_id, !tpl.is_active);
      setTemplates((prev) =>
        prev.map((t) => t.template_id === tpl.template_id ? { ...t, is_active: !t.is_active } : t),
      );
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (tpl: TemplateListItem) => {
    if (!window.confirm(`ลบ Template "${tpl.name}" และ Nodes/Edges ทั้งหมด?`)) return;
    try {
      await workflowEngineApi.deleteTemplate(tpl.template_id);
      setTemplates((prev) => prev.filter((t) => t.template_id !== tpl.template_id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleApprove = async (payload: CircularApprovePayload) => {
    await workflowEngineApi.approveCircular(payload);
    alert('ดำเนินการสำเร็จ');
  };

  // ─── Builder View ─────────────────────────────────────────────────────────
  if (view === 'builder') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
        {/* Mini nav */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            '14px',
            padding:        '14px 20px',
            borderBottom:   '1px solid #1e293b',
            background:     '#0f172a',
          }}
        >
          <button
            onClick={() => { setView('list'); setEditId(undefined); loadTemplates(); }}
            style={{
              display:    'inline-flex',
              alignItems: 'center',
              gap:        '6px',
              background: '#1e293b',
              border:     '1px solid #334155',
              borderRadius: '8px',
              color:      '#94a3b8',
              padding:    '6px 12px',
              fontSize:   '13px',
              cursor:     'pointer',
              fontFamily: "'Inter', 'Sarabun', sans-serif",
            }}
          >
            <FiArrowLeft size={14} /> กลับรายการ
          </button>
          <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
            {editId ? `แก้ไข Template #${editId}` : 'สร้าง Workflow Template ใหม่'}
          </h1>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <WorkflowBuilder
            initialTemplateId={editId}
            onSaveSuccess={(id) => {
              setEditId(id);
              loadTemplates();
            }}
          />
        </div>
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight:  '100vh',
        background: '#0f172a',
        padding:    '32px',
        fontFamily: "'Inter', 'Sarabun', sans-serif",
        color:      '#f1f5f9',
      }}
    >
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                width:          '44px',
                height:         '44px',
                borderRadius:   '12px',
                background:     '#6366f122',
                color:          '#6366f1',
              }}
            >
              <FiGitBranch size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Dynamic Workflow Engine</h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>จัดการ Workflow Templates และการอนุมัติเอกสาร</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Demo: Open approval modal */}
          <button
            id="demo-approve-btn"
            onClick={() => setModalOpen(true)}
            style={actionBtnStyle('#10b981')}
          >
            <FiCheckCircle size={15} /> ทดสอบ Approval Modal
          </button>
          <button
            id="new-template-btn"
            onClick={() => { setEditId(undefined); setView('builder'); }}
            style={actionBtnStyle('#6366f1')}
          >
            <FiPlusCircle size={15} /> สร้าง Template ใหม่
          </button>
        </div>
      </div>

      {/* Template list */}
      {errorMsg ? (
        <div style={{ textAlign: 'center', color: '#ef4444', padding: '60px 0', background: '#450a0a22', borderRadius: '16px', border: '1px solid #7f1d1d' }}>
          <FiAlertCircle size={32} style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
          เกิดข้อผิดพลาด: {errorMsg}
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', color: '#475569', padding: '60px 0' }}>
          <FiClock size={32} style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
          กำลังโหลด...
        </div>
      ) : templates.length === 0 ? (
        <div
          style={{
            textAlign:    'center',
            padding:      '80px 20px',
            background:   '#0f172a',
            border:       '1px dashed #334155',
            borderRadius: '16px',
            color:        '#475569',
          }}
        >
          <FiGitBranch size={40} style={{ marginBottom: '16px', display: 'block', margin: '0 auto 16px', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>ยังไม่มี Workflow Template</p>
          <p style={{ margin: '6px 0 0', fontSize: '13px' }}>คลิก "สร้าง Template ใหม่" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {templates.map((tpl) => (
            <div
              key={tpl.template_id}
              style={{
                background:   '#0f172a',
                border:       `1px solid ${tpl.is_active ? '#1e3a5f' : '#1e293b'}`,
                borderRadius: '16px',
                padding:      '20px',
                display:      'flex',
                flexDirection: 'column',
                gap:          '14px',
                transition:   'border-color 0.15s ease',
              }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>{tpl.name}</p>
                  {tpl.description && (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>{tpl.description}</p>
                  )}
                </div>
                <span
                  style={{
                    padding:      '3px 10px',
                    borderRadius: '100px',
                    fontSize:     '11px',
                    fontWeight:   700,
                    background:   tpl.is_active ? '#064e3b' : '#1e293b',
                    color:        tpl.is_active ? '#10b981' : '#475569',
                    border:       `1px solid ${tpl.is_active ? '#10b981' : '#334155'}`,
                    marginLeft:   '10px',
                    flexShrink:   0,
                  }}
                >
                  {tpl.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <StatBadge label="Nodes" value={tpl.node_count} color="#6366f1" />
                <StatBadge label="Edges" value={tpl.edge_count} color="#10b981" />
              </div>

              {/* Meta */}
              <p style={{ margin: 0, fontSize: '11px', color: '#475569' }}>
                สร้างโดย {tpl.created_by_name ?? '—'} • {new Date(tpl.created_at).toLocaleDateString('th-TH')}
              </p>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  id={`edit-tpl-${tpl.template_id}`}
                  onClick={() => { setEditId(tpl.template_id); setView('builder'); }}
                  style={cardBtnStyle('#6366f1')}
                  title="แก้ไข"
                >
                  <FiEdit2 size={13} /> แก้ไข
                </button>
                <button
                  id={`toggle-tpl-${tpl.template_id}`}
                  onClick={() => handleToggle(tpl)}
                  style={cardBtnStyle(tpl.is_active ? '#f59e0b' : '#10b981')}
                  title={tpl.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                >
                  {tpl.is_active ? <FiToggleLeft size={13} /> : <FiToggleRight size={13} />}
                  {tpl.is_active ? 'ปิด' : 'เปิด'}
                </button>
                <button
                  id={`delete-tpl-${tpl.template_id}`}
                  onClick={() => handleDelete(tpl)}
                  style={{ ...cardBtnStyle('#ef4444'), marginLeft: 'auto' }}
                  title="ลบ"
                >
                  <FiTrash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Demo: WorkflowActionModal ───────────────────────────────────── */}
      <WorkflowActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleApprove}
        circularId={demoCircularId}
        circularTitle="หนังสือเวียน: ขอทดสอบการอนุมัติผ่านระบบ Workflow"
        hasActingPermission={myDelegations.length > 0}
        activeDelegations={myDelegations}
        defaultAction="APPROVE"
        nextOwnerOptions={[]}
      />
    </div>
  );
};

// ─── Small helpers ─────────────────────────────────────────────────────────────

const StatBadge: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div
    style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '6px',
      padding:      '4px 10px',
      background:   `${color}11`,
      border:       `1px solid ${color}33`,
      borderRadius: '8px',
      fontSize:     '12px',
      fontWeight:   700,
      color,
    }}
  >
    <FiGitBranch size={12} />
    {value} {label}
  </div>
);

const actionBtnStyle = (color: string): React.CSSProperties => ({
  display:    'inline-flex',
  alignItems: 'center',
  gap:        '6px',
  padding:    '10px 18px',
  background: `${color}22`,
  border:     `1px solid ${color}`,
  borderRadius: '10px',
  color,
  fontSize:   '13px',
  fontWeight: 700,
  cursor:     'pointer',
  fontFamily: "'Inter', 'Sarabun', sans-serif",
});

const cardBtnStyle = (color: string): React.CSSProperties => ({
  display:    'inline-flex',
  alignItems: 'center',
  gap:        '5px',
  padding:    '6px 12px',
  background: `${color}11`,
  border:     `1px solid ${color}33`,
  borderRadius: '8px',
  color,
  fontSize:   '12px',
  fontWeight: 600,
  cursor:     'pointer',
  fontFamily: "'Inter', 'Sarabun', sans-serif",
});

export default WorkflowBuilderPage;

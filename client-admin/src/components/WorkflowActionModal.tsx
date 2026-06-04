/**
 * WorkflowActionModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Circular Approval Modal with Context-Based Acting Role Selection
 *
 * Props:
 *   isOpen              — controls modal visibility
 *   onClose             — called when modal is dismissed
 *   onConfirm           — called with the final payload on Submit
 *   circularId          — the in_id of the circular being actioned
 *   circularTitle       — display name / subject line of the circular
 *   hasActingPermission — if true, show the "Acting" radio option
 *   activeDelegations   — list of active delegations the user can act under
 *   defaultAction       — 'APPROVE' | 'REJECT' | 'REQUEST_REVISION'
 *   nextOwnerOptions    — list of users available as next step owners
 *
 * Note: renders only when isOpen = true. The parent component is responsible
 *       for fetching activeDelegations (via delegationApi.getMyActive()).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useId, useState } from 'react';
import {
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
  FiLoader,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { type ApprovalContext, type CircularAction, type CircularApprovePayload } from '../api/workflowEngineApi';
import type { DelegationItem } from '../api/apiService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NextOwnerOption {
  id: number;
  name: string;
  role: string;
  position?: string;
}

export interface WorkflowActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: CircularApprovePayload) => Promise<void>;
  circularId: number;
  circularTitle: string;
  hasActingPermission: boolean;
  /** Active delegations where the current user is the assignee */
  activeDelegations?: DelegationItem[];
  defaultAction?: CircularAction;
  nextOwnerOptions?: NextOwnerOption[];
}

// ─── Component ────────────────────────────────────────────────────────────────

const WorkflowActionModal: React.FC<WorkflowActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  circularId,
  circularTitle,
  hasActingPermission,
  activeDelegations = [],
  defaultAction = 'APPROVE',
  nextOwnerOptions = [],
}) => {
  const uid = useId();

  const [action, setAction]                   = useState<CircularAction>(defaultAction);
  const [comment, setComment]                 = useState<string>('');
  const [approvalContext, setApprovalContext]  = useState<ApprovalContext>('SELF');
  const [selectedDelegation, setSelectedDelegation] = useState<number | undefined>(undefined);
  const [nextOwnerId, setNextOwnerId]         = useState<number | undefined>(undefined);
  const [submitting, setSubmitting]            = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setAction(defaultAction);
      setComment('');
      setApprovalContext('SELF');
      setSelectedDelegation(activeDelegations[0]?.delegation_id);
      setNextOwnerId(nextOwnerOptions[0]?.id);
      setError(null);
    }
  }, [isOpen, defaultAction]);

  if (!isOpen) return null;

  // ── Derived helpers ──────────────────────────────────────────────────────
  const actionConfig: Record<CircularAction, { label: string; color: string; bg: string }> = {
    APPROVE:          { label: 'อนุมัติ',      color: '#10b981', bg: '#064e3b' },
    REJECT:           { label: 'ตีกลับ',       color: '#ef4444', bg: '#7f1d1d' },
    REQUEST_REVISION: { label: 'ขอแก้ไข',     color: '#f59e0b', bg: '#78350f' },
  };
  const currentAction = actionConfig[action];

  const handleSubmit = async () => {
    // Validation
    if (approvalContext === 'ACTING' && !selectedDelegation) {
      setError('กรุณาเลือกการมอบอำนาจที่จะใช้ดำเนินการ');
      return;
    }
    if (action === 'APPROVE' && nextOwnerOptions.length > 0 && !nextOwnerId) {
      setError('กรุณาเลือกผู้รับผิดชอบขั้นตอนถัดไป');
      return;
    }

    const payload: CircularApprovePayload = {
      circular_id:      circularId,
      action,
      comment:          comment.trim(),
      approval_context: approvalContext,
      ...(approvalContext === 'ACTING' && selectedDelegation
        ? { delegation_id: selectedDelegation }
        : {}),
      ...(action === 'APPROVE' && nextOwnerId
        ? { next_owner_id: nextOwnerId }
        : {}),
    };

    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(payload);
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex:     1000,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        style={{
          position:     'fixed',
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%, -50%)',
          zIndex:       1001,
          width:        '100%',
          maxWidth:     '520px',
          background:   '#0f172a',
          border:       '1px solid #1e293b',
          borderRadius: '20px',
          boxShadow:    '0 25px 60px rgba(0, 0, 0, 0.7)',
          fontFamily:   "'Inter', 'Sarabun', sans-serif",
          color:        '#f1f5f9',
          overflow:     'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '20px 24px 16px',
            borderBottom:   '1px solid #1e293b',
          }}
        >
          <div>
            <h2
              id={`${uid}-title`}
              style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}
            >
              ดำเนินการเอกสาร
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {circularTitle}
            </p>
          </div>
          <button
            id={`${uid}-close`}
            onClick={onClose}
            aria-label="ปิด"
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          '32px',
              height:         '32px',
              borderRadius:   '8px',
              background:     '#1e293b',
              border:         '1px solid #334155',
              color:          '#94a3b8',
              cursor:         'pointer',
            }}
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Action selector ──────────────────────────────────────── */}
          <div>
            <p style={sectionLabel}>การดำเนินการ</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(Object.keys(actionConfig) as CircularAction[]).map((act) => {
                const cfg = actionConfig[act];
                const isSelected = action === act;
                return (
                  <label
                    key={act}
                    htmlFor={`${uid}-action-${act}`}
                    style={{
                      flex:           1,
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      padding:        '10px',
                      borderRadius:   '10px',
                      background:     isSelected ? cfg.bg : '#1e293b',
                      border:         `2px solid ${isSelected ? cfg.color : '#334155'}`,
                      color:          isSelected ? cfg.color : '#64748b',
                      fontSize:       '13px',
                      fontWeight:     600,
                      cursor:         'pointer',
                      transition:     'all 0.15s ease',
                      gap:            '6px',
                    }}
                  >
                    <input
                      type="radio"
                      id={`${uid}-action-${act}`}
                      name={`${uid}-action`}
                      value={act}
                      checked={action === act}
                      onChange={() => setAction(act)}
                      style={{ display: 'none' }}
                    />
                    {isSelected && <FiCheck size={14} />}
                    {cfg.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Approval context (SELF / ACTING) ─────────────────────── */}
          <div>
            <p style={sectionLabel}>บริบทการลงนาม</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* SELF option — always shown */}
              <label
                htmlFor={`${uid}-ctx-self`}
                style={contextOptionStyle(approvalContext === 'SELF', '#6366f1')}
              >
                <input
                  type="radio"
                  id={`${uid}-ctx-self`}
                  name={`${uid}-context`}
                  value="SELF"
                  checked={approvalContext === 'SELF'}
                  onChange={() => setApprovalContext('SELF')}
                  style={{ display: 'none' }}
                />
                <span style={radioDotStyle(approvalContext === 'SELF', '#6366f1')} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiUser size={15} style={{ color: '#6366f1' }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>ลงนามในนามตนเอง</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>ใช้สิทธิ์ตามตำแหน่งของตนเอง</p>
                  </div>
                </div>
              </label>

              {/* ACTING option — conditional on hasActingPermission */}
              {hasActingPermission && (
                <label
                  htmlFor={`${uid}-ctx-acting`}
                  style={contextOptionStyle(approvalContext === 'ACTING', '#f59e0b')}
                >
                  <input
                    type="radio"
                    id={`${uid}-ctx-acting`}
                    name={`${uid}-context`}
                    value="ACTING"
                    checked={approvalContext === 'ACTING'}
                    onChange={() => setApprovalContext('ACTING')}
                    style={{ display: 'none' }}
                  />
                  <span style={radioDotStyle(approvalContext === 'ACTING', '#f59e0b')} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <FiAlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#f59e0b' }}>
                        ลงนามในฐานะรักษาการ
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#92400e' }}>
                        ⚠️ การลงนามนี้จะถูกบันทึกในระบบ Audit Log ว่าเป็นการรักษาการ
                      </p>
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* ── Delegation selector (only when ACTING) ───────────────── */}
          {approvalContext === 'ACTING' && hasActingPermission && (
            <div
              style={{
                padding:      '14px',
                background:   '#451a03',
                border:       '1px solid #92400e',
                borderRadius: '10px',
                animation:    'fadeIn 0.2s ease',
              }}
            >
              <p style={{ ...sectionLabel, color: '#fbbf24', marginBottom: '8px' }}>
                เลือกคำสั่งมอบอำนาจที่จะใช้
              </p>
              {activeDelegations.length === 0 ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#f59e0b' }}>
                  ไม่พบการมอบอำนาจที่ active สำหรับบัญชีของคุณ
                </p>
              ) : (
                <div style={{ position: 'relative' }}>
                  <select
                    id={`${uid}-delegation-select`}
                    value={selectedDelegation ?? ''}
                    onChange={(e) => setSelectedDelegation(Number(e.target.value))}
                    style={{
                      width:        '100%',
                      background:   '#1c1400',
                      border:       '1px solid #92400e',
                      borderRadius: '8px',
                      color:        '#fbbf24',
                      padding:      '9px 32px 9px 12px',
                      fontSize:     '13px',
                      fontWeight:   600,
                      outline:      'none',
                      appearance:   'none',
                    }}
                  >
                    {activeDelegations.map((d) => (
                      <option key={d.delegation_id} value={d.delegation_id}>
                        รักษาการแทน {d.assigner_name} ({d.delegated_role})
                      </option>
                    ))}
                  </select>
                  <FiChevronDown
                    size={14}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#f59e0b', pointerEvents: 'none' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Next owner (only for APPROVE action if options provided) ─ */}
          {action === 'APPROVE' && nextOwnerOptions.length > 0 && (
            <div>
              <p style={sectionLabel}>ส่งต่อให้</p>
              <div style={{ position: 'relative' }}>
                <select
                  id={`${uid}-next-owner`}
                  value={nextOwnerId ?? ''}
                  onChange={(e) => setNextOwnerId(Number(e.target.value))}
                  style={{
                    width:        '100%',
                    background:   '#1e293b',
                    border:       '1px solid #334155',
                    borderRadius: '8px',
                    color:        '#f1f5f9',
                    padding:      '9px 32px 9px 12px',
                    fontSize:     '13px',
                    outline:      'none',
                    appearance:   'none',
                  }}
                >
                  <option value="">-- เลือกผู้รับขั้นตอนถัดไป --</option>
                  {nextOwnerOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}{u.position ? ` — ${u.position}` : ''})
                    </option>
                  ))}
                </select>
                <FiChevronDown
                  size={14}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}
                />
              </div>
            </div>
          )}

          {/* ── Comment ──────────────────────────────────────────────── */}
          <div>
            <p style={sectionLabel}>
              หมายเหตุ{action !== 'APPROVE' && ' *'}
            </p>
            <textarea
              id={`${uid}-comment`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={action === 'APPROVE' ? 'หมายเหตุเพิ่มเติม (ถ้ามี)' : 'ระบุเหตุผลการดำเนินการ...'}
              style={{
                width:        '100%',
                background:   '#1e293b',
                border:       '1px solid #334155',
                borderRadius: '8px',
                color:        '#f1f5f9',
                padding:      '10px 12px',
                fontSize:     '13px',
                resize:       'vertical',
                outline:      'none',
                fontFamily:   "'Inter', 'Sarabun', sans-serif",
                boxSizing:    'border-box',
              }}
            />
          </div>

          {/* ── Error ────────────────────────────────────────────────── */}
          {error && (
            <div
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '8px',
                padding:      '10px 14px',
                background:   '#7f1d1d',
                border:       '1px solid #ef4444',
                borderRadius: '8px',
                color:        '#fca5a5',
                fontSize:     '13px',
              }}
            >
              <FiAlertTriangle size={15} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display:        'flex',
            justifyContent: 'flex-end',
            gap:            '12px',
            padding:        '16px 24px 20px',
            borderTop:      '1px solid #1e293b',
          }}
        >
          <button
            id={`${uid}-cancel`}
            onClick={onClose}
            disabled={submitting}
            style={{
              padding:      '10px 20px',
              background:   '#1e293b',
              border:       '1px solid #334155',
              borderRadius: '10px',
              color:        '#94a3b8',
              fontSize:     '14px',
              fontWeight:   600,
              cursor:       submitting ? 'not-allowed' : 'pointer',
              fontFamily:   "'Inter', 'Sarabun', sans-serif",
            }}
          >
            ยกเลิก
          </button>
          <button
            id={`${uid}-submit`}
            onClick={handleSubmit}
            disabled={submitting || (approvalContext === 'ACTING' && !selectedDelegation && hasActingPermission)}
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '8px',
              padding:        '10px 24px',
              background:     submitting ? '#1e293b' : `${currentAction.bg}`,
              border:         `1px solid ${submitting ? '#334155' : currentAction.color}`,
              borderRadius:   '10px',
              color:          submitting ? '#475569' : currentAction.color,
              fontSize:       '14px',
              fontWeight:     700,
              cursor:         submitting ? 'not-allowed' : 'pointer',
              fontFamily:     "'Inter', 'Sarabun', sans-serif",
              transition:     'all 0.15s ease',
            }}
          >
            {submitting
              ? <><FiLoader size={14} style={{ animation: 'spin 1s linear infinite' }} /> กำลังดำเนินการ...</>
              : <><FiCheck size={14} /> {currentAction.label}</>
            }
          </button>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

// ─── Style helpers ────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  margin:        '0 0 8px',
  fontSize:      '11px',
  fontWeight:    700,
  color:         '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
};

const contextOptionStyle = (active: boolean, color: string): React.CSSProperties => ({
  display:        'flex',
  alignItems:     'center',
  gap:            '12px',
  padding:        '12px 14px',
  background:     active ? `${color}11` : '#1e293b',
  border:         `1.5px solid ${active ? color : '#334155'}`,
  borderRadius:   '10px',
  cursor:         'pointer',
  transition:     'all 0.15s ease',
  width:          '100%',
  boxSizing:      'border-box' as const,
});

const radioDotStyle = (active: boolean, color: string): React.CSSProperties => ({
  width:        '16px',
  height:       '16px',
  borderRadius: '50%',
  border:       `2px solid ${active ? color : '#475569'}`,
  background:   active ? color : 'transparent',
  flexShrink:   0,
  transition:   'all 0.15s ease',
  boxShadow:    active ? `0 0 0 3px ${color}33` : 'none',
});

export default WorkflowActionModal;

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { workflowApi, adminApi, DelegationItem } from '../../api/apiService';

export type WorkflowActionType = 'submitToHr' | 'submitToGrpLeader' | 'delegate' | 'submitReview' | 'approve' | 'reject' | 'actingApprove' | 'actingReject';

interface WorkflowActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionType: WorkflowActionType;
  docId: number | null;
  users: any[];
  /** delegation ที่ active ของ user ที่ login — ใช้สำหรับแสดง Radio context */
  activeDelegations?: DelegationItem[];
  /** delegation id ของ task ที่กดเข้ามา (สำหรับ Acting Inbox) */
  preSelectedDelegationId?: number | null;
}

export default function WorkflowActionModal({
  isOpen, onClose, onSuccess, actionType, docId, users, activeDelegations = [], preSelectedDelegationId
}: WorkflowActionModalProps) {
  const [comments, setComments]           = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | ''>('');
  const [submitting, setSubmitting]       = useState(false);

  // บริบทการลงนาม: SELF = ตนเอง, ACTING = รักษาการแทน
  const [approvalContext, setApprovalContext] = useState<'SELF' | 'ACTING'>('SELF');
  // delegation ที่เลือก (เมื่อ approvalContext = 'ACTING')
  const [selectedDelegationId, setSelectedDelegationId] = useState<number | ''>('');

  const [dynamicUsers, setDynamicUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const hasActiveDelegations = activeDelegations.length > 0;
  // แสดงตัวเลือก delegation หรือ radio group
  const isActingAction = actionType === 'actingApprove' || actionType === 'actingReject';
  const showContextSelector  = (actionType === 'approve' || isActingAction) && hasActiveDelegations;

  useEffect(() => {
    if (!isOpen) return;

    // --- Step 1: resolve initial context & delegation ---
    setComments('');
    const initContext = (actionType === 'actingApprove' || actionType === 'actingReject') ? 'ACTING' : 'SELF';
    setApprovalContext(initContext);

    let resolvedDelegationId: number | '' = '';
    if (initContext === 'ACTING') {
      if (preSelectedDelegationId) {
        resolvedDelegationId = preSelectedDelegationId;
      } else if (activeDelegations.length === 1) {
        resolvedDelegationId = activeDelegations[0].delegation_id;
      }
    }
    setSelectedDelegationId(resolvedDelegationId);

    if (users.length === 1 && (actionType === 'reject' || actionType === 'actingReject')) {
      setSelectedUserId(`${users[0].a_id}-0`);
    } else {
      setSelectedUserId('');
    }

    // --- Step 2: load dynamic users (skip for reject flows) ---
    if (actionType === 'reject' || actionType === 'actingReject') return;

    // If ACTING but no delegation resolved yet, skip (user must pick manually)
    if (initContext === 'ACTING' && !resolvedDelegationId) {
      setDynamicUsers([]);
      return;
    }

    const ACTION_ROLE_MAP: Record<string, string[]> = {
      submitToHr: ['HR_DIRECTOR'],
      submitToGrpLeader: ['GRP_LEADER'],
      delegate: ['DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF'],
      approve: ['HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'COORDINATOR'],
      actingApprove: ['HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'COORDINATOR'],
    };

    const roles = ACTION_ROLE_MAP[actionType] || [];
    if (roles.length > 0) {
      setLoadingUsers(true);
      adminApi.getUsersByRole(
        roles,
        initContext,
        initContext === 'ACTING' && resolvedDelegationId ? Number(resolvedDelegationId) : undefined
      ).then(u => {
        setDynamicUsers(u || []);
        setLoadingUsers(false);
      }).catch(e => {
        console.error('Failed to load dynamic users', e);
        setDynamicUsers([]);
        setLoadingUsers(false);
      });
    } else {
      setDynamicUsers([]);
    }
  }, [isOpen, actionType, activeDelegations, preSelectedDelegationId]);

  // Re-load when user manually changes delegation (approve with context selector)
  useEffect(() => {
    if (!isOpen) return;
    if (actionType === 'reject' || actionType === 'actingReject') return;
    if (!showContextSelector) return; // only for manual selection flows
    if (approvalContext === 'ACTING' && !selectedDelegationId) {
      setDynamicUsers([]);
      return;
    }
    const ACTION_ROLE_MAP: Record<string, string[]> = {
      approve: ['HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'COORDINATOR'],
    };
    const roles = ACTION_ROLE_MAP[actionType] || [];
    if (roles.length > 0) {
      setLoadingUsers(true);
      adminApi.getUsersByRole(
        roles,
        approvalContext,
        approvalContext === 'ACTING' && selectedDelegationId ? Number(selectedDelegationId) : undefined
      ).then(u => {
        setDynamicUsers(u || []);
        setLoadingUsers(false);
      }).catch(() => {
        setDynamicUsers([]);
        setLoadingUsers(false);
      });
    }
  }, [approvalContext, selectedDelegationId]);

  if (!isOpen || !docId) return null;

  const getActionConfig = () => {
    switch (actionType) {
      case 'submitToHr':    return { title: 'ส่งให้ ผอ. ศูนย์สารสนเทศฯ', buttonText: 'ส่งเรื่อง', requiresUser: true };
      case 'submitToGrpLeader': return { title: 'ส่งให้ หัวหน้าฝ่าย (GRP_LEADER)', buttonText: 'ส่งเรื่อง', requiresUser: true };
      case 'delegate':      return { title: 'มอบหมายงาน',                  buttonText: 'มอบหมาย',  requiresUser: true };
      case 'submitReview':  return { title: 'ส่งผลการดำเนินงาน',           buttonText: 'ส่งผล',    requiresUser: false };
      case 'approve':       return { title: 'อนุมัติ / เห็นชอบ',           buttonText: approvalContext === 'ACTING' ? 'อนุมัติในฐานะรักษาการ' : 'อนุมัติ', requiresUser: true };
      case 'actingApprove': return { title: 'ดำเนินการ (ในฐานะรักษาการ)', buttonText: 'ดำเนินการ', requiresUser: true };
      case 'reject':        return { title: 'ตีกลับ / ส่งแก้ไข',           buttonText: 'ตีกลับ',   requiresUser: true };
      case 'actingReject':  return { title: 'ส่งงานกลับ (ในฐานะรักษาการ)', buttonText: 'ส่งกลับ',   requiresUser: true };
      default:              return { title: 'ดำเนินการ',                     buttonText: 'ยืนยัน',  requiresUser: false };
    }
  };

  const config = getActionConfig();
  
  const effectiveUsers = (actionType === 'reject' || actionType === 'actingReject') ? users : dynamicUsers;

  // Dynamic button color: amber สำหรับ ACTING, emerald สำหรับ SELF
  const buttonColorClass = approvalContext === 'ACTING'
    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200/50'
    : 'bg-emerald-600 hover:bg-emerald-700 text-white';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (config.requiresUser && !selectedUserId) {
      Swal.fire('Error', 'กรุณาเลือกผู้รับมอบหมาย/ผู้รับผิดชอบ', 'error');
      return;
    }
    if (showContextSelector && approvalContext === 'ACTING' && !selectedDelegationId) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกตำแหน่งที่ต้องการรักษาการแทน', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const targetUserId = selectedUserId ? Number(String(selectedUserId).split('-')[0]) : 0;

      if (actionType === 'submitToHr') {
        await workflowApi.submitToHr(docId, targetUserId, comments);
      } else if (actionType === 'submitToGrpLeader') {
        await workflowApi.submitToGrpLeader(docId, targetUserId, comments);
      } else if (actionType === 'delegate') {
        await workflowApi.delegate(docId, targetUserId, comments);
      } else if (actionType === 'submitReview') {
        await workflowApi.submitReview(docId, comments);
      } else if (actionType === 'approve' || actionType === 'actingApprove') {
        await workflowApi.approve(
          docId,
          targetUserId,
          comments,
          approvalContext,
          approvalContext === 'ACTING' ? Number(selectedDelegationId) : undefined,
        );
      } else if (actionType === 'reject' || actionType === 'actingReject') {
        await workflowApi.reject(
          docId, 
          targetUserId, 
          comments, 
          approvalContext, 
          approvalContext === 'ACTING' ? Number(selectedDelegationId) : undefined
        );
      }

      Swal.fire('สำเร็จ', 'ดำเนินการเรียบร้อยแล้ว', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('ข้อผิดพลาด', error.response?.data?.message || error.message || 'ไม่สามารถดำเนินการได้', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className={`bx ${actionType === 'approve' || actionType === 'actingApprove' ? 'bx-check-circle text-emerald-500' : actionType === 'reject' || actionType === 'actingReject' ? 'bx-x-circle text-red-500' : 'bx-message-square-detail text-emerald-500'} text-xl`}></i>
            {config.title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100">
            <i className="bx bx-x text-2xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">

          {/* ── Approval Context Selector (compact banner style) ── */}
          {showContextSelector && (
            <div className="space-y-2">
              {/* Option 1: SELF */}
              {!isActingAction && (
                <label
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                    approvalContext === 'SELF'
                      ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="approvalContext"
                    value="SELF"
                    checked={approvalContext === 'SELF'}
                    onChange={() => setApprovalContext('SELF')}
                    className="accent-emerald-600"
                  />
                  <i className="bx bx-user text-lg text-emerald-600"></i>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800">ดำเนินการในนามตนเอง</div>
                    <div className="text-xs text-slate-400">ใช้สิทธิ์ปกติของตนเอง</div>
                  </div>
                  {approvalContext === 'SELF' && (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold">เลือกอยู่</span>
                  )}
                </label>
              )}

              {/* Option 2: ACTING — one per delegation */}
              {activeDelegations.map(del => (
                <label
                  key={del.delegation_id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                    approvalContext === 'ACTING' && selectedDelegationId === del.delegation_id
                      ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300'
                      : 'bg-slate-50 border-slate-200 hover:border-amber-200'
                  }`}
                >
                  {(!isActingAction || activeDelegations.length > 1) && (
                    <input
                      type="radio"
                      name="approvalContext"
                      value="ACTING"
                      checked={approvalContext === 'ACTING' && selectedDelegationId === del.delegation_id}
                      onChange={() => { setApprovalContext('ACTING'); setSelectedDelegationId(del.delegation_id); }}
                      className="accent-amber-500"
                    />
                  )}
                  <i className="bx bx-shield-check text-lg text-amber-500"></i>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-amber-800">
                      รักษาการแทน <span className="text-amber-600">{del.assigner_name}</span>
                    </div>
                    <div className="text-xs text-slate-400">{del.assigner_position || del.assigner_role || 'ไม่ระบุตำแหน่ง'}</div>
                  </div>
                  {approvalContext === 'ACTING' && selectedDelegationId === del.delegation_id && (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">เลือกอยู่</span>
                  )}
                </label>
              ))}
            </div>
          )}

          {/* User selector (submitToHr, delegate, reject) */}
          {config.requiresUser && (
            <div className="animate__animated animate__fadeInUp animate__faster animate__delay-1s">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ผู้รับมอบหมาย / ผู้รับผิดชอบ <span className="text-emerald-600 font-normal text-xs ml-2">(พบ {effectiveUsers.length} รายชื่อ)</span>
              </label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-slate-500 py-2">
                  <i className="bx bx-loader-alt animate-spin"></i> กำลังโหลดรายชื่อ...
                </div>
              ) : actionType === 'reject' || actionType === 'actingReject' ? (
                <div>
                  {users.length === 0 ? (
                    <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm">
                      <i className="bx bx-info-circle mr-2"></i>ไม่พบข้อมูลผู้ดำเนินการก่อนหน้า
                    </div>
                  ) : (
                    <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
                      {users.map((u: any, idx: number) => (
                        <div
                          key={`${u.a_id}-${idx}`}
                          className="flex items-center gap-3 px-4 py-3 border-b border-red-100 last:border-0"
                        >
                          <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            <i className="bx bx-user text-lg"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 text-sm">{u.a_name}</div>
                            <div className="text-xs text-slate-500">{u.a_position || u.a_role || 'ไม่ระบุตำแหน่ง'}</div>
                          </div>
                          {/* Badge บอกฐานะของผู้รับงาน */}
                          {u.isActing ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                              <i className="bx bx-shield-check"></i> รักษาการแทน {u.actingFor}
                            </span>
                          ) : (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                              <i className="bx bx-user"></i> ปกติ
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>

                  <select
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">-- เลือกบุคคล --</option>
                    {effectiveUsers.length === 0 ? (
                      <option disabled value="">ไม่พบบุคคลที่มีสิทธิ์รับมอบหมายในขณะนี้</option>
                    ) : (
                      effectiveUsers.map((u, i) => (
                        <option key={`${u.a_id}-${i}`} value={`${u.a_id}-${i}`}>
                          {u.a_name} ({u.a_position || u.a_role})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">ความคิดเห็น / ข้อความสั่งการ</label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              placeholder="ระบุข้อความเพิ่มเติม..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 ${buttonColorClass}`}
          >
            {submitting ? <i className="bx bx-loader-alt animate-spin"></i> : <i className="bx bx-check"></i>}
            {config.buttonText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

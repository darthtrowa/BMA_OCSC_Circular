import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { workflowApi, adminApi, DelegationItem } from '../../api/apiService';

export type WorkflowActionType = 'forward' | 'reject' | 'actingReject';

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
  /** บังคับบริบทของการกระทำ (เช่น มาจากกล่องข้อความส่วนตัว หรือ กล่องรักษาการ) */
  initContext?: 'SELF' | 'ACTING';
}

export default function WorkflowActionModal({
  isOpen, onClose, onSuccess, actionType, docId, users, activeDelegations = [], preSelectedDelegationId, initContext
}: WorkflowActionModalProps) {
  const [comments, setComments]           = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | ''>('');
  const [submitting, setSubmitting]       = useState(false);

  // บริบทการลงนาม: SELF = ตนเอง, ACTING = รักษาการแทน
  const [approvalContext, setApprovalContext] = useState<'SELF' | 'ACTING'>('SELF');
  // delegation ที่เลือก (เมื่อ approvalContext = 'ACTING')
  const [selectedDelegationId, setSelectedDelegationId] = useState<number | ''>('');

  // When modal opens, sync context based on initContext or preSelectedDelegationId
  useEffect(() => {
    if (isOpen) {
      if (initContext) {
        setApprovalContext(initContext);
      } else if (actionType === 'actingReject') {
        setApprovalContext('ACTING');
      } else {
        setApprovalContext('SELF');
      }

      if (preSelectedDelegationId) {
        setSelectedDelegationId(preSelectedDelegationId);
      } else if (activeDelegations.length > 0) {
        setSelectedDelegationId(activeDelegations[0].delegation_id);
      }
    } else {
      setComments('');
      setSelectedUserId('');
      setSubmitting(false);
    }
  }, [isOpen, actionType, initContext, preSelectedDelegationId, activeDelegations]);

  const [autoUpAssignee, setAutoUpAssignee] = useState<any>(null);
  const [manualAssignees, setManualAssignees] = useState<any[]>([]);
  const [assignedAgencies, setAssignedAgencies] = useState<any[]>([]);
  const [useParallelAssign, setUseParallelAssign] = useState<boolean>(false);
  const [forwardMode, setForwardMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const hasActiveDelegations = activeDelegations.length > 0;
  // แสดงตัวเลือก delegation หรือ radio group
  const isActingAction = actionType === 'actingReject';
  const showContextSelector  = !initContext && (actionType === 'forward' || isActingAction) && hasActiveDelegations;

  useEffect(() => {
    if (!isOpen) return;

    // --- Step 1: resolve initial context & delegation ---
    setComments('');
    const resolvedInitContext = initContext ? initContext : (actionType === 'actingReject') ? 'ACTING' : 'SELF';
    setApprovalContext(resolvedInitContext);

    let resolvedDelegationId: number | '' = '';
    if (resolvedInitContext === 'ACTING') {
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
      setAutoUpAssignee(null);
      setManualAssignees([]);
      return;
    }

    if (actionType === 'forward') {
      setLoadingUsers(true);
      workflowApi.getNextAssignees(
        docId,
        resolvedInitContext,
        resolvedInitContext === 'ACTING' && resolvedDelegationId ? Number(resolvedDelegationId) : undefined
      ).then(res => {
        const { autoUpAssignee: upUser, manualAssignees: mUsers, assignedAgencies: ags, useParallelAssign: pAssign } = res.data;
        setAutoUpAssignee(upUser);
        setManualAssignees(mUsers || []);
        setAssignedAgencies(ags || []);
        setUseParallelAssign(pAssign || false);
        if (upUser) {
          setForwardMode('AUTO');
          const idToUse = upUser.acting_info ? upUser.acting_info.id : upUser.a_id;
          setSelectedUserId(`${idToUse}-0`);
        } else {
          setForwardMode('MANUAL');
          setSelectedUserId('');
        }
        setLoadingUsers(false);
      }).catch(err => {
        console.error('Failed to load dynamic assignees', err);
        setAutoUpAssignee(null);
        setManualAssignees([]);
        setLoadingUsers(false);
      });
    }
  }, [isOpen, actionType, activeDelegations, preSelectedDelegationId, docId]);

  // Re-load when user manually changes delegation (approve with context selector)
  useEffect(() => {
    if (!isOpen) return;
    if (actionType === 'reject' || actionType === 'actingReject') return;
    if (!showContextSelector) return; // only for manual selection flows
    if (approvalContext === 'ACTING' && !selectedDelegationId) {
      setAutoUpAssignee(null);
      setManualAssignees([]);
      return;
    }
    if (actionType === 'forward') {
      setLoadingUsers(true);
      workflowApi.getNextAssignees(
        docId,
        approvalContext,
        approvalContext === 'ACTING' && selectedDelegationId ? Number(selectedDelegationId) : undefined
      ).then(res => {
        const { autoUpAssignee: upUser, manualAssignees: mUsers, assignedAgencies: ags, useParallelAssign: pAssign } = res.data;
        setAutoUpAssignee(upUser);
        setManualAssignees(mUsers || []);
        setAssignedAgencies(ags || []);
        setUseParallelAssign(pAssign || false);
        if (upUser) {
          setForwardMode('AUTO');
          const idToUse = upUser.acting_info ? upUser.acting_info.id : upUser.a_id;
          setSelectedUserId(`${idToUse}-0`);
        } else {
          setForwardMode('MANUAL');
          setSelectedUserId('');
        }
        setLoadingUsers(false);
      }).catch((e) => {
        console.error('Failed to load next assignees:', e);
        setAutoUpAssignee(null);
        setManualAssignees([]);
        setLoadingUsers(false);
      });
    }
  }, [approvalContext, selectedDelegationId]);

  if (!isOpen || !docId) return null;

  const getActionConfig = () => {
    switch (actionType) {
      case 'forward':       return { title: 'เสนอเรื่อง / ส่งต่อ',           buttonText: approvalContext === 'ACTING' ? 'ส่งต่อ (รักษาการ)' : 'ส่งต่อ', requiresUser: true };
      case 'reject':        return { title: 'ตีกลับ / ส่งแก้ไข',           buttonText: 'ตีกลับ',   requiresUser: true };
      case 'actingReject':  return { title: 'ส่งงานกลับ (ในฐานะรักษาการ)', buttonText: 'ส่งกลับ',   requiresUser: true };
      default:              return { title: 'ดำเนินการ',                     buttonText: 'ยืนยัน',  requiresUser: false };
    }
  };

  const config = getActionConfig();
  const effectiveUsers = users;

  // Dynamic button color: amber สำหรับ ACTING, emerald สำหรับ SELF
  const buttonColorClass = approvalContext === 'ACTING'
    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200/50'
    : 'bg-emerald-600 hover:bg-emerald-700 text-white';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (config.requiresUser && !selectedUserId && !(actionType === 'forward' && useParallelAssign)) {
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

      if (actionType === 'reject' || actionType === 'actingReject') {
        await workflowApi.reject(
          docId, 
          targetUserId, 
          comments, 
          approvalContext, 
          approvalContext === 'ACTING' ? Number(selectedDelegationId) : undefined
        );
      } else {
        if (useParallelAssign) {
          if (assignedAgencies.length === 0) {
            Swal.fire('Error', 'ไม่พบข้อมูลส่วนราชการที่รับมอบ', 'error');
            setSubmitting(false);
            return;
          }
          await workflowApi.assignParallel(
            docId, 
            assignedAgencies.map(ag => ({ ag_id: ag.ag_id, ag_name: ag.ag_name })),
            approvalContext,
            approvalContext === 'ACTING' ? Number(selectedDelegationId) : undefined
          );
        } else {
          await workflowApi.forward(
            docId,
            targetUserId,
            comments,
            approvalContext,
            approvalContext === 'ACTING' ? Number(selectedDelegationId) : undefined,
          );
        }
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
            <i className={`bx ${actionType === 'forward' ? 'bx-check-circle text-emerald-500' : actionType === 'reject' || actionType === 'actingReject' ? 'bx-x-circle text-red-500' : 'bx-message-square-detail text-emerald-500'} text-xl`}></i>
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

          {/* User selector */}
          {config.requiresUser && (
            <div className="animate__animated animate__fadeInUp animate__faster animate__delay-1s">
              {actionType === 'reject' || actionType === 'actingReject' ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    ผู้รับมอบหมาย / ผู้รับผิดชอบ <span className="text-emerald-600 font-normal text-xs ml-2">(พบ {effectiveUsers.length} รายชื่อ)</span>
                  </label>
                  {users.length === 0 ? (
                    <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm">
                      <i className="bx bx-info-circle mr-2"></i>ไม่พบข้อมูลผู้ดำเนินการก่อนหน้า
                    </div>
                  ) : (
                    <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
                      {users.map((u: any, idx: number) => (
                        <div
                          key={`${u.a_id}-${idx}`}
                          onClick={() => setSelectedUserId(`${u.a_id}-0`)}
                          className={`flex items-center gap-3 px-4 py-3 border-b border-red-100 last:border-0 cursor-pointer transition-colors ${
                            selectedUserId === `${u.a_id}-0` ? 'bg-red-100/50' : 'hover:bg-red-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="rejectAssignee"
                            checked={selectedUserId === `${u.a_id}-0`}
                            onChange={() => setSelectedUserId(`${u.a_id}-0`)}
                            className="accent-red-500"
                          />
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            selectedUserId === `${u.a_id}-0` ? 'bg-red-200 text-red-700' : 'bg-red-100 text-red-600'
                          }`}>
                            <i className="bx bx-user text-lg"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 text-sm">{u.a_name}</div>
                            <div className="text-xs text-slate-500">{u.a_position || u.a_role || 'ไม่ระบุตำแหน่ง'}</div>
                          </div>
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                            <i className="bx bx-user"></i> ตำแหน่งปกติ
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : actionType === 'forward' ? (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700">รูปแบบการส่งต่อ</label>
                  {loadingUsers ? (
                    <div className="flex items-center gap-2 text-slate-500 py-2">
                      <i className="bx bx-loader-alt animate-spin"></i> กำลังโหลดข้อมูลผู้รับ...
                    </div>
                  ) : useParallelAssign ? (
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-slate-800">
                        ส่งต่อให้ส่วนราชการที่รับมอบ ({assignedAgencies.length} ส่วนราชการ)
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                        {assignedAgencies.length === 0 ? (
                          <div className="text-sm text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100">
                            ไม่พบข้อมูลส่วนราชการที่รับมอบ กรุณากลับไปแก้ไขข้อมูลหนังสือ
                          </div>
                        ) : (
                          assignedAgencies.map((ag: any, idx: number) => (
                            <div key={idx} className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                                <i className="bx bx-user text-sm"></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                {ag.div_director_name ? (
                                  <>
                                    <div className="text-sm font-semibold text-indigo-900">{ag.div_director_name}</div>
                                    <div className="text-xs text-indigo-700 mt-0.5">
                                      {ag.div_director_position}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm font-semibold text-rose-600">
                                    <i className="bx bx-error-circle mr-1"></i>ไม่มีข้อมูลผู้อำนวยการกอง
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                  <i className="bx bx-buildings"></i> {ag.ag_name}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {autoUpAssignee && (
                        <div 
                          onClick={() => {
                            setForwardMode('AUTO');
                            const idToUse = autoUpAssignee.acting_info ? autoUpAssignee.acting_info.id : autoUpAssignee.a_id;
                            setSelectedUserId(`${idToUse}-0`);
                          }}
                          className={`p-4 border rounded-xl cursor-pointer transition-colors ${
                            forwardMode === 'AUTO' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${forwardMode === 'AUTO' ? 'border-emerald-500' : 'border-slate-300'}`}>
                              {forwardMode === 'AUTO' && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 text-sm">
                                {autoUpAssignee.a_role === 'DIV_DIRECTOR' ? 'ส่งต่อไปยัง ผอ.กอง:' : 'เสนอเรื่องขึ้นไปที่:'} <span className="font-bold">
                                  {autoUpAssignee.acting_info ? (
                                    <>
                                      <i className="bx bx-shield-check text-amber-500 mr-1"></i>
                                      รักษาการแทน {autoUpAssignee.acting_info.position || 'หัวหน้ากลุ่มงาน'}
                                      {autoUpAssignee.acting_info.name && (
                                        <span className="block text-xs font-normal text-slate-500 mt-1">
                                          ({autoUpAssignee.acting_info.name})
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {autoUpAssignee.a_position || (autoUpAssignee.a_role === 'GRP_LEADER' ? 'หัวหน้ากลุ่มงาน' : autoUpAssignee.a_role)}
                                      {autoUpAssignee.a_name && (
                                        <span className="block text-xs font-normal text-slate-500 mt-1">
                                          ({autoUpAssignee.a_name})
                                        </span>
                                      )}
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {manualAssignees.length > 0 && !autoUpAssignee && (
                        <div 
                        onClick={() => {
                          setForwardMode('MANUAL');
                          setSelectedUserId('');
                        }}
                        className={`p-4 border rounded-xl cursor-pointer transition-colors ${
                          forwardMode === 'MANUAL' ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500' : 'border-slate-200 hover:border-amber-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${forwardMode === 'MANUAL' ? 'border-amber-500' : 'border-slate-300'}`}>
                            {forwardMode === 'MANUAL' && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />}
                          </div>
                          <div className="font-medium text-slate-900 text-sm">มอบหมายงาน / ส่งข้ามสายงาน</div>
                        </div>

                        {forwardMode === 'MANUAL' && (
                          <div onClick={e => e.stopPropagation()}>
                            <select
                              value={selectedUserId}
                              onChange={e => setSelectedUserId(e.target.value)}
                              required={forwardMode === 'MANUAL'}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
                            >
                              <option value="">-- เลือกผู้รับมอบหมาย --</option>
                              {manualAssignees.length === 0 ? (
                                <option disabled value="">ไม่พบบุคคลที่สามารถมอบหมายได้</option>
                              ) : (
                                manualAssignees.map((u, i) => {
                                  const idToUse = u.acting_info ? u.acting_info.id : u.a_id;
                                  const nameToUse = u.acting_info ? u.acting_info.name : u.a_name;
                                  const posToUse = u.acting_info ? u.acting_info.position : (u.a_position || u.ag_name || u.a_role);
                                  return (
                                    <option key={`${idToUse}-${i}`} value={`${idToUse}-0`}>
                                      {nameToUse} ({posToUse}) {u.acting_info ? `[รักษาการแทน ${u.a_name}]` : ''}
                                    </option>
                                  );
                                })
                              )}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                  )}
                </div>
              ) : null}
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

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { workflowApi, DelegationItem } from '../../api/apiService';

export type WorkflowActionType = 'submitToHr' | 'delegate' | 'submitReview' | 'approve' | 'reject';

interface WorkflowActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionType: WorkflowActionType;
  docId: number | null;
  users: any[];
  /** delegation ที่ active ของ user ที่ login — ใช้สำหรับแสดง Radio context */
  activeDelegations?: DelegationItem[];
}

export default function WorkflowActionModal({
  isOpen, onClose, onSuccess, actionType, docId, users, activeDelegations = []
}: WorkflowActionModalProps) {
  const [comments, setComments]           = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [submitting, setSubmitting]       = useState(false);

  // บริบทการลงนาม: SELF = ตนเอง, ACTING = รักษาการแทน
  const [approvalContext, setApprovalContext] = useState<'SELF' | 'ACTING'>('SELF');
  // delegation ที่เลือก (เมื่อ approvalContext = 'ACTING')
  const [selectedDelegationId, setSelectedDelegationId] = useState<number | ''>('');

  const hasActiveDelegations = activeDelegations.length > 0;
  // แสดง radio group เฉพาะ actionType = 'approve' และมี delegation
  const showContextSelector  = actionType === 'approve' && hasActiveDelegations;

  useEffect(() => {
    if (isOpen) {
      setComments('');
      setApprovalContext('SELF');
      setSelectedDelegationId('');
      if (users.length === 1 && actionType === 'reject') {
        setSelectedUserId(users[0].a_id);
      } else {
        setSelectedUserId('');
      }
    }
  }, [isOpen, users, actionType]);

  // auto-select delegation ถ้ามีเพียงอันเดียว
  useEffect(() => {
    if (approvalContext === 'ACTING' && activeDelegations.length === 1) {
      setSelectedDelegationId(activeDelegations[0].delegation_id);
    } else if (approvalContext === 'SELF') {
      setSelectedDelegationId('');
    }
  }, [approvalContext, activeDelegations]);

  if (!isOpen || !docId) return null;

  const getActionConfig = () => {
    switch (actionType) {
      case 'submitToHr':    return { title: 'ส่งให้ ผอ. ศูนย์สารสนเทศฯ', buttonText: 'ส่งเรื่อง', requiresUser: true };
      case 'delegate':      return { title: 'มอบหมายงาน',                  buttonText: 'มอบหมาย',  requiresUser: true };
      case 'submitReview':  return { title: 'ส่งผลการดำเนินงาน',           buttonText: 'ส่งผล',    requiresUser: false };
      case 'approve':       return { title: 'อนุมัติ / เห็นชอบ',           buttonText: approvalContext === 'ACTING' ? 'อนุมัติในฐานะรักษาการ' : 'อนุมัติ', requiresUser: false };
      case 'reject':        return { title: 'ตีกลับ / ส่งแก้ไข',           buttonText: 'ตีกลับ',   requiresUser: true };
      default:              return { title: 'ดำเนินการ',                     buttonText: 'ยืนยัน',  requiresUser: false };
    }
  };

  const config = getActionConfig();

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
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกคำสั่งการรักษาการที่ต้องการอ้างอิง', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (actionType === 'submitToHr') {
        await workflowApi.submitToHr(docId, Number(selectedUserId), comments);
      } else if (actionType === 'delegate') {
        await workflowApi.delegate(docId, Number(selectedUserId), comments);
      } else if (actionType === 'submitReview') {
        await workflowApi.submitReview(docId, comments);
      } else if (actionType === 'approve') {
        await workflowApi.approve(
          docId,
          comments,
          approvalContext,
          approvalContext === 'ACTING' ? Number(selectedDelegationId) : undefined,
        );
      } else if (actionType === 'reject') {
        await workflowApi.reject(docId, Number(selectedUserId), comments);
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
            <i className={`bx ${actionType === 'approve' ? 'bx-check-circle text-emerald-500' : actionType === 'reject' ? 'bx-x-circle text-red-500' : 'bx-message-square-detail text-emerald-500'} text-xl`}></i>
            {config.title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100">
            <i className="bx bx-x text-2xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">

          {/* ── Approval Context Selector (approve + active delegations เท่านั้น) ── */}
          {showContextSelector && (
            <div className="rounded-xl border-2 border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">เลือกบริบทการลงนาม</p>
              </div>

              {/* Option 1: SELF */}
              <label
                className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors border-b border-slate-100 ${approvalContext === 'SELF' ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
              >
                <input
                  type="radio"
                  name="approvalContext"
                  value="SELF"
                  checked={approvalContext === 'SELF'}
                  onChange={() => setApprovalContext('SELF')}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bx bx-user text-emerald-600"></i>
                    ลงนามในนามตนเอง (ตนเอง)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">อนุมัติในฐานะสิทธิ์ปกติของตนเอง</div>
                </div>
              </label>

              {/* Option 2: ACTING — แสดงทุก active delegation */}
              {activeDelegations.map(del => (
                <label
                  key={del.delegation_id}
                  className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ${approvalContext === 'ACTING' && selectedDelegationId === del.delegation_id ? 'bg-amber-50 border-l-4 border-l-amber-400' : 'hover:bg-amber-50/50'}`}
                >
                  <input
                    type="radio"
                    name="approvalContext"
                    value="ACTING"
                    checked={approvalContext === 'ACTING' && selectedDelegationId === del.delegation_id}
                    onChange={() => {
                      setApprovalContext('ACTING');
                      setSelectedDelegationId(del.delegation_id);
                    }}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                      <i className="bx bx-shield-check text-amber-500"></i>
                      ลงนามในฐานะผู้รักษาการแทน
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md font-semibold">
                        รักษาการแทน: {del.assigner_name}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md font-semibold">
                        {del.delegated_role}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      เลขที่คำสั่ง: {del.order_number}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Acting Warning Banner */}
          {approvalContext === 'ACTING' && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
              <i className="bx bx-error text-lg mt-0.5 shrink-0"></i>
              <p className="text-xs leading-relaxed">
                <strong>คุณกำลังลงนามในฐานะผู้รักษาการ</strong> การกระทำนี้จะถูกบันทึกพร้อมคำสั่งมอบอำนาจไว้ในประวัติตรวจสอบ
              </p>
            </div>
          )}

          {/* User selector (submitToHr, delegate, reject) */}
          {config.requiresUser && (
            <div>
              {actionType === 'reject' ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">ส่งเรื่องกลับไปยัง</label>
                  {users.length === 0 ? (
                    <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm">
                      <i className="bx bx-info-circle mr-2"></i>ไม่พบข้อมูลผู้ดำเนินการก่อนหน้า
                    </div>
                  ) : (
                    <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <i className="bx bx-user text-lg"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{users[0].a_name}</div>
                        <div className="text-xs text-slate-500">{users[0].a_position || users[0].a_role || 'ไม่ระบุตำแหน่ง'}</div>
                      </div>
                      <span className="ml-auto text-[10px] font-bold px-2 py-1 bg-red-100 text-red-600 rounded-full">ผู้ดำเนินการก่อนหน้า</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    ระบุบุคคลเป้าหมาย <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">-- เลือกบุคคล --</option>
                    {users.length === 0 ? (
                      <option disabled value="">ไม่พบบุคคลที่มีสิทธิ์รับมอบหมายในขณะนี้</option>
                    ) : (
                      users.map(u => (
                        <option key={u.a_id} value={u.a_id}>
                          {u.a_name} — {u.a_position || u.a_role || 'ไม่ระบุตำแหน่ง'}
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

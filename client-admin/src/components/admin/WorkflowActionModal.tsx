import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { workflowApi } from '../../api/apiService';

export type WorkflowActionType = 'submitToHr' | 'delegate' | 'submitReview' | 'approve' | 'reject';

interface WorkflowActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionType: WorkflowActionType;
  docId: number | null;
  users: any[];
}

export default function WorkflowActionModal({ isOpen, onClose, onSuccess, actionType, docId, users }: WorkflowActionModalProps) {
  const [comments, setComments] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setComments('');
      if (users.length === 1 && actionType === 'reject') {
        setSelectedUserId(users[0].a_id);
      } else {
        setSelectedUserId('');
      }
    }
  }, [isOpen, users, actionType]);

  if (!isOpen || !docId) return null;

  const getActionConfig = () => {
    switch (actionType) {
      case 'submitToHr': return { title: 'ส่งให้ ผอ. ศูนย์สารสนเทศฯ', buttonText: 'ส่งเรื่อง', requiresUser: true, userRoleFilter: ['HR_DIRECTOR'] };
      case 'delegate': return { title: 'มอบหมายงาน', buttonText: 'มอบหมาย', requiresUser: true, userRoleFilter: ['DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF'] };
      case 'submitReview': return { title: 'ส่งผลการดำเนินงาน', buttonText: 'ส่งผล', requiresUser: false, userRoleFilter: [] };
      case 'approve': return { title: 'อนุมัติ / เห็นชอบ', buttonText: 'อนุมัติ', requiresUser: false, userRoleFilter: [] };
      case 'reject': return { title: 'ตีกลับ / ส่งแก้ไข', buttonText: 'ตีกลับ', requiresUser: true, userRoleFilter: ['DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF'] };
      default: return { title: 'ดำเนินการ', buttonText: 'ยืนยัน', requiresUser: false, userRoleFilter: [] };
    }
  };

  const config = getActionConfig();

  const filteredUsers = users; // Already filtered by role + active status from server

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (config.requiresUser && !selectedUserId) {
      Swal.fire('Error', 'กรุณาเลือกผู้รับมอบหมาย/ผู้รับผิดชอบ', 'error');
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
        await workflowApi.approve(docId, comments);
      } else if (actionType === 'reject') {
        await workflowApi.reject(docId, Number(selectedUserId), comments);
      }
      
      Swal.fire('สำเร็จ', 'ดำเนินการเรียบร้อยแล้ว', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('ข้อผิดพลาด', error.message || 'ไม่สามารถดำเนินการได้', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className={`bx ${actionType === 'approve' ? 'bx-check-circle text-emerald-500' : actionType === 'reject' ? 'bx-x-circle text-red-500' : 'bx-message-square-detail text-emerald-500'} text-xl`}></i>
            {config.title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100">
            <i className="bx bx-x text-2xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto">
          {config.requiresUser && (
            <div className="mb-4">
              {actionType === 'reject' ? (
                // Reject: show the previous person as a readonly info card
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">ส่งเรื่องกลับไปยัง</label>
                  {filteredUsers.length === 0 ? (
                    <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm">
                      <i className="bx bx-info-circle mr-2"></i>ไม่พบข้อมูลผู้ดำเนินการก่อนหน้า
                    </div>
                  ) : (
                    <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <i className="bx bx-user text-lg"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{filteredUsers[0].a_name}</div>
                        <div className="text-xs text-slate-500">{filteredUsers[0].a_position || filteredUsers[0].a_role || 'ไม่ระบุตำแหน่ง'}</div>
                      </div>
                      <span className="ml-auto text-[10px] font-bold px-2 py-1 bg-red-100 text-red-600 rounded-full">ผู้ดำเนินการก่อนหน้า</span>
                    </div>
                  )}
                </div>
              ) : (
                // Other actions: dropdown selector
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">ระบุบุคคลเป้าหมาย <span className="text-red-500">*</span></label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">-- เลือกบุคคล --</option>
                    {filteredUsers.length === 0 ? (
                      <option disabled value="">ไม่พบบุคคลที่มีสิทธิ์รับมอบหมายในขณะนี้</option>
                    ) : (
                      filteredUsers.map(u => (
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

          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">ความคิดเห็น / ข้อความสั่งการ</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              placeholder="ระบุข้อความเพิ่มเติม..."
            />
          </div>
        </form>

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
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
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

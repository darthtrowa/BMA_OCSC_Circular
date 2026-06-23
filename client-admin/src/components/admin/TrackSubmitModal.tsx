import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { workflowApi, DelegationItem } from '../../api/apiService';
import { useAuth } from '../../contexts/AuthContext';
import Swal from 'sweetalert2';

interface Props {
  isOpen: boolean;
  docId: number | null;
  preSelectedPaId?: number | null;
  allData: any;
  actionContext?: 'SELF' | 'ACTING';
  delegationId?: number | null;
  activeDelegations?: DelegationItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function TrackSubmitModal({
  isOpen,
  docId,
  preSelectedPaId,
  allData,
  actionContext = 'SELF',
  delegationId,
  activeDelegations = [],
  onClose,
  onSuccess
}: Props) {
  const { admin } = useAuth();
  const [paId, setPaId] = useState<number | null>(null);
  const [resultsId, setResultsId] = useState<number | ''>('');
  const [resultComments, setResultComments] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const results = allData?.results || [];

  useEffect(() => {
    if (!isOpen || !docId) return;
    setLoading(true);
    setPaId(null);
    setResultsId('');
    setResultComments('');

    workflowApi.getParallelTracks(docId)
      .then(res => {
        const list = res.data || [];
        
        // Determine the user ID to check (either assigner if acting, or current logged-in user)
        let checkId: string | number | undefined = admin?.id;
        if (actionContext === 'ACTING' && delegationId) {
          const matched = activeDelegations.find(d => Number(d.delegation_id) === Number(delegationId));
          if (matched) {
            checkId = matched.assigner_id;
          }
        }

        const track = preSelectedPaId 
          ? list.find((t: any) => Number(t.pa_id) === Number(preSelectedPaId))
          : list.find((t: any) => 
              Number(t.current_owner_id) === Number(checkId) && 
              ['PENDING', 'IN_PROGRESS'].includes(t.pa_status)
            );

        if (track) {
          setPaId(track.pa_id);
          if (track.results_id) setResultsId(Number(track.results_id));
          if (track.result_comments) setResultComments(track.result_comments);
        } else {
          Swal.fire('ข้อผิดพลาด', 'ไม่พบการมอบหมายของท่านที่ยังดำเนินการไม่เสร็จสิ้น', 'error');
          onClose();
        }
      })
      .catch(err => {
        console.error(err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลการมอบหมายได้', 'error');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [isOpen, docId, preSelectedPaId, actionContext, delegationId, admin, activeDelegations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId || !paId) return;
    if (!resultsId) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกผลการพิจารณา', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await workflowApi.parallelSave(
        docId,
        paId,
        resultComments,
        Number(resultsId),
        actionContext,
        actionContext === 'ACTING' && delegationId ? delegationId : undefined
      );

      Swal.fire({
        icon: 'success',
        text: 'บันทึกผลการพิจารณาสำเร็จ',
        timer: 1500,
        showConfirmButton: false
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !docId) return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <i className="bx bx-check-shield text-xl"></i>
            </div>
            <div>
              <h5 className="font-bold text-lg text-slate-800 m-0">ผลการพิจารณา</h5>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 hover:bg-red-100 hover:text-red-600 transition"
          >
            <i className="bx bx-x text-xl"></i>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <i className="bx bx-loader-alt animate-spin text-2xl mr-2"></i> กำลังโหลดข้อมูล...
            </div>
          ) : (
            <>
              {/* Dropdown: ผลการพิจารณา */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  ผลการพิจารณา <span className="text-red-500">*</span>
                </label>
                <select
                  value={resultsId}
                  onChange={e => setResultsId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                >
                  <option value="">-- เลือกผลการพิจารณา --</option>
                  {results.map((r: any) => (
                    <option key={r.results_id} value={r.results_id}>
                      {r.results_detail}
                    </option>
                  ))}
                </select>
              </div>

              {/* Textarea: การพิจารณาจากส่วนราชการ */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  การพิจารณาจากส่วนราชการ (ความคิดเห็น)
                </label>
                <textarea
                  value={resultComments}
                  onChange={e => setResultComments(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
                  placeholder="กรุณากรอกความคิดเห็นหรือรายละเอียดเพิ่มเติมเกี่ยวกับการพิจารณา..."
                />
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-sm transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading || !paId}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <><i className="bx bx-loader-alt animate-spin"></i> กำลังบันทึก...</>
            ) : (
              <><i className="bx bx-save"></i> บันทึก</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

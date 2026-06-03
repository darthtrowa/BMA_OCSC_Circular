import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { workflowApi } from '../../api/apiService';

interface WorkflowHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: number | null;
}

export default function WorkflowHistoryModal({ isOpen, onClose, docId }: WorkflowHistoryModalProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && docId) {
      loadHistory();
    } else {
      setHistory([]);
    }
  }, [isOpen, docId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await workflowApi.getHistory(docId!);
      if (data && data.success) {
        setHistory(data.data);
      }
    } catch (error) {
      console.error('Failed to load history', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !docId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className="bx bx-history text-emerald-500 text-xl"></i>
            ประวัติการดำเนินการ (Workflow History)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100">
            <i className="bx bx-x text-2xl"></i>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <i className="bx bx-loader-alt animate-spin text-3xl text-emerald-500"></i>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <i className="bx bx-info-circle text-4xl mb-2 text-slate-300"></i>
              <p>ยังไม่มีประวัติการดำเนินการ</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 pb-4">
              {history.map((h, idx) => (
                <div key={h.wh_id || idx} className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-sm"></div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-700 text-sm">
                        {h.action === 'STARTED' ? 'เริ่มกระบวนการ' :
                         h.action === 'SUBMITTED' ? 'ส่งเรื่อง' :
                         h.action === 'DELEGATED' ? 'มอบหมาย' :
                         h.action === 'REVIEWED' ? 'ส่งผลการดำเนินงาน' :
                         h.action === 'APPROVED' ? 'อนุมัติ' :
                         h.action === 'REJECTED' ? 'ตีกลับ' :
                         h.action === 'FINALIZED' ? 'เสร็จสิ้น' : h.action}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(h.created_at).toLocaleString('th-TH')}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mb-1">
                      <span className="font-semibold text-slate-800">{h.from_user_name || 'ระบบ'}</span>
                      {h.from_user_position && <span className="text-slate-400 text-xs ml-1">({h.from_user_position})</span>}
                      <i className="bx bx-right-arrow-alt mx-2 text-slate-400"></i>
                      <span className="font-semibold text-slate-800">{h.to_user_name || 'ระบบ'}</span>
                      {h.to_user_position && <span className="text-slate-400 text-xs ml-1">({h.to_user_position})</span>}
                    </div>
                    {h.comments && (
                      <div className="mt-2 bg-white p-3 rounded-lg border border-slate-100 text-sm text-slate-600 italic">
                        {h.comments}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

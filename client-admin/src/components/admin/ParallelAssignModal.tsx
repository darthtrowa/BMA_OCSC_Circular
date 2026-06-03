import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { adminApi, agencyApi, workflowApi } from '../../api/apiService';
import Swal from 'sweetalert2';

interface TrackRow {
  id: string; // temp UUID for UI keying
  ag_id?: number;
  ag_name?: string;
  toUserId: number | '';
}

interface Props {
  isOpen: boolean;
  docId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ParallelAssignModal({ isOpen, docId, onClose, onSuccess }: Props) {
  const [tracks, setTracks] = useState<TrackRow[]>([{ id: '1', toUserId: '' }]);
  const [hrDirectorId, setHrDirectorId] = useState<number | ''>('');
  const [comments, setComments] = useState('');
  const [agencies, setAgencies] = useState<any[]>([]);
  const [hrList, setHrList] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    Promise.all([
      agencyApi.getTree().catch(() => []),
      adminApi.getUsersByRole(['HR_DIRECTOR']).catch(() => []),
      adminApi.getUsersByRole(['HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF', 'COORDINATOR']).catch(() => []),
      adminApi.getProfile().catch(() => null),
    ]).then(([agTree, hr, users, profile]) => {
      // Get only the first level (root level) of the agency tree (where parent_ag_id is null)
      // Sorted by agency_ordering ascending to match organization tree management view
      const rootAgencies = (Array.isArray(agTree) ? agTree : [])
        .filter(n => n.parent_ag_id === null || n.parent_ag_id === undefined)
        .map(n => ({ ...n, depth: 0 }))
        .sort((a, b) => (a.agency_ordering || 0) - (b.agency_ordering || 0));
      setAgencies(rootAgencies);
      setHrList(hr || []);
      setAllUsers(users || []);

      const prof = profile?.response || profile;
      if (prof) {
        setCurrentUserProfile(prof);
      }
    }).finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTracks([{ id: Date.now().toString(), toUserId: '' }]);
      setHrDirectorId('');
      setComments('');
    }
  }, [isOpen]);

  const addTrack = () =>
    setTracks(prev => [...prev, { id: Date.now().toString(), toUserId: '' }]);

  const removeTrack = (id: string) =>
    setTracks(prev => prev.filter(t => t.id !== id));

  const updateTrack = (id: string, field: keyof TrackRow, value: any) =>
    setTracks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, [field]: value };
      // Auto-fill ag_name when ag_id changes
      if (field === 'ag_id') {
        const ag = agencies.find(a => a.ag_id === Number(value));
        updated.ag_name = ag?.ag_name || '';
      }
      return updated;
    }));

  const getUsersByAgency = (agId?: number) => {
    if (!agId) return [];
    let filtered = allUsers.filter((u: any) => Number(u.a_agency_id) === Number(agId));

    // Rule: Cross-department assignments must strictly be assigned to DIV_DIRECTOR or HR_DIRECTOR only.
    if (currentUserProfile && Number(agId) !== Number(currentUserProfile.a_agency_id)) {
      filtered = filtered.filter((u: any) => u.a_role === 'DIV_DIRECTOR' || u.a_role === 'HR_DIRECTOR');
    }
    return filtered;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId || !hrDirectorId) return;

    const validTracks = tracks.filter(t => t.toUserId !== '' && t.ag_id !== undefined && t.ag_id !== null);
    if (validTracks.length === 0) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกผู้รับมอบและส่วนราชการอย่างน้อย 1 ส่วนราชการ', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = validTracks.map(t => ({
        ag_id: t.ag_id,
        ag_name: t.ag_name,
        toUserId: Number(t.toUserId),
      }));
      await workflowApi.assignParallel(docId, Number(hrDirectorId), payload, comments);
      Swal.fire({ icon: 'success', text: `มอบหมายสำเร็จ (${validTracks.length} ส่วนราชการ)`, timer: 1800, showConfirmButton: false });
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <i className="bx bx-git-branch text-xl"></i>
            </div>
            <div>
              <h5 className="font-bold text-lg text-slate-800 m-0">ส่งให้พิจารณา</h5>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 hover:bg-red-100 hover:text-red-600 transition">
            <i className="bx bx-x text-xl"></i>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <i className="bx bx-loader-alt animate-spin text-2xl mr-2"></i> กำลังโหลด...
            </div>
          ) : (
            <>
              {/* HR Director Selector */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  ผู้อำนวยการ (HR Director) ผู้อนุมัติขั้นสุดท้าย <span className="text-red-500">*</span>
                </label>
                <select
                  value={hrDirectorId}
                  onChange={e => setHrDirectorId(Number(e.target.value))}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                >
                  <option value="">-- เลือก HR Director --</option>
                  {hrList.map((u: any) => (
                    <option key={u.a_id} value={u.a_id}>
                      {u.a_name} — {u.a_position || u.a_role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Parallel Tracks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700">
                    ส่วนราชการที่รับมอบ
                    <span className="ml-2 text-xs font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {tracks.length} ส่วนราชการ
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={addTrack}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                  >
                    <i className="bx bx-plus"></i> เพิ่มส่วนราชการ
                  </button>
                </div>

                <div className="space-y-3">
                  {tracks.map((track, idx) => {
                    const filteredUsers = getUsersByAgency(track.ag_id);
                    return (
                      <div key={track.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            ส่วนราชการที่ {idx + 1}
                          </span>
                          {tracks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTrack(track.id)}
                              className="text-rose-400 hover:text-rose-600 transition text-sm"
                              title="ลบลำดับนี้"
                            >
                              <i className="bx bx-trash"></i>
                            </button>
                          )}
                        </div>

                        {/* Agency Selector */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            ส่วนราชการ <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={track.ag_id ?? ''}
                            onChange={e => updateTrack(track.id, 'ag_id', e.target.value ? Number(e.target.value) : undefined)}
                            required
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                          >
                            <option value="">-- เลือกส่วนราชการ --</option>
                            {agencies.filter(a => a.ag_status === 'active').map((ag: any) => (
                              <option key={ag.ag_id} value={ag.ag_id}>
                                {'—'.repeat(ag.depth)} {ag.ag_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Person Selector */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            ผู้รับมอบ <span className="text-red-500">*</span>
                            {track.ag_id && filteredUsers.length === 0 && (
                              <span className="ml-1 text-amber-500">(ไม่มีบัญชีในส่วนราชการนี้)</span>
                            )}
                          </label>
                          <select
                            value={track.toUserId}
                            onChange={e => updateTrack(track.id, 'toUserId', e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                          >
                            <option value="">-- เลือกผู้รับมอบ --</option>
                            {filteredUsers.map((u: any) => (
                              <option key={u.a_id} value={u.a_id}>
                                {u.a_name} — {u.a_position || u.a_role}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">เนื้อความ</label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none"
                  placeholder="ระบุข้อความเพิ่มเติม..."
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
            onClick={handleSubmit as any}
            disabled={submitting || loading}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <><i className="bx bx-loader-alt animate-spin"></i> กำลังส่ง...</>
            ) : (
              <><i className="bx bx-git-branch"></i> ส่งไปพิจารณา ({tracks.filter(t => t.toUserId !== '').length} ส่วนราชการ)</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

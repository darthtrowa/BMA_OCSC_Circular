import { useEffect, useState } from 'react';
import { workflowApi, DelegationItem } from '../../api/apiService';
import { useAuth } from '../../contexts/AuthContext';

interface Track {
  pa_id: number;
  ag_name: string;
  pa_status: string;
  initial_owner_name: string;
  current_owner_name: string;
  current_owner_id: number;
  current_owner_position: string;
  result_comments: string;
  results_detail?: string;
}

interface Props {
  docId: number | null;
  isParallel?: boolean;
  canAct?: boolean;
  activeDelegations?: DelegationItem[];
  activeTabFromSidebar?: string;
  onRecordResult?: (paId: number) => void;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:     { label: 'รอดำเนินการ',       color: 'bg-slate-100 text-slate-600',    icon: 'bx-time' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ',    color: 'bg-blue-100 text-blue-700',     icon: 'bx-loader-alt' },
  SUBMITTED:   { label: 'ส่งผลแล้ว',          color: 'bg-emerald-100 text-emerald-700', icon: 'bx-check-circle' },
  REJECTED:    { label: 'ตีกลับ',             color: 'bg-red-100 text-red-700',       icon: 'bx-x-circle' },
};

export default function ParallelTracksPanel({ 
  docId, 
  isParallel, 
  canAct = false, 
  activeDelegations = [], 
  activeTabFromSidebar = 'inbox', 
  onRecordResult 
}: Props) {
  const { admin } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docId || !isParallel) return;
    setLoading(true);
    workflowApi.getParallelTracks(docId)
      .then(res => setTracks(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [docId, isParallel]);

  if (!isParallel || tracks.length === 0) return null;

  const submitted = tracks.filter(t => t.pa_status === 'SUBMITTED').length;
  const rejected  = tracks.filter(t => t.pa_status === 'REJECTED').length;
  const total     = tracks.length;
  const progress  = Math.round(((submitted + rejected) / total) * 100);

  return (
    <div className="mt-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm font-bold text-indigo-700">
          <i className="bx bx-git-branch text-lg"></i>
          <span>Parallel Tracks ({submitted + rejected}/{total} ส่วนราชการดำเนินการแล้ว)</span>
        </div>
        <span className="text-xs font-semibold text-indigo-500">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {loading ? (
        <div className="text-center text-indigo-500 text-sm py-2">
          <i className="bx bx-loader-alt animate-spin mr-2"></i>กำลังโหลด...
        </div>
      ) : (
        <div className="space-y-2">
          {tracks.map(track => {
            const st = STATUS_MAP[track.pa_status] || STATUS_MAP['PENDING'];
            
            // Check if this track belongs to the logged-in user (or their assigner if acting)
            const isMyTrack = Number(track.current_owner_id) === Number(admin?.id) || 
              (activeTabFromSidebar === 'acting' && activeDelegations.some(d => Number(d.assigner_id) === Number(track.current_owner_id)));

            const canSeeDetails = admin?.role === 'COORDINATOR' || 
              admin?.permiss === 'admin' || 
              admin?.permiss === 'superadmin' || 
              isMyTrack;

            return (
              <div key={track.pa_id} className="bg-white rounded-lg border border-indigo-100 p-3 flex items-start gap-3">
                <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${st.color}`}>
                  <i className={`bx ${st.icon} ${track.pa_status === 'IN_PROGRESS' ? 'animate-spin' : ''}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm truncate">
                      {track.ag_name || 'ส่วนราชการ'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  {canSeeDetails && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      ผู้ดำเนินการ: <span className="text-slate-700">{track.current_owner_name || track.initial_owner_name}</span>
                      {track.current_owner_position && ` — ${track.current_owner_position}`}
                    </div>
                  )}
                  {/* Consideration Result button inside the track card */}
                  {canAct && isMyTrack && ['PENDING', 'IN_PROGRESS'].includes(track.pa_status) && (
                    <button
                      type="button"
                      onClick={() => onRecordResult && onRecordResult(track.pa_id)}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition text-xs font-semibold flex items-center gap-1 border border-emerald-200"
                    >
                      <i className="bx bx-check-shield"></i> ผลการพิจารณา
                    </button>
                  )}
                  {track.results_detail && (
                    <div className="mt-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50/50 border border-emerald-100 rounded-lg px-2.5 py-1 flex items-center gap-1">
                      <i className="bx bx-check-shield text-sm"></i>
                      <span>ผลการพิจารณา: {track.results_detail}</span>
                    </div>
                  )}
                  {track.result_comments && (
                    <div className="mt-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 italic">
                      ความเห็น: "{track.result_comments}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

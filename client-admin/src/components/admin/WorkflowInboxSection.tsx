import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import WorkflowActionModal, { WorkflowActionType } from './WorkflowActionModal';
import WorkflowHistoryModal from './WorkflowHistoryModal';
import CircularModal from './CircularModal';
import ParallelAssignModal from './ParallelAssignModal';
import ParallelTracksPanel from './ParallelTracksPanel';
import { adminApi, workflowApi, delegationApi, DelegationItem } from '../../api/apiService';

interface WorkflowInboxSectionProps {
  allData: any;
  loading: boolean;
  onReload: () => void;
}

export default function WorkflowInboxSection({ allData, loading, onReload }: WorkflowInboxSectionProps) {
  const { admin } = useAuth();
  
  const [showActionModal, setShowActionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<WorkflowActionType>('submitToHr');
  
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [showParallelModal, setShowParallelModal] = useState(false);
  const [parallelDocId, setParallelDocId] = useState<number | null>(null);

  // Active delegations ของ user ที่ login — ใช้แสดง Acting Inbox และส่งเข้า WorkflowActionModal
  const [activeDelegations, setActiveDelegations] = useState<DelegationItem[]>([]);

  useEffect(() => {
    delegationApi.getMyActive()
      .then(data => setActiveDelegations(data || []))
      .catch(() => setActiveDelegations([]));
  }, []);

  // Role map for each action type
  const ACTION_ROLE_MAP: Record<string, string[]> = {
    submitToHr: ['HR_DIRECTOR'],
    delegate: ['DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF'],
    reject: ['DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF', 'COORDINATOR'],
    submitReview: [],
    approve: [],
  };

  const handleAction = async (docId: number, type: WorkflowActionType) => {
    setSelectedDocId(docId);
    setActionType(type);
    
    if (type === 'reject') {
      setUsersLoading(true);
      try {
        const res = await workflowApi.getHistory(docId);
        const historyList = res.data || [];
        // Find the last history item where this admin received it
        const myLastReceive = [...historyList].reverse().find((h: any) => Number(h.to_user_id) === Number(admin?.id));
        if (myLastReceive && myLastReceive.from_user_id) {
          setUsers([{
            a_id: myLastReceive.from_user_id,
            a_name: myLastReceive.from_user_name,
            a_position: myLastReceive.from_user_position,
            a_role: 'ผู้ดำเนินการก่อนหน้า'
          }]);
        } else {
          setUsers([]);
        }
      } catch (e) {
        console.error('Failed to load history for reject', e);
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    } else {
      const roles = ACTION_ROLE_MAP[type] || [];
      if (roles.length > 0) {
        setUsersLoading(true);
        try {
          const u = await adminApi.getUsersByRole(roles);
          setUsers(u || []);
        } catch (e) {
          console.error('Failed to load users', e);
          setUsers([]);
        } finally {
          setUsersLoading(false);
        }
      } else {
        setUsers([]);
      }
    }
    setShowActionModal(true);
  };

  const info = allData?.information || [];
  
  // Filter only documents currently assigned to the logged-in user
  const myTasks = info.filter((item: any) => Number(item.in_current_owner_id) === Number(admin?.id));

  // Documents created by COORDINATOR that are not DRAFT (to monitor)
  const myCreatedTasks = info.filter((item: any) => 
    Number(item.in_creator_id) === Number(admin?.id) && 
    Number(item.in_current_owner_id) !== Number(admin?.id)
  );

  // All active workflow tasks for SYSTEM_ADMIN (view-only)
  const isSuper = admin?.role === 'SYSTEM_ADMIN' || admin?.permiss === 'superadmin';
  const systemAdminTasks = isSuper 
    ? info.filter((item: any) => item.in_workflow_status && item.in_workflow_status !== 'DRAFT')
    : [];

  // ── Acting Inbox ──────────────────────────────────────────────────────────────────────────
  // งานที่ผู้มอบอำนาจ (assigner) เป็น current_owner — ผู้รักษาการจะมองเห็นและดำเนินการแทนได้
  const actingAssignerIds = activeDelegations.map(d => d.assigner_id);
  const actingTasks = actingAssignerIds.length > 0
    ? info.filter((item: any) =>
        actingAssignerIds.includes(Number(item.in_current_owner_id)) &&
        item.in_workflow_status && item.in_workflow_status !== 'DRAFT'
      )
    : [];

  const handleHistory = (docId: number) => {
    setSelectedDocId(docId);
    setShowHistoryModal(true);
  };

  const renderStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string, color: string }> = {
      'DRAFT': { label: 'ฉบับร่าง', color: 'bg-slate-100 text-slate-700' },
      'PENDING_HR_APPROVAL': { label: 'รอ ผอ.ศูนย์ฯ พิจารณา', color: 'bg-amber-100 text-amber-700' },
      'PENDING_DELEGATION': { label: 'รอมอบหมาย', color: 'bg-blue-100 text-blue-700' },
      'PENDING_EXECUTION': { label: 'รอเจ้าหน้าที่ดำเนินการ', color: 'bg-indigo-100 text-indigo-700' },
      'PENDING_REVIEW': { label: 'รอตรวจสอบผล', color: 'bg-purple-100 text-purple-700' },
      'PENDING_PARALLEL': { label: 'รอผลหลายส่วนราชการ', color: 'bg-violet-100 text-violet-700' },
      'COMPLETED': { label: 'เสร็จสิ้น', color: 'bg-emerald-100 text-emerald-700' },
      'REJECTED': { label: 'ถูกตีกลับ', color: 'bg-red-100 text-red-700' },
    };

    const s = statusMap[status || 'DRAFT'];
    if (!s) return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700">{status}</span>;
    return <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${s.color}`}>{s.label}</span>;
  };

  const renderTaskRow = (item: any, isOwner: boolean) => (
    <tr key={item.in_id} className="hover:bg-slate-50 border-b border-slate-100 transition last:border-0">
      <td className="px-6 py-4 align-top">
        <div className="font-bold text-slate-800">{item.in_num_date}</div>
        <div className="text-xs text-slate-500 mt-1">{item.in_doc_date ? `ลงวันที่ ${item.in_doc_date}` : ''}</div>
      </td>
      <td className="px-6 py-4 align-top">
        <div className="text-slate-700 line-clamp-2 max-w-[350px] mb-2">{item.in_detail}</div>
        <ParallelTracksPanel docId={item.in_id} isParallel={!!item.in_is_parallel} />
      </td>
      <td className="px-6 py-4 align-top">
        {renderStatusBadge(item.in_workflow_status)}
      </td>
      <td className="px-6 py-4 align-top text-right">
        <div className="flex justify-end gap-2">
          <button 
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition text-xs font-semibold flex items-center gap-1"
            onClick={() => handleHistory(item.in_id)}
          >
            <i className="bx bx-history"></i> ประวัติ
          </button>

          {/* Pencil edit button: shown for COORDINATOR on their own DRAFT or REJECTED items */}
          {isOwner && admin?.role === 'COORDINATOR' && ['DRAFT', 'REJECTED'].includes(item.in_workflow_status) && (
            <button
              className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition text-xs font-semibold flex items-center gap-1"
              onClick={() => { setEditItem(item); setShowEditModal(true); }}
              title="แก้ไขข้อมูลก่อนส่ง"
            >
              <i className="bx bx-pencil"></i> แก้ไข
            </button>
          )}
          
          {isOwner && admin?.role === 'COORDINATOR' && ['DRAFT', 'REJECTED'].includes(item.in_workflow_status) && (
            <button className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition text-xs font-semibold" onClick={() => handleAction(item.in_id, 'submitToHr')}>
              ส่งให้ ผอ.ศูนย์ฯ
            </button>
          )}

          {isOwner && admin?.role === 'COORDINATOR' && ['DRAFT', 'REJECTED'].includes(item.in_workflow_status) && (
            <button
              className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition text-xs font-semibold flex items-center gap-1"
              onClick={() => { setParallelDocId(item.in_id); setShowParallelModal(true); }}
              title="ส่งให้หลายส่วนราชการพิจารณาร่วมกัน"
            >
              <i className="bx bx-git-branch"></i> ส่งไปพิจารณา
            </button>
          )}

          {isOwner && ['HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER'].includes(admin?.role || '') && (
            <button className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition text-xs font-semibold" onClick={() => handleAction(item.in_id, 'delegate')}>
              มอบหมาย
            </button>
          )}

          {isOwner && admin?.role === 'STAFF' && (
            <button className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition text-xs font-semibold" onClick={() => handleAction(item.in_id, 'submitReview')}>
              ส่งผลการดำเนินงาน
            </button>
          )}

          {isOwner && ['HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER'].includes(admin?.role || '') && item.in_workflow_status === 'PENDING_REVIEW' && (
            <button className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition text-xs font-semibold" onClick={() => handleAction(item.in_id, 'approve')}>
              อนุมัติ
            </button>
          )}

          {isOwner && admin?.role !== 'COORDINATOR' && !['COMPLETED', 'REJECTED', 'DRAFT'].includes(item.in_workflow_status) && (
            <button className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition text-xs font-semibold" onClick={() => handleAction(item.in_id, 'reject')}>
              ตีกลับ
            </button>
          )}

          {isOwner && admin?.role === 'COORDINATOR' && item.in_workflow_status === 'COMPLETED' && (
            <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition text-xs font-semibold" onClick={() => {
               // In a real app, this might just acknowledge or archive the task.
               // For now we just show it's completed.
               alert('งานเสร็จสมบูรณ์แล้ว');
               onReload();
            }}>
              รับทราบ
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      {admin?.permiss !== 'superadmin' && (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl">
              <i className="bx bx-task"></i>
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-800 m-0 font-saochingcha">กล่องข้อความงาน (Inbox)</h4>
              <p className="text-slate-500 m-0 text-sm">งานที่รอการพิจารณาหรือดำเนินการของคุณ</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <i className="bx bx-loader-alt animate-spin text-3xl text-emerald-500"></i>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">เลขที่หนังสือ / วันที่</th>
                    <th className="px-6 py-4 font-semibold">เรื่อง</th>
                    <th className="px-6 py-4 font-semibold">สถานะ</th>
                    <th className="px-6 py-4 font-semibold text-right">เครื่องมือ</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {myTasks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-500">
                        ไม่มีงานที่ต้องดำเนินการ
                      </td>
                    </tr>
                  )}
                  {myTasks.map(item => renderTaskRow(item, true))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* For Coordinators: Show tasks they created that are currently in progress */}
      {admin?.role === 'COORDINATOR' && myCreatedTasks.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
          <div className="p-6 border-b border-slate-100">
            <h4 className="text-lg font-bold text-slate-800 m-0 font-saochingcha">งานที่กำลังดำเนินการ (ติดตาม)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">เลขที่หนังสือ</th>
                  <th className="px-6 py-4 font-semibold">เรื่อง</th>
                  <th className="px-6 py-4 font-semibold">สถานะ</th>
                  <th className="px-6 py-4 font-semibold text-right">เครื่องมือ</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {myCreatedTasks.map(item => renderTaskRow(item, false))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Acting Inbox — งานรักษาการ (amber theme) */}
      {actingTasks.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border-2 border-amber-200">
          <div className="p-6 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
              <i className="bx bx-shield-quarter"></i>
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-bold text-amber-800 m-0 font-saochingcha flex items-center gap-2">
                กล่องงานรักษาการ (Acting Inbox)
                <span className="px-2 py-0.5 bg-amber-400 text-white text-xs font-bold rounded-full">
                  {actingTasks.length}
                </span>
              </h4>
              <p className="text-amber-600 m-0 text-sm">งานที่คุณรักษาการแทนผู้มอบอำนาจ</p>
            </div>
            {/* แสดง delegation badge ทั้งหมด */}
            <div className="flex flex-col gap-1">
              {activeDelegations.map(d => (
                <span key={d.delegation_id} className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[11px] font-semibold rounded-lg flex items-center gap-1">
                  <i className="bx bx-shield-check text-sm"></i>
                  รักษาการแทน: {d.assigner_name} ({d.delegated_role})
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <i className="bx bx-loader-alt animate-spin text-3xl text-amber-500"></i>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-amber-50 text-xs uppercase text-amber-600 tracking-wide border-b border-amber-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">เลขที่หนังสือ / วันที่</th>
                    <th className="px-6 py-4 font-semibold">เรื่อง</th>
                    <th className="px-6 py-4 font-semibold">สถานะ</th>
                    <th className="px-6 py-4 font-semibold text-right">เครื่องมือ</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {actingTasks.map(item => (
                    <tr key={`acting-${item.in_id}`} className="hover:bg-amber-50/50 border-b border-amber-100 transition last:border-0">
                      <td className="px-6 py-4 align-top">
                        <div className="font-bold text-slate-800">{item.in_num_date}</div>
                        <div className="text-xs text-slate-500 mt-1">{item.in_doc_date ? `ลงวันที่ ${item.in_doc_date}` : ''}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="text-slate-700 line-clamp-2 max-w-[350px] mb-2">{item.in_detail}</div>
                        <ParallelTracksPanel docId={item.in_id} isParallel={!!item.in_is_parallel} />
                      </td>
                      <td className="px-6 py-4 align-top">
                        {renderStatusBadge(item.in_workflow_status)}
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition text-xs font-semibold flex items-center gap-1"
                            onClick={() => handleHistory(item.in_id)}
                          >
                            <i className="bx bx-history"></i> ประวัติ
                          </button>
                          {/* ผู้รักษาการสามารถ approve (เหมือนผู้มอบอำนาจ) */}
                          {item.in_workflow_status === 'PENDING_REVIEW' && (
                            <button
                              className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition text-xs font-semibold flex items-center gap-1"
                              onClick={() => handleAction(item.in_id, 'approve')}
                            >
                              <i className="bx bx-shield-check"></i> อนุมัติ (รักษาการ)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* For System Admin: Show all active workflow tasks for monitoring */}
      {isSuper && (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
          <div className="p-6 border-b border-slate-100 flex items-center gap-2">
            <i className="bx bx-shield-quarter text-xl text-slate-500"></i>
            <h4 className="text-lg font-bold text-slate-800 m-0 font-saochingcha">ภาพรวมงานในระบบ Workflow (System Admin)</h4>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <i className="bx bx-loader-alt animate-spin text-3xl text-emerald-500"></i>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">เลขที่หนังสือ</th>
                    <th className="px-6 py-4 font-semibold">เรื่อง</th>
                    <th className="px-6 py-4 font-semibold">สถานะ</th>
                    <th className="px-6 py-4 font-semibold text-right">เครื่องมือ</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {systemAdminTasks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-500">
                        ไม่มีงานในระบบ
                      </td>
                    </tr>
                  ) : (
                    systemAdminTasks.map(item => renderTaskRow(item, false))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <WorkflowActionModal 
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        onSuccess={onReload}
        actionType={actionType}
        docId={selectedDocId}
        users={users}
        activeDelegations={activeDelegations}
      />

      <WorkflowHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        docId={selectedDocId}
      />

      {showEditModal && editItem && (
        <CircularModal
          allData={allData}
          editItem={editItem}
          onClose={() => { setShowEditModal(false); setEditItem(null); }}
          onSaved={() => { setShowEditModal(false); setEditItem(null); onReload(); }}
          mode="task-submit"
        />
      )}

      <ParallelAssignModal
        isOpen={showParallelModal}
        docId={parallelDocId}
        onClose={() => { setShowParallelModal(false); setParallelDocId(null); }}
        onSuccess={onReload}
      />
    </div>
  );
}

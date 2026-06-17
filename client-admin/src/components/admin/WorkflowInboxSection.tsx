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
  activeTabFromSidebar?: string;
}

export default function WorkflowInboxSection({ allData, loading, onReload, activeTabFromSidebar = 'inbox' }: WorkflowInboxSectionProps) {
  const { admin } = useAuth();
  
  const [showActionModal, setShowActionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<WorkflowActionType>('forward');
  const [actionContext, setActionContext] = useState<'SELF' | 'ACTING'>('SELF');
  const [selectedTaskDelegationId, setSelectedTaskDelegationId] = useState<number | null>(null);
  
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [showParallelModal, setShowParallelModal] = useState(false);
  const [parallelDocId, setParallelDocId] = useState<number | null>(null);

  // Active delegations ของ user ที่ login — ใช้แสดง Acting Inbox และส่งเข้า WorkflowActionModal
  const [activeDelegations, setActiveDelegations] = useState<DelegationItem[]>([]);
  // Delegations ที่ user ที่ login เป็นผู้มอบอำนาจ (Assigner) — ใช้สำหรับซ่อนปุ่ม Action
  const [myDelegated, setMyDelegated] = useState<DelegationItem[]>([]);

  useEffect(() => {
    delegationApi.getMyActive()
      .then(data => setActiveDelegations(data || []))
      .catch(() => setActiveDelegations([]));

    delegationApi.getMyDelegated()
      .then(data => setMyDelegated(data || []))
      .catch(() => setMyDelegated([]));
  }, []);

  // Role map for each action type
  const ACTION_ROLE_MAP: Record<string, string[]> = {
    forward: ['HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF', 'COORDINATOR'],
    reject: ['DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF', 'COORDINATOR']
  };

  const handleAction = async (docId: number, type: WorkflowActionType, delegationId?: number) => {
    setSelectedDocId(docId);
    setActionType(type);
    setActionContext(activeTabFromSidebar === 'acting' ? 'ACTING' : 'SELF');
    setSelectedTaskDelegationId(delegationId || null);
    
    if (type === 'reject' || type === 'actingReject') {
      setUsersLoading(true);
      try {
        const context = activeTabFromSidebar === 'acting' ? 'ACTING' : 'SELF';
        const res = await workflowApi.getRejectAssignees(docId, context, delegationId);
        setUsers(res.data || []);
      } catch (e) {
        console.error('Failed to load assignees for reject', e);
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    } else {
      setUsers([]);
    }
    setShowActionModal(true);
  };



  const info = allData?.information || [];

  const checkIsCurrentOwner = (item: any, userId: number | string | undefined) => {
    if (!userId) return false;
    if (item.in_is_parallel && item.parallel_owner_ids) {
      const pIds = String(item.parallel_owner_ids).split(',').map(Number);
      return pIds.includes(Number(userId));
    }
    return Number(item.in_current_owner_id) === Number(userId);
  };
  
  // Filter only documents currently assigned to the logged-in user
  const myTasks = info.filter((item: any) => checkIsCurrentOwner(item, admin?.id));

  // Tasks already processed by me (sent/returned) but no longer in my inbox — for tracking
  const myProcessedTasks = info.filter((item: any) =>
    item.in_processed_by_me === true &&
    !checkIsCurrentOwner(item, admin?.id) &&
    !['DRAFT', 'COMPLETED'].includes(item.in_workflow_status)
  );

  // Documents created by COORDINATOR that are not DRAFT (to monitor)
  const myCreatedTasks = info.filter((item: any) => 
    Number(item.in_creator_id) === Number(admin?.id) && 
    !checkIsCurrentOwner(item, admin?.id)
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
    ? info
        .filter((item: any) =>
          actingAssignerIds.some(id => checkIsCurrentOwner(item, id)) &&
          item.in_workflow_status && item.in_workflow_status !== 'DRAFT'
        )
        .map((item: any) => {
          // หา delegation ที่ตรงกับ owner ของ item นี้
          const matchedDelegation = activeDelegations.find(
            d => checkIsCurrentOwner(item, d.assigner_id)
          );
          return { ...item, _delegationId: matchedDelegation?.delegation_id ?? null };
        })
    : [];

  const handleHistory = (docId: number) => {
    setSelectedDocId(docId);
    setShowHistoryModal(true);
  };

  const renderStatusBadge = (item: any) => {
    const status = item.in_workflow_status || 'DRAFT';
    const flowState = item.in_flow_state;
    const statusMap: Record<string, { label: string, color: string }> = {
      'DRAFT': { label: 'ฉบับร่าง', color: 'bg-slate-100 text-slate-700' },
      'PENDING_HR_APPROVAL': { label: 'รอ ผอ.ศูนย์ฯ พิจารณา', color: 'bg-amber-100 text-amber-700' },
      'PENDING_GRP_REVIEW': { label: 'อยู่ระหว่างหัวหน้าพิจารณา', color: 'bg-orange-100 text-orange-700' },
      'PENDING_DELEGATION': { label: 'รอมอบหมาย', color: 'bg-blue-100 text-blue-700' },
      'PENDING_EXECUTION': { label: 'รอเจ้าหน้าที่ดำเนินการ', color: 'bg-indigo-100 text-indigo-700' },
      'PENDING_REVIEW': { label: 'รอตรวจสอบผล', color: 'bg-purple-100 text-purple-700' },
      'PENDING_PARALLEL': { label: 'รอผลหลายส่วนราชการ', color: 'bg-violet-100 text-violet-700' },
      'COMPLETED': { label: 'เสร็จสิ้น', color: 'bg-emerald-100 text-emerald-700' },
      'REJECTED': { label: 'ถูกตีกลับ', color: 'bg-red-100 text-red-700' },
    };

    const s = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
    
    return (
      <div className="flex flex-col gap-1 items-start">
        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${s.color}`}>{s.label}</span>
        {flowState === 'out' && <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-sky-100 text-sky-700"><i className="bx bx-right-arrow-alt"></i> ส่งออก</span>}
        {flowState === 'in' && <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-fuchsia-100 text-fuchsia-700"><i className="bx bx-left-arrow-alt"></i> รับเข้า</span>}
        {flowState === 'end' && <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-700"><i className="bx bx-check-double"></i> จบงาน</span>}
      </div>
    );
  };

  const renderTaskRow = (item: any, isOwner: boolean) => {
    const canAct = isOwner;

    return (
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
        {renderStatusBadge(item)}
      </td>
      <td className="px-6 py-4 align-top text-right">
        <div className="flex justify-end gap-2">
          <button 
            className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition text-xs font-semibold flex items-center gap-1"
            onClick={() => { setViewItem(item); setShowViewModal(true); }}
            title="ดูรายละเอียด"
          >
            <i className="bx bx-show"></i> ดู
          </button>
          <button 
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition text-xs font-semibold flex items-center gap-1"
            onClick={() => handleHistory(item.in_id)}
          >
            <i className="bx bx-history"></i> ประวัติ
          </button>

          {/* Pencil edit button: shown for COORDINATOR on DRAFT/REJECTED, and STAFF on active tasks */}
          {canAct && item.in_workflow_status !== 'COMPLETED' && (
            (admin?.role === 'COORDINATOR' && ['DRAFT', 'REJECTED'].includes(item.in_workflow_status)) ||
            (admin?.role === 'STAFF')
          ) && (
            <button
              className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition text-xs font-semibold flex items-center gap-1"
              onClick={() => { setEditItem(item); setShowEditModal(true); }}
              title={admin?.role === 'STAFF' ? "บันทึกข้อมูลพิจารณา" : "แก้ไขข้อมูลก่อนส่ง"}
            >
              <i className="bx bx-pencil"></i> แก้ไข
            </button>
          )}
          
          {canAct && !['COMPLETED'].includes(item.in_workflow_status) && (
            <button className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition text-xs font-semibold flex items-center gap-1" onClick={() => handleAction(item.in_id, 'forward')}>
              <i className="bx bx-share"></i> เสนอเรื่อง / ส่งต่อ
            </button>
          )}

          {canAct && !['STAFF', 'COORDINATOR'].includes(admin?.role || '') && !['COMPLETED', 'REJECTED', 'DRAFT'].includes(item.in_workflow_status) && item.in_flow_state !== 'in' && (
            <button className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition text-xs font-semibold flex items-center gap-1" onClick={() => handleAction(item.in_id, 'reject')}>
              <i className="bx bx-undo"></i> ส่งงานกลับ
            </button>
          )}

          {canAct && admin?.role === 'COORDINATOR' && item.in_workflow_status === 'COMPLETED' && (
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
  };

  return (
    <div className="space-y-6">
      {admin?.permiss !== 'superadmin' && activeTabFromSidebar === 'inbox' && (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden animate__animated animate__fadeIn">
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
      {admin?.role === 'COORDINATOR' && activeTabFromSidebar === 'inbox' && myCreatedTasks.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden opacity-75 hover:opacity-100 transition-opacity animate__animated animate__fadeIn">
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

      {/* Processed Tasks Tracking — งานที่ดำเนินการไปแล้ว (ติดตามสถานะ) */}
      {admin?.permiss !== 'superadmin' && activeTabFromSidebar === 'tracking' && (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-sky-100 animate__animated animate__fadeIn">
          <div className="p-6 border-b border-sky-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center text-xl">
              <i className="bx bx-send"></i>
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-800 m-0 font-saochingcha">งานที่ดำเนินการแล้ว (ติดตาม)</h4>
              <p className="text-slate-500 m-0 text-sm">งานที่คุณเคยส่งหรือตีกลับ และยังอยู่ระหว่างดำเนินการในระบบ</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            {myProcessedTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                ไม่มีงานที่กำลังติดตาม
              </div>
            ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-sky-50 text-xs uppercase text-sky-600 tracking-wide border-b border-sky-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">เลขที่หนังสือ / วันที่</th>
                  <th className="px-6 py-4 font-semibold">เรื่อง</th>
                  <th className="px-6 py-4 font-semibold">สถานะปัจจุบัน</th>
                  <th className="px-6 py-4 font-semibold text-right">เครื่องมือ</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {myProcessedTasks.map((item: any) => (
                  <tr key={`processed-${item.in_id}`} className="hover:bg-sky-50/40 border-b border-sky-100 transition last:border-0">
                    <td className="px-6 py-4 align-top">
                      <div className="font-bold text-slate-800">{item.in_num_date}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.in_doc_date ? `ลงวันที่ ${item.in_doc_date}` : ''}</div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="text-slate-700 line-clamp-2 max-w-[350px]">{item.in_detail}</div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {renderStatusBadge(item)}
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition text-xs font-semibold flex items-center gap-1"
                          onClick={() => { setViewItem(item); setShowViewModal(true); }}
                          title="ดูรายละเอียด"
                        >
                          <i className="bx bx-show"></i> ดู
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition text-xs font-semibold flex items-center gap-1"
                          onClick={() => handleHistory(item.in_id)}
                        >
                          <i className="bx bx-history"></i> ประวัติ
                        </button>
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

      {/* Acting Inbox — งานรักษาการ (amber theme) */}
      {admin?.permiss !== 'superadmin' && activeTabFromSidebar === 'acting' && (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border-2 border-amber-200 animate__animated animate__fadeIn">
          <div className="p-6 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
                <i className="bx bx-shield-quarter"></i>
              </div>
              <div>
                <h4 className="text-xl font-bold text-amber-800 m-0 font-saochingcha flex items-center gap-2">
                  กล่องงานรักษาการ (Acting Inbox)
                </h4>
                <p className="text-amber-600 m-0 text-sm">งานที่คุณรักษาการแทนผู้มอบอำนาจ</p>
              </div>
            </div>
            {/* แสดง delegation badge ทั้งหมด */}
            <div className="flex flex-wrap gap-2">
              {activeDelegations.map(d => (
                <span key={d.delegation_id} className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[11px] font-semibold rounded-lg flex items-center gap-1">
                  <i className="bx bx-shield-check text-sm"></i>
                  {d.is_position_delegation
                    ? `รักษาการ${d.assigner_name}`
                    : `รักษาการแทน: ${d.assigner_name} (${d.delegated_role})`}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <i className="bx bx-loader-alt animate-spin text-3xl text-amber-500"></i>
              </div>
            ) : actingTasks.length === 0 ? (
              <div className="text-center py-12 text-amber-600/70">
                ไม่มีงานรักษาการที่ต้องดำเนินการ
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
                        {renderStatusBadge(item)}
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition text-xs font-semibold flex items-center gap-1"
                            onClick={() => { setViewItem(item); setShowViewModal(true); }}
                            title="ดูรายละเอียด"
                          >
                            <i className="bx bx-show"></i> ดู
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition text-xs font-semibold flex items-center gap-1"
                            onClick={() => handleHistory(item.in_id)}
                          >
                            <i className="bx bx-history"></i> ประวัติ
                          </button>
                          {/* ผู้รักษาการสามารถ forward (เหมือนผู้มอบอำนาจ) */}
                          {!['COMPLETED'].includes(item.in_workflow_status) && (
                            <button
                              className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition text-xs font-semibold flex items-center gap-1"
                              onClick={() => handleAction(item.in_id, 'forward', item._delegationId)}
                            >
                              <i className="bx bx-share"></i> เสนอเรื่อง / ส่งต่อ
                            </button>
                          )}
                          
                          {/* ผู้รักษาการสามารถ reject */}
                          {!['COMPLETED', 'REJECTED', 'DRAFT'].includes(item.in_workflow_status) && (
                            <button
                              className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition text-xs font-semibold flex items-center gap-1"
                              onClick={() => handleAction(item.in_id, 'actingReject', item._delegationId)}
                            >
                              <i className="bx bx-undo"></i> ส่งงานกลับ
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
        onSuccess={() => {
          setShowActionModal(false);
          onReload();
        }}
        actionType={actionType}
        docId={selectedDocId}
        users={users}
        activeDelegations={activeDelegations}
        preSelectedDelegationId={selectedTaskDelegationId}
        initContext={actionContext}
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
        actionContext={actionContext}
        delegationId={selectedTaskDelegationId}
        onClose={() => { setShowParallelModal(false); setParallelDocId(null); }}
        onSuccess={onReload}
      />

      {showViewModal && viewItem && (
        <CircularModal
          allData={allData}
          editItem={viewItem}
          onClose={() => { setShowViewModal(false); setViewItem(null); }}
          onSaved={() => { setShowViewModal(false); setViewItem(null); }}
          mode="view"
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react'
import Select from 'react-select'
import Swal from 'sweetalert2'

import { adminApi, workflowApi } from '../../api/apiService'

interface SimParallelAssignment {
  pa_id: number;
  ag_id: number;
  ag_name: string;
  initial_owner_id: number;
  current_owner_id: number | null;
  pa_status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'REJECTED';
  result_comments: string;
  results_id: number | null;
  updated_at: string;
}

interface SimTask {
  id: number;
  in_num_date: string;
  in_doc_date: string;
  in_detail: string;
  in_circular_detail: string;
  in_etc: string;
  in_link: string;
  in_year_id: number;
  in_status_id: number;
  in_results_id: number | null;
  categories: number[];
  agencies: number[]; // ag_ids
  
  // Workflow States
  in_workflow_status: string; // DRAFT, PENDING_HR_APPROVAL, PENDING_GRP_REVIEW, etc.
  in_current_owner_id: number | null;
  in_creator_id: number;
  in_is_parallel: boolean;
  in_flow_state: 'in' | 'out' | 'end' | null;
  
  parallel_assignments: SimParallelAssignment[];
}

interface SimHistoryEntry {
  id: number;
  in_id: number;
  pa_id: number | null;
  from_user_id: number | null;
  from_user_name: string | null;
  from_user_position: string | null;
  from_user_role: string | null;
  to_user_id: number | null;
  to_user_name: string | null;
  to_user_position: string | null;
  to_user_role: string | null;
  action: string; // STARTED, APPROVED, REJECTED, DELEGATED, FINALIZED, PARALLEL_ASSIGNED, etc.
  comments: string;
  created_at: string;
}

interface SimAgency {
  ag_id: number;
  ag_name: string;
}

interface SimCategory {
  cat_id: number;
  cat_name: string;
}

interface SimResult {
  results_id: number;
  results_detail: string;
}

interface SimYear {
  year_id: number;
  year_value: string | number;
}

interface DashboardAllData {
  agency?: SimAgency[];
  categories?: SimCategory[];
  results?: SimResult[];
  year?: SimYear[];
  [key: string]: unknown;
}

interface SimUserActingInfo {
  id: number;
  name: string;
  position: string;
}

interface SimUser {
  a_id: number;
  a_name: string;
  a_role: string;
  a_position?: string | null;
  isActing?: boolean;
  is_acting?: boolean;
  delegationId?: number;
  delegated_role?: string;
  acting_info?: SimUserActingInfo | null;
}

interface SelectOption {
  value: string;
  label: string;
}

interface SimBotQueueItem {
  bot_id: number;
  bot_title: string;
  bot_url: string;
  bot_date: string;
}

interface WorkflowSimulatorSectionProps {
  allData: DashboardAllData | null;
  loading: boolean;
}

const roleRank: Record<string, number> = {
  "STAFF": 1,
  "COORDINATOR": 0,
  "GRP_LEADER": 2,
  "SEC_DIRECTOR": 3,
  "DIV_DIRECTOR": 4,
  "HR_DIRECTOR": 4
};

const statusMap: Record<string, { label: string, color: string }> = {
  'DRAFT': { label: 'ฉบับร่าง', color: 'bg-slate-100 text-slate-700' },
  'PENDING_HR_APPROVAL': { label: 'รอ ผอ.ศูนย์ฯ พิจารณา', color: 'bg-amber-100 text-amber-700' },
  'PENDING_GRP_REVIEW': { label: 'อยู่ระหว่างหัวหน้าพิจารณา', color: 'bg-orange-100 text-orange-700' },
  'PENDING_SEC_APPROVAL': { label: 'รอ ผอ.ส่วนฯ พิจารณา', color: 'bg-yellow-100 text-yellow-700' },
  'PENDING_DIRECTOR_APPROVAL': { label: 'รอ ผอ.กองฯ พิจารณา', color: 'bg-sky-100 text-sky-700' },
  'PENDING_DELEGATION': { label: 'รอมอบหมาย', color: 'bg-blue-100 text-blue-700' },
  'PENDING_EXECUTION': { label: 'รอเจ้าหน้าที่ดำเนินการ', color: 'bg-indigo-100 text-indigo-700' },
  'PENDING_PARALLEL': { label: 'รอผลหลายส่วนราชการ', color: 'bg-violet-100 text-violet-700' },
  'PENDING_CLOSE': { label: 'รอผู้ตั้งเรื่องปิดงาน', color: 'bg-rose-100 text-rose-700' },
  'COMPLETED': { label: 'เสร็จสิ้น (Close)', color: 'bg-emerald-100 text-emerald-700' },
  'REJECTED': { label: 'ถูกตีกลับ', color: 'bg-red-100 text-red-700' },
};

export default function WorkflowSimulatorSection({ allData, loading: allDataLoading }: WorkflowSimulatorSectionProps) {
  // Simulator Metadata
  const [users, setUsers] = useState<SimUser[]>([]);
  
  // Simulator Tasks State
  const [simTasks, setSimTasks] = useState<SimTask[]>([]);
  const [simLogs, setSimLogs] = useState<SimHistoryEntry[]>([]);
  
  // UI State
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [activeSimUserId, setActiveSimUserId] = useState<number | ''>('');
  const [activeSimUserKey, setActiveSimUserKey] = useState<string>('');
  const [autoSwitch, setAutoSwitch] = useState<boolean>(true);
  
  // Modal states for mock bot queue
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedBotItem, setSelectedBotItem] = useState<SimBotQueueItem | null>(null);
  
  // Form values for importing mock circular
  const [mockDocNum, setMockDocNum] = useState('');
  const [mockTitle, setMockTitle] = useState('');
  const [mockYearId, setMockYearId] = useState<number | ''>('');
  const [mockCategoryIds, setMockCategoryIds] = useState<SelectOption[]>([]);
  const [mockAgencyIds, setMockAgencyIds] = useState<SelectOption[]>([]);
  
  // Workflow action state
  const [actionComments, setActionComments] = useState('');
  const [selectedNextOwnerId, setSelectedNextOwnerId] = useState<string>('');
  const [parallelTracksInput, setParallelTracksInput] = useState<Record<number, { comments: string, resultsId: string }>>({});

  // Backend-driven simulation options
  const [simOptions, setSimOptions] = useState<{
    autoUpAssignee: SimUser | null;
    manualAssignees: SimUser[];
    useParallelAssign: boolean;
    rejectAssignees: SimUser[];
  }>({
    autoUpAssignee: null,
    manualAssignees: [],
    useParallelAssign: false,
    rejectAssignees: []
  });

  const getActiveUser = useCallback(() => {
    return users.find(u => u.a_id === Number(activeSimUserId)) || null;
  }, [users, activeSimUserId]);

  const getSelectedTask = useCallback((): SimTask | null => {
    return simTasks.find(t => t.id === activeTaskId) || null;
  }, [simTasks, activeTaskId]);

  // Load simulation options dynamically from the backend simulation API
  useEffect(() => {
    const fetchSimOptions = async () => {
      const task = getSelectedTask();
      const activeUser = getActiveUser();
      if (!task || !activeUser) {
        setSimOptions({
          autoUpAssignee: null,
          manualAssignees: [],
          useParallelAssign: false,
          rejectAssignees: []
        });
        return;
      }

      try {
        const taskHistory = simLogs.filter(log => log.in_id === task.id);
        const res = await workflowApi.simulateWorkflowAction({
          task: {
            in_workflow_status: task.in_workflow_status,
            in_flow_state: task.in_flow_state,
            agencies: task.agencies
          },
          activeUserId: activeUser.a_id,
          history: taskHistory
        });

        if (res.success && res.data) {
          setSimOptions({
            autoUpAssignee: res.data.autoUpAssignee || null,
            manualAssignees: res.data.manualAssignees || [],
            useParallelAssign: !!res.data.useParallelAssign,
            rejectAssignees: res.data.rejectAssignees || []
          });
        }
      } catch (err) {
        console.error("Failed to load backend simulation options:", err);
      }
    };

    fetchSimOptions();
  }, [getActiveUser, getSelectedTask, simLogs]);

  // Mock bot queue findings
  const mockBotQueueFindings = [
    { bot_id: 101, bot_title: 'การจัดทำกรอบอัตรากำลังข้าราชการกรุงเทพมหานครสามัญ ประจำปีงบประมาณ พ.ศ. 2570', bot_url: 'https://www.ocsc.go.th/circular/101', bot_date: '2026-06-20' },
    { bot_id: 102, bot_title: 'หลักเกณฑ์และวิธีการประเมินผลการปฏิบัติงานของข้าราชการครูและบุคลากรทางการศึกษากรุงเทพมหานคร', bot_url: 'https://www.ocsc.go.th/circular/102', bot_date: '2026-06-22' },
    { bot_id: 103, bot_title: 'แนวทางปฏิบัติตามพระราชบัญญัติระเบียบข้าราชการกรุงเทพมหานครและบุคลากรกรุงเทพมหานคร พ.ศ. 2554', bot_url: 'https://www.ocsc.go.th/circular/103', bot_date: '2026-06-24' },
  ];

  // Load metadata and simulator state
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const uRes = await adminApi.getUsersByRole(
          ['COORDINATOR', 'HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF'],
          undefined,
          undefined,
          true // isSimulator
        );
        setUsers(uRes || []);
        
        // Load tasks and logs from localStorage
        const cachedTasks = localStorage.getItem('bma_simulator_tasks');
        const cachedLogs = localStorage.getItem('bma_simulator_logs');
        
        if (cachedTasks) setSimTasks(JSON.parse(cachedTasks));
        if (cachedLogs) setSimLogs(JSON.parse(cachedLogs));
        
        // Default active user is the first coordinator found, or fallback
        if (uRes && uRes.length > 0) {
          const coord = uRes.find((u: SimUser) => u.a_role === 'COORDINATOR');
          if (coord) {
            setActiveSimUserId(coord.a_id);
            setActiveSimUserKey(`${coord.a_id}-normal`);
          } else {
            const first = uRes[0];
            setActiveSimUserId(first.a_id);
            const key = first.isActing ? `${first.a_id}-acting-${first.delegationId}` : `${first.a_id}-normal`;
            setActiveSimUserKey(key);
          }
        }
      } catch (err) {
        console.error('Failed to load simulator metadata:', err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดรายชื่อผู้ใช้จากระบบได้ หรือคุณไม่มีสิทธิ์', 'error');
      }
    };
    
    fetchMetadata();
  }, []);

  // Save state helper
  const saveSimulatorState = (tasks: SimTask[], logs: SimHistoryEntry[]) => {
    localStorage.setItem('bma_simulator_tasks', JSON.stringify(tasks));
    localStorage.setItem('bma_simulator_logs', JSON.stringify(logs));
    setSimTasks(tasks);
    setSimLogs(logs);
  };

  const setSimUserById = (userId: number) => {
    const foundActing = users.find(u => u.a_id === userId && u.isActing);
    if (foundActing) {
      setActiveSimUserId(userId);
      setActiveSimUserKey(`${userId}-acting-${foundActing.delegationId}`);
    } else {
      const foundNormal = users.find(u => u.a_id === userId);
      if (foundNormal) {
        setActiveSimUserId(userId);
        setActiveSimUserKey(`${userId}-normal`);
      }
    }
  };


  // Mock bot queue item selection
  const handleOpenImport = (botItem: SimBotQueueItem) => {
    setSelectedBotItem(botItem);
    setMockDocNum(`ที่ กท 0503/ว ${Math.floor(Math.random() * 100) + 1}`);
    setMockTitle(botItem.bot_title);
    
    // Set default values if available in allData
    if (allData?.year && allData.year.length > 0) {
      setMockYearId(Number(allData.year[0].year_id));
    } else {
      setMockYearId('');
    }
    setMockCategoryIds([]);
    setMockAgencyIds([]);
    setShowImportModal(true);
  };

  // Submit Mock Import (spawn DRAFT task under COORDINATOR)
  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockDocNum) return Swal.fire('คำเตือน', 'กรุณากรอกเลขที่หนังสือ', 'warning');
    if (!mockTitle) return Swal.fire('คำเตือน', 'กรุณากรอกชื่อเรื่อง', 'warning');
    if (!mockYearId) return Swal.fire('คำเตือน', 'กรุณาเลือกปี พ.ศ.', 'warning');
    if (mockCategoryIds.length === 0) return Swal.fire('คำเตือน', 'กรุณาเลือกหมวดหมู่อย่างน้อย 1 หมวดหมู่', 'warning');

    const coordinator = users.find(u => u.a_role === 'COORDINATOR') || users[0];
    if (!coordinator) return Swal.fire('Error', 'ไม่พบผู้ใช้บทบาท COORDINATOR ในระบบ', 'error');

    const newTaskId = Date.now();
    setSimUserById(coordinator.a_id);
    setActiveSimUserKey(`${coordinator.a_id}-normal`);
    const newTask: SimTask = {
      id: newTaskId,
      in_num_date: mockDocNum,
      in_doc_date: new Date().toLocaleDateString('th-TH'),
      in_detail: mockTitle,
      in_circular_detail: 'จำลองการประเมินจากบอตคิว',
      in_etc: '-',
      in_link: selectedBotItem?.bot_url || '',
      in_year_id: Number(mockYearId),
      in_status_id: 1, // Active status
      in_results_id: null,
      categories: mockCategoryIds.map(c => Number(c.value)),
      agencies: mockAgencyIds.map(a => Number(a.value)),
      
      // Init states
      in_workflow_status: 'DRAFT',
      in_current_owner_id: coordinator.a_id,
      in_creator_id: coordinator.a_id,
      in_is_parallel: false,
      in_flow_state: null,
      parallel_assignments: []
    };

    const newHistory: SimHistoryEntry = {
      id: Date.now(),
      in_id: newTaskId,
      pa_id: null,
      from_user_id: null,
      from_user_name: 'ระบบบอตตรวจจับ',
      from_user_position: 'BOT SCRAPER',
      from_user_role: 'SYSTEM',
      to_user_id: coordinator.a_id,
      to_user_name: coordinator.a_name,
      to_user_position: coordinator.a_position,
      to_user_role: coordinator.a_role,
      action: 'STARTED',
      comments: 'ระบบบอตตรวจพบหนังสือเวียนและสร้างแบบร่างงานจำลอง',
      created_at: new Date().toISOString()
    };

    const updatedTasks = [newTask, ...simTasks];
    const updatedLogs = [newHistory, ...simLogs];
    
    saveSimulatorState(updatedTasks, updatedLogs);
    setActiveTaskId(newTaskId);

    setShowImportModal(false);
    
    Swal.fire({
      icon: 'success',
      title: 'สร้างหนังสือจำลองสำเร็จ',
      text: `งานอยู่ในกล่องข้อความของ ${coordinator.a_name} (COORDINATOR)`,
      timer: 2000,
      showConfirmButton: false
    });
  };

  // ── Reset Task to initial state (arrived from bot queue) ────────────────────
  const handleResetTask = (taskId: number) => {
    const task = simTasks.find(t => t.id === taskId);
    if (!task) return;

    Swal.fire({
      title: 'ต้องการรีเซ็ตงานจำลอง?',
      text: 'งานจะกลับสู่สถานะแบบร่าง (DRAFT) ภายใต้เจ้าหน้าที่ COORDINATOR และข้อมูลประวัติทั้งหมดจะถูกล้างใหม่',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'ยืนยันรีเซ็ต',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        const coordinator = users.find(u => u.a_role === 'COORDINATOR') || users[0];
        const updatedTasks = simTasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              in_workflow_status: 'DRAFT',
              in_current_owner_id: coordinator.a_id,
              in_is_parallel: false,
              in_flow_state: null,
              in_results_id: null,
              parallel_assignments: []
            };
          }
          return t;
        });

        // Keep only initial STARTED history log
        const cleanedLogs = simLogs.filter(log => log.in_id !== taskId);
        const resetHistory: SimHistoryEntry = {
          id: Date.now(),
          in_id: taskId,
          pa_id: null,
          from_user_id: null,
          from_user_name: 'ระบบบอตตรวจจับ',
          from_user_position: 'BOT SCRAPER',
          from_user_role: 'SYSTEM',
          to_user_id: coordinator.a_id,
          to_user_name: coordinator.a_name,
          to_user_position: coordinator.a_position,
          to_user_role: coordinator.a_role,
          action: 'STARTED',
          comments: 'จำลองการนำเข้าหนังสือเวียนใหม่จากคิวบอต (รีเซ็ต)',
          created_at: new Date().toISOString()
        };

        saveSimulatorState(updatedTasks, [resetHistory, ...cleanedLogs]);
        setSimUserById(coordinator.a_id);
        setActionComments('');
        setSelectedNextOwnerId('');
        
        Swal.fire('รีเซ็ตสำเร็จ', 'สถานะงานถูกย้อนกลับไปยังกล่องผู้ตั้งเรื่องแล้ว', 'success');
      }
    });
  };

  // ── Delete Task ──────────────────────────────────────────────────────────
  const handleDeleteTask = (taskId: number) => {
    Swal.fire({
      title: 'ต้องการลบงานจำลองนี้?',
      text: 'ข้อมูลและประวัติการเดินงานของหนังสือฉบับนี้จะถูกลบถาวร',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'ใช่, ลบทิ้ง',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        const updatedTasks = simTasks.filter(t => t.id !== taskId);
        const updatedLogs = simLogs.filter(log => log.in_id !== taskId);
        
        saveSimulatorState(updatedTasks, updatedLogs);
        setActiveTaskId(null);
        
        Swal.fire('ลบข้อมูลแล้ว', 'ลบงานจำลองสำเร็จ', 'success');
      }
    });
  };

  // ── Forward Action (เสนอเรื่อง / ส่งต่อ / มอบหมาย) ─────────────────────────────
  const handleForward = async (e: React.FormEvent) => {
    e.preventDefault();
    const task = getSelectedTask();
    const activeUser = getActiveUser();
    
    if (!task || !activeUser) return;
    
    // Check if target agencies are empty for COORDINATOR in DRAFT
    if (task.in_workflow_status === 'DRAFT' && task.agencies.length === 0) {
      return Swal.fire('คำเตือน', 'กรุณาเข้าสู่กระบวนการนำเข้าโดยเลือกส่วนราชการผู้รับผิดชอบก่อน', 'warning');
    }

    if (useParallelAssign) {
      Swal.fire({
        title: 'ยืนยันการกระจายงาน?',
        text: `ระบบจะทำการส่งข้อมูลให้ผู้อำนวยการส่วนราชการปลายทางทั้ง ${task.agencies.length} หน่วยงานตรวจสอบคู่ขนานพร้อมกัน`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            const res = await workflowApi.simulateWorkflowAction({
              task,
              activeUserId: activeUser.a_id,
              action: 'PARALLEL_ASSIGN',
              comments: actionComments
            });

            if (res.success && res.data) {
              const { updatedTask, newHistoryEntries } = res.data;
              const updatedTasks = simTasks.map(t => t.id === task.id ? updatedTask : t);
              saveSimulatorState(updatedTasks, [...newHistoryEntries, ...simLogs]);
              setActionComments('');

              if (autoSwitch && updatedTask.parallel_assignments?.length > 0) {
                setSimUserById(updatedTask.parallel_assignments[0].initial_owner_id);
              }

              Swal.fire('กระจายงานแล้ว', 'มอบหมายงานคู่ขนานส่งออกไปยังส่วนราชการปลายทางเรียบร้อยแล้ว', 'success');
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'ไม่สามารถกระจายงานได้';
            Swal.fire('ข้อผิดพลาด', errMsg, 'error');
          }
        }
      });
      return;
    }

    // Single recipient forward
    if (!selectedNextOwnerId) return Swal.fire('คำเตือน', 'กรุณาเลือกผู้รับมอบหมายคนถัดไป', 'warning');
    const targetUserId = Number(selectedNextOwnerId);
    const targetUser = users.find(u => u.a_id === targetUserId);
    if (!targetUser) return Swal.fire('Error', 'ไม่พบข้อมูลผู้รับปลายทาง', 'error');

    try {
      const res = await workflowApi.simulateWorkflowAction({
        task,
        activeUserId: activeUser.a_id,
        action: 'FORWARD',
        targetUserId,
        comments: actionComments
      });

      if (res.success && res.data) {
        const { updatedTask, newHistoryEntries } = res.data;
        const updatedTasks = simTasks.map(t => t.id === task.id ? updatedTask : t);
        saveSimulatorState(updatedTasks, [...newHistoryEntries, ...simLogs]);
        setActionComments('');
        setSelectedNextOwnerId('');

        if (autoSwitch) {
          setSimUserById(targetUserId);
        }

        Swal.fire({
          icon: 'success',
          title: 'ส่งต่อเอกสารแล้ว',
          text: `งานอยู่ในกล่องข้อความของ ${targetUser.a_name} (${targetUser.a_role})`,
          timer: 1500,
          showConfirmButton: false
        });
      }
    } catch (err: unknown) {
      Swal.fire('ข้อผิดพลาด', err instanceof Error ? err.message : 'ไม่สามารถส่งต่อเอกสารได้', 'error');
    }
  };

  // ── Reject Action (ส่งงานกลับ / ตีกลับ) ──────────────────────────────────
  const handleReject = async () => {
    const task = getSelectedTask();
    const activeUser = getActiveUser();
    if (!task || !activeUser) return;

    if (rejectAssignees.length === 0) {
      return Swal.fire('ไม่พบผู้รับงานตีกลับ', 'งานนี้ยังไม่มีประวัติการส่งต่อก่อนหน้าให้ตีกลับ', 'warning');
    }

    if (!selectedNextOwnerId) {
      return Swal.fire('คำเตือน', 'กรุณาเลือกผู้รับงานตีกลับ', 'warning');
    }

    const targetUserId = Number(selectedNextOwnerId);
    const targetUser = users.find(u => u.a_id === targetUserId);
    if (!targetUser) return;

    try {
      const res = await workflowApi.simulateWorkflowAction({
        task,
        activeUserId: activeUser.a_id,
        action: 'REJECT',
        targetUserId,
        comments: actionComments
      });

      if (res.success && res.data) {
        const { updatedTask, newHistoryEntries } = res.data;
        const updatedTasks = simTasks.map(t => t.id === task.id ? updatedTask : t);
        saveSimulatorState(updatedTasks, [...newHistoryEntries, ...simLogs]);
        setActionComments('');
        setSelectedNextOwnerId('');

        if (autoSwitch) {
          setSimUserById(targetUserId);
        }

        Swal.fire('ตีกลับเอกสารแล้ว', `ส่งข้อมูลกลับคืนให้คุณ ${targetUser.a_name} ตรวจสอบแล้ว`, 'success');
      }
    } catch (err: unknown) {
      Swal.fire('ข้อผิดพลาด', err instanceof Error ? err.message : 'ไม่สามารถตีกลับเอกสารได้', 'error');
    }
  };

  // ── Record & Submit results inside a parallel track (STAFF / DIVISION LEVEL) ──────
  const handleSubmitTrackResult = async (paId: number) => {
    const task = getSelectedTask();
    const activeUser = getActiveUser();
    if (!task || !activeUser) return;

    const trackInput = parallelTracksInput[paId] || { comments: '', resultsId: '' };
    if (!trackInput.resultsId) {
      return Swal.fire('คำเตือน', 'กรุณาเลือกผลการพิจารณาสำหรับ Track นี้', 'warning');
    }

    Swal.fire({
      title: 'ส่งผลพิจารณาของกอง?',
      text: `บันทึกความคิดเห็น: "${trackInput.comments || '-'}" และส่งให้ศูนย์สารสนเทศฯ ทราบ`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันส่งผล',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await workflowApi.simulateWorkflowAction({
            task,
            activeUserId: activeUser.a_id,
            action: 'PARALLEL_SUBMIT',
            paId,
            resultsId: Number(trackInput.resultsId),
            comments: trackInput.comments
          });

          if (res.success && res.data) {
            const { updatedTask, newHistoryEntries } = res.data;
            const updatedTasks = simTasks.map(t => t.id === task.id ? updatedTask : t);
            saveSimulatorState(updatedTasks, [...newHistoryEntries, ...simLogs]);

            // Reset local input
            setParallelTracksInput(prev => {
              const c = { ...prev };
              delete c[paId];
              return c;
            });

            if (autoSwitch && updatedTask.in_current_owner_id) {
              setSimUserById(updatedTask.in_current_owner_id);
            }

            Swal.fire('บันทึกผลสำเร็จ', 'ส่งความคิดเห็นเข้าสู่ระบบเรียบร้อยแล้ว', 'success');
          }
        } catch (err: unknown) {
          Swal.fire('ข้อผิดพลาด', err instanceof Error ? err.message : 'ไม่สามารถบันทึกผลได้', 'error');
        }
      }
    });
  };

  // ── delegate parallel track within division ───────────────────────
  const handleDelegateWithinTrack = async (paId: number, targetSubordinateId: number) => {
    const task = getSelectedTask();
    const activeUser = getActiveUser();
    if (!task || !activeUser || !targetSubordinateId) return;

    const subUser = users.find(u => u.a_id === targetSubordinateId);
    if (!subUser) return;

    try {
      const res = await workflowApi.simulateWorkflowAction({
        task,
        activeUserId: activeUser.a_id,
        action: 'PARALLEL_DELEGATE',
        paId,
        targetUserId: targetSubordinateId,
        comments: actionComments
      });

      if (res.success && res.data) {
        const { updatedTask, newHistoryEntries } = res.data;
        const updatedTasks = simTasks.map(t => t.id === task.id ? updatedTask : t);
        saveSimulatorState(updatedTasks, [...newHistoryEntries, ...simLogs]);
        setActionComments('');
        setSelectedNextOwnerId('');

        if (autoSwitch) {
          setSimUserById(targetSubordinateId);
        }

        Swal.fire('มอบหมายงานแล้ว', `ส่งงานต่อให้ ${subUser.a_name} ภายใน Track ของกองแล้ว`, 'success');
      }
    } catch (err: unknown) {
      Swal.fire('ข้อผิดพลาด', err instanceof Error ? err.message : 'ไม่สามารถมอบหมายงานได้', 'error');
    }
  };

  // ── Close / Finalize Workflow (COORDINATOR) ──────────────────────────────────
  const handleCloseWorkflow = () => {
    const task = getSelectedTask();
    const activeUser = getActiveUser();
    if (!task || !activeUser) return;

    Swal.fire({
      title: 'ต้องการปิดเอกสาร?',
      text: 'การจำลองจะจบลงอย่างสมบูรณ์ และหนังสือจะถูกปรับสถานะเป็นเสร็จสิ้น (COMPLETED)',
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: 'ตกลง, จบงาน',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await workflowApi.simulateWorkflowAction({
            task,
            activeUserId: activeUser.a_id,
            action: 'CLOSE',
            comments: actionComments
          });

          if (res.success && res.data) {
            const { updatedTask, newHistoryEntries } = res.data;
            const updatedTasks = simTasks.map(t => t.id === task.id ? updatedTask : t);
            saveSimulatorState(updatedTasks, [...newHistoryEntries, ...simLogs]);
            setActionComments('');

            Swal.fire('ปิดงานสำเร็จ', 'ระบบบันทึกความสมบูรณ์ของ Workflow เรียบร้อย', 'success');
          }
        } catch (err: unknown) {
          Swal.fire('ข้อผิดพลาด', err instanceof Error ? err.message : 'ไม่สามารถปิดงานได้', 'error');
        }
      }
    });
  };



  // Helper values for selectors
  const activeUser = getActiveUser();
  const task = getSelectedTask();
  
  // Use simulation options fetched from the backend simulation endpoint
  const { autoUpAssignee, manualAssignees, useParallelAssign, rejectAssignees } = simOptions;

  const handleUpdateDraftAgencies = (selectedOptions: readonly SelectOption[] | null) => {
    if (!task) return;
    const agIds = selectedOptions ? selectedOptions.map((o) => Number(o.value)) : [];
    const updatedTasks = simTasks.map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          agencies: agIds
        };
      }
      return t;
    });
    saveSimulatorState(updatedTasks, simLogs);
  };

  const agencyOptions = (allData?.agency || []).map((ag: SimAgency) => ({
    value: String(ag.ag_id),
    label: ag.ag_name
  }));

  const categoryOptions = (allData?.categories || []).map((cat: SimCategory) => ({
    value: String(cat.cat_id),
    label: cat.cat_name
  }));

  if (allDataLoading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm h-[650px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-500 font-semibold text-sm">กำลังโหลดข้อมูลระบบ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* ── Top Bar Control Panel ────────────────────────────────── */}
      <div className="bg-linear-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-6 shadow-lg border border-emerald-500/20 animate__animated animate__fadeIn">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Identity Selection Block */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
            <div className="bg-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3">
              <i className="bx bx-user-pin text-3xl text-emerald-200"></i>
              <div>
                <div className="text-[10px] text-emerald-200 uppercase tracking-wider font-bold">จำลองฐานะผู้ใช้</div>
                <select
                  className="bg-transparent border-0 font-bold focus:ring-0 text-white text-sm p-0 m-0 outline-none cursor-pointer"
                  value={activeSimUserKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveSimUserKey(val);
                    const [userId] = val.split('-');
                    setActiveSimUserId(Number(userId));
                  }}
                >
                  {users.map((u) => {
                    const val = u.isActing ? `${u.a_id}-acting-${u.delegationId}` : `${u.a_id}-normal`;
                    return (
                      <option key={val} value={val} className="text-slate-800">
                        [{u.a_role}] - {u.a_name} ({u.a_position})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            
            {/* Auto Switch Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSwitch}
                onChange={(e) => setAutoSwitch(e.target.checked)}
                className="w-4.5 h-4.5 rounded text-emerald-600 focus:ring-emerald-500/20 border-white/20 bg-white/10"
              />
              <span className="text-sm font-semibold text-emerald-100">
                สลับตัวละครอัตโนมัติตามเส้นทางการส่ง (Auto-Switch Role)
              </span>
            </label>
          </div>
          
          {/* Bot Queue Mock Button */}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-5 py-2.5 bg-white text-emerald-800 font-bold rounded-2xl hover:bg-emerald-50 active:scale-95 transition shadow-sm flex items-center gap-2"
            >
              <i className="bx bx-bot text-xl"></i>
              <span>นำเข้าจากบอตคิวจำลอง</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* ── Left Panel (Simulated Inbox) ────────────────────────────────── */}
        <div className="xl:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[650px]">
          <div className="p-5 border-b border-slate-50">
            <h5 className="font-bold text-slate-800 m-0 flex items-center gap-2">
              <i className="bx bx-archive-in text-lg text-emerald-600"></i>
              <span>กล่องจำลองงาน (Inbox)</span>
            </h5>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {simTasks.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <i className="bx bx-inbox text-5xl mb-2 block"></i>
                <span className="text-sm">ไม่มีหนังสือเวียนจำลองในคิว</span>
              </div>
            ) : (
              simTasks.map((t) => {
                // Check if current user is owner, or if parallel track owner matches active user
                const isDirectOwner = t.in_current_owner_id === activeUser?.a_id;
                const isTrackOwner = t.in_is_parallel && t.parallel_assignments.some(
                  pa => pa.current_owner_id === activeUser?.a_id && ['PENDING', 'IN_PROGRESS'].includes(pa.pa_status)
                );
                const hasActionPending = isDirectOwner || isTrackOwner;

                return (
                  <button
                    key={t.id}
                    type="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveTaskId(t.id);
                      setSelectedNextOwnerId('');
                    }}
                    className={`w-full p-4 rounded-2xl cursor-pointer transition-all duration-300 border text-left ${
                      activeTaskId === t.id
                        ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/20'
                        : 'border-slate-100 bg-slate-50/40 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="font-bold text-xs text-slate-700 truncate block max-w-[70%]">
                        {t.in_num_date}
                      </span>
                      {hasActionPending && (
                        <span className="px-2 py-0.5 bg-rose-500 text-white font-extrabold text-[8px] rounded-full uppercase tracking-wider animate-pulse">
                          Pending
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                      {t.in_detail}
                    </p>
                    
                    <div className="flex justify-between items-center text-[10px] font-semibold">
                      <span className="text-slate-400">{t.in_doc_date}</span>
                      <div className="flex gap-1.5 items-center">
                        {t.in_flow_state === 'out' && <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100 font-bold uppercase">out</span>}
                        {t.in_flow_state === 'in' && <span className="px-1.5 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 font-bold uppercase">in</span>}
                        {t.in_flow_state === 'end' && <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-100 font-bold uppercase">end</span>}
                        <span className={`px-2 py-0.5 rounded-full font-bold ${
                          statusMap[t.in_workflow_status]?.color || 'bg-slate-100 text-slate-600'
                        }`}>
                          {statusMap[t.in_workflow_status]?.label || t.in_workflow_status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Middle Panel (Circular Details & Workflow Actions) ────────────────────────────────── */}
        <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[650px]">
          {task ? (
            <div className="flex flex-col h-full">
              
              {/* Task Header */}
              <div className="p-6 border-b border-slate-50 bg-slate-50/20 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <h4 className="font-extrabold text-lg text-slate-800 m-0 font-saochingcha">
                      {task.in_num_date}
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                      statusMap[task.in_workflow_status]?.color || 'bg-slate-100 text-slate-600'
                    }`}>
                      {statusMap[task.in_workflow_status]?.label || task.in_workflow_status}
                    </span>
                    {task.in_flow_state === 'out' && <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-100 uppercase font-mono">out</span>}
                    {task.in_flow_state === 'in' && <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 uppercase font-mono">in</span>}
                    {task.in_flow_state === 'end' && <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-gray-50 text-gray-700 border border-gray-100 uppercase font-mono">end</span>}
                  </div>
                  <p className="text-xs font-semibold text-slate-500 m-0">
                    ลงวันที่ {task.in_doc_date}
                  </p>
                </div>
                
                {/* Reset & Delete buttons */}
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleResetTask(task.id)}
                    className="p-2 text-slate-500 bg-slate-100 hover:bg-amber-100 hover:text-amber-700 rounded-xl transition-colors text-sm font-semibold flex items-center gap-1"
                    title="เริ่มใหม่ทั้งหมด (Reset)"
                  >
                    <i className="bx bx-reset text-lg"></i>
                    <span className="hidden sm:inline">รีเซ็ต</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 text-slate-500 bg-slate-100 hover:bg-red-100 hover:text-red-700 rounded-xl transition-colors text-sm font-semibold flex items-center gap-1"
                    title="ลบงานจำลองนี้"
                  >
                    <i className="bx bx-trash text-lg"></i>
                    <span className="hidden sm:inline">ลบทิ้ง</span>
                  </button>
                </div>
              </div>

              {/* Task body / Details */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                {/* Document Information Card */}
                <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide mb-1">
                      เรื่อง / หัวข้อ
                    </span>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">
                      {task.in_detail}
                    </p>
                  </div>
                  
                  {/* Category and Department badges */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        หมวดหมู่หนังสือ
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {task.categories.map(catId => {
                          const c = allData?.categories?.find((item: SimCategory) => item.cat_id === catId);
                          return (
                            <span key={catId} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">
                              {c ? c.cat_name : `หมวดหมู่ ${catId}`}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        ส่วนราชการผู้รับผิดชอบ
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {task.agencies.length === 0 ? (
                          <span className="text-xs text-rose-500 font-bold">ยังไม่เลือกหน่วยงานผู้รับ</span>
                        ) : (
                          task.agencies.map(agId => {
                            const ag = allData?.agency?.find((item: SimAgency) => item.ag_id === agId);
                            return (
                              <span key={agId} className="px-2 py-0.5 bg-sky-50 text-sky-700 text-[10px] font-bold rounded">
                                {ag ? ag.ag_name : `ส่วนราชการ ${agId}`}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Parallel tracks panel ── */}
                {task.in_is_parallel && (
                  <div className="space-y-3">
                    <h6 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-1">
                      สถานะสายงานพิจารณาคู่ขนาน (Parallel Tracks)
                    </h6>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                      {task.parallel_assignments.map((pa) => {
                        const isPaOwner = pa.current_owner_id === activeUser?.a_id;
                        const trackInput = parallelTracksInput[pa.pa_id] || { comments: '', resultsId: '' };

                        return (
                          <div key={pa.pa_id} className="p-4 bg-slate-50/20 hover:bg-slate-50 transition">
                            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                              <div>
                                <span className="font-bold text-sm text-slate-700 block font-saochingcha">
                                  {pa.ag_name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  ผู้ครอบครองปัจจุบัน: {
                                    users.find(u => u.a_id === pa.current_owner_id)?.a_name || 'ไม่พบผู้ใช้'
                                  }
                                </span>
                              </div>
                              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                                pa.pa_status === 'SUBMITTED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : pa.pa_status === 'REJECTED'
                                  ? 'bg-red-100 text-red-700'
                                  : pa.pa_status === 'IN_PROGRESS'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {pa.pa_status}
                              </span>
                            </div>

                            {pa.result_comments && (
                              <div className="mb-2 p-2 bg-slate-100/50 rounded-lg text-xs italic text-slate-600 border-l-2 border-emerald-500">
                                ผลวิเคราะห์: {pa.result_comments}
                              </div>
                            )}

                            {/* Actions within track for simulated user */}
                            {isPaOwner && ['PENDING', 'IN_PROGRESS'].includes(pa.pa_status) && (
                              <div className="mt-3 p-3 bg-white border border-slate-100 rounded-xl space-y-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">
                                  คุณกำลังครอบครองกล่องงาน Track นี้
                                </span>
                                
                                {/* If user is STAFF -> submit track result */}
                                {activeUser.a_role === 'STAFF' ? (
                                  <div className="space-y-2">
                                    <select
                                      value={trackInput.resultsId}
                                      onChange={(e) => setParallelTracksInput(prev => ({
                                        ...prev,
                                        [pa.pa_id]: { ...trackInput, resultsId: e.target.value }
                                      }))}
                                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                                    >
                                      <option value="">-- เลือกผลการพิจารณา --</option>
                                      {(allData?.results || []).map((r: SimResult) => (
                                        <option key={r.results_id} value={r.results_id}>
                                          {r.results_detail}
                                        </option>
                                      ))}
                                    </select>
                                    <textarea
                                      placeholder="พิมพ์ข้อคิดเห็นรายงานผลวิเคราะห์..."
                                      value={trackInput.comments}
                                      onChange={(e) => setParallelTracksInput(prev => ({
                                        ...prev,
                                        [pa.pa_id]: { ...trackInput, comments: e.target.value }
                                      }))}
                                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 h-14 font-saochingcha"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSubmitTrackResult(pa.pa_id)}
                                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                                    >
                                      รายงานผลและส่งกลับ ผอ.ศูนย์ฯ
                                    </button>
                                  </div>
                                ) : (
                                  /* If user is DIV_DIRECTOR / GRP_LEADER -> can delegate to subordinate */
                                  <div className="space-y-2">
                                    <div className="flex gap-2 items-center">
                                      <span className="text-xs text-slate-500 shrink-0 font-medium">มอบต่อให้:</span>
                                      <select
                                        className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1 outline-none"
                                        value={selectedNextOwnerId}
                                        onChange={(e) => setSelectedNextOwnerId(e.target.value)}
                                      >
                                        <option value="">-- เลือกผู้ใต้บังคับบัญชา --</option>
                                        {users
                                          .filter(u => 
                                            u.a_id !== activeUser.a_id &&
                                            (roleRank[u.a_role] || 0) < (roleRank[activeUser.a_role] || 0)
                                          )
                                          .map(u => (
                                            <option key={u.a_id} value={u.a_id}>
                                             {u.is_acting ? '[รักษาการ] ' : ''}[{u.delegated_role || u.a_role}] - {u.a_name}
                                           </option>
                                          ))}
                                      </select>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={!selectedNextOwnerId}
                                      onClick={() => handleDelegateWithinTrack(pa.pa_id, Number(selectedNextOwnerId))}
                                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
                                    >
                                      มอบหมายงานลงสายงาน
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Actions Control Panel ── */}
                {task.in_current_owner_id === activeUser?.a_id && task.in_workflow_status !== 'COMPLETED' ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                    <h6 className="font-bold text-xs uppercase tracking-wider text-rose-500 m-0">
                      คุณต้องดำเนินการ (Action Pending)
                    </h6>
                    
                    {/* COORDINATOR DRAFT (Initial Step) */}
                    {task.in_workflow_status === 'DRAFT' && activeUser.a_role === 'COORDINATOR' ? (
                      <div className="space-y-3">
                        <label htmlFor="draft-agencies-select" className="block text-xs font-bold text-slate-600 mb-1">
                          เลือกส่วนราชการผู้รับเวียนหนังสือ (กองต่างๆ)
                        </label>
                        <Select
                          inputId="draft-agencies-select"
                          isMulti
                          options={agencyOptions}
                          value={agencyOptions.filter(o => task.agencies.includes(Number(o.value)))}
                          onChange={handleUpdateDraftAgencies}
                          placeholder="ค้นหาและเลือกกองรับหนังสือเวียน..."
                          className="text-sm font-saochingcha"
                        />
                        
                        <div className="pt-3 flex gap-2">
                          <select
                            className="flex-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none font-saochingcha"
                            value={selectedNextOwnerId}
                            onChange={(e) => setSelectedNextOwnerId(e.target.value)}
                          >
                            <option value="">-- เลือกผู้รับพิจารณาเสนอเวียน --</option>
                            {autoUpAssignee && (
                              <optgroup label="หัวหน้ากลุ่มงานแนะนำ (Auto-up)">
                                <option value={autoUpAssignee.acting_info ? autoUpAssignee.acting_info.id : autoUpAssignee.a_id}>
                                  {autoUpAssignee.acting_info 
                                    ? `[รักษาการแทน] ${autoUpAssignee.acting_info.name} (${autoUpAssignee.acting_info.position})`
                                    : `${autoUpAssignee.a_name} (${autoUpAssignee.a_position || 'GRP_LEADER'})`
                                  }
                                </option>
                              </optgroup>
                            )}
                            {manualAssignees.filter(u => u.a_id !== (autoUpAssignee?.acting_info ? autoUpAssignee.acting_info.id : autoUpAssignee?.a_id)).length > 0 && (
                              <optgroup label="หัวหน้ากลุ่มงานอื่น / รักษาการแทน">
                                {manualAssignees
                                  .filter(u => u.a_id !== (autoUpAssignee?.acting_info ? autoUpAssignee.acting_info.id : autoUpAssignee?.a_id))
                                  .map(u => (
                                    <option key={u.a_id} value={u.a_id}>
                                      {u.is_acting ? '[รักษาการ] ' : ''}{u.a_name} ({u.a_position || u.delegated_role || u.a_role})
                                    </option>
                                  ))
                                }
                              </optgroup>
                            )}
                          </select>
                          <button
                            type="button"
                            disabled={task.agencies.length === 0 || !selectedNextOwnerId}
                            onClick={handleForward}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-xl text-sm font-bold active:scale-95 transition font-saochingcha"
                          >
                            ริเริ่มเสนอเวียนหนังสือ
                          </button>
                        </div>
                      </div>
                    ) : task.in_workflow_status === 'PENDING_CLOSE' && activeUser.a_role === 'COORDINATOR' ? (
                      /* COORDINATOR CLOSE */
                      <div className="space-y-3">
                        <textarea
                          placeholder="ใส่บันทึกข้อคิดเห็นการปิดงานจำลอง..."
                          value={actionComments}
                          onChange={(e) => setActionComments(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs h-20 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-saochingcha"
                        />
                        <button
                          type="button"
                          onClick={handleCloseWorkflow}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm active:scale-95 transition shadow-sm"
                        >
                          อนุมัติจบเรื่องและปิดเอกสารเวียน (Close Workflow)
                        </button>
                      </div>
                    ) : (
                      /* ALL INTERMEDIATE ROLES (Forward, Delegate, Reject) */
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="action-comments-textarea" className="block text-xs font-bold text-slate-500 mb-1.5">
                            บันทึกข้อเห็นชอบ / ความเห็นการพิจารณา
                          </label>
                          <textarea
                            id="action-comments-textarea"
                            placeholder="กรอกเหตุผลหรือบันทึกข้อความประกอบการส่งต่อ..."
                            value={actionComments}
                            onChange={(e) => setActionComments(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs h-20 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-saochingcha"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          
                          {/* Forward block */}
                          <div className="flex-1 bg-white border border-slate-100 rounded-xl p-3 space-y-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">
                              {useParallelAssign ? 'มอบหมายในรูปแบบ' : 'ส่งต่อตามสายบังคับบัญชา'}
                            </span>
                            
                            {useParallelAssign ? (
                              <button
                                type="button"
                                onClick={handleForward}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs font-saochingcha"
                              >
                                มอบหมายคู่ขนาน ({task.agencies.length} กอง)
                              </button>
                            ) : (
                              <div className="flex gap-1">
                                <select
                                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1 outline-none font-saochingcha"
                                  value={selectedNextOwnerId}
                                  onChange={(e) => setSelectedNextOwnerId(e.target.value)}
                                >
                                  <option value="">-- เลือกผู้รับปลายทาง --</option>
                                  
                                  {autoUpAssignee && (
                                    <optgroup label="เสนอขึ้น (Auto-up)">
                                      <option value={autoUpAssignee.a_id}>
                                        [{autoUpAssignee.a_role}] - {autoUpAssignee.a_name}
                                      </option>
                                    </optgroup>
                                  )}
                                  
                                  {manualAssignees.filter(u => u.a_id !== (autoUpAssignee?.acting_info ? autoUpAssignee.acting_info.id : autoUpAssignee?.a_id)).length > 0 && (
                                    <optgroup label="มอบหมายงาน / ส่งข้ามสายงาน">
                                      {manualAssignees
                                        .filter(u => u.a_id !== (autoUpAssignee?.acting_info ? autoUpAssignee.acting_info.id : autoUpAssignee?.a_id))
                                        .map(u => (
                                          <option key={u.a_id} value={u.a_id}>
                                             {u.is_acting ? '[รักษาการ] ' : ''}[{u.delegated_role || u.a_role}] - {u.a_name}
                                           </option>
                                        ))
                                      }
                                    </optgroup>
                                  )}
                                </select>
                                <button
                                  type="button"
                                  disabled={!selectedNextOwnerId}
                                  onClick={handleForward}
                                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-bold rounded-lg text-xs shrink-0 font-saochingcha"
                                >
                                  ตกลง
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Reject Block */}
                          {rejectAssignees.length > 0 && (
                            <div className="flex-1 bg-white border border-slate-100 rounded-xl p-3 space-y-2">
                              <span className="text-[10px] uppercase font-bold block tracking-wide text-red-500">
                                ตีกลับ / คืนเรื่องก่อนหน้า
                              </span>
                              <div className="flex gap-1">
                                <select
                                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1 outline-none font-saochingcha"
                                  value={selectedNextOwnerId}
                                  onChange={(e) => setSelectedNextOwnerId(e.target.value)}
                                >
                                  <option value="">-- เลือกผู้ที่จะส่งงานคืน --</option>
                                  {rejectAssignees.map(u => (
                                    <option key={u.a_id} value={u.a_id}>
                                             {u.is_acting ? '[รักษาการ] ' : ''}[{u.delegated_role || u.a_role}] - {u.a_name}
                                           </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={!selectedNextOwnerId}
                                  onClick={handleReject}
                                  className="px-3 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-200 text-white font-bold rounded-lg text-xs shrink-0 font-saochingcha"
                                >
                                  ตีกลับ
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : task.in_workflow_status === 'COMPLETED' ? (
                  <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 text-center font-bold text-sm">
                    ✔️ กระบวนการเวียนหนังสือจำลองเสร็จสมบูรณ์แล้ว
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 text-slate-500 rounded-2xl border border-slate-100 text-center text-xs font-semibold">
                    ขณะนี้อยู่ในความครอบครองของบุคคลอื่น คุณไม่สามารถดำเนินการได้ในไอเดนทิตี้นี้
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
              <i className="bx bx-tachometer text-7xl mb-4 text-emerald-500/30 animate-pulse"></i>
              <h5 className="font-extrabold text-slate-600 m-0 text-base font-saochingcha">
                กรุณาเลือกหรือสร้างหนังสือเวียนจำลองเพื่อเริ่มการทดสอบ
              </h5>
              <p className="text-xs text-slate-400 mt-2 max-w-sm">
                เลือกหนังสือในกล่องซ้ายมือ หรือคลิกปุ่มนำเข้าบอตคิวจำลองที่มุมขวาบนเพื่อทดสอบการเดินงานแบบ Bypass Authentication
              </p>
            </div>
          )}
        </div>

        {/* ── Right Panel (Transaction Log & Timeline) ────────────────────────────────── */}
        <div className="xl:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[650px]">
          <div className="p-5 border-b border-slate-50 bg-slate-50/20">
            <h5 className="font-bold text-slate-800 m-0 flex items-center gap-2">
              <i className="bx bx-history text-lg text-emerald-600"></i>
              <span>บันทึกสถานะการทำรายการ</span>
            </h5>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-50/20">
            {task ? (
              (() => {
                const logsForTask = simLogs.filter(log => log.in_id === task.id);
                if (logsForTask.length === 0) {
                  return <div className="text-center py-20 text-slate-400 text-xs">ไม่มีบันทึกสำหรับงานนี้</div>;
                }
                return (
                  <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-5 py-2">
                    {logsForTask.map((log) => (
                      <div key={log.id} className="relative">
                        
                        {/* Timeline dot */}
                        <span className={`absolute left-[-21px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                          log.action === 'STARTED'
                            ? 'bg-emerald-500'
                            : log.action === 'REJECTED'
                            ? 'bg-rose-500'
                            : log.action === 'FINALIZED'
                            ? 'bg-teal-500'
                            : 'bg-indigo-500'
                        }`}></span>
                        
                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-1">
                            <span>
                              {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="font-extrabold uppercase text-emerald-600">
                              {log.action}
                            </span>
                          </div>
                          
                          <div className="text-xs font-bold text-slate-700">
                            {log.from_user_name}
                            {log.to_user_name && (
                              <span className="text-slate-400 font-normal">
                                {' '}ส่งต่อให้{' '}
                                <span className="font-bold text-slate-700">{log.to_user_name}</span>
                              </span>
                            )}
                          </div>
                          
                          <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg italic">
                            💬 {log.comments || '-'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                กรุณาเลือกงานเวียนเพื่อดูประวัติ
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Mock Bot findings import Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate__animated animate__zoomIn animate__faster">
            
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h5 className="font-bold text-slate-800 m-0 text-lg flex items-center gap-2 font-saochingcha">
                <i className="bx bx-bot text-xl text-emerald-600"></i>
                <span>นำเข้าหนังสือเวียนจากคิวบอต (จำลอง)</span>
              </h5>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition"
              >
                <i className="bx bx-x text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              
              {/* Select Bot Finding */}
              <div>
                <label htmlFor="bot-finding-select" className="block text-xs font-bold text-slate-500 mb-1.5">
                  เลือกหัวข้อข่าวที่บอตสแกนเจอ <span className="text-rose-500">*</span>
                </label>
                <select
                  id="bot-finding-select"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-saochingcha"
                  value={selectedBotItem ? selectedBotItem.bot_id : ''}
                  onChange={(e) => {
                    const item = mockBotQueueFindings.find(b => b.bot_id === Number(e.target.value));
                    if (item) handleOpenImport(item);
                  }}
                >
                  <option value="">-- เลือกข่าวบอตสแกน --</option>
                  {mockBotQueueFindings.map(b => (
                    <option key={b.bot_id} value={b.bot_id}>
                      {b.bot_title} ({b.bot_date})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBotItem && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="mock-doc-num-input" className="block text-xs font-bold text-slate-500 mb-1.5">เลขที่หนังสือเวียน</label>
                      <input
                        id="mock-doc-num-input"
                        type="text"
                        value={mockDocNum}
                        onChange={(e) => setMockDocNum(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-saochingcha"
                      />
                    </div>
                    <div>
                      <label htmlFor="mock-year-select" className="block text-xs font-bold text-slate-500 mb-1.5">ปี พ.ศ. <span className="text-rose-500">*</span></label>
                      <select
                        id="mock-year-select"
                        value={mockYearId}
                        onChange={(e) => setMockYearId(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-saochingcha"
                      >
                        <option value="">-- เลือกปี --</option>
                        {(allData?.year || []).map((y: SimYear) => (
                          <option key={y.year_id} value={y.year_id}>
                            {y.year_value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="mock-title-textarea" className="block text-xs font-bold text-slate-500 mb-1.5">ชื่อเรื่องหนังสือเวียน</label>
                    <textarea
                      id="mock-title-textarea"
                      value={mockTitle}
                      onChange={(e) => setMockTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs h-20 font-saochingcha"
                    />
                  </div>

                  <div>
                    <label htmlFor="mock-agency-select" className="block text-xs font-bold text-slate-500 mb-1.5">
                      ส่วนราชการต้นเรื่องผู้รับผิดชอบ <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      inputId="mock-agency-select"
                      isMulti
                      options={agencyOptions}
                      value={mockAgencyIds}
                      onChange={(options) => setMockAgencyIds(options ? [...options] : [])}
                      placeholder="เลือกกองหรือส่วนราชการ..."
                      className="text-xs font-saochingcha"
                    />
                  </div>

                  <div>
                    <label htmlFor="mock-category-select" className="block text-xs font-bold text-slate-500 mb-1.5">
                      หมวดหมู่หนังสือเวียน <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      inputId="mock-category-select"
                      isMulti
                      options={categoryOptions}
                      value={mockCategoryIds}
                      onChange={(options) => setMockCategoryIds(options ? [...options] : [])}
                      placeholder="เลือกหมวดหมู่..."
                      className="text-xs font-saochingcha"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                    >
                      จำลองการนำเข้าและเวียนงาน
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}



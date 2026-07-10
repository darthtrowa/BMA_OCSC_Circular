import { useState, useEffect } from 'react'
import Select from 'react-select'
import Swal from 'sweetalert2'
import { adminApi, workflowApi, delegationApi } from '../../api/apiService'

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

interface WorkflowSimulatorSectionProps {
  allData: any;
  loading: boolean;
}

const roleRank: Record<string, number> = {
  "STAFF": 1,
  "COORDINATOR": 1,
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
  'PENDING_REVIEW': { label: 'รอตรวจสอบผล', color: 'bg-purple-100 text-purple-700' },
  'PENDING_PARALLEL': { label: 'รอผลหลายส่วนราชการ', color: 'bg-violet-100 text-violet-700' },
  'PENDING_CLOSE': { label: 'รอผู้ตั้งเรื่องปิดงาน', color: 'bg-rose-100 text-rose-700' },
  'COMPLETED': { label: 'เสร็จสิ้น (Close)', color: 'bg-emerald-100 text-emerald-700' },
  'REJECTED': { label: 'ถูกตีกลับ', color: 'bg-red-100 text-red-700' },
};

export default function WorkflowSimulatorSection({ allData, loading: allDataLoading }: WorkflowSimulatorSectionProps) {
  // Simulator Metadata
  const [users, setUsers] = useState<any[]>([]);
  const [delegations, setDelegations] = useState<any[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  
  // Simulator Tasks State
  const [simTasks, setSimTasks] = useState<SimTask[]>([]);
  const [simLogs, setSimLogs] = useState<SimHistoryEntry[]>([]);
  
  // UI State
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [activeSimUserId, setActiveSimUserId] = useState<number | ''>('');
  const [autoSwitch, setAutoSwitch] = useState<boolean>(true);
  
  // Modal states for mock bot queue
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedBotItem, setSelectedBotItem] = useState<any>(null);
  
  // Form values for importing mock circular
  const [mockDocNum, setMockDocNum] = useState('');
  const [mockTitle, setMockTitle] = useState('');
  const [mockYearId, setMockYearId] = useState<number | ''>('');
  const [mockCategoryIds, setMockCategoryIds] = useState<any[]>([]);
  const [mockAgencyIds, setMockAgencyIds] = useState<any[]>([]);
  
  // Workflow action state
  const [actionComments, setActionComments] = useState('');
  const [selectedNextOwnerId, setSelectedNextOwnerId] = useState<string>('');
  const [selectedResultsId, setSelectedResultsId] = useState<string>('');
  const [parallelTracksInput, setParallelTracksInput] = useState<Record<number, { comments: string, resultsId: string }>>({});

  // Mock bot queue findings
  const mockBotQueueFindings = [
    { bot_id: 101, bot_title: 'การจัดทำกรอบอัตรากำลังข้าราชการกรุงเทพมหานครสามัญ ประจำปีงบประมาณ พ.ศ. 2570', bot_url: 'https://www.ocsc.go.th/circular/101', bot_date: '2026-06-20' },
    { bot_id: 102, bot_title: 'หลักเกณฑ์และวิธีการประเมินผลการปฏิบัติงานของข้าราชการครูและบุคลากรทางการศึกษากรุงเทพมหานคร', bot_url: 'https://www.ocsc.go.th/circular/102', bot_date: '2026-06-22' },
    { bot_id: 103, bot_title: 'แนวทางปฏิบัติตามพระราชบัญญัติระเบียบข้าราชการกรุงเทพมหานครและบุคลากรกรุงเทพมหานคร พ.ศ. 2554', bot_url: 'https://www.ocsc.go.th/circular/103', bot_date: '2026-06-24' },
  ];

  // Load metadata and simulator state
  useEffect(() => {
    const fetchMetadata = async () => {
      setLoadingMetadata(true);
      try {
        const uRes = await adminApi.getUsersByRole(['COORDINATOR', 'HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF']);
        setUsers(uRes || []);
        
        try {
          const dRes = await delegationApi.getAll();
          setDelegations(dRes || []);
        } catch (delErr) {
          console.warn('Failed to load delegations for simulator, using empty list:', delErr);
          setDelegations([]);
        }
        
        // Load tasks and logs from localStorage
        const cachedTasks = localStorage.getItem('bma_simulator_tasks');
        const cachedLogs = localStorage.getItem('bma_simulator_logs');
        
        if (cachedTasks) setSimTasks(JSON.parse(cachedTasks));
        if (cachedLogs) setSimLogs(JSON.parse(cachedLogs));
        
        // Default active user is the first coordinator found, or fallback
        if (uRes && uRes.length > 0) {
          const coord = uRes.find((u: any) => u.a_role === 'COORDINATOR');
          if (coord) {
            setActiveSimUserId(coord.a_id);
          } else {
            setActiveSimUserId(uRes[0].a_id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load simulator metadata:', err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดรายชื่อผู้ใช้จากระบบได้ หรือคุณไม่มีสิทธิ์', 'error');
      } finally {
        setLoadingMetadata(false);
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

  const getActiveUser = () => {
    return users.find(u => u.a_id === Number(activeSimUserId)) || null;
  };

  const getSelectedTask = (): SimTask | null => {
    return simTasks.find(t => t.id === activeTaskId) || null;
  };

  // ── Helper to resolve the top director of an agency ──────────────────────
  const findAgencyDirector = (agencyId: number) => {
    // 1. Search users for DIV_DIRECTOR or HR_DIRECTOR in that agency
    const dir = users.find(u => 
      Number(u.a_agency_id) === agencyId && 
      ['DIV_DIRECTOR', 'HR_DIRECTOR'].includes(u.a_role)
    );
    if (dir) return dir;

    // 2. Fallback to any supervisor in the agency
    const backup = users.find(u => Number(u.a_agency_id) === agencyId);
    return backup || null;
  };

  // Calculate workflow progression status based on roles
  const getNextStatus = (fromRole: string, toRole: string): string => {
    if (toRole === "COORDINATOR") return "PENDING_CLOSE";
    if (toRole === "STAFF") return "PENDING_EXECUTION";
    
    const fromRank = roleRank[fromRole] || 0;
    const toRank = roleRank[toRole] || 0;

    if (fromRank > toRank) {
      return "PENDING_DELEGATION";
    } else {
      if (toRole === "GRP_LEADER") return "PENDING_GRP_REVIEW";
      if (toRole === "SEC_DIRECTOR") return "PENDING_SEC_APPROVAL";
      if (toRole === "HR_DIRECTOR") return "PENDING_HR_APPROVAL";
      if (toRole === "DIV_DIRECTOR") return "PENDING_DIRECTOR_APPROVAL";
      return "PENDING_GRP_REVIEW";
    }
  };

  // Mock botqueue item selection
  const handleOpenImport = (botItem: any) => {
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
    const newTask: SimTask = {
      id: newTaskId,
      in_num_date: mockDocNum,
      in_doc_date: new Date().toLocaleDateString('th-TH'),
      in_detail: mockTitle,
      in_circular_detail: 'จำลองการประเมินจากบอตคิว',
      in_etc: '-',
      in_link: selectedBotItem.bot_url,
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
    setActiveSimUserId(coordinator.a_id); // Set simulation user to Coordinator
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
        setActiveSimUserId(coordinator.a_id);
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
  const handleForward = (e: React.FormEvent) => {
    e.preventDefault();
    const task = getSelectedTask();
    const activeUser = getActiveUser();
    
    if (!task || !activeUser) return;
    
    // Check if target agencies are empty for COORDINATOR in DRAFT
    if (task.in_workflow_status === 'DRAFT' && task.agencies.length === 0) {
      return Swal.fire('คำเตือน', 'กรุณาเข้าสู่กระบวนการนำเข้าโดยเลือกส่วนราชการผู้รับผิดชอบก่อน', 'warning');
    }

    const { role: effectiveRole } = getSimEffectiveUser(task, activeUser, delegations);
    const { autoUpAssignee, manualAssignees, useParallelAssign } = getSimNextAssignees(task, activeUser, users, allData?.agency || [], delegations);
    
    // If parallel assign is required (HR_DIRECTOR forwards to multiple divisions)
    if (useParallelAssign) {
      Swal.fire({
        title: 'ยืนยันการกระจายงาน?',
        text: `ระบบจะทำการส่งข้อมูลให้ผู้อำนวยการส่วนราชการปลายทางทั้ง ${task.agencies.length} หน่วยงานตรวจสอบคู่ขนานพร้อมกัน`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก'
      }).then((result) => {
        if (result.isConfirmed) {
          const batchId = Math.random().toString(36).substring(7);
          const parallelTracks: SimParallelAssignment[] = task.agencies.map((agId, idx) => {
            const ag = allData?.agency?.find((a: any) => a.ag_id === agId);
            const director = findAgencyDirector(agId);
            
            return {
              pa_id: Date.now() + idx,
              ag_id: agId,
              ag_name: ag?.ag_name || `หน่วยงาน ${agId}`,
              initial_owner_id: director ? director.a_id : activeUser.a_id,
              current_owner_id: director ? director.a_id : activeUser.a_id,
              pa_status: 'PENDING',
              result_comments: '',
              results_id: null,
              updated_at: new Date().toISOString()
            };
          });

          const updatedTasks = simTasks.map(t => {
            if (t.id === task.id) {
              return {
                ...t,
                in_workflow_status: 'PENDING_PARALLEL',
                in_is_parallel: true,
                in_current_owner_id: null,
                in_flow_state: 'in' as const,
                parallel_assignments: parallelTracks
              };
            }
            return t;
          });

          // Add history logs for each parallel assignment
          const newHistoryEntries: SimHistoryEntry[] = parallelTracks.map((pa, idx) => {
            const director = users.find(u => u.a_id === pa.initial_owner_id);
            return {
              id: Date.now() + idx,
              in_id: task.id,
              pa_id: pa.pa_id,
              from_user_id: activeUser.a_id,
              from_user_name: activeUser.a_name,
              from_user_position: activeUser.a_position,
              from_user_role: effectiveRole,
              to_user_id: pa.initial_owner_id,
              to_user_name: director ? director.a_name : 'ไม่พบรายชื่อ',
              to_user_position: director ? director.a_position : 'ผอ.ส่วนราชการ',
              to_user_role: director ? director.a_role : 'DIV_DIRECTOR',
              action: 'PARALLEL_ASSIGNED',
              comments: `เสนอพิจารณาคู่ขนาน (หน่วยงาน: ${pa.ag_name}): ${actionComments || 'โปรดพิจารณาดำเนินการ'}`,
              created_at: new Date().toISOString()
            };
          });

          saveSimulatorState(updatedTasks, [...newHistoryEntries, ...simLogs]);
          setActionComments('');
          
          // Auto switch to the first track owner if switch is active
          if (autoSwitch && parallelTracks.length > 0) {
            setActiveSimUserId(parallelTracks[0].initial_owner_id);
          }
          
          Swal.fire('กระจายงานแล้ว', 'มอบหมายงานคู่ขนานส่งออกไปยังส่วนราชการปลายทางเรียบร้อยแล้ว', 'success');
        }
      });
      return;
    }

    // Single recipient forward
    if (!selectedNextOwnerId) return Swal.fire('คำเตือน', 'กรุณาเลือกผู้รับมอบหมายคนถัดไป', 'warning');
    
    const targetUserId = Number(selectedNextOwnerId);
    const targetUser = users.find(u => u.a_id === targetUserId);
    if (!targetUser) return Swal.fire('Error', 'ไม่พบข้อมูลผู้รับปลายทาง', 'error');

    let newStatus = getNextStatus(effectiveRole, targetUser.a_role);
    let action = 'APPROVED';
    let newFlowState = task.in_flow_state;

    if (targetUser.a_role === 'COORDINATOR') {
      newStatus = 'PENDING_CLOSE';
      action = 'FINALIZED';
    }

    // Update flow_state dynamically
    if (effectiveRole === 'COORDINATOR') {
      newFlowState = 'out';
    } else if (effectiveRole === 'HR_DIRECTOR' && targetUser.a_role === 'DIV_DIRECTOR') {
      newFlowState = 'in';
    } else if (targetUser.a_role === 'STAFF') {
      newFlowState = 'out';
    } else if (effectiveRole === 'STAFF') {
      newFlowState = 'out';
    } else if (effectiveRole === 'DIV_DIRECTOR' && targetUser.a_role === 'HR_DIRECTOR') {
      newFlowState = 'in';
    }

    const updatedTasks = simTasks.map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          in_workflow_status: newStatus,
          in_current_owner_id: targetUserId,
          in_flow_state: newFlowState
        };
      }
      return t;
    });

    const newHistory: SimHistoryEntry = {
      id: Date.now(),
      in_id: task.id,
      pa_id: null,
      from_user_id: activeUser.a_id,
      from_user_name: activeUser.a_name,
      from_user_position: activeUser.a_position,
      from_user_role: effectiveRole,
      to_user_id: targetUserId,
      to_user_name: targetUser.a_name,
      to_user_position: targetUser.a_position,
      to_user_role: targetUser.a_role,
      action: action,
      comments: actionComments || 'เห็นชอบและส่งดำเนินการขั้นถัดไป',
      created_at: new Date().toISOString()
    };

    saveSimulatorState(updatedTasks, [newHistory, ...simLogs]);
    setActionComments('');
    setSelectedNextOwnerId('');

    // Auto-switch simulated user
    if (autoSwitch) {
      setActiveSimUserId(targetUserId);
    }

    Swal.fire({
      icon: 'success',
      title: 'ส่งต่อเอกสารแล้ว',
      text: `งานอยู่ในกล่องข้อความของ ${targetUser.a_name} (${targetUser.a_role})`,
      timer: 1500,
      showConfirmButton: false
    });
  };

  // ── Reject Action (ส่งงานกลับ / ตีกลับ) ──────────────────────────────────
  const handleReject = () => {
    const task = getSelectedTask();
    const activeUser = getActiveUser();
    if (!task || !activeUser) return;

    const previousUsers = getSimRejectAssignees(task, activeUser, simLogs);
    if (previousUsers.length === 0) {
      return Swal.fire('ไม่พบผู้รับงานตีกลับ', 'งานนี้ยังไม่มีประวัติการส่งต่อก่อนหน้าให้ตีกลับ', 'warning');
    }

    if (!selectedNextOwnerId) {
      return Swal.fire('คำเตือน', 'กรุณาเลือกผู้รับงานตีกลับ', 'warning');
    }

    const targetUserId = Number(selectedNextOwnerId);
    const targetUser = users.find(u => u.a_id === targetUserId);
    if (!targetUser) return;

    let newFlowState = task.in_flow_state;
    if (targetUser.a_role === 'STAFF') {
      newFlowState = 'out';
    }

    const updatedTasks = simTasks.map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          in_workflow_status: 'REJECTED',
          in_current_owner_id: targetUserId,
          in_flow_state: newFlowState
        };
      }
      return t;
    });

    const newHistory: SimHistoryEntry = {
      id: Date.now(),
      in_id: task.id,
      pa_id: null,
      from_user_id: activeUser.a_id,
      from_user_name: activeUser.a_name,
      from_user_position: activeUser.a_position,
      from_user_role: activeUser.a_role,
      to_user_id: targetUserId,
      to_user_name: targetUser.a_name,
      to_user_position: targetUser.a_position,
      to_user_role: targetUser.a_role,
      action: 'REJECTED',
      comments: actionComments || 'ส่งงานกลับพิจารณาแก้ไข',
      created_at: new Date().toISOString()
    };

    saveSimulatorState(updatedTasks, [newHistory, ...simLogs]);
    setActionComments('');
    setSelectedNextOwnerId('');

    if (autoSwitch) {
      setActiveSimUserId(targetUserId);
    }

    Swal.fire('ตีกลับเอกสารแล้ว', `ส่งข้อมูลกลับคืนให้คุณ ${targetUser.a_name} ตรวจสอบแล้ว`, 'success');
  };

  // ── Record & Submit results inside a parallel track (STAFF / DIVISION LEVEL) ──────
  const handleSubmitTrackResult = (paId: number) => {
    const task = getSelectedTask();
    const activeUser = getActiveUser();
    if (!task || !activeUser) return;

    const track = task.parallel_assignments.find(pa => pa.pa_id === paId);
    if (!track) return;

    const trackInput = parallelTracksInput[paId] || { comments: '', resultsId: '' };
    if (!trackInput.resultsId) {
      return Swal.fire('คำเตือน', 'กรุณาเลือกผลการพิจารณาสำหรับ Track นี้', 'warning');
    }

    const results = allData?.results?.find((r: any) => r.results_id === Number(trackInput.resultsId));
    
    Swal.fire({
      title: 'ส่งผลพิจารณาของกอง?',
      text: `บันทึกความคิดเห็น: "${trackInput.comments || '-'}" และส่งให้ศูนย์สารสนเทศฯ ทราบ`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันส่งผล',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        // Update this parallel assignment to SUBMITTED
        const updatedTracks = task.parallel_assignments.map(pa => {
          if (pa.pa_id === paId) {
            return {
              ...pa,
              pa_status: 'SUBMITTED' as const,
              result_comments: trackInput.comments,
              results_id: Number(trackInput.resultsId),
              updated_at: new Date().toISOString()
            };
          }
          return pa;
        });

        // Add history log for track submit
        const trackHistory: SimHistoryEntry = {
          id: Date.now(),
          in_id: task.id,
          pa_id: paId,
          from_user_id: activeUser.a_id,
          from_user_name: activeUser.a_name,
          from_user_position: activeUser.a_position,
          from_user_role: activeUser.a_role,
          to_user_id: null,
          to_user_name: null,
          to_user_position: null,
          to_user_role: null,
          action: 'PARALLEL_SUBMITTED',
          comments: `รายงานผลของกอง (${track.ag_name}): [ผล: ${results?.results_detail || 'พิจารณาแล้ว'}] - ${trackInput.comments || 'เรียบร้อย'}`,
          created_at: new Date().toISOString()
        };

        // Check if all tracks are terminal (SUBMITTED or REJECTED)
        const totalTracksCount = updatedTracks.length;
        const terminalTracksCount = updatedTracks.filter(pa => ['SUBMITTED', 'REJECTED'].includes(pa.pa_status)).length;
        
        let newStatus = 'PENDING_PARALLEL';
        let newCurrentOwnerId = task.in_current_owner_id;
        const nextLogs = [trackHistory];

        if (totalTracksCount === terminalTracksCount) {
          // All tracks terminal, route back to HR_DIRECTOR
          const hrDir = users.find(u => u.a_role === 'HR_DIRECTOR') || users[0];
          newStatus = 'PENDING_HR_APPROVAL';
          newCurrentOwnerId = hrDir ? hrDir.a_id : null;
          
          const advanceHistory: SimHistoryEntry = {
            id: Date.now() + 1,
            in_id: task.id,
            pa_id: null,
            from_user_id: null,
            from_user_name: 'ระบบรวมผลอัตโนมัติ',
            from_user_position: 'SYSTEM PROCESSOR',
            from_user_role: 'SYSTEM',
            to_user_id: hrDir?.a_id || null,
            to_user_name: hrDir?.a_name || 'ผอ.ศูนย์ฯ',
            to_user_position: hrDir?.a_position || 'HR_DIRECTOR',
            to_user_role: hrDir?.a_role || 'HR_DIRECTOR',
            action: 'SUBMITTED',
            comments: 'ทุกส่วนราชการพิจารณาตรวจสอบข้อมูลครบถ้วนแล้ว - ระบบส่งคืนให้ ผอ.ศูนย์ฯ (HR_DIRECTOR) พิจารณาลงนามจบเรื่อง',
            created_at: new Date().toISOString()
          };
          nextLogs.push(advanceHistory);
          
          if (autoSwitch && hrDir) {
            setActiveSimUserId(hrDir.a_id);
          }
        }

        const updatedTasks = simTasks.map(t => {
          if (t.id === task.id) {
            return {
              ...t,
              in_workflow_status: newStatus,
              in_current_owner_id: newCurrentOwnerId,
              parallel_assignments: updatedTracks
            };
          }
          return t;
        });

        saveSimulatorState(updatedTasks, [...nextLogs, ...simLogs]);
        
        // Reset local input
        setParallelTracksInput(prev => {
          const c = { ...prev };
          delete c[paId];
          return c;
        });

        Swal.fire('บันทึกผลสำเร็จ', 'ส่งความคิดเห็นเข้าสู่ระบบเรียบร้อยแล้ว', 'success');
      }
    });
  };

  // ── delegate parallel track within division ───────────────────────
  const handleDelegateWithinTrack = (paId: number, targetSubordinateId: number) => {
    const task = getSelectedTask();
    const activeUser = getActiveUser();
    if (!task || !activeUser || !targetSubordinateId) return;

    const track = task.parallel_assignments.find(pa => pa.pa_id === paId);
    const subUser = users.find(u => u.a_id === targetSubordinateId);
    if (!track || !subUser) return;

    const updatedTracks = task.parallel_assignments.map(pa => {
      if (pa.pa_id === paId) {
        return {
          ...pa,
          current_owner_id: targetSubordinateId,
          pa_status: 'IN_PROGRESS' as const
        };
      }
      return pa;
    });

    const newHistory: SimHistoryEntry = {
      id: Date.now(),
      in_id: task.id,
      pa_id: paId,
      from_user_id: activeUser.a_id,
      from_user_name: activeUser.a_name,
      from_user_position: activeUser.a_position,
      from_user_role: activeUser.a_role,
      to_user_id: targetSubordinateId,
      to_user_name: subUser.a_name,
      to_user_position: subUser.a_position,
      to_user_role: subUser.a_role,
      action: 'PARALLEL_DELEGATED',
      comments: `มอบหมายตรวจสอบในสายงานของกอง: ${actionComments || 'โปรดดำเนินตรวจสอบข้อมูล'}`,
      created_at: new Date().toISOString()
    };

    const updatedTasks = simTasks.map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          parallel_assignments: updatedTracks
        };
      }
      return t;
    });

    saveSimulatorState(updatedTasks, [newHistory, ...simLogs]);
    setActionComments('');
    setSelectedNextOwnerId('');

    if (autoSwitch) {
      setActiveSimUserId(targetSubordinateId);
    }

    Swal.fire('มอบหมายงานแล้ว', `ส่งงานต่อให้ ${subUser.a_name} ภายใน Track ของกองแล้ว`, 'success');
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
    }).then((result) => {
      if (result.isConfirmed) {
        const updatedTasks = simTasks.map(t => {
          if (t.id === task.id) {
            return {
              ...t,
              in_workflow_status: 'COMPLETED',
              in_current_owner_id: null,
              in_flow_state: 'end' as const
            };
          }
          return t;
        });

        const newHistory: SimHistoryEntry = {
          id: Date.now(),
          in_id: task.id,
          pa_id: null,
          from_user_id: activeUser.a_id,
          from_user_name: activeUser.a_name,
          from_user_position: activeUser.a_position,
          from_user_role: activeUser.a_role,
          to_user_id: null,
          to_user_name: null,
          to_user_position: null,
          to_user_role: null,
          action: 'FINALIZED',
          comments: actionComments || 'ปิดงานพิจารณาหนังสือเวียนและเก็บประวัติประมวลผล',
          created_at: new Date().toISOString()
        };

        saveSimulatorState(updatedTasks, [newHistory, ...simLogs]);
        setActionComments('');

        Swal.fire('ปิดงานสำเร็จ', 'ระบบบันทึกความสมบูรณ์ของ Workflow เรียบร้อย', 'success');
      }
    });
  };

  // Helper values for selectors
  const activeUser = getActiveUser();
  const task = getSelectedTask();
  
  // Calculate next assignees options
  const { autoUpAssignee, manualAssignees, useParallelAssign } = task && activeUser
    ? getSimNextAssignees(task, activeUser, users, allData?.agency || [], delegations)
    : { autoUpAssignee: null, manualAssignees: [], useParallelAssign: false };

  // Calculate reject options
  const rejectAssignees = task && activeUser
    ? getSimRejectAssignees(task, activeUser, simLogs)
    : [];

  const handleUpdateDraftAgencies = (selectedOptions: any) => {
    if (!task) return;
    const agIds = selectedOptions ? selectedOptions.map((o: any) => Number(o.value)) : [];
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

  const agencyOptions = (allData?.agency || []).map((ag: any) => ({
    value: String(ag.ag_id),
    label: ag.ag_name
  }));

  const categoryOptions = (allData?.categories || []).map((cat: any) => ({
    value: String(cat.cat_id),
    label: cat.cat_name
  }));

  return (
    <div className="space-y-6">
      
      {/* ── Top Bar Control Panel ────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-6 shadow-lg border border-emerald-500/20 animate__animated animate__fadeIn">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Identity Selection Block */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
            <div className="bg-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3">
              <i className="bx bx-user-pin text-3xl text-emerald-200"></i>
              <div>
                <div className="text-[10px] text-emerald-200 uppercase tracking-wider font-bold">จำลองฐานะผู้ใช้</div>
                <select
                  className="bg-transparent border-0 font-bold focus:ring-0 text-white text-sm p-0 m-0 outline-none cursor-pointer"
                  value={activeSimUserId}
                  onChange={(e) => setActiveSimUserId(Number(e.target.value))}
                >
                  {users.map((u) => (
                    <option key={u.a_id} value={u.a_id} className="text-slate-800">
                      [{u.a_role}] - {u.a_name} ({u.a_position})
                    </option>
                  ))}
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
                  <div
                    key={t.id}
                    onClick={() => {
                      setActiveTaskId(t.id);
                      setSelectedNextOwnerId('');
                    }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 border ${
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
                    
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                      <span>{t.in_doc_date}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold ${
                        statusMap[t.in_workflow_status]?.color || 'bg-slate-100 text-slate-600'
                      }`}>
                        {statusMap[t.in_workflow_status]?.label || t.in_workflow_status}
                      </span>
                    </div>
                  </div>
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
                  </div>
                  <p className="text-xs font-semibold text-slate-500 m-0">
                    ลงวันที่ {task.in_doc_date}
                  </p>
                </div>
                
                {/* Reset & Delete buttons */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleResetTask(task.id)}
                    className="p-2 text-slate-500 bg-slate-100 hover:bg-amber-100 hover:text-amber-700 rounded-xl transition-colors text-sm font-semibold flex items-center gap-1"
                    title="เริ่มใหม่ทั้งหมด (Reset)"
                  >
                    <i className="bx bx-reset text-lg"></i>
                    <span className="hidden sm:inline">รีเซ็ต</span>
                  </button>
                  <button
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
                          const c = allData?.categories?.find((item: any) => item.cat_id === catId);
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
                            const ag = allData?.agency?.find((item: any) => item.ag_id === agId);
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
                                      {(allData?.results || []).map((r: any) => (
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
                                              [{u.a_role}] - {u.a_name}
                                            </option>
                                          ))}
                                      </select>
                                    </div>
                                    <button
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
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          เลือกส่วนราชการผู้รับเวียนหนังสือ (กองต่างๆ)
                        </label>
                        <Select
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
                                      {u.is_acting ? '[รักษาการ] ' : ''}{u.a_name} ({u.a_position || u.a_role})
                                    </option>
                                  ))
                                }
                              </optgroup>
                            )}
                          </select>
                          <button
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
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">
                            บันทึกข้อเห็นชอบ / ความเห็นการพิจารณา
                          </label>
                          <textarea
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
                                  
                                  {manualAssignees.length > 0 && (
                                    <optgroup label="มอบหมายลงสายงาน (Forward Down)">
                                      {manualAssignees.map(u => (
                                        <option key={u.a_id} value={u.a_id}>
                                          [{u.a_role}] - {u.a_name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                                <button
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
                              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide text-red-500">
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
                                      [{u.a_role}] - {u.a_name}
                                    </option>
                                  ))}
                                </select>
                                <button
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
                        <span className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
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
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  เลือกหัวข้อข่าวที่บอตสแกนเจอ <span className="text-rose-500">*</span>
                </label>
                <select
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
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">เลขที่หนังสือเวียน</label>
                      <input
                        type="text"
                        value={mockDocNum}
                        onChange={(e) => setMockDocNum(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-saochingcha"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">ปี พ.ศ. <span className="text-rose-500">*</span></label>
                      <select
                        value={mockYearId}
                        onChange={(e) => setMockYearId(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-saochingcha"
                      >
                        <option value="">-- เลือกปี --</option>
                        {(allData?.year || []).map((y: any) => (
                          <option key={y.year_id} value={y.year_id}>
                            {y.year_value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">ชื่อเรื่องหนังสือเวียน</label>
                    <textarea
                      value={mockTitle}
                      onChange={(e) => setMockTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs h-20 font-saochingcha"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      ส่วนราชการต้นเรื่องผู้รับผิดชอบ <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      isMulti
                      options={agencyOptions}
                      value={mockAgencyIds}
                      onChange={(options: any) => setMockAgencyIds(options || [])}
                      placeholder="เลือกกองหรือส่วนราชการ..."
                      className="text-xs font-saochingcha"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      หมวดหมู่หนังสือเวียน <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      isMulti
                      options={categoryOptions}
                      value={mockCategoryIds}
                      onChange={(options: any) => setMockCategoryIds(options || [])}
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

// ── Helper to resolve simulated effective user role ──
function getSimEffectiveUser(task: SimTask, user: any, delegations: any[]) {
  if (!task || !user) return { role: '', agencyId: null };

  const requiredRoleMap: Record<string, string> = {
    'DRAFT': 'COORDINATOR',
    'PENDING_GRP_REVIEW': 'GRP_LEADER',
    'PENDING_SEC_APPROVAL': 'SEC_DIRECTOR',
    'PENDING_DIRECTOR_APPROVAL': 'DIV_DIRECTOR',
    'PENDING_HR_APPROVAL': 'HR_DIRECTOR',
    'PENDING_EXECUTION': 'STAFF',
    'PENDING_CLOSE': 'COORDINATOR'
  };
  const requiredRole = requiredRoleMap[task.in_workflow_status];

  let role = user.a_role;
  let agencyId = user.a_agency_id;

  if (requiredRole && user.a_role !== requiredRole) {
    const activeDel = delegations.find(d => 
      Number(d.assignee_id) === Number(user.a_id) && 
      d.delegated_role === requiredRole && 
      d.is_active
    );
    if (activeDel) {
      role = requiredRole;
      agencyId = activeDel.assigner_ag_id || activeDel.assigner_id;
    }
  }

  return { role, agencyId };
}

// ── Helper to resolve simulated next assignees ──
function getSimNextAssignees(task: SimTask, currentUser: any, allUsers: any[], agencies: any[], delegations: any[] = []) {
  const { role: effectiveRole, agencyId: effectiveAgencyId } = getSimEffectiveUser(task, currentUser, delegations);
  const currentRank = roleRank[effectiveRole] || 0;
  const flowState = task.in_flow_state;
  
  let autoUpAssignee: any = null;
  let manualAssignees: any[] = [];

  const processActing = (targetUser: any) => {
    if (!targetUser) return null;
    const acting = delegations.find(d => 
      (d.assigner_id === targetUser.a_id || (!d.assigner_id && d.assigner_ag_id === targetUser.a_agency_id)) && 
      d.is_active
    );
    if (acting) {
      return {
        ...targetUser,
        acting_info: {
          id: acting.assignee_id,
          name: acting.assignee_name,
          position: acting.assignee_position || acting.assignee_role
        }
      };
    }
    return targetUser;
  };

  if (effectiveRole === 'COORDINATOR') {
    const curAg = agencies.find(a => Number(a.ag_id) === Number(effectiveAgencyId));
    const groupAgencyId = curAg && curAg.ag_type === 'POSITION' ? Number(curAg.parent_ag_id) : Number(effectiveAgencyId);
    if (groupAgencyId) {
      // Find normal GRP_LEADERs in group
      const grpLeaders = allUsers.filter(u => {
        if (u.a_role !== 'GRP_LEADER') return false;
        const uAg = agencies.find(a => Number(a.ag_id) === Number(u.a_agency_id));
        return (
          Number(u.a_agency_id) === groupAgencyId || 
          (uAg && Number(uAg.parent_ag_id) === groupAgencyId && uAg.ag_type === 'POSITION')
        );
      });
      
      if (grpLeaders.length > 0) {
        autoUpAssignee = processActing(grpLeaders[0]);
      }

      // Find acting GRP_LEADERs in group
      const actingGrpLeaders = delegations
        .filter(d => d.delegated_role === 'GRP_LEADER' && d.is_active)
        .filter(d => {
          if (d.assigner_id) {
            const assigner = allUsers.find(u => Number(u.a_id) === Number(d.assigner_id));
            if (assigner) {
              const assignerAg = agencies.find(a => Number(a.ag_id) === Number(assigner.a_agency_id));
              const assignerGrp = assignerAg && assignerAg.ag_type === 'POSITION' ? Number(assignerAg.parent_ag_id) : Number(assigner.a_agency_id);
              return assignerGrp === groupAgencyId;
            }
          }
          if (d.assigner_ag_id) {
            const ag = agencies.find(a => Number(a.ag_id) === Number(d.assigner_ag_id));
            if (ag) {
              return Number(ag.ag_id) === groupAgencyId || Number(ag.parent_ag_id) === groupAgencyId;
            }
          }
          return false;
        })
        .map(d => {
          const assignee = allUsers.find(u => Number(u.a_id) === Number(d.assignee_id));
          return assignee ? { ...assignee, is_acting: true } : null;
        })
        .filter(Boolean);

      const seenIds = new Set();
      const finalManual: any[] = [];
      for (const u of grpLeaders) {
        if (!seenIds.has(u.a_id)) {
          seenIds.add(u.a_id);
          finalManual.push(u);
        }
      }
      for (const u of actingGrpLeaders) {
        if (u && !seenIds.has(u.a_id)) {
          seenIds.add(u.a_id);
          finalManual.push(u);
        }
      }
      manualAssignees = finalManual;
    }
  } else if (effectiveRole === 'GRP_LEADER') {
    // Find HR_DIRECTORs
    const hrDirectors = allUsers.filter(u => u.a_role === 'HR_DIRECTOR');
    if (hrDirectors.length > 0) {
      autoUpAssignee = processActing(hrDirectors[0]);
    }

    // Find acting HR_DIRECTORs
    const actingHrDirectors = delegations
      .filter(d => d.delegated_role === 'HR_DIRECTOR' && d.is_active)
      .map(d => {
        const assignee = allUsers.find(u => u.a_id === d.assignee_id);
        return assignee ? { ...assignee, is_acting: true } : null;
      })
      .filter(Boolean);

    const seenIds = new Set();
    const finalManual: any[] = [];
    for (const u of hrDirectors) {
      if (!seenIds.has(u.a_id)) {
        seenIds.add(u.a_id);
        finalManual.push(u);
      }
    }
    for (const u of actingHrDirectors) {
      if (u && !seenIds.has(u.a_id)) {
        seenIds.add(u.a_id);
        finalManual.push(u);
      }
    }
    manualAssignees = finalManual;
  } else {
    // Standard Auto UP Logic
    if (flowState !== 'in') {
      let currentLookupAgency = effectiveAgencyId;
      while (currentLookupAgency) {
        const higherRankUsers = allUsers.filter(u => 
          u.a_id !== currentUser.a_id &&
          Number(u.a_agency_id) === currentLookupAgency &&
          (roleRank[u.a_role] || 0) > currentRank
        );

        if (higherRankUsers.length > 0) {
          higherRankUsers.sort((a, b) => (roleRank[a.a_role] || 0) - (roleRank[b.a_role] || 0));
          autoUpAssignee = processActing(higherRankUsers[0]);
          break;
        }

        const parentAgency = agencies.find(a => a.ag_id === currentLookupAgency);
        if (!parentAgency || !parentAgency.parent_ag_id) {
          break;
        }
        currentLookupAgency = parentAgency.parent_ag_id;
      }
    }

    const childAgencyIds: number[] = [];
    const getDescendants = (agId: number) => {
      childAgencyIds.push(agId);
      agencies.filter(a => a.parent_ag_id === agId).forEach(child => {
        getDescendants(child.ag_id);
      });
    };
    if (effectiveAgencyId) {
      getDescendants(effectiveAgencyId);
    }

    manualAssignees = allUsers.filter(u => {
      if (u.a_id === currentUser.a_id) return false;
      const uRank = roleRank[u.a_role] || 0;
      
      if (flowState === 'out') {
        if (effectiveRole === 'DIV_DIRECTOR') {
          return u.a_role === 'HR_DIRECTOR';
        } else if (effectiveRole === 'HR_DIRECTOR') {
          if (uRank < currentRank) return false;
        } else {
          if (uRank <= currentRank) return false;
        }
      } else if (flowState === 'in') {
        if (uRank >= currentRank) return false;
      }

      if (currentRank === 4 && uRank === 4) {
        return true;
      }

      if (childAgencyIds.includes(u.a_agency_id) && uRank < currentRank) {
        return true;
      }

      return false;
    }).map(processActing);
  }

  let useParallelAssign = false;
  const taskAgencies = task.agencies || [];
  if (effectiveRole === 'HR_DIRECTOR' && (flowState === 'out' || !flowState)) {
    if (taskAgencies.length > 1) {
      useParallelAssign = true;
    }
  }

  return {
    autoUpAssignee,
    manualAssignees,
    useParallelAssign
  };
}

// ── Helper to resolve simulated reject assignees ──
function getSimRejectAssignees(task: SimTask, currentUser: any, history: SimHistoryEntry[]) {
  const taskHistory = history.filter(h => h.in_id === task.id);
  const seen = new Set<number>();
  const rejectAssignees: any[] = [];
  
  for (let i = taskHistory.length - 1; i >= 0; i--) {
    const h = taskHistory[i];
    const uid = h.from_user_id;
    if (uid && uid !== currentUser.a_id && !seen.has(uid)) {
      seen.add(uid);
      rejectAssignees.push({
        a_id: uid,
        a_name: h.from_user_name,
        a_position: h.from_user_position,
        a_role: h.from_user_role || 'ผู้ร่วมทวนทาน'
      });
    }
  }
  
  return rejectAssignees;
}

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import { agencyApi, adminApi, delegationApi, DelegationItem } from '../../api/apiService'
import { useAuth } from '../../contexts/AuthContext'

interface AgencyNode {
  ag_id: number
  ag_name: string
  ag_code: string | null
  ag_level: number
  ag_type?: string
  ag_role?: string | null
  parent_ag_id: number | null
}

interface Member {
  a_id: number
  a_name: string
  a_username: string
  a_email: string
  a_role: string
  a_position: string
  a_status: string
  a_permiss: string
  a_agency_id: number
  agency_name: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  node: AgencyNode | null
  allNodes?: AgencyNode[]
  onReload?: () => void
  onEditNode?: (node: AgencyNode) => void
}

const ROLE_MAP: Record<string, string> = {
  HR_DIRECTOR:   'ผอ. ควบคุม',
  DIV_DIRECTOR:  'ผอ. กอง',
  SEC_DIRECTOR:  'ผอ. ส่วน',
  GRP_LEADER:    'หัวหน้าฝ่าย',
  STAFF:         'เจ้าหน้าที่',
  COORDINATOR:   'ผู้ประสานงาน',
  SYSTEM_ADMIN:  'ผู้ดูแลระบบ',
}

const ROLE_COLOR: Record<string, string> = {
  HR_DIRECTOR:   'bg-purple-100 text-purple-700',
  DIV_DIRECTOR:  'bg-blue-100 text-blue-700',
  SEC_DIRECTOR:  'bg-sky-100 text-sky-700',
  GRP_LEADER:    'bg-teal-100 text-teal-700',
  STAFF:         'bg-slate-100 text-slate-600',
  COORDINATOR:   'bg-amber-100 text-amber-700',
  SYSTEM_ADMIN:  'bg-rose-100 text-rose-700',
}

const ALLOWED_ASSIGNEE_ROLES: Record<string, string[]> = {
  HR_DIRECTOR: ['SEC_DIRECTOR', 'GRP_LEADER'],
  DIV_DIRECTOR: ['SEC_DIRECTOR', 'GRP_LEADER'],
  SEC_DIRECTOR: ['GRP_LEADER'],
  GRP_LEADER: ['COORDINATOR', 'STAFF'],
  COORDINATOR: [],
  STAFF: [],
}

export default function AgencyMembersDrawer({ isOpen, onClose, node, allNodes = [], onReload, onEditNode }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [allUsers, setAllUsers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const { admin } = useAuth()
  const permiss = admin?.permiss
  
  const [delegations, setDelegations] = useState<DelegationItem[]>([])
  const [showDelegateId, setShowDelegateId] = useState<number | null>(null)
  const [showAttachId, setShowAttachId] = useState<number | null>(null)
  
  const dragDelegationItem = useRef<number | null>(null)
  const dragDelegationOverItem = useRef<number | null>(null)
  
  // Add Position state
  const [showAddPosition, setShowAddPosition] = useState(false)
  const [newPosName, setNewPosName] = useState('')
  const [newPosRole, setNewPosRole] = useState('')
  const [newPosCode, setNewPosCode] = useState('')
  const [savingPos, setSavingPos] = useState(false)

  // Edit Position state
  const [editPosId, setEditPosId] = useState<number | null>(null)
  const [editPosName, setEditPosName] = useState('')
  const [editPosRole, setEditPosRole] = useState('')
  const [editPosCode, setEditPosCode] = useState('')
  const [savingEditPos, setSavingEditPos] = useState(false)

  useEffect(() => {
    if (!isOpen || !node) {
      setMembers([])
      setSearch('')
      setShowAttachId(null)
      setShowDelegateId(null)
      setShowAddPosition(false)
      setEditPosId(null)
      return
    }
    const load = async () => {
      setLoading(true)
      try {
        const data = await agencyApi.getMembers(node.ag_id)
        setMembers(data || [])
        
        if (permiss === 'superadmin') {
          const dels = await delegationApi.getAll()
          setDelegations(dels || [])
        }
      } catch {
        setMembers([])
      } finally {
        setLoading(false)
      }
    }
    const loadUsers = async () => {
      try {
        const u = await adminApi.getUsers()
        setAllUsers(u || [])
      } catch {}
    }
    load()
    loadUsers()
  }, [isOpen, node])

  const positions = allNodes.filter(n => n.parent_ag_id === node?.ag_id && n.ag_type === 'POSITION')
  const allPositionIds = new Set(allNodes.filter(n => n.ag_type === 'POSITION').map(n => n.ag_id))

  const handleDetach = async (userId: number, userName: string) => {
    Swal.fire({
      title: 'ปลดผู้ใช้งาน?',
      text: `ต้องการปลด ${userName} ออกจากตำแหน่ง/ส่วนราชการนี้ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ปลดเลย',
      cancelButtonText: 'ยกเลิก'
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          await adminApi.updateUserAgency(userId, null)
          setMembers(prev => prev.filter(m => m.a_id !== userId))
          if (onReload) onReload()
          Swal.fire('สำเร็จ', 'ปลดผู้ใช้งานเรียบร้อยแล้ว', 'success')
        } catch (e: any) {
          Swal.fire('ผิดพลาด', e.response?.data?.message || 'ไม่สามารถปลดผู้ใช้งานได้', 'error')
        }
      }
    })
  }

  const handleAttach = async (userId: number, targetAgId: number, targetAgName: string, existingUserId?: number) => {
    try {
      if (existingUserId) {
        await adminApi.updateUserAgency(existingUserId, null)
      }
      await adminApi.updateUserAgency(userId, targetAgId)
      const u = allUsers.find(x => x.a_id === userId)
      setMembers(prev => {
        let next = prev
        if (existingUserId) next = next.filter(m => m.a_id !== existingUserId)
        if (u) next = [...next, { ...u, a_agency_id: targetAgId, agency_name: targetAgName }]
        return next
      })
      setShowAttachId(null)
      if (onReload) onReload()
      Swal.fire({ title: 'สำเร็จ', text: existingUserId ? 'เปลี่ยนผู้ใช้งานสำเร็จ' : 'เพิ่มผู้ใช้งานสำเร็จ', icon: 'success', timer: 1500, showConfirmButton: false })
    } catch (e: any) {
      Swal.fire('ผิดพลาด', e.response?.data?.message || 'ไม่สามารถเพิ่มผู้ใช้งานได้', 'error')
    }
  }

  const handleAssignDelegation = async (assignerAgId: number, assigneeId: number) => {
    try {
      const res = await delegationApi.assign({ assigner_ag_id: assignerAgId, assignee_id: assigneeId })
      if (res.status) {
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'แต่งตั้งรักษาการเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false })
        setShowDelegateId(null)
        // Refresh delegations
        if (permiss === 'superadmin') {
          const dels = await delegationApi.getAll()
          setDelegations(dels || [])
        }
      }
    } catch (e: any) {
      Swal.fire('ผิดพลาด', e.response?.data?.message || 'ไม่สามารถแต่งตั้งได้', 'error')
    }
  }

  const handleRevokeDelegation = async (delegationId: number) => {
    const confirm = await Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'ต้องการลบการเป็นรักษาการนี้ใช่หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonText: 'ยกเลิก',
      confirmButtonText: 'ใช่, ลบเลย!'
    })
    if (!confirm.isConfirmed) return
    try {
      await delegationApi.remove(delegationId)
      Swal.fire('สำเร็จ', 'ลบการเป็นรักษาการเรียบร้อยแล้ว', 'success')
      if (permiss === 'superadmin') {
        const dels = await delegationApi.getAll()
        setDelegations(dels || [])
      }
    } catch (e: any) {
      Swal.fire('ผิดพลาด', e.response?.data?.message || 'ไม่สามารถลบได้', 'error')
    }
  }

  const handleSortDelegation = async (myDels: DelegationItem[]) => {
    const fromIndex = dragDelegationItem.current
    const toIndex = dragDelegationOverItem.current
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
      dragDelegationItem.current = null
      dragDelegationOverItem.current = null
      return
    }

    const newDels = [...myDels]
    const item = newDels.splice(fromIndex, 1)[0]
    newDels.splice(toIndex, 0, item)

    // Update state optimistically
    setDelegations(prev => {
      const otherDels = prev.filter(d => !myDels.find(md => md.delegation_id === d.delegation_id))
      return [...otherDels, ...newDels]
    })

    try {
      await delegationApi.reorder(newDels.map(d => d.delegation_id))
    } catch (e: any) {
      console.error('Reorder error', e)
    }

    dragDelegationItem.current = null
    dragDelegationOverItem.current = null
  }

  const handleAddPositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosName.trim()) return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อตำแหน่ง', 'warning');
    setSavingPos(true);
    try {
      const payload = {
        ag_name: newPosName.trim(),
        ag_code: newPosCode.trim() || undefined,
        parent_ag_id: node!.ag_id,
        ag_status: 'active',
        ag_type: 'POSITION',
        ag_role: newPosRole || null
      };
      await agencyApi.create(payload);
      if (onReload) onReload();
      setShowAddPosition(false);
      setNewPosName('');
      setNewPosRole('');
      setNewPosCode('');
      Swal.fire({ icon: 'success', text: 'เพิ่มตำแหน่งเรียบร้อย', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error');
    } finally {
      setSavingPos(false);
    }
  }

  const handleEditPositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPosId) return;
    if (!editPosName.trim()) return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อตำแหน่ง', 'warning');
    setSavingEditPos(true);
    try {
      const payload = {
        ag_name: editPosName.trim(),
        ag_code: editPosCode.trim() || undefined,
        parent_ag_id: node!.ag_id,
        ag_type: 'POSITION',
        ag_role: editPosRole || null
      };
      await agencyApi.update(editPosId, payload);
      if (onReload) onReload();
      setEditPosId(null);
      setEditPosName('');
      setEditPosRole('');
      setEditPosCode('');
      Swal.fire({ icon: 'success', text: 'แก้ไขตำแหน่งเรียบร้อย', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error');
    } finally {
      setSavingEditPos(false);
    }
  }

  const handleDeletePosition = async (pos: AgencyNode) => {
    const { value: password, isConfirmed } = await Swal.fire({
      title: 'ยืนยันการลบตำแหน่ง?',
      html: `<p>ต้องการลบ <strong>"${pos.ag_name}"</strong> ใช่หรือไม่?</p><p class="text-sm text-red-500 mt-2">บัญชีที่อยู่ในตำแหน่งนี้จะถูกปลดออกอัตโนมัติ</p>`,
      icon: 'warning',
      input: 'password',
      inputPlaceholder: 'ระบุรหัสผ่านของคุณ',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
        autocomplete: 'new-password'
      },
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'ลบถาวร',
      cancelButtonText: 'ยกเลิก',
      preConfirm: (pwd) => {
        if (!pwd) {
          Swal.showValidationMessage('กรุณาระบุรหัสผ่านเพื่อยืนยัน')
        }
        return pwd
      }
    })
    if (!isConfirmed || !password) return
    try {
      const res = await agencyApi.remove(pos.ag_id, password)
      if (!res.status) return Swal.fire('ไม่สามารถลบได้', res.message, 'error')
      if (onReload) onReload()
      // Also remove users from UI locally or just refetch
      setMembers(prev => prev.filter(m => m.a_agency_id !== pos.ag_id))
      Swal.fire({ icon: 'success', text: res.message, timer: 1500, showConfirmButton: false })
    } catch (e: any) {
      Swal.fire('ไม่สามารถลบได้', e.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
    }
  }

  const filtered = members.filter(m =>
    !search ||
    m.a_name.toLowerCase().includes(search.toLowerCase()) ||
    m.a_position?.toLowerCase().includes(search.toLowerCase()) ||
    m.agency_name?.toLowerCase().includes(search.toLowerCase())
  )

  const renderMember = (m: Member, idx: number, posId?: number) => {
    return (
      <div key={m.a_id} className="flex flex-col border-t border-slate-50">
        <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/50 transition">
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm ${m.a_status === '1' || m.a_status === 'true' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
        {m.a_name.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-800 truncate">{m.a_name}</span>
          {m.a_status !== '1' && m.a_status !== 'true' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded-full font-bold">ระงับ</span>
          )}
        </div>
        {/* Username / Email */}
        <div className="flex flex-wrap gap-2 mt-1">
          <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">@{m.a_username}</span>
          {m.a_email && (
            <span className="text-[11px] text-slate-400">{m.a_email}</span>
          )}
        </div>
      </div>

      {/* Right: action */}
      <div className="flex flex-col items-end gap-1 shrink-0">
          {posId && (
            <button 
              type="button" 
              title="เปลี่ยนบัญชี"
              className="w-6 h-6 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition"
              onClick={() => setShowAttachId(showAttachId === posId ? null : posId)}
            >
              <i className="bx bx-transfer"></i>
            </button>
          )}
          <button 
            type="button" 
            title="ปลดออก"
            className="w-6 h-6 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition"
            onClick={() => handleDetach(m.a_id, m.a_name)}
          >
            <i className="bx bx-minus"></i>
          </button>
        </div>
      </div>
    </div>
  )
}

  if (!isOpen) return null

  // Groups
  const directMembers = filtered.filter(m => m.a_agency_id === node?.ag_id)

  return createPortal(
    <>
      <div className="fixed inset-0 z-[299] bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full z-[300] w-full max-w-xl flex flex-col bg-slate-50 shadow-2xl transition-transform duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <i className="bx bx-id-card text-xl"></i>
            </div>
            <div>
              <h5 className="m-0 font-bold text-slate-800 text-base leading-tight">จัดการตำแหน่งและบัญชี</h5>
              <p className="text-xs text-blue-600 mt-0.5 font-medium truncate max-w-[260px]">
                <i className="bx bx-buildings mr-1"></i>
                {node?.ag_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition"
            onClick={onClose}
          >
            <i className="bx bx-x text-xl"></i>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 shrink-0 flex gap-2">
          <div className="relative flex-1">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              placeholder="ค้นหาชื่อ, username..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button
            type="button"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition shadow-sm flex items-center gap-1 shrink-0"
            onClick={() => setShowAddPosition(!showAddPosition)}
          >
            <i className="bx bx-plus"></i> เพิ่มตำแหน่ง
          </button>
        </div>

        {/* Add Position Form */}
        {showAddPosition && (
          <div className="p-5 bg-teal-50 border-b border-teal-100 animate__animated animate__fadeIn">
            <h6 className="font-bold text-teal-800 text-sm mb-3">สร้างตำแหน่งใหม่ในสังกัด</h6>
            <form onSubmit={handleAddPositionSubmit} className="space-y-3">
              <div>
                <input 
                  type="text" 
                  placeholder="ชื่อตำแหน่ง *" 
                  required
                  className="w-full px-3 py-2 border border-teal-200 rounded-lg text-sm bg-white"
                  value={newPosName}
                  onChange={e => setNewPosName(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <select
                  className="flex-1 px-3 py-2 border border-teal-200 rounded-lg text-sm bg-white"
                  value={newPosRole}
                  onChange={e => setNewPosRole(e.target.value)}
                >
                  <option value="">-- ไม่ระบุ Role ระบบ --</option>
                  {Object.entries(ROLE_MAP).filter(([k]) => k !== 'SYSTEM_ADMIN').map(([k, v]) => (
                    <option key={k} value={k}>{v} ({k})</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  placeholder="รหัสย่อ (ไม่บังคับ)" 
                  className="w-1/3 px-3 py-2 border border-teal-200 rounded-lg text-sm bg-white"
                  value={newPosCode}
                  onChange={e => setNewPosCode(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAddPosition(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 rounded-lg transition">
                  ยกเลิก
                </button>
                <button type="submit" disabled={savingPos} className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition flex items-center gap-1">
                  {savingPos ? <i className="bx bx-loader-alt animate-spin"></i> : <i className="bx bx-save"></i>} บันทึก
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Member & Position List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <i className="bx bx-loader-alt animate-spin text-4xl text-blue-500 mb-3"></i>
              <p className="text-sm font-medium">กำลังโหลด...</p>
            </div>
          ) : (
            <>
              {/* Positions List */}
              {positions.map(pos => {
                const posMembers = filtered.filter(m => m.a_agency_id === pos.ag_id)
                return (
                  <div key={pos.ag_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <i className="bx bx-id-card text-teal-600 text-lg"></i>
                          <span className="font-bold text-slate-700 text-sm">{pos.ag_name}</span>
                          {pos.ag_role && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ROLE_COLOR[pos.ag_role] || 'bg-slate-200 text-slate-600'}`}>
                              {ROLE_MAP[pos.ag_role] || pos.ag_role}
                            </span>
                          )}
                        </div>
                        {pos.ag_code && <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{pos.ag_code}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {permiss === 'superadmin' && pos.ag_role && (ALLOWED_ASSIGNEE_ROLES[pos.ag_role]?.length > 0) && (
                          <button 
                            className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 flex items-center justify-center transition text-sm"
                            title="แต่งตั้งรักษาการแทนตำแหน่ง"
                            onClick={() => setShowDelegateId(showDelegateId === pos.ag_id ? null : pos.ag_id)}
                          >
                            <i className="bx bx-shield-plus"></i>
                          </button>
                        )}
                        {posMembers.length === 0 && (
                          <button 
                            className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition text-sm"
                            title="ดึงบัญชีเข้าตำแหน่ง"
                            onClick={() => setShowAttachId(showAttachId === pos.ag_id ? null : pos.ag_id)}
                          >
                            <i className="bx bx-user-plus"></i>
                          </button>
                        )}
                        <button 
                          className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 flex items-center justify-center transition text-sm"
                          title="แก้ไขตำแหน่ง"
                          onClick={() => {
                            if (editPosId === pos.ag_id) {
                              setEditPosId(null);
                            } else {
                              setEditPosId(pos.ag_id);
                              setEditPosName(pos.ag_name);
                              setEditPosRole(pos.ag_role || '');
                              setEditPosCode(pos.ag_code || '');
                            }
                          }}
                        >
                          <i className="bx bx-pencil"></i>
                        </button>
                        <button 
                          className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition text-sm"
                          title="ลบตำแหน่ง"
                          onClick={() => handleDeletePosition(pos)}
                        >
                          <i className="bx bx-trash"></i>
                        </button>
                      </div>
                    </div>

                    {/* Edit Position Form */}
                    {editPosId === pos.ag_id && (
                      <div className="p-4 bg-amber-50 border-b border-amber-100 animate__animated animate__fadeIn">
                        <h6 className="font-bold text-amber-800 text-sm mb-3">แก้ไขข้อมูลตำแหน่ง</h6>
                        <form onSubmit={handleEditPositionSubmit} className="space-y-3">
                          <div>
                            <input 
                              type="text" 
                              placeholder="ชื่อตำแหน่ง *" 
                              required
                              className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white"
                              value={editPosName}
                              onChange={e => setEditPosName(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-3">
                            <select
                              className="flex-1 px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white"
                              value={editPosRole}
                              onChange={e => setEditPosRole(e.target.value)}
                            >
                              <option value="">-- ไม่ระบุ Role ระบบ --</option>
                              {Object.entries(ROLE_MAP).filter(([k]) => k !== 'SYSTEM_ADMIN').map(([k, v]) => (
                                <option key={k} value={k}>{v} ({k})</option>
                              ))}
                            </select>
                            <input 
                              type="text" 
                              placeholder="รหัสย่อ (ไม่บังคับ)" 
                              className="w-1/3 px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white"
                              value={editPosCode}
                              onChange={e => setEditPosCode(e.target.value)}
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setEditPosId(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 rounded-lg transition">
                              ยกเลิก
                            </button>
                            <button type="submit" disabled={savingEditPos} className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition flex items-center gap-1">
                              {savingEditPos ? <i className="bx bx-loader-alt animate-spin"></i> : <i className="bx bx-save"></i>} บันทึก
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Attach Dropdown */}
                    {showAttachId === pos.ag_id && (
                      <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-50 flex gap-2">
                        <select 
                          className="flex-1 px-3 py-1.5 border border-blue-200 rounded-lg text-xs bg-white"
                          onChange={(e) => {
                            if (e.target.value) handleAttach(parseInt(e.target.value), pos.ag_id, pos.ag_name, posMembers[0]?.a_id)
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>-- เลือกบัญชีเพื่อเข้าตำแหน่งนี้ --</option>
                          {allUsers.filter(u => !allPositionIds.has(u.a_agency_id)).map(u => (
                            <option key={u.a_id} value={u.a_id}>{u.a_name} ({u.agency_name || 'ไม่มีสังกัด'})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Delegate Dropdown & Active Delegations */}
                    {(() => {
                      const myDels = delegations.filter(d => d.assigner_ag_id === pos.ag_id && d.is_active)
                      
                      return (
                        <>
                          {showDelegateId === pos.ag_id && pos.ag_role && (
                            <div className="px-4 py-2 bg-violet-50/50 border-b border-violet-50 flex gap-2">
                              <select 
                                className="flex-1 px-3 py-1.5 border border-violet-200 rounded-lg text-xs bg-white"
                                onChange={(e) => {
                                  if (e.target.value) handleAssignDelegation(pos.ag_id, parseInt(e.target.value))
                                }}
                                defaultValue=""
                              >
                                <option value="" disabled>-- เลือกผู้รักษาการแทนตำแหน่งนี้ --</option>
                                {allUsers.filter(u => 
                                  (ALLOWED_ASSIGNEE_ROLES[pos.ag_role!] || []).includes(u.a_role) &&
                                  !myDels.some(d => d.assignee_id === u.a_id)
                                ).map(u => (
                                  <option key={u.a_id} value={u.a_id}>{u.a_name} ({u.agency_name || 'ไม่มีสังกัด'}) - {ROLE_MAP[u.a_role] || u.a_role}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {myDels.length > 0 && (
                            <div className="px-4 py-2 bg-violet-50 border-b border-violet-100 flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold text-violet-600 mb-1">ผู้รักษาการแทนตำแหน่งนี้:</span>
                              {myDels.map((d, index) => (
                            <div 
                              key={d.delegation_id} 
                              draggable={permiss === 'superadmin' && myDels.length > 1}
                              onDragStart={() => (dragDelegationItem.current = index)}
                              onDragEnter={() => (dragDelegationOverItem.current = index)}
                              onDragEnd={() => handleSortDelegation(myDels)}
                              onDragOver={(e) => e.preventDefault()}
                              className={`flex items-center justify-between bg-white border border-violet-200 rounded-lg px-3 py-1.5 ${permiss === 'superadmin' && myDels.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                {permiss === 'superadmin' && myDels.length > 1 && (
                                  <i className="bx bx-grid-vertical text-violet-300 mr-1 text-lg"></i>
                                )}
                                <i className="bx bx-user-pin text-violet-600"></i>
                                <span className="text-xs font-semibold text-violet-800 truncate">{d.assignee_name}</span>
                              </div>
                              {permiss === 'superadmin' && (
                                <button 
                                  type="button"
                                  title="ลบสิทธิ์รักษาการ"
                                  onClick={() => handleRevokeDelegation(d.delegation_id)}
                                  className="w-5 h-5 flex items-center justify-center rounded bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition shadow-sm"
                                >
                                  <i className="bx bx-x text-sm"></i>
                                </button>
                              )}
                            </div>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })()}

                    {/* Members inside position */}
                    <div className="divide-y divide-slate-50">
                      {posMembers.length > 0 ? (
                        posMembers.map((m, idx) => renderMember(m, idx, pos.ag_id))
                      ) : (
                        <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                          <i className="bx bx-info-circle"></i> ไม่มีบัญชีในตำแหน่งนี้
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Direct members (Unassigned to position) */}
              {directMembers.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="bx bx-user text-slate-500 text-lg"></i>
                      <span className="font-bold text-slate-700 text-sm">ส่วนราชการส่วนกลาง (ไม่ระบุตำแหน่ง)</span>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {directMembers.map((m, idx) => renderMember(m, idx))}
                  </div>
                </div>
              )}

              {positions.length === 0 && directMembers.length === 0 && !search && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <i className="bx bx-folder-open text-5xl mb-3"></i>
                  <p className="text-sm font-medium">ไม่มีตำแหน่งและบัญชี</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import { adminApi, delegationApi, agencyApi } from '../../api/apiService'

// ลำดับชั้นสำหรับแสดง role ที่จะได้รับ
const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN:   'ผู้อำนวยการใหญ่ (SUPERADMIN)',
  HR_DIRECTOR:  'ผอ.ศูนย์สารสนเทศฯ (HR_DIRECTOR)',
  DIV_DIRECTOR: 'ผอ.กอง (DIV_DIRECTOR)',
  SEC_DIRECTOR: 'ผอ.ส่วน (SEC_DIRECTOR)',
  GRP_LEADER:   'หัวหน้าฝ่าย (GRP_LEADER)',
  STAFF:        'เจ้าหน้าที่ (STAFF)',
  COORDINATOR:  'เจ้าหน้าที่ประสานงาน (COORDINATOR)',
}

interface AssignDelegationModalProps {
  isOpen:       boolean
  onClose:      () => void
  onSuccess:    () => void
  /** user ที่ถูกเลือกจาก UserSection (จะเป็น assignee) */
  assigneeUser: any | null
}

export default function AssignDelegationModal({ isOpen, onClose, onSuccess, assigneeUser }: AssignDelegationModalProps) {
  const [users, setUsers]               = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [assignerId, setAssignerId]     = useState<number | ''>('')
  const [notes, setNotes]               = useState('')
  const [saving, setSaving]             = useState(false)

  const selectedAssigner  = users.find(u => u.a_id === assignerId)
  const delegatedRole     = selectedAssigner?.a_role || null

  // โหลดรายชื่อ users และตรวจสอบโครงสร้าง agency เพื่อแสดงตัวเลือกที่ถูกต้อง
  useEffect(() => {
    if (!isOpen || !assigneeUser) return
    setAssignerId('')
    setNotes('')

    setLoadingUsers(true)
    Promise.all([adminApi.getUsers(), agencyApi.getTree()])
      .then(([usersData, agenciesData]) => {
        let filtered = usersData || []
        filtered = filtered.filter((u: any) => u.a_id !== assigneeUser.a_id && u.a_role !== 'SYSTEM_ADMIN')

        const agencies = agenciesData || []
        const assigneeAgency = agencies.find((a: any) => a.ag_id === assigneeUser.a_agency_id) || { parent_ag_id: null }
        const parentAgId = assigneeAgency.parent_ag_id

        if (['STAFF', 'COORDINATOR'].includes(assigneeUser.a_role)) {
          // ระดับปฏิบัติการ: ต้องเป็น GRP_LEADER และสังกัดเดียวกัน
          filtered = filtered.filter((u: any) => u.a_role === 'GRP_LEADER' && u.a_agency_id === assigneeUser.a_agency_id)
        } else {
          // ระดับอื่นๆ: ต้องอยู่ในสังกัดระดับเหนือขึ้นไป 1 ระดับตามโครงสร้าง
          if (parentAgId) {
            filtered = filtered.filter((u: any) => u.a_agency_id === parentAgId || u.a_role === 'SUPERADMIN')
          } else {
            // ถ้าตัวเองอยู่ระดับบนสุด (ไม่มี parent_ag_id) ก็ให้เลือกเฉพาะ SUPERADMIN
            filtered = filtered.filter((u: any) => u.a_role === 'SUPERADMIN')
          }
        }
        
        setUsers(filtered)
      })
      .catch((e) => {
        console.error(e)
        setUsers([])
      })
      .finally(() => setLoadingUsers(false))
  }, [isOpen, assigneeUser])

  if (!isOpen || !assigneeUser) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignerId) return Swal.fire('แจ้งเตือน', 'กรุณาเลือกผู้มอบอำนาจ', 'warning')

    setSaving(true)
    try {
      const result = await delegationApi.assign({
        assigner_id:  Number(assignerId),
        assignee_id:  assigneeUser.a_id,
        notes:        notes.trim() || undefined,
      })
      if (result.status) {
        Swal.fire({
          title: 'สำเร็จ!',
          html: `<div class="text-sm">แต่งตั้ง <strong>${assigneeUser.a_name}</strong><br/>รักษาการแทน <strong>${selectedAssigner?.a_name}</strong><br/>ในตำแหน่ง <span class="font-bold text-violet-700">${delegatedRole}</span></div>`,
          icon: 'success',
          timer: 2500,
          showConfirmButton: false,
        })
        onSuccess()
        onClose()
      } else {
        Swal.fire('ข้อผิดพลาด', result.message || 'ไม่สามารถบันทึกได้', 'error')
      }
    } catch (err: any) {
      Swal.fire('ข้อผิดพลาด', err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate__animated animate__fadeIn animate__faster">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate__animated animate__zoomIn animate__faster">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-violet-600 to-purple-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <i className="bx bx-shield-plus text-xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold m-0">แต่งตั้งผู้รักษาการ</h3>
              <p className="text-violet-200 text-xs m-0">Acting Role Assignment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <i className="bx bx-x text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Assignee Info (read-only) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              ผู้รับมอบหมาย (Assignee)
            </label>
            <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <i className="bx bx-user text-lg"></i>
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{assigneeUser.a_name}</div>
                <div className="text-xs text-slate-500">{assigneeUser.a_position || 'ไม่ระบุตำแหน่ง'}</div>
              </div>
              <span className="ml-auto px-2 py-1 bg-violet-100 text-violet-700 text-[11px] font-bold rounded-lg">
                {assigneeUser.a_role || 'STAFF'}
              </span>
            </div>
          </div>

          {/* Assigner Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              ให้ไปรักษาการแทน (เจ้าของตำแหน่ง) <span className="text-red-500">*</span>
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 px-4 py-3 text-slate-400 text-sm">
                <i className="bx bx-loader-alt animate-spin"></i> กำลังโหลด...
              </div>
            ) : (
              <select
                value={assignerId}
                onChange={e => setAssignerId(e.target.value ? Number(e.target.value) : '')}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition appearance-none"
              >
                <option value="">-- เลือกเจ้าของตำแหน่ง --</option>
                {users.length === 0 ? (
                  <option disabled value="">ไม่พบบุคคลที่มีสิทธิ์ในขณะนี้</option>
                ) : (
                  users.map(u => (
                    <option key={u.a_id} value={u.a_id}>
                      {u.a_name} — {u.a_position || u.a_role || 'ไม่ระบุตำแหน่ง'}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Delegated Role (auto-fill read-only) */}
          {delegatedRole && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                บทบาทที่จะได้รับ (Auto-calculated)
              </label>
              <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <i className="bx bx-award text-emerald-600"></i>
                <span className="font-bold text-emerald-700 text-sm">
                  {ROLE_LABELS[delegatedRole] || delegatedRole}
                </span>
              </div>
            </div>
          )}


          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">หมายเหตุ (ไม่บังคับ)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="ระบุหมายเหตุเพิ่มเติม..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition resize-none"
            />
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={saving || !assignerId}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-sm transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><i className="bx bx-loader-alt animate-spin"></i> กำลังบันทึก...</>
            ) : (
              'บันทึกแต่งตั้ง'
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}

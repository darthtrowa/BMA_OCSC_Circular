/**
 * ManageDelegationModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal สำหรับจัดการผู้รักษาการ (Manager Hub)
 * เปิดจาก UserSection โดยส่ง assignerUser (เจ้าของตำแหน่ง) เข้ามา
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import { delegationApi } from '../../api/apiService'

interface ManageDelegationModalProps {
  isOpen:       boolean
  onClose:      () => void
  onSuccess:    () => void
  /** user ที่ถูกเลือกจาก UserSection (เจ้าของตำแหน่ง - Assigner) */
  assignerUser: any | null
}

export default function ManageDelegationModal({ isOpen, onClose, onSuccess, assignerUser }: ManageDelegationModalProps) {
  const [activeDelegates, setActiveDelegates] = useState<any[]>([])
  const [loadingDelegates, setLoadingDelegates] = useState(false)

  const loadDelegates = async () => {
    if (!assignerUser) return
    setLoadingDelegates(true)
    try {
      const data = await delegationApi.getByAssigner(assignerUser.a_id)
      setActiveDelegates(data || [])
    } catch (err) {
      console.error(err)
      Swal.fire('Error', 'ไม่สามารถโหลดข้อมูลผู้รักษาการได้', 'error')
    } finally {
      setLoadingDelegates(false)
    }
  }

  useEffect(() => {
    if (!isOpen || !assignerUser) return
    loadDelegates()
  }, [isOpen, assignerUser])

  if (!isOpen || !assignerUser) return null

  const handleRemove = async (delegationId: number) => {
    Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'ต้องการนำผู้ใช้นี้ออกจากการเป็นผู้รักษาการแทนใช่หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ลบออก',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await delegationApi.remove(delegationId)
          Swal.fire('ลบสำเร็จ', '', 'success')
          await loadDelegates()
          onSuccess()
        } catch (err: any) {
          Swal.fire('ข้อผิดพลาด', err.response?.data?.message || err.message || 'ไม่สามารถลบข้อมูลได้', 'error')
        }
      }
    })
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === activeDelegates.length - 1) return

    const newDelegates = [...activeDelegates]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    // Swap
    const temp = newDelegates[index]
    newDelegates[index] = newDelegates[targetIndex]
    newDelegates[targetIndex] = temp

    setActiveDelegates(newDelegates) // Optimistic update UI

    try {
      const delegationIds = newDelegates.map(d => d.delegation_id)
      await delegationApi.reorder(delegationIds)
      onSuccess() // Notify parent to refresh list
    } catch (err: any) {
      console.error(err)
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกลำดับได้', 'error')
      loadDelegates() // Revert UI
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate__animated animate__fadeIn animate__faster">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate__animated animate__zoomIn animate__faster">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-violet-600 to-purple-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <i className="bx bx-list-ol text-xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold m-0">จัดการลำดับผู้รักษาการแทน</h3>
              <p className="text-violet-200 text-xs m-0">Manage Acting Delegates Order</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <i className="bx bx-x text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Assigner Info */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              เจ้าของตำแหน่ง (Position Owner)
            </label>
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                <i className="bx bx-award text-lg"></i>
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{assignerUser.a_name}</div>
                <div className="text-xs text-slate-500">{assignerUser.a_position || 'ไม่ระบุตำแหน่ง'}</div>
              </div>
              <span className="ml-auto px-2 py-1 bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg">
                {assignerUser.a_role}
              </span>
            </div>
          </div>

          {/* Current Delegates List */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              ลำดับผู้รักษาการแทนปัจจุบัน
            </label>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {loadingDelegates ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <i className="bx bx-loader-alt animate-spin text-2xl mb-2"></i>
                  <p>กำลังโหลดข้อมูล...</p>
                </div>
              ) : activeDelegates.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="bx bx-user-x text-2xl text-slate-300"></i>
                  </div>
                  ยังไม่มีผู้รักษาการแทน
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {activeDelegates.map((delegate, index) => (
                    <li key={delegate.delegation_id} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition">
                      
                      {/* Order Controls */}
                      <div className="flex flex-col items-center justify-center shrink-0 w-8">
                        <button 
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <i className="bx bx-chevron-up text-lg"></i>
                        </button>
                        <span className="text-xs font-bold text-slate-500">{index + 1}</span>
                        <button 
                          disabled={index === activeDelegates.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <i className="bx bx-chevron-down text-lg"></i>
                        </button>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 text-sm truncate">{delegate.assignee_name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{delegate.assignee_position || delegate.assignee_role}</div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemove(delegate.delegation_id)}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition shrink-0"
                        title="ลบออก"
                      >
                        <i className="bx bx-x text-xl"></i>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>,
    document.body
  )
}

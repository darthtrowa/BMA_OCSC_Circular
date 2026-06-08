import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import { agencyApi } from '../../api/apiService'
interface AgencyNode {
  ag_id: number
  ag_name: string
  ag_code: string | null
  ag_status: string
  ag_type?: string
  ag_role?: string | null
  parent_ag_id: number | null
  ag_level: number
  ag_path: string
  children_count: number
  direct_member_count: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editNode?: AgencyNode | null
  parentNode?: AgencyNode | null
  allNodes: AgencyNode[]
}

export default function AgencyFormModal({ isOpen, onClose, onSuccess, editNode, parentNode, allNodes }: Props) {
  const isEdit = !!editNode

  const [form, setForm] = useState({
    ag_name: '',
    ag_code: '',
    parent_ag_id: '',
    ag_status: 'active',
    ag_type: 'AGENCY',
    ag_role: '',
  })
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && editNode) {
      setForm({
        ag_name: editNode.ag_name || '',
        ag_code: editNode.ag_code || '',
        parent_ag_id: editNode.parent_ag_id ? String(editNode.parent_ag_id) : '',
        ag_status: editNode.ag_status || 'active',
        ag_type: editNode.ag_type || 'AGENCY',
        ag_role: editNode.ag_role || '',
      })
    } else {
      setForm({
        ag_name: '',
        ag_code: '',
        parent_ag_id: parentNode ? String(parentNode.ag_id) : '',
        ag_status: 'active',
        ag_type: 'AGENCY',
        ag_role: '',
      })
    }
  }, [isOpen, editNode, parentNode, isEdit])

  // กรองตัวเลือก parent: ห้ามเลือกตัวเอง + descendants
  const getDescendantIds = (nodeId: number): Set<number> => {
    const set = new Set<number>([nodeId])
    const addChildren = (id: number) => {
      allNodes.filter(n => n.parent_ag_id === id).forEach(n => {
        set.add(n.ag_id)
        addChildren(n.ag_id)
      })
    }
    addChildren(nodeId)
    return set
  }

  const excludedIds = isEdit && editNode ? getDescendantIds(editNode.ag_id) : new Set<number>()
  const parentOptions = allNodes.filter(n => !excludedIds.has(n.ag_id))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.ag_name.trim()) {
      return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อส่วนราชการ', 'warning')
    }
    setSaving(true)
    try {
      const payload = {
        ag_name: form.ag_name.trim(),
        ag_code: form.ag_code.trim() || undefined,
        parent_ag_id: form.parent_ag_id ? parseInt(form.parent_ag_id) : null,
        ag_status: form.ag_status,
        ag_type: form.ag_type,
        ag_role: form.ag_type === 'POSITION' ? (form.ag_role || null) : null,
      }
      const result = isEdit
        ? await agencyApi.update(editNode!.ag_id, payload)
        : await agencyApi.create(payload)

      if (!result.status) {
        return Swal.fire('ผิดพลาด', result.message, 'error')
      }
      Swal.fire({ icon: 'success', text: result.message, timer: 1500, showConfirmButton: false })
      onSuccess()
      onClose()
    } catch (err: any) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editNode) return;
    const { value: password } = await Swal.fire({
      title: 'ยืนยันการลบ',
      text: `คุณกำลังจะลบส่วนราชการ "${editNode.ag_name}" กรุณาระบุรหัสผ่านของคุณเพื่อยืนยัน`,
      input: 'password',
      inputPlaceholder: 'รหัสผ่านของคุณ',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      inputValidator: (value) => {
        if (!value) return 'กรุณาระบุรหัสผ่าน'
      }
    })

    if (password) {
      setSaving(true)
      try {
        const result = await agencyApi.remove(editNode.ag_id, password)
        if (!result.status) {
          return Swal.fire('ผิดพลาด', result.message, 'error')
        }
        Swal.fire({ icon: 'success', text: 'ลบส่วนราชการสำเร็จ', timer: 1500, showConfirmButton: false })
        onSuccess()
        onClose()
      } catch (err: any) {
        Swal.fire('ผิดพลาด', err.response?.data?.message || 'ไม่สามารถลบส่วนราชการได้', 'error')
      } finally {
        setSaving(false)
      }
    }
  }

  if (!isOpen) return null

  const indent = (level: number) => '\u00a0\u00a0\u00a0\u00a0'.repeat(level - 1)

  return createPortal(
    <>
      <div className="fixed inset-0 z-[299] bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-[300] w-full max-w-lg flex flex-col bg-slate-50 shadow-2xl animate__animated animate__slideInRight animate__faster">
        {/* Header */}
        <div className="p-5 border-b border-amber-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-yellow-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <i className={`bx ${isEdit ? 'bx-edit' : 'bx-building-house'} text-xl`}></i>
            </div>
            <div>
              <h5 className="m-0 font-bold text-amber-900 text-base leading-tight">
                {isEdit ? 'แก้ไขส่วนราชการ' : 'เพิ่มส่วนราชการ'}
              </h5>
              {parentNode && !isEdit && (
                <p className="text-xs text-amber-600 mt-0.5 font-medium">
                  <i className="bx bx-subdirectory-right mr-1"></i>
                  ภายใต้: {parentNode.ag_name}
                </p>
              )}
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

        {/* Body */}
        <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
          <form id="agencyForm" onSubmit={handleSubmit} className="space-y-5">
            {/* ประเภทโหนด */}


            {/* ชื่อ */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                ชื่อส่วนราชการ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="ag_name"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                value={form.ag_name}
                onChange={e => setForm({ ...form, ag_name: e.target.value })}
                placeholder="เช่น สำนักการศึกษา"
                required
              />
            </div>



            {/* รหัสย่อ */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                รหัสย่อ <span className="text-slate-400 font-normal text-xs">(ไม่บังคับ)</span>
              </label>
              <input
                type="text"
                id="ag_code"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                value={form.ag_code}
                onChange={e => setForm({ ...form, ag_code: e.target.value })}
                placeholder="เช่น BMA-EDU"
              />
            </div>

            {/* สังกัด (parent) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                สังกัด (หน่วยงานแม่)
              </label>
              <select
                id="ag_parent"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition appearance-none"
                value={form.parent_ag_id}
                onChange={e => setForm({ ...form, parent_ag_id: e.target.value })}
              >
                <option value="">— ส่วนราชการระดับต้น (Root) —</option>
                {parentOptions.map((n) => (
                  <option key={n.ag_id} value={n.ag_id}>
                    {indent(n.ag_level)}{n.ag_level > 1 ? '└ ' : ''}{n.ag_name}
                    {n.ag_code ? ` [${n.ag_code}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* สถานะ */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">สถานะการใช้งาน</label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition ${form.ag_status === 'active' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="ag_status"
                    value="active"
                    checked={form.ag_status === 'active'}
                    onChange={e => setForm({ ...form, ag_status: e.target.value })}
                    className="accent-amber-600"
                  />
                  <div>
                    <div className="font-semibold text-sm text-amber-700">ใช้งาน</div>
                    <div className="text-xs text-slate-400">เปิดใช้งานอยู่</div>
                  </div>
                </label>
                <label className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition ${form.ag_status === 'disbanded' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="ag_status"
                    value="disbanded"
                    checked={form.ag_status === 'disbanded'}
                    onChange={e => setForm({ ...form, ag_status: e.target.value })}
                    className="accent-rose-600"
                  />
                  <div>
                    <div className="font-semibold text-sm text-rose-700">ยุบเลิก</div>
                    <div className="text-xs text-slate-400">ปิดใช้งาน / ยุบ</div>
                  </div>
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            {isEdit && (
              <button
                type="button"
                className="px-4 py-2.5 rounded-xl font-semibold text-rose-500 bg-rose-50 hover:bg-rose-100 transition flex items-center gap-2"
                onClick={handleDelete}
                disabled={saving}
              >
                <i className="bx bx-trash text-lg"></i> ลบข้อมูล
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
              onClick={onClose}
            >
              ยกเลิก
            </button>
          <button
            type="submit"
            form="agencyForm"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><i className="bx bx-loader-alt animate-spin text-lg"></i> กำลังบันทึก...</>
            ) : (
              <><i className={`bx ${isEdit ? 'bx-save' : 'bx-plus-circle'} text-lg`}></i> {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มส่วนราชการ'}</>
            )}
          </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

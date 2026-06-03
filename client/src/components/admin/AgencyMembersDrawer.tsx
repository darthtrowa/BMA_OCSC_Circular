import { useState, useEffect } from 'react'
import { agencyApi } from '../../api/apiService'

interface AgencyNode {
  ag_id: number
  ag_name: string
  ag_level: number
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

export default function AgencyMembersDrawer({ isOpen, onClose, node }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isOpen || !node) {
      setMembers([])
      setSearch('')
      return
    }
    const load = async () => {
      setLoading(true)
      try {
        const data = await agencyApi.getMembers(node.ag_id)
        setMembers(data || [])
      } catch {
        setMembers([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, node])

  const filtered = members.filter(m =>
    !search ||
    m.a_name.toLowerCase().includes(search.toLowerCase()) ||
    m.a_position?.toLowerCase().includes(search.toLowerCase()) ||
    m.agency_name?.toLowerCase().includes(search.toLowerCase())
  )

  // Group by agency_name for display
  const grouped = filtered.reduce<Record<string, Member[]>>((acc, m) => {
    const key = m.agency_name || 'ไม่ระบุสังกัด'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[299] bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-[300] w-full max-w-xl flex flex-col bg-white shadow-2xl transition-transform duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <i className="bx bx-group text-xl"></i>
            </div>
            <div>
              <h5 className="m-0 font-bold text-slate-800 text-base leading-tight">บัญชีในสังกัด</h5>
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

        {/* Summary */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl">
            <i className="bx bx-user text-blue-600"></i>
            <span className="text-sm font-bold text-blue-700">
              {loading ? '...' : members.length} บัญชี
            </span>
          </div>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <i className="bx bx-info-circle"></i>
            รวมสังกัดย่อยทั้งหมด
          </span>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              placeholder="ค้นหาชื่อ, ตำแหน่ง, หน่วยงาน..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <i className="bx bx-loader-alt animate-spin text-4xl text-blue-500 mb-3"></i>
              <p className="text-sm font-medium">กำลังโหลด...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <i className="bx bx-user-x text-5xl mb-3"></i>
              <p className="text-sm font-medium">{search ? 'ไม่พบผลการค้นหา' : 'ไม่มีบัญชีในสังกัดนี้'}</p>
            </div>
          ) : (
            Object.entries(grouped).map(([agName, agMembers]) => (
              <div key={agName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Group Header */}
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <i className="bx bx-buildings text-slate-400"></i>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{agName}</span>
                  <span className="ml-auto text-xs text-slate-400">{agMembers.length} คน</span>
                </div>

                {/* Members */}
                <div className="divide-y divide-slate-50">
                  {agMembers.map((m, idx) => (
                    <div key={m.a_id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/50 transition">
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

                        {/* Position */}
                        {m.a_position && (
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <i className="bx bx-id-card text-slate-400"></i>
                            {m.a_position}
                          </div>
                        )}

                        {/* Username / Email */}
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">@{m.a_username}</span>
                          {m.a_email && (
                            <span className="text-[11px] text-slate-400">{m.a_email}</span>
                          )}
                        </div>
                      </div>

                      {/* Right: index + role */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-slate-300 font-mono">#{idx + 1}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ROLE_COLOR[m.a_role] || 'bg-slate-100 text-slate-500'}`}>
                          {ROLE_MAP[m.a_role] || m.a_role || 'STAFF'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

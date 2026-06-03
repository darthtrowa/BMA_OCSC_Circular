import { useState, useEffect, useCallback } from 'react'
import Swal from 'sweetalert2'
import { agencyApi } from '../../api/apiService'
import AgencyFormModal from './AgencyFormModal'
import AgencyMembersDrawer from './AgencyMembersDrawer'

// ─── Types ────────────────────────────────────────────────────
interface AgencyNode {
  ag_id: number
  ag_name: string
  ag_code: string | null
  ag_status: string
  parent_ag_id: number | null
  ag_level: number
  ag_path: string
  agency_ordering: number
  children_count: number
  direct_member_count: number
  // computed
  children?: AgencyNode[]
}

// ─── Helpers ──────────────────────────────────────────────────
function buildTree(flat: AgencyNode[]): AgencyNode[] {
  const map = new Map<number, AgencyNode>()
  flat.forEach(n => map.set(n.ag_id, { ...n, children: [] }))
  const roots: AgencyNode[] = []
  map.forEach(n => {
    if (n.parent_ag_id && map.has(n.parent_ag_id)) {
      map.get(n.parent_ag_id)!.children!.push(n)
    } else {
      roots.push(n)
    }
  })
  roots.sort((a, b) => (a.agency_ordering || 0) - (b.agency_ordering || 0))
  map.forEach(n => n.children!.sort((a, b) => (a.agency_ordering || 0) - (b.agency_ordering || 0)))
  return roots
}

function getAllDescendantIds(node: AgencyNode): number[] {
  const ids: number[] = [node.ag_id]
  node.children?.forEach(c => ids.push(...getAllDescendantIds(c)))
  return ids
}

function countAllMembers(node: AgencyNode): number {
  return Number(node.direct_member_count || 0) + (node.children?.reduce((s, c) => s + countAllMembers(c), 0) || 0)
}

// ─── TreeNode Component ───────────────────────────────────────
interface TreeNodeProps {
  node: AgencyNode
  allFlat: AgencyNode[]
  expandedIds: Set<number>
  toggleExpand: (id: number) => void
  searchTerm: string
  onAdd: (parent: AgencyNode) => void
  onEdit: (node: AgencyNode) => void
  onDelete: (node: AgencyNode) => void
  onViewMembers: (node: AgencyNode) => void
  onToggleStatus: (node: AgencyNode) => void
  draggedNode?: AgencyNode | null
  dragOverNode?: AgencyNode | null
  dragPosition?: 'before' | 'after' | null
  onDragStart?: (e: React.DragEvent, node: AgencyNode) => void
  onDragOver?: (e: React.DragEvent, node: AgencyNode) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent, node: AgencyNode) => void
  isSearchMode?: boolean
}

function matchesSearch(node: AgencyNode, term: string): boolean {
  if (!term) return true
  const t = term.toLowerCase()
  return (
    node.ag_name.toLowerCase().includes(t) ||
    (node.ag_code || '').toLowerCase().includes(t)
  )
}

function hasMatchInSubtree(node: AgencyNode, term: string): boolean {
  if (matchesSearch(node, term)) return true
  return node.children?.some(c => hasMatchInSubtree(c, term)) ?? false
}

function TreeNode({
  node, allFlat, expandedIds, toggleExpand, searchTerm,
  onAdd, onEdit, onDelete, onViewMembers, onToggleStatus,
  draggedNode, dragOverNode, dragPosition, onDragStart, onDragOver, onDragLeave, onDrop, isSearchMode
}: TreeNodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0
  const isExpanded = expandedIds.has(node.ag_id)
  const isActive = node.ag_status === 'active'
  const totalMembers = countAllMembers(node)
  const isMatch = matchesSearch(node, searchTerm)

  // Filter children for search
  const visibleChildren = searchTerm
    ? node.children?.filter(c => hasMatchInSubtree(c, searchTerm))
    : node.children

  const shouldShow = searchTerm ? hasMatchInSubtree(node, searchTerm) : true
  if (!shouldShow) return null

  const isDragging = draggedNode?.ag_id === node.ag_id;
  const isDragOver = dragOverNode?.ag_id === node.ag_id;

  const levelColors = [
    'border-l-emerald-500',
    'border-l-blue-400',
    'border-l-indigo-400',
    'border-l-purple-400',
    'border-l-pink-400',
  ]
  const borderColor = levelColors[Math.min(node.ag_level - 1, levelColors.length - 1)]

  return (
    <div className="relative">
      {/* Node Row */}
      <div
        draggable={!isSearchMode}
        onDragStart={e => onDragStart?.(e, node)}
        onDragOver={e => onDragOver?.(e, node)}
        onDragLeave={onDragLeave}
        onDrop={e => onDrop?.(e, node)}
        className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-100 mb-1.5 transition-all hover:shadow-sm ${
          isDragging ? 'opacity-40 border-dashed border-2 border-slate-300 bg-slate-50' : ''
        } ${
          isDragOver ? (dragPosition === 'before' ? 'border-t-2 border-t-emerald-500 rounded-t-none' : 'border-b-2 border-b-emerald-500 rounded-b-none') : ''
        } ${
          isActive
            ? 'bg-white hover:bg-emerald-50/30 hover:border-emerald-200'
            : 'bg-slate-50 opacity-75 hover:opacity-90'
        } ${isMatch && searchTerm ? 'ring-2 ring-amber-300/60' : ''}`}
        style={{ marginLeft: `${(node.ag_level - 1) * 24}px` }}
      >
        {/* Drag Handle */}
        {!isSearchMode && (
          <div className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing px-1 shrink-0 flex items-center">
            <i className="bx bx-grid-vertical text-lg"></i>
          </div>
        )}
        
        {/* Level connector */}
        {node.ag_level > 1 && (
          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl border-l-4 ${borderColor}`} />
        )}

        {/* Expand toggle */}
        <button
          type="button"
          className={`w-6 h-6 flex items-center justify-center rounded-md transition shrink-0 ${
            hasChildren
              ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              : 'text-transparent cursor-default'
          }`}
          onClick={() => hasChildren && toggleExpand(node.ag_id)}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={isExpanded ? 'ย่อ' : 'ขยาย'}
        >
          {hasChildren && (
            <i className={`bx bx-chevron-${isExpanded ? 'down' : 'right'} text-base`}></i>
          )}
        </button>

        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isActive
            ? node.ag_level === 1
              ? 'bg-emerald-100 text-emerald-700'
              : node.ag_level === 2
                ? 'bg-blue-100 text-blue-600'
                : 'bg-slate-100 text-slate-500'
            : 'bg-slate-100 text-slate-400'
        }`}>
          <i className={`bx ${
            hasChildren
              ? (isExpanded ? 'bx-folder-open' : 'bx-folder')
              : 'bx-buildings'
          } text-base`}></i>
        </div>

        {/* Name & info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
              {node.ag_name}
            </span>
            {node.ag_code && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                {node.ag_code}
              </span>
            )}
            {/* Status badge */}
            {!isActive && (
              <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-600 font-bold rounded-full">
                ยุบเลิก
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {hasChildren && (
              <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                <i className="bx bx-git-branch text-[11px]"></i>
                {node.children!.length} หน่วยงานย่อย
              </span>
            )}
            {totalMembers > 0 && (
              <span className="text-[11px] text-blue-500 flex items-center gap-0.5">
                <i className="bx bx-user text-[11px]"></i>
                {totalMembers} บัญชี
              </span>
            )}
            <span className="text-[11px] text-slate-300">ระดับ {node.ag_level}</span>
          </div>
        </div>

        {/* Action buttons — show on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* View members */}
          <button
            type="button"
            title="ดูบัญชีในสังกัด"
            className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition text-sm"
            onClick={() => onViewMembers(node)}
          >
            <i className="bx bx-group"></i>
          </button>

          {/* Add child */}
          <button
            type="button"
            title="เพิ่มส่วนราชการภายใต้"
            className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition text-sm"
            onClick={() => onAdd(node)}
          >
            <i className="bx bx-plus"></i>
          </button>

          {/* Toggle status */}
          <button
            type="button"
            title={isActive ? 'ยุบเลิกส่วนราชการ' : 'เปิดใช้งานอีกครั้ง'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition text-sm ${
              isActive
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
            onClick={() => onToggleStatus(node)}
          >
            <i className={`bx ${isActive ? 'bx-pause-circle' : 'bx-play-circle'}`}></i>
          </button>

          {/* Edit */}
          <button
            type="button"
            title="แก้ไข"
            className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition text-sm"
            onClick={() => onEdit(node)}
          >
            <i className="bx bx-edit-alt"></i>
          </button>

          {/* Delete */}
          <button
            type="button"
            title="ลบถาวร"
            className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition text-sm"
            onClick={() => onDelete(node)}
          >
            <i className="bx bx-trash"></i>
          </button>
        </div>
      </div>

      {/* Children */}
      {(isExpanded || searchTerm) && visibleChildren && visibleChildren.length > 0 && (
        <div className="ml-1">
          {visibleChildren.map(child => (
            <TreeNode
              key={child.ag_id}
              node={child}
              allFlat={allFlat}
              draggedNode={draggedNode}
              dragOverNode={dragOverNode}
              dragPosition={dragPosition}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              isSearchMode={isSearchMode}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              searchTerm={searchTerm}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewMembers={onViewMembers}
              onToggleStatus={onToggleStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Section ─────────────────────────────────────────────
export default function AgencyTreeSection() {
  const [flatNodes, setFlatNodes] = useState<AgencyNode[]>([])
  const [draggedNode, setDraggedNode] = useState<AgencyNode | null>(null);
  const [dragOverNode, setDragOverNode] = useState<AgencyNode | null>(null);
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [treeNodes, setTreeNodes] = useState<AgencyNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')

  // Modal states
  const [formOpen, setFormOpen] = useState(false)
  const [editNode, setEditNode] = useState<AgencyNode | null>(null)
  const [parentNode, setParentNode] = useState<AgencyNode | null>(null)

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerNode, setDrawerNode] = useState<AgencyNode | null>(null)


  const handleDragStart = (e: React.DragEvent, node: AgencyNode) => {
    if (search) {
      e.preventDefault();
      return;
    }
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.ag_id.toString());
  };

  const handleDragOver = (e: React.DragEvent, node: AgencyNode) => {
    e.preventDefault();
    if (!draggedNode || draggedNode.ag_id === node.ag_id || draggedNode.parent_ag_id !== node.parent_ag_id) {
      if (dragOverNode) setDragOverNode(null);
      return;
    }
    setDragOverNode(node);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;
    setDragPosition(isAfter ? 'after' : 'before');
  };

  const handleDragLeave = () => {
    setDragOverNode(null);
    setDragPosition(null);
  };

  const handleDrop = async (e: React.DragEvent, targetNode: AgencyNode) => {
    e.preventDefault();
    if (!draggedNode || draggedNode.ag_id === targetNode.ag_id || draggedNode.parent_ag_id !== targetNode.parent_ag_id) {
      setDraggedNode(null);
      setDragOverNode(null);
      return;
    }

    const siblings = flatNodes.filter(n => n.parent_ag_id === targetNode.parent_ag_id).sort((a, b) => (a.agency_ordering || 0) - (b.agency_ordering || 0));
    const draggedIdx = siblings.findIndex(n => n.ag_id === draggedNode.ag_id);
    siblings.splice(draggedIdx, 1);
    
    let targetIdx = siblings.findIndex(n => n.ag_id === targetNode.ag_id);
    if (dragPosition === 'after') targetIdx += 1;
    
    siblings.splice(targetIdx, 0, draggedNode);

    const updates = siblings.map((n, i) => ({
      ag_id: n.ag_id,
      agency_ordering: i + 1
    }));

    const newFlat = flatNodes.map(n => {
      const u = updates.find(x => x.ag_id === n.ag_id);
      return u ? { ...n, agency_ordering: u.agency_ordering } : n;
    });
    setFlatNodes(newFlat);
    setTreeNodes(buildTree(newFlat));

    setDraggedNode(null);
    setDragOverNode(null);
    setIsSavingOrder(true);

    try {
      await agencyApi.reorder(updates);
    } catch (err: any) {
      Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกลำดับได้', 'error');
      loadTree();
    } finally {
      setIsSavingOrder(false);
    }
  };

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const data = await agencyApi.getTree()
      setFlatNodes(data || [])
      const tree = buildTree(data || [])
      setTreeNodes(tree)
      // Auto-expand level-1 nodes
      setExpandedIds(new Set((data || []).filter((n: AgencyNode) => n.ag_level === 1).map((n: AgencyNode) => n.ag_id)))
    } catch {
      Swal.fire('ผิดพลาด', 'โหลดโครงสร้างส่วนราชการไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTree() }, [loadTree])

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandAll = () => setExpandedIds(new Set(flatNodes.map(n => n.ag_id)))
  const collapseAll = () => setExpandedIds(new Set())

  // ── Actions ──────────────────────────────────────────────────
  const handleAdd = (parent?: AgencyNode) => {
    setEditNode(null)
    setParentNode(parent || null)
    setFormOpen(true)
  }

  const handleEdit = (node: AgencyNode) => {
    setEditNode(node)
    setParentNode(null)
    setFormOpen(true)
  }

  const handleViewMembers = (node: AgencyNode) => {
    setDrawerNode(node)
    setDrawerOpen(true)
  }

  const handleToggleStatus = async (node: AgencyNode) => {
    const newStatus = node.ag_status === 'active' ? 'disbanded' : 'active'
    const confirm = await Swal.fire({
      title: newStatus === 'disbanded' ? 'ยืนยันการยุบเลิก?' : 'ยืนยันการเปิดใช้งาน?',
      text: newStatus === 'disbanded'
        ? `ต้องการยุบเลิก "${node.ag_name}" ใช่หรือไม่?`
        : `ต้องการเปิดใช้งาน "${node.ag_name}" อีกครั้งใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: newStatus === 'disbanded' ? '#f43f5e' : '#059669',
      confirmButtonText: newStatus === 'disbanded' ? 'ยุบเลิก' : 'เปิดใช้งาน',
      cancelButtonText: 'ยกเลิก',
    })
    if (!confirm.isConfirmed) return
    try {
      const res = await agencyApi.updateStatus(node.ag_id, newStatus as 'active' | 'disbanded')
      if (!res.status) return Swal.fire('ผิดพลาด', res.message, 'error')
      Swal.fire({ icon: 'success', text: res.message, timer: 1500, showConfirmButton: false })
      loadTree()
    } catch (e: any) {
      Swal.fire('ผิดพลาด', e.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
    }
  }

  const handleDelete = async (node: AgencyNode) => {
    const confirm = await Swal.fire({
      title: 'ยืนยันการลบถาวร?',
      html: `<p>ต้องการลบ <strong>"${node.ag_name}"</strong> ออกจากระบบอย่างถาวรใช่หรือไม่?</p><p class="text-sm text-red-500 mt-2">การลบนี้ไม่สามารถกู้คืนได้</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'ลบถาวร',
      cancelButtonText: 'ยกเลิก',
    })
    if (!confirm.isConfirmed) return
    try {
      const res = await agencyApi.remove(node.ag_id)
      if (!res.status) return Swal.fire('ไม่สามารถลบได้', res.message, 'error')
      Swal.fire({ icon: 'success', text: res.message, timer: 1500, showConfirmButton: false })
      loadTree()
    } catch (e: any) {
      Swal.fire('ไม่สามารถลบได้', e.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
    }
  }

  // ── Stats ─────────────────────────────────────────────────────
  const totalActive = flatNodes.filter(n => n.ag_status === 'active').length
  const totalDisbanded = flatNodes.filter(n => n.ag_status === 'disbanded').length
  const totalMembers = flatNodes.reduce((s, n) => s + Number(n.direct_member_count || 0), 0)
  const maxLevel = flatNodes.reduce((m, n) => Math.max(m, n.ag_level), 0)

  return (
    <div className="space-y-4 animate__animated animate__fadeIn">
      {/* Page Header */}
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                <i className="bx bx-sitemap text-2xl text-white"></i>
              </div>
              <div>
                <h5 className="m-0 font-bold text-xl text-slate-800 font-saochingcha">
                  โครงสร้างส่วนราชการ
                </h5>
                <p className="text-xs text-slate-400 mt-0.5">จัดการแผนผังองค์กรแบบ Tree ไม่จำกัดชั้น</p>
              </div>
            </div>
            <button
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-sm shrink-0"
              onClick={() => handleAdd()}
              id="btn-add-root-agency"
            >
              <i className="bx bx-plus-circle text-lg"></i>
              เพิ่มส่วนราชการระดับต้น
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
          {[
            { label: 'หน่วยงานทั้งหมด', value: flatNodes.length, icon: 'bx-buildings', color: 'text-slate-700' },
            { label: 'ใช้งานอยู่', value: totalActive, icon: 'bx-check-circle', color: 'text-emerald-600' },
            { label: 'ยุบเลิก', value: totalDisbanded, icon: 'bx-x-circle', color: 'text-rose-500' },
            { label: 'บัญชีทั้งหมด', value: totalMembers, icon: 'bx-group', color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="px-6 py-4 flex items-center gap-3">
              <i className={`bx ${s.icon} text-2xl ${s.color}`}></i>
              <div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-400">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tree Panel */}
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
            <input
              type="text"
              className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              placeholder="ค้นหาส่วนราชการ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="search-agency-tree"
            />
            {search && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                onClick={() => setSearch('')}
              >
                <i className="bx bx-x text-lg"></i>
              </button>
            )}
          </div>

          {/* Expand / Collapse */}
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
              onClick={expandAll}
              title="ขยายทั้งหมด"
            >
              <i className="bx bx-expand-alt text-base"></i>
              ขยายทั้งหมด
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
              onClick={collapseAll}
              title="ย่อทั้งหมด"
            >
              <i className="bx bx-collapse-alt text-base"></i>
              ย่อทั้งหมด
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
              onClick={loadTree}
              title="รีเฟรช"
            >
              <i className="bx bx-refresh text-base"></i>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 py-2.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-4 flex-wrap">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">ปุ่มควบคุม (Hover ที่แถว):</span>
          {[
            { icon: 'bx-group', color: 'text-blue-600', label: 'ดูบัญชีในสังกัด' },
            { icon: 'bx-plus', color: 'text-emerald-600', label: 'เพิ่มหน่วยงานย่อย' },
            { icon: 'bx-pause-circle', color: 'text-amber-600', label: 'ยุบ/เปิดใช้งาน' },
            { icon: 'bx-edit-alt', color: 'text-slate-600', label: 'แก้ไข' },
            { icon: 'bx-trash', color: 'text-rose-500', label: 'ลบถาวร' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1 text-[11px] text-slate-500">
              <i className={`bx ${l.icon} text-sm ${l.color}`}></i>
              {l.label}
            </span>
          ))}
        </div>

        {/* Tree content */}
        <div className="p-4 min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <i className="bx bx-loader-alt animate-spin text-4xl text-emerald-500 mb-3"></i>
              <p className="text-sm font-medium">กำลังโหลดโครงสร้าง...</p>
            </div>
          ) : flatNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <i className="bx bx-sitemap text-6xl mb-4 text-slate-200"></i>
              <p className="text-lg font-semibold text-slate-400 mb-1">ยังไม่มีข้อมูลส่วนราชการ</p>
              <p className="text-sm text-slate-400 mb-5">เริ่มต้นโดยเพิ่มส่วนราชการระดับต้น</p>
              <button
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
                onClick={() => handleAdd()}
              >
                <i className="bx bx-plus-circle text-lg"></i>
                เพิ่มส่วนราชการแรก
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {search ? (
                // Search mode: show all matching nodes as flat tree
                flatNodes
                  .filter(n => hasMatchInSubtree({ ...n, children: buildTree(flatNodes).find(r => r.ag_id === n.ag_id)?.children || [] }, search))
                  .filter(n => n.parent_ag_id === null || !flatNodes.find(p => p.ag_id === n.parent_ag_id))
                  .concat(
                    flatNodes.filter(n => {
                      if (n.parent_ag_id === null) return false
                      return matchesSearch(n, search)
                    })
                  )
                  .filter((n, i, arr) => arr.findIndex(x => x.ag_id === n.ag_id) === i)
                  .map(n => {
                    const treeNode = treeNodes.find(r => r.ag_id === n.ag_id) ||
                      (function findNode(nodes: AgencyNode[], id: number): AgencyNode | undefined {
                        for (const node of nodes) {
                          if (node.ag_id === id) return node
                          const found = findNode(node.children || [], id)
                          if (found) return found
                        }
                      })(treeNodes, n.ag_id)
                    if (!treeNode) return null
                    return (
                      <TreeNode
                        key={treeNode.ag_id}
                        node={treeNode}
                        allFlat={flatNodes}
                        expandedIds={expandedIds}
                        toggleExpand={toggleExpand}
                        searchTerm={search}
                        onAdd={handleAdd}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onViewMembers={handleViewMembers}
                        onToggleStatus={handleToggleStatus}
                      />
                    )
                  })
              ) : (
                treeNodes.map(node => (
                  <TreeNode
                    key={node.ag_id}
                    node={node}
                    allFlat={flatNodes}
                    draggedNode={draggedNode}
                    dragOverNode={dragOverNode}
                    dragPosition={dragPosition}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    isSearchMode={!!search}
                    expandedIds={expandedIds}
                    toggleExpand={toggleExpand}
                    searchTerm={search}
                    onAdd={handleAdd}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onViewMembers={handleViewMembers}
                    onToggleStatus={handleToggleStatus}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        {!loading && flatNodes.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-4 text-xs text-slate-400">
            <span><i className="bx bx-git-branch mr-1"></i>{flatNodes.length} ส่วนราชการ</span>
            <span><i className="bx bx-layer mr-1"></i>{maxLevel} ชั้น</span>
            <span className="ml-auto">Recursive CTE — PostgreSQL</span>
          </div>
        )}
      </div>

      {/* Modals */}
      <AgencyFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={loadTree}
        editNode={editNode}
        parentNode={parentNode}
        allNodes={flatNodes}
      />

      <AgencyMembersDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        node={drawerNode}
      />
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import Select from 'react-select'
import { adminApi } from '../../api/apiService'

export default function BotQueueSection({ allData }: { allData: any }) {
  const cleanYear = (val: string | number | undefined | null) => {
    if (!val) return ''
    return String(val).replace(/^(ปี\s*)?พ\.ศ\.\s*/g, '').trim()
  }

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  // Form State
  const [docNum, setDocNum] = useState('')
  const [docDate, setDocDate] = useState('')
  const [title, setTitle] = useState('')
  const [yearId, setYearId] = useState<number | ''>('')
  const [linkUrl, setLinkUrl] = useState('')
  const [selectedCats, setSelectedCats] = useState<number[]>([])
  const [selectedAgencies, setSelectedAgencies] = useState<any[]>([null])

  const makeOptions = (arr: any[], valKey: string, labelFn: (i: any) => string) => {
    if (!arr) return []
    return arr.map(i => ({ value: i[valKey], label: labelFn(i) }))
  }

  // Local state for categories to allow immediate updates
  const [localCategories, setLocalCategories] = useState<any[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    if (allData?.categories) {
      setLocalCategories(allData.categories)
    }
  }, [allData?.categories])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getBotFindings()
      if (res.status) {
        setData(res.response || [])
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'ไม่สามารถโหลดข้อมูลได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openImportModal = (item: any) => {
    setSelectedItem(item)
    const payload = item.bot_payload || {}
    
    // Auto fill
    setDocNum(payload.doc_num || '')
    setDocDate(payload.extracted_date || '')
    setTitle(payload.title || item.bot_title || '')
    setLinkUrl(payload.original_pdf || item.bot_url || '')
    setSelectedCats([])
    setSelectedAgencies([null])
    
    // Match year from master data
    if (payload.year && allData?.year) {
      const cleanPayloadYear = cleanYear(payload.year)
      const y = allData.year.find((y: any) => cleanYear(y.year_value) === cleanPayloadYear)
      setYearId(y ? y.year_id : '')
    } else {
      setYearId('')
    }
    
    setShowModal(true)
  }

  const submitImport = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!docNum) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกเลขที่หนังสือ' })
    if (!yearId) return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกปี' })
    if (!title) return Swal.fire({ icon: 'warning', text: 'กรุณากรอกชื่อเรื่อง' })
    if (selectedCats.length === 0) return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกหมวดหมู่อย่างน้อย 1 หมวดหมู่' })
    
    try {
      Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } })
      
      const payload = {
        bot_id: selectedItem.bot_id,
        in_num_date: docNum,
        in_doc_date: docDate || null,
        in_detail: title,
        in_year_id: yearId || null,
        in_link: linkUrl,
        categories: selectedCats,
        agencies: selectedAgencies.filter(Boolean).map((a: any) => a.value)
      }
      
      const res = await adminApi.importBotFinding(payload)
      if (res.status) {
        Swal.fire('สำเร็จ', 'นำเข้าข้อมูลสู่ระบบสำเร็จ', 'success')
        setShowModal(false)
        loadData()
      } else {
        Swal.fire('ผิดพลาด', res.message || 'เกิดข้อผิดพลาด', 'error')
      }
    } catch (err: any) {
      Swal.fire('ผิดพลาด', err.message || 'เชื่อมต่อไม่ได้', 'error')
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      Swal.fire({ title: 'กำลังเพิ่มหมวดหมู่...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } })
      const res = await adminApi.masterAction('create', 'categories', null, newCategoryName.trim(), '-')
      if (res.status) {
        const newCat = { cat_id: res.response.id || Math.random(), cat_name: newCategoryName.trim() }
        setLocalCategories(prev => [...prev, newCat])
        setSelectedCats(prev => [...prev, newCat.cat_id])
        setNewCategoryName('')
        Swal.fire('สำเร็จ', 'เพิ่มหมวดหมู่ใหม่เรียบร้อยแล้ว', 'success')
      } else {
        Swal.fire('ผิดพลาด', res.message || 'เกิดข้อผิดพลาด', 'error')
      }
    } catch (err: any) {
      Swal.fire('ผิดพลาด', err.message || 'เชื่อมต่อไม่ได้', 'error')
    }
  }

  const handleAction = async (id: number, action: 'IMPORT' | 'IGNORE') => {
    // IMPORT is now handled by modal
    if (action === 'IMPORT') return;

    const actionText = 'ละเว้น'
    const confirmColor = '#ef4444'

    const result = await Swal.fire({
      title: `ยืนยันการ${actionText}?`,
      text: `คุณต้องการ${actionText}ข้อมูลนี้ใช่หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: '#64748b',
      confirmButtonText: `ใช่, ${actionText}`,
      cancelButtonText: 'ยกเลิก'
    })

    if (result.isConfirmed) {
      Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } })
      try {
        const res = await adminApi.actionBotFinding(id, action)
        if (res.status) {
          Swal.fire('สำเร็จ', `ดำเนินการ${actionText}เรียบร้อยแล้ว`, 'success')
          loadData()
        } else {
          Swal.fire('ผิดพลาด', res.message || 'เกิดข้อผิดพลาด', 'error')
        }
      } catch (err: any) {
        Swal.fire('ผิดพลาด', err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error')
      }
    }
  }

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบทิ้ง?',
      text: 'ข้อมูลนี้จะถูกลบออก และบอตจะสามารถดึงกลับมาใหม่ได้ในการซิงค์ครั้งหน้า',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ใช่, ลบทิ้ง',
      cancelButtonText: 'ยกเลิก'
    })

    if (result.isConfirmed) {
      Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } })
      try {
        const res = await adminApi.deleteBotFinding(id)
        if (res.status) {
          Swal.fire('สำเร็จ', 'ลบข้อมูลสำเร็จ', 'success')
          loadData()
        } else {
          Swal.fire('ผิดพลาด', res.message || 'เกิดข้อผิดพลาด', 'error')
        }
      } catch (err: any) {
        Swal.fire('ผิดพลาด', err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error')
      }
    }
  }

  const handleSyncBot = async () => {
    try {
      Swal.fire({
        title: 'กำลังตรวจสอบข้อมูล...',
        text: 'กรุณารอสักครู่ ระบบกำลังดึงข้อมูลจากเว็บไซต์ ก.พ.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading() }
      })
      
      const res = await adminApi.syncBotFindings()
      
      if (res.status) {
        Swal.fire('สำเร็จ', res.message || `พบข้อมูลใหม่ ${res.response?.count || 0} เรื่อง`, 'success')
        loadData()
      } else {
        Swal.fire('ผิดพลาด', res.message || 'เกิดข้อผิดพลาดในการซิงค์', 'error')
      }
    } catch (err: any) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error')
    }
  }

  return (
    <div className="animate__animated animate__fadeIn">
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <i className='bx bx-bot text-2xl'></i>
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-800 m-0 font-saochingcha">คิวงานบอต (Bot Findings)</h4>
              <p className="text-slate-500 m-0 text-sm">ตรวจสอบและนำเข้าหนังสือเวียนที่บอตค้นพบอัตโนมัติ</p>
            </div>
          </div>
          
          <button 
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-sm hover:shadow"
            onClick={handleSyncBot}
          >
            <i className='bx bx-sync text-lg'></i>
            <span>ดึงข้อมูลล่าสุด (Sync Now)</span>
          </button>
        </div>

        {/* Table Content */}
        <div className="p-0">
          {loading ? (
            <div className="flex justify-center items-center h-[300px]">
              <i className='bx bx-loader-alt animate-spin text-4xl text-indigo-600'></i>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <i className='bx bx-check-shield text-4xl text-slate-300'></i>
              </div>
              <h5 className="text-lg font-bold text-slate-700 mb-2">ไม่มีข้อมูลใหม่ในคิวงาน</h5>
              <p className="text-slate-500 max-w-md">ระบบไม่พบหนังสือเวียนใหม่ที่คุณยังไม่ได้ตรวจสอบ หากต้องการตรวจสอบเพิ่มเติมสามารถกดปุ่ม Sync ด้านบนได้</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
                  <tr>
                    <th className="px-6 py-4 font-semibold border-b border-slate-100">เรื่อง / รายละเอียด</th>
                    <th className="px-6 py-4 font-semibold border-b border-slate-100 w-64 text-center">การกระทำ (Actions)</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.map((item, idx) => (
                    <tr key={item.bot_id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-5 border-b border-slate-50">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {item.bot_payload?.doc_num && (
                              <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-md text-xs border border-indigo-100">
                                <i className='bx bx-file-blank'></i> เลขที่: {item.bot_payload.doc_num}
                              </span>
                            )}
                            {item.bot_payload?.year && (
                              <span className="inline-block px-2 py-1 bg-amber-50 text-amber-800 font-semibold rounded-md text-xs border border-amber-100">
                                <i className='bx bx-calendar'></i> {cleanYear(item.bot_payload.year)}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-slate-800 text-base">{item.bot_title}</span>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                            {item.bot_payload?.extracted_date && (
                              <span className="flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2 rounded-md">
                                <i className='bx bx-check-circle'></i> ดึงวันที่: {item.bot_payload.extracted_date}
                              </span>
                            )}
                            <a href={item.bot_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition font-medium">
                              <i className='bx bx-link-external'></i> ดูหน้าต้นฉบับ (ก.พ.)
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 border-b border-slate-50">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => openImportModal(item)}
                            className="flex items-center justify-center px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-sm font-semibold transition border border-emerald-100 hover:border-emerald-600"
                            title="ตรวจและนำเข้าสู่ระบบหลัก"
                          >
                            <i className='bx bx-import text-xl'></i>
                          </button>
                          <button 
                            onClick={() => handleAction(item.bot_id, 'IGNORE')}
                            className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 hover:bg-slate-500 hover:text-white rounded-lg text-sm font-semibold transition border border-slate-200 hover:border-slate-500"
                            title="ละเว้นข้อมูลนี้"
                          >
                            <i className='bx bx-block text-xl'></i>
                          </button>
                          <button 
                            onClick={() => handleDelete(item.bot_id)}
                            className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-sm font-semibold transition border border-red-100 hover:border-red-500"
                            title="ลบทิ้ง (ให้บอทดึงใหม่)"
                          >
                            <i className='bx bx-trash text-xl'></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* IMPORT MODAL */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center">
                  <i className="bx bx-check-shield text-xl"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-800 m-0 font-saochingcha">ตรวจสอบข้อมูลก่อนนำเข้า</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition">
                <i className="bx bx-x text-2xl"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <form id="importForm" onSubmit={submitImport} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">เลขที่หนังสือ</label>
                    <input type="text" value={docNum} onChange={e => setDocNum(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50" placeholder="เช่น นร 1013/ว 36" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">ปี</label>
                    <select value={yearId} onChange={e => setYearId(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50">
                      <option value="">-- เลือกปี --</option>
                      {allData?.year?.map((y: any) => (
                        <option key={y.year_id} value={y.year_id}>{cleanYear(y.year_value)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 flex items-center justify-between">
                    <span>วันที่ลงหนังสือ</span>
                    {!docDate && <span className="text-amber-500 font-normal normal-case"><i className='bx bx-info-circle'></i> บอตหาไม่พบ โปรดเปิด PDF เพื่อดูวันที่ (ปล่อยว่างได้)</span>}
                  </label>
                  <input type="text" value={docDate} onChange={e => setDocDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-white" placeholder="เช่น 10 ตุลาคม 2568" />
                  <p className="text-xs text-slate-400 mt-1">วันที่นี้จะถูกบันทึกแยกกับเลขที่หนังสือ</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">ชื่อเรื่อง</label>
                  <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 custom-scrollbar"></textarea>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">หมวดหมู่หนังสือ (เลือกได้มากกว่า 1)</label>
                  <div className="grid grid-cols-2 gap-2 mt-2 p-4 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto custom-scrollbar">
                    {localCategories.map((cat: any) => (
                      <label key={cat.cat_id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1.5 rounded-lg transition">
                        <input 
                          type="checkbox" 
                          checked={selectedCats.includes(cat.cat_id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCats([...selectedCats, cat.cat_id])
                            else setSelectedCats(selectedCats.filter(id => id !== cat.cat_id))
                          }}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                        />
                        <span className="text-xs text-slate-700 select-none">{cat.cat_name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input 
                      type="text" 
                      value={newCategoryName} 
                      onChange={e => setNewCategoryName(e.target.value)} 
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 bg-white" 
                      placeholder="+ พิมพ์ชื่อหมวดหมู่ใหม่ที่นี่ หากไม่มีในรายการ..." 
                    />
                    <button 
                      type="button" 
                      onClick={handleAddCategory} 
                      disabled={!newCategoryName.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      เพิ่มหมวดหมู่ใหม่
                    </button>
                  </div>
                </div>

                <div className="z-[60] relative">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    ผู้รับผิดชอบ (ส่วนราชการเป้าหมาย) <span className="text-rose-500">*</span>
                  </label>
                  
                  {selectedAgencies.map((selected, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <Select 
                          placeholder="-- เลือกผู้รับผิดชอบ --"
                          styles={{ 
                            control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e2e8f0', padding: '0.1rem', backgroundColor: '#f8fafc', fontSize: '12px' }),
                            menu: (base) => ({ ...base, fontSize: '12px' }),
                            singleValue: (base) => ({ ...base, fontSize: '12px' })
                          }}
                          options={makeOptions(allData?.agency?.filter((a: any) => (!a.parent_ag_id || a.parent_ag_id === 0) && a.ag_type !== 'POSITION'), 'ag_id', (i: any)=>i.ag_name)}
                          value={selected} 
                          onChange={v => {
                            const newSelected = [...selectedAgencies];
                            newSelected[index] = v;
                            setSelectedAgencies(newSelected);
                          }} 
                        />
                      </div>
                      {selectedAgencies.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => {
                            const newSelected = selectedAgencies.filter((_, i) => i !== index);
                            setSelectedAgencies(newSelected);
                          }}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition border border-red-100"
                          title="ลบส่วนราชการนี้"
                        >
                          <i className="bx bx-trash"></i>
                        </button>
                      )}
                    </div>
                  ))}
                  
                  <button 
                    type="button"
                    onClick={() => setSelectedAgencies([...selectedAgencies, null])}
                    className="mt-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition flex items-center gap-1"
                  >
                    <i className="bx bx-plus"></i> เพิ่มส่วนราชการพิจารณา
                  </button>

                  <p className="text-xs text-slate-400 mt-2">ส่วนราชการที่คุณเลือกตรงนี้จะถูกบันทึกเพื่อใช้ในการกระจายงานเมื่อหัวหน้าฝ่ายบุคคลอนุมัติ</p>
                </div>
                
                <div className="hidden">
                  <input type="text" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <a href={selectedItem.bot_url || selectedItem.bot_payload?.original_pdf} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition mr-auto">
                <i className='bx bx-search-alt'></i> ดู PDF ต้นฉบับ
              </a>
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition">
                ยกเลิก
              </button>
              <button type="submit" form="importForm" className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow hover:shadow-md rounded-xl transition flex items-center gap-2">
                <i className="bx bx-save text-lg"></i> บันทึกนำเข้า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

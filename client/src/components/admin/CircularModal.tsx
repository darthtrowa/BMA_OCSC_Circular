import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { adminApi, BASE_URL } from '../../api/apiService'
import Select from 'react-select'
import moment from 'moment/min/moment-with-locales'
import Swal from 'sweetalert2'
moment.locale('th')

export default function CircularModal({ allData, editItem, onClose, onSaved, mode = 'edit' }) {
  const isEdit = !!editItem
  const isTaskSubmit = mode === 'task-submit'
  const [form, setForm] = useState({
    in_num_date: '', in_doc_date: '', in_detail: '', in_circular_detail: '', in_detail_ag: '',
    in_mkk_id: '', in_mw_id: '', in_results_id: '', in_year_id: '',
    in_status_id: '', in_etc: '', in_link: '', in_qr_link: '',
    in_original_link: '', in_attachment_link: '',
    ag_id: [], cat_id: [], in_id_ref: [],
    mkk_file_mode: 'none',
    mkk_ref_link_in: '',
    existing_file_in: '',
  })
  const [file, setFile]     = useState<File | null>(null)
  const [origFile, setOrigFile] = useState<File | null>(null)
  const [attFiles, setAttFiles] = useState<{ id: string; file: File | null }[]>([])
  const [keptAttachments, setKeptAttachments] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)

  useEffect(() => {
    if (!editItem) return
    const e = editItem
    setForm({
      in_num_date:    e.in_num_date || '',
      in_doc_date:    e.in_doc_date || '',
      in_detail:      e.in_detail || '',
      in_circular_detail: e.in_circular_detail || '',
      in_detail_ag:   e.in_detail_ag || '',
      in_mkk_id:      e.mati_kk?.mkk_id || '',
      in_mw_id:       e.mati_work?.mw_id || '',
      in_results_id:  e.results?.results_id || '',
      in_year_id:     e.year?.year_id || '',
      in_status_id:   e.status_a?.status_id || '',
      in_etc:         e.in_etc === '-' ? '' : (e.in_etc || ''),
      in_link:        e.in_link === '-' ? '' : (e.in_link || ''),
      in_qr_link:     e.in_qr_link === '-' ? '' : (e.in_qr_link || ''),
      in_original_link: e.in_original_link === '-' ? '' : (e.in_original_link || ''),
      in_attachment_link: e.in_attachment_link === '-' ? '' : (e.in_attachment_link || ''),
      ag_id:   (e.agency||[]).map(a => ({ value: String(a.ag_id), label: a.ag_name })),
      cat_id:  (e.categories||[]).map(c => ({ value: String(c.cat_id), label: c.cat_name })),
      in_id_ref: (e.references_info||[]).map((r: any) => ({
        value: String(r.in_id), label: `${r.in_num_date}${r.in_doc_date ? ` (ลงวันที่ ${r.in_doc_date})` : ''}`
      })),
      mkk_file_mode:    e.in_file_mkk && e.in_file_mkk !== '-' ? 'existing' : 'none',
      mkk_ref_link_in:  '',
      existing_file_in: e.in_file_mkk && e.in_file_mkk !== '-' ? e.in_file_mkk : '',
    })

    let parsedAttachments: string[] = []
    if (e.in_attachment_link && e.in_attachment_link !== '-') {
      try {
        const p = JSON.parse(e.in_attachment_link)
        if (Array.isArray(p)) parsedAttachments = p
        else parsedAttachments = [e.in_attachment_link]
      } catch {
        parsedAttachments = [e.in_attachment_link]
      }
    }
    setKeptAttachments(parsedAttachments)
    setAttFiles([])
  }, [editItem])

  const makeOptions = (arr, idKey, labelFn) =>
    (arr||[]).map(item => ({ value: String(item[idKey]), label: labelFn(item) }))

  const formatMati = (item, nameKey, dateKey) => {
    if (!item) return null
    const name = item[nameKey] || ''
    const d = item[dateKey]
    const isDummyDate = d && moment(d).format('YYYY-MM-DD') === '2222-01-01'

    if (!d || isDummyDate || name.includes('รอเข้า')) {
      return name && name !== 'ไม่ระบุ' ? name : null
    }
    return `ครั้งที่ ${name} วันที่ ${moment(d).locale('th').add(543, 'year').format('DD MMM YYYY')}`
  }

  const refOptions = (allData?.information||[]).map((i: any) => ({
    value: String(i.in_id),
    label: `${i.in_num_date}${i.in_doc_date ? ` (ลงวันที่ ${i.in_doc_date})` : ''}`
  }))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.in_num_date)       return Swal.fire({ icon: 'warning', text: 'กรุณากรอกเลขที่หนังสือ' })
    if (!form.in_detail)         return Swal.fire({ icon: 'warning', text: 'กรุณากรอกชื่อเรื่อง' })
    if (!isTaskSubmit) {
      if (!form.in_results_id)     return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกผลการพิจารณา' })
      if (!form.in_year_id)        return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกปี พ.ศ.' })
      if (form.ag_id.length === 0) return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกผู้รับผิดชอบ' })
      if (form.cat_id.length === 0) return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกหมวดหมู่' })
    }

    const fd = new FormData()
    fd.append('submit_create_circular_hidden', '1')
    if (isEdit) fd.append('in_id', editItem.in_id)
    fd.append('in_num_date',   form.in_num_date)
    fd.append('in_doc_date',   form.in_doc_date)
    fd.append('in_detail',     form.in_detail)
    fd.append('in_circular_detail', form.in_circular_detail)
    fd.append('in_detail_ag',  form.in_detail_ag)
    fd.append('in_mkk_id',     form.in_mkk_id)
    fd.append('in_mw_id',      form.in_mw_id)
    fd.append('in_results_id', form.in_results_id)
    fd.append('in_year_id',    form.in_year_id)
    fd.append('in_status_id',  form.in_status_id)
    fd.append('in_etc',        form.in_etc)
    fd.append('in_link',       form.in_link)
    fd.append('in_qr_link',    form.in_qr_link)
    
    // Original Circular File
    if (origFile) {
      fd.append('in_original_file', origFile)
    } else {
      fd.append('in_original_link', form.in_original_link || '-')
    }

    // Attachment File
    const filesToUpload = attFiles.map(item => item.file).filter((f): f is File => f !== null)
    if (filesToUpload.length > 0) {
      filesToUpload.forEach(f => { fd.append('in_attachment_file', f) })
    }
    fd.append('in_attachment_link', keptAttachments.length > 0 ? JSON.stringify(keptAttachments) : '-')

    if (!form.in_link) fd.append('lkk_none', '-')
    form.ag_id.forEach(o  => { fd.append('ag_id[]', o.value) })
    form.cat_id.forEach(o => { fd.append('cat_id[]', o.value) })

    if (form.mkk_file_mode === 'link' && form.mkk_ref_link_in) {
      fd.append('mkk_ref_link_in', form.mkk_ref_link_in)
    } else if (form.mkk_file_mode === 'upload' && file) {
      fd.append('mkk_ref_upload_in', file)
    } else if (form.mkk_file_mode === 'existing' && form.existing_file_in) {
      fd.append('existing_file_in', form.existing_file_in)
    } else {
      fd.append('mkk_ref_none_in', '-')
    }

    if (form.in_id_ref.length > 0) {
      fd.append('ref_none', 'has_ref')
      form.in_id_ref.forEach(o => { fd.append('in_id_ref[]', o.value) })
    } else {
      fd.append('ref_none', '-')
    }

    setSaving(true)
    try {
      const data = isEdit
        ? await adminApi.updateCircular(fd)
        : await adminApi.createCircular(fd)
      if (data.status) {
        Swal.fire({ icon: 'success', text: data.message, timer: 1500, showConfirmButton: false })
        onSaved()
      } else {
        Swal.fire('ผิดพลาด', data.message, 'error')
      }
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate__animated animate__fadeIn animate__faster">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate__animated animate__zoomIn animate__faster">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h5 className="m-0 font-bold text-xl text-slate-800 font-saochingcha">
            {isTaskSubmit ? 'แก้ไขและส่งข้อมูลหนังสือเวียน' : isEdit ? 'แก้ไขหนังสือเวียน' : 'เพิ่มหนังสือเวียน'}
          </h5>
          <button 
            type="button" 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition" 
            onClick={onClose}
          >
            <i className='bx bx-x text-xl'></i>
          </button>
        </div>
        
        <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">เลขที่หนังสือ <span className="text-rose-500">*</span></label>
                <input 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                  value={form.in_num_date} 
                  onChange={e=>set('in_num_date',e.target.value)} 
                  placeholder="เช่น ที่ นร 1013/ว 36"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">ลงวันที่</label>
                <input 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                  value={form.in_doc_date} 
                  onChange={e=>set('in_doc_date',e.target.value)} 
                  placeholder="เช่น 10 ตุลาคม 2568"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">ปี พ.ศ. <span className="text-rose-500">*</span></label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none" 
                  value={form.in_year_id} 
                  onChange={e=>set('in_year_id',e.target.value)}
                >
                  <option value="">-- เลือกปี --</option>
                  {(allData?.year||[]).map((y: any)=><option key={y.year_id} value={y.year_id}>{y.year_value}</option>)}
                </select>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อเรื่อง <span className="text-rose-500">*</span></label>
              <textarea 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none" 
                rows={2} 
                value={form.in_detail} 
                onChange={e=>set('in_detail',e.target.value)} 
              />
            </div>
            {/* Reference field — shown immediately after Subject */}
            <div className="md:col-span-2 relative z-40">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">อ้างอิงหนังสือเวียน</label>
              <Select isMulti placeholder="-- เลือกหนังสืออ้างอิง --"
                styles={{ control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e2e8f0', padding: '0.1rem' }) }}
                options={refOptions.filter(o => !isEdit || o.value !== String(editItem?.in_id))}
                value={form.in_id_ref} onChange={v=>set('in_id_ref',v)} />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-700">รายละเอียดของหนังสือเวียน</label>
                <button 
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  onClick={async () => {
                    // Check if new un-uploaded files exist
                    const hasUnsavedUploads = origFile || file || attFiles.some(item => item.file !== null);
                    if (hasUnsavedUploads) {
                       return Swal.fire({ 
                         icon: 'info', 
                         title: 'กรุณาบันทึกข้อมูลก่อน',
                         text: 'พบไฟล์ใหม่ที่เพิ่งถูกเพิ่มแต่ยังไม่ได้ถูกอัปโหลดขึ้นเซิร์ฟเวอร์ กรุณากดบันทึกข้อมูลก่อนหนึ่งครั้งเพื่อให้ระบบนำไฟล์ไปประมวลผลได้' 
                       })
                    }

                    // Determine Main PDF
                    let mainPdf = ''
                    if (form.in_original_link && form.in_original_link !== '-') {
                      mainPdf = form.in_original_link
                    } else if (form.mkk_file_mode === 'existing' && form.existing_file_in) {
                      mainPdf = form.existing_file_in
                    } else if (form.mkk_file_mode === 'link' && form.mkk_ref_link_in) {
                      mainPdf = form.mkk_ref_link_in
                    }

                    let selectedAttachments: string[] = []

                    // If we have keptAttachments, we prompt the user to select
                    if (keptAttachments.length > 0) {
                      const { value: selectedObj, isConfirmed } = await Swal.fire({
                        title: 'เลือกไฟล์ที่ต้องการให้ AI สรุปเพิ่มเติม',
                        html: `
                          <div class="text-left text-sm text-slate-700 mt-2 space-y-3">
                            <p class="text-xs text-rose-500 mb-2">* ระบบจะนำหนังสือเวียนหลัก (ถ้ามี) ไปอ่านเป็นแกนนำเสมอ</p>
                            <label class="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
                              <input type="checkbox" id="selectAllAtt" class="w-4 h-4 text-emerald-600 rounded" onclick="
                                const checkboxes = document.querySelectorAll('.att-chk');
                                checkboxes.forEach(cb => cb.checked = this.checked);
                              " />
                              <span class="font-bold">เลือกไฟล์สิ่งที่ส่งมาด้วยทั้งหมด</span>
                            </label>
                            <div class="space-y-2 max-h-48 overflow-y-auto pr-2">
                              ${keptAttachments.map((att) => `
                                <label class="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-emerald-50 transition">
                                  <input type="checkbox" class="att-chk w-4 h-4 text-emerald-600 rounded" value="${att}" />
                                  <span class="truncate" title="${att}">${att}</span>
                                </label>
                              `).join('')}
                            </div>
                          </div>
                        `,
                        showCancelButton: true,
                        confirmButtonText: 'ยืนยันและเริ่มสรุป',
                        cancelButtonText: 'ยกเลิก',
                        confirmButtonColor: '#10b981',
                        preConfirm: () => {
                          const checkboxes = document.querySelectorAll('.att-chk:checked') as NodeListOf<HTMLInputElement>;
                          return Array.from(checkboxes).map(cb => cb.value);
                        }
                      });

                      if (!isConfirmed) return; // User canceled
                      selectedAttachments = selectedObj || [];
                    }

                    if (!mainPdf && selectedAttachments.length === 0) {
                      return Swal.fire({ icon: 'warning', text: 'ไม่พบไฟล์ PDF หรือสิ่งที่ส่งมาด้วยที่สามารถนำมาสรุปผลได้' })
                    }

                    setSummarizing(true)
                    try {
                      const payload = {
                        mainPdf: mainPdf || undefined,
                        attachments: selectedAttachments
                      }
                      const res = await adminApi.summarizeCircular(payload)
                      if (res.status) {
                        let summary = ''
                        let docDate = ''
                        let references: any[] = []
                        let qrLink = ''

                        if (res.response && typeof res.response === 'object') {
                          summary = res.response.summary || ''
                          docDate = res.response.docDate || ''
                          references = res.response.references || []
                          qrLink = res.response.qrLink || ''
                        } else if (typeof res.response === 'string') {
                          summary = res.response
                        }

                        // Helper functions for fuzzy matching
                        const normalizeCircularNum = (str: string): string => {
                          if (!str) return ''
                          return str
                            .toLowerCase()
                            .replace(/^ที่\s*/, '')
                            .replace(/\s+/g, '')
                            .trim()
                        }

                        const normalizeDateStr = (str: string): string => {
                          if (!str) return ''
                          let res = str.toLowerCase().replace(/\s+/g, '').trim()
                          
                          // Replace full Thai month names with abbreviations to normalize
                          const monthMap = [
                            { full: 'มกราคม', short: 'ม.ค.' },
                            { full: 'กุมภาพันธ์', short: 'ก.พ.' },
                            { full: 'มีนาคม', short: 'มี.ค.' },
                            { full: 'เมษายน', short: 'เม.ย.' },
                            { full: 'พฤษภาคม', short: 'พ.ค.' },
                            { full: 'มิถุนายน', short: 'มิ.ย.' },
                            { full: 'กรกฎาคม', short: 'ก.ค.' },
                            { full: 'สิงหาคม', short: 'ส.ค.' },
                            { full: 'กันยายน', short: 'ก.ย.' },
                            { full: 'ตุลาคม', short: 'ต.ค.' },
                            { full: 'พฤศจิกายน', short: 'พ.ย.' },
                            { full: 'ธันวาคม', short: 'ธ.ค.' },
                          ]
                          
                          monthMap.forEach(m => {
                            res = res.replace(new RegExp(m.full, 'g'), m.short)
                          })
                          
                          return res
                        }

                        const isMatch = (dbNum: string, refNum: string): boolean => {
                          const normDb = normalizeCircularNum(dbNum)
                          const normRef = normalizeCircularNum(refNum)
                          
                          if (!normDb || !normRef) return false
                          if (normDb === normRef) return true
                          
                          const checkBoundaryContain = (longer: string, shorter: string) => {
                            const idx = longer.indexOf(shorter)
                            if (idx === -1) return false
                            
                            if (idx > 0) {
                              const charBefore = longer.charAt(idx - 1)
                              if (/\d/.test(charBefore)) return false
                            }
                            const endIdx = idx + shorter.length
                            if (endIdx < longer.length) {
                              const charAfter = longer.charAt(endIdx)
                              if (/\d/.test(charAfter)) return false
                            }
                            return true
                          }

                          if (normDb.length > normRef.length) {
                            return checkBoundaryContain(normDb, normRef)
                          } else {
                            return checkBoundaryContain(normRef, normDb)
                          }
                        }

                        const matchedOptions: { value: string; label: string }[] = []
                        if (references && references.length > 0) {
                          (allData?.information || []).forEach((info: any) => {
                            if (isEdit && String(info.in_id) === String(editItem?.in_id)) {
                              return
                            }
                            const matchFound = references.some((ref: any) => {
                              let refNum = ''
                              let refDate = ''
                              if (typeof ref === 'string') {
                                refNum = ref
                              } else if (ref && typeof ref === 'object') {
                                refNum = ref.number || ''
                                refDate = ref.date || ''
                              }
                              
                              if (!refNum) return false
                              const numMatches = isMatch(info.in_num_date, refNum)
                              if (!numMatches) return false
                              
                              // 2. Check if the document date matches (both must be non-empty and match)
                              if (!refDate || !info.in_doc_date) return false
                              
                              const normDbDate = normalizeDateStr(info.in_doc_date)
                              const normRefDate = normalizeDateStr(refDate)
                              
                              return normDbDate === normRefDate
                            })
                            if (matchFound) {
                              matchedOptions.push({
                                value: String(info.in_id),
                                label: `${info.in_num_date}${info.in_doc_date ? ` (ลงวันที่ ${info.in_doc_date})` : ''}`
                              })
                            }
                          })
                        }

                        let addedCount = 0
                        setForm((prev: any) => {
                          const updated = { ...prev, in_circular_detail: summary }
                          if (docDate && !prev.in_doc_date) {
                            updated.in_doc_date = docDate
                          }
                          if (qrLink && !prev.in_link) {
                            updated.in_link = qrLink
                          }
                          const currentRefs = (prev.in_id_ref || []) as any[]
                          const mergedRefs = [...currentRefs]
                          
                          matchedOptions.forEach(opt => {
                            if (!mergedRefs.some(r => r.value === opt.value)) {
                              mergedRefs.push(opt)
                              addedCount++
                            }
                          })
                          updated.in_id_ref = mergedRefs
                          return updated
                        })

                        let alertMsg = 'สรุปผลสำเร็จ'
                        const isDateAdded = !!(docDate && !form.in_doc_date)
                        const isQrAdded = !!(qrLink && !form.in_link)
                        if (isDateAdded && isQrAdded && addedCount > 0) {
                          alertMsg = `สรุปผลสำเร็จ (ดึงลงวันที่, ลิงก์ QR Code และพบข้อมูลอ้างอิงใหม่ ${addedCount} รายการ)`
                        } else if (isDateAdded && isQrAdded) {
                          alertMsg = 'สรุปผลสำเร็จ (ดึงลงวันที่ และลิงก์ QR Code อัตโนมัติ)'
                        } else if (isQrAdded && addedCount > 0) {
                          alertMsg = `สรุปผลสำเร็จ (ดึงลิงก์ QR Code และพบข้อมูลอ้างอิงใหม่ ${addedCount} รายการ)`
                        } else if (isQrAdded) {
                          alertMsg = 'สรุปผลสำเร็จ (ดึงลิงก์ QR Code อัตโนมัติ)'
                        } else if (isDateAdded && addedCount > 0) {
                          alertMsg = `สรุปผลสำเร็จ (ดึงลงวันที่ และพบข้อมูลอ้างอิงใหม่ ${addedCount} รายการ)`
                        } else if (isDateAdded) {
                          alertMsg = 'สรุปผลสำเร็จ (ดึงลงวันที่อัตโนมัติ)'
                        } else if (addedCount > 0) {
                          alertMsg = `สรุปผลสำเร็จ (พบข้อมูลอ้างอิงใหม่ ${addedCount} รายการ)`
                        }

                        Swal.fire({ icon: 'success', text: alertMsg, timer: 2500, showConfirmButton: false })
                      } else {
                        Swal.fire('ผิดพลาด', res.message, 'error')
                      }
                    } catch (err: any) {
                      const msg = err.response?.data?.message || 'ไม่สามารถสรุปผลได้ในขณะนี้';
                      Swal.fire('ผิดพลาด', msg, 'error')
                    } finally {
                      setSummarizing(false)
                    }
                  }}
                  disabled={summarizing}
                >
                  {summarizing ? (
                    <><i className='bx bx-loader-alt animate-spin'></i> กำลังสรุป...</>
                  ) : (
                    <><i className='bx bx-brain'></i> ใช้ AI สรุปผล</>
                  )}
                </button>
              </div>
              <textarea 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-y" 
                rows={6} 
                value={form.in_circular_detail} 
                onChange={e=>set('in_circular_detail',e.target.value)} 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">การพิจารณาจากส่วนราชการ</label>
              <textarea
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
                rows={2}
                value={form.in_detail_ag}
                onChange={e=>set('in_detail_ag',e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">หนังสือเวียนสำนักงาน ก.พ.</label>
              {form.in_original_link && form.in_original_link !== '-' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className='bx bxs-file-pdf text-rose-500 text-xl shrink-0'></i>
                    <span className="text-sm text-emerald-800 font-medium truncate">{form.in_original_link}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a 
                      href={form.in_original_link.startsWith('http') ? form.in_original_link : `${BASE_URL}/uploads/${form.in_original_link}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 hover:text-emerald-800 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <i className='bx bx-show text-sm'></i>
                      <span>ดูไฟล์</span>
                    </a>
                    <button 
                      type="button" 
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      onClick={() => {
                        set('in_original_link', '-');
                        setOrigFile(null);
                      }}
                    >
                      <i className='bx bx-trash text-sm'></i>
                      <span>ลบไฟล์</span>
                    </button>
                  </div>
                </div>
              ) : !origFile ? (
                <input 
                  type="file"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                  accept=".pdf"
                  onChange={e=>setOrigFile(e.target.files?.[0])} 
                />
              ) : (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between animate__animated animate__fadeIn">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className='bx bxs-file-pdf text-rose-500 text-xl shrink-0'></i>
                    <span className="text-sm text-indigo-800 font-medium truncate">{origFile.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a 
                      href={URL.createObjectURL(origFile)} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 hover:text-indigo-800 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <i className='bx bx-show text-sm'></i>
                      <span>ดูไฟล์</span>
                    </a>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                      onClick={async () => {
                        if (!origFile) return
                        const fd = new FormData()
                        fd.append('in_original_file', origFile)
                        try {
                          Swal.showLoading()
                          const res = await adminApi.uploadSingle(fd)
                          if (res.status && res.response?.filename) {
                            set('in_original_link', res.response.filename)
                            setOrigFile(null)
                            Swal.fire({ icon: 'success', text: 'อัปโหลดไฟล์ต้นฉบับสำเร็จ', timer: 1500, showConfirmButton: false })
                          } else {
                            Swal.fire('ผิดพลาด', res.message || 'อัปโหลดล้มเหลว', 'error')
                          }
                        } catch (err: any) {
                          Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาดในการอัปโหลด', 'error')
                        }
                      }}
                    >
                      <i className='bx bx-upload text-sm'></i>
                      <span>อัปโหลดทันที</span>
                    </button>
                    <button 
                      type="button" 
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      onClick={() => setOrigFile(null)}
                    >
                      <i className='bx bx-x text-sm'></i>
                      <span>ยกเลิกเลือก</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">เอกสารแนบท้าย (อัปโหลดได้หลายไฟล์)</label>
              
              <div className="space-y-2 mb-3">
                {keptAttachments.map((link) => (
                  <div key={link} className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <i className='bx bxs-file-pdf text-rose-500 text-xl shrink-0'></i>
                      <span className="text-sm text-emerald-800 font-medium truncate">{link}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a 
                        href={`${BASE_URL}/uploads/${link}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 hover:text-emerald-800 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <i className='bx bx-show text-sm'></i>
                        <span>ดูไฟล์</span>
                      </a>
                      <button 
                        type="button" 
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        onClick={() => setKeptAttachments(prev => prev.filter(item => item !== link))}
                      >
                        <i className='bx bx-trash text-sm'></i>
                        <span>ลบไฟล์</span>
                      </button>
                    </div>
                  </div>
                ))}

                {attFiles.map((item) => {
                  const fileObj = item.file
                  const itemId = item.id
                  return (
                    <div key={itemId} className="flex items-center gap-2">
                      <div className="flex-1">
                        {fileObj ? (
                          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between animate__animated animate__fadeIn">
                            <div className="flex items-center gap-2 min-w-0">
                              <i className='bx bxs-file-pdf text-rose-500 text-xl shrink-0'></i>
                              <span className="text-sm text-indigo-800 font-medium truncate">{fileObj.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a 
                                href={URL.createObjectURL(fileObj)} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 hover:text-indigo-800 rounded-lg text-xs font-bold transition flex items-center gap-1"
                              >
                                <i className='bx bx-show text-sm'></i>
                                <span>ดูไฟล์</span>
                              </a>
                              <button
                                type="button"
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                                onClick={async () => {
                                  if (!fileObj) return
                                  const fd = new FormData()
                                  fd.append('in_attachment_file', fileObj)
                                  try {
                                    Swal.showLoading()
                                    const res = await adminApi.uploadSingle(fd)
                                    if (res.status && res.response?.filename) {
                                      setKeptAttachments(prev => [...prev, res.response.filename])
                                      setAttFiles(prev => prev.filter(att => att.id !== itemId))
                                      Swal.fire({ icon: 'success', text: 'อัปโหลดเอกสารแนบท้ายสำเร็จ', timer: 1500, showConfirmButton: false })
                                    } else {
                                      Swal.fire('ผิดพลาด', res.message || 'อัปโหลดล้มเหลว', 'error')
                                    }
                                  } catch (err: unknown) {
                                    const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                                    Swal.fire('ผิดพลาด', apiMsg || 'เกิดข้อผิดพลาดในการอัปโหลด', 'error')
                                  }
                                }}
                              >
                                <i className='bx bx-upload text-sm'></i>
                                <span>อัปโหลดทันที</span>
                              </button>
                              <button 
                                type="button" 
                                className="px-2.5 py-1 bg-indigo-100/50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                onClick={() => {
                                  setAttFiles(prev => prev.map(att => att.id === itemId ? { ...att, file: null } : att))
                                }}
                              >
                                <i className='bx bx-x text-sm'></i>
                                <span>เปลี่ยนไฟล์</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <input 
                            type="file"
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                            accept=".pdf"
                            onChange={e => {
                              const selectedFile = e.target.files?.[0] || null
                              setAttFiles(prev => prev.map(att => att.id === itemId ? { ...att, file: selectedFile } : att))
                            }} 
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-xl transition flex items-center justify-center shrink-0 border border-rose-100"
                        onClick={() => setAttFiles(prev => prev.filter(att => att.id !== itemId))}
                        title="ลบรายการนี้"
                      >
                        <i className='bx bx-trash text-lg'></i>
                      </button>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 text-slate-500 hover:text-emerald-600 rounded-xl transition flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer mt-2"
                onClick={() => setAttFiles(prev => [...prev, { id: `att-${Date.now()}-${Math.random()}`, file: null }])}
              >
                <i className='bx bx-plus text-lg'></i>
                <span>เพิ่มรายการไฟล์สิ่งที่ส่งมาด้วย</span>
              </button>
            </div>
            {!isTaskSubmit && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">มติคณะทำงาน</label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none" 
                  value={form.in_mw_id} 
                  onChange={e=>set('in_mw_id',e.target.value)}
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {(allData?.mati_work||[]).map((m: any)=><option key={m.mw_id} value={m.mw_id}>{formatMati(m, 'mw_name', 'mw_date')}</option>)}
                </select>
              </div>
            )}
            {!isTaskSubmit && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">มติ ก.ก.</label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none" 
                  value={form.in_mkk_id} 
                  onChange={e=>set('in_mkk_id',e.target.value)}
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {(allData?.mati_kk||[]).map((m: any)=><option key={m.mkk_id} value={m.mkk_id}>{formatMati(m, 'mkk_name', 'mkk_date')}</option>)}
                </select>
              </div>
            )}
            {!isTaskSubmit && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">ผลการพิจารณา <span className="text-rose-500">*</span></label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none" 
                  value={form.in_results_id} 
                  onChange={e=>set('in_results_id',e.target.value)}
                >
                  <option value="">-- เลือกผล --</option>
                  {(allData?.results||[]).map((r: any)=><option key={r.results_id} value={r.results_id}>{r.results_detail}</option>)}
                </select>
                {form.in_results_id && (
                  <div className="text-xs text-slate-500 mt-1.5 px-1 flex items-start">
                    <i className='bx bx-info-circle mr-1 mt-0.5 text-emerald-500'></i>
                    <span className="italic">{allData?.results?.find((r: any) => String(r.results_id) === String(form.in_results_id))?.results_etc}</span>
                  </div>
                )}
              </div>
            )}
            {!isTaskSubmit && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">สถานะ <span className="text-rose-500">*</span></label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none" 
                  value={form.in_status_id} 
                  onChange={e=>set('in_status_id',e.target.value)}
                >
                  <option value="">-- เลือกสถานะ --</option>
                  {(allData?.status||[]).map((s: any)=><option key={s.status_id} value={s.status_id}>{s.status_value}</option>)}
                </select>
              </div>
            )}
            <div className="md:col-span-2 relative z-60 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 m-0">
                  ส่วนราชการที่รับมอบ
                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                    {form.ag_id.length} ส่วนราชการ
                  </span>
                  <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => set('ag_id', [...form.ag_id, { value: '', label: '', id: Date.now().toString() }])}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                >
                  <i className="bx bx-plus"></i> เพิ่มส่วนราชการ
                </button>
              </div>

              <div className="space-y-3">
                {form.ag_id.length === 0 && (
                  <div className="text-center p-4 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm bg-white">
                    คลิกปุ่ม "เพิ่มส่วนราชการ" เพื่อเลือกส่วนราชการเป้าหมาย
                  </div>
                )}
                {form.ag_id.map((track: any, idx: number) => {
                  const trackId = track.id || idx.toString();
                  return (
                    <div key={trackId} className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          ส่วนราชการที่ {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => set('ag_id', form.ag_id.filter((_: any, i: number) => i !== idx))}
                          className="text-rose-400 hover:text-rose-600 transition text-sm flex items-center gap-1"
                          title="ลบส่วนราชการ"
                        >
                          <i className="bx bx-trash"></i>
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                          ส่วนราชการ <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={track.value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const ag = allData?.agency?.find((a: any) => String(a.ag_id) === val);
                            const newArr = [...form.ag_id];
                            newArr[idx] = { ...track, value: val, label: ag?.ag_name || '' };
                            set('ag_id', newArr);
                          }}
                          required
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                        >
                          <option value="">-- เลือกส่วนราชการ --</option>
                          {allData?.agency?.filter((a: any) => !a.parent_ag_id).map((ag: any) => (
                            <option key={ag.ag_id} value={String(ag.ag_id)}>
                              {ag.ag_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2 relative z-50">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">หมวดหมู่ <span className="text-rose-500">*</span></label>
              <Select isMulti placeholder="-- เลือกหมวดหมู่ --"
                styles={{ control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e2e8f0', padding: '0.1rem' }) }}
                options={makeOptions(allData?.categories, 'cat_id', (i: any)=>i.cat_name)}
                value={form.cat_id} onChange={v=>set('cat_id',v)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Link เว็บไซต์</label>
              <input 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                placeholder="https://..." 
                value={form.in_link} 
                onChange={e=>set('in_link',e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Link QR Code</label>
              <div className="flex items-stretch">
                <input 
                  className="flex-1 min-w-0 px-4 py-2 bg-slate-50 border border-slate-200 rounded-l-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                  placeholder="https://..." 
                  value={form.in_qr_link} 
                  onChange={e=>set('in_qr_link', e.target.value)} 
                />
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold rounded-r-xl transition disabled:opacity-50 shrink-0 whitespace-nowrap"
                  onClick={async () => {
                    const hasUnsavedUploads = origFile || file || attFiles.some(item => item.file !== null)
                    if (hasUnsavedUploads) {
                      return Swal.fire({
                        icon: 'info',
                        title: 'กรุณาบันทึกข้อมูลก่อน',
                        text: 'พบไฟล์ใหม่ที่เพิ่งถูกเพิ่มแต่ยังไม่ได้ถูกอัปโหลดขึ้นเซิร์ฟเวอร์ กรุณากดบันทึกข้อมูลก่อนหนึ่งครั้งเพื่อให้ระบบนำไฟล์ไปประมวลผลได้'
                      })
                    }

                    let mainPdf = ''
                    if (form.in_original_link && form.in_original_link !== '-') {
                      mainPdf = form.in_original_link
                    }

                    if (!mainPdf) {
                      return Swal.fire({ icon: 'warning', text: 'ไม่พบไฟล์ PDF หนังสือเวียนสำนักงาน ก.พ. สำหรับสแกน QR Code' })
                    }

                    setSummarizing(true)
                    try {
                      const res = await adminApi.summarizeCircular({ mainPdf, attachments: [] })
                      if (res.status && res.response?.qrLink) {
                        set('in_qr_link', res.response.qrLink)
                        Swal.fire({ icon: 'success', text: 'ดึงลิงก์จาก QR Code สำเร็จ', timer: 1500, showConfirmButton: false })
                      } else {
                        Swal.fire({ icon: 'info', text: 'ไม่พบ QR Code ในเอกสาร หรืออ่านไม่ได้' })
                      }
                    } catch (err: any) {
                      const msg = err.response?.data?.message || 'ไม่สามารถสแกน QR Code ได้ในขณะนี้'
                      Swal.fire('ผิดพลาด', msg, 'error')
                    } finally {
                      setSummarizing(false)
                    }
                  }}
                  disabled={summarizing}
                >
                  {summarizing ? (
                    <i className='bx bx-loader-alt animate-spin text-sm'></i>
                  ) : (
                    <i className='bx bx-qr-scan text-sm'></i>
                  )}
                  <span>ดึงจาก QR Code</span>
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">หมายเหตุ</label>
              <textarea 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none" 
                rows={3} 
                value={form.in_etc} 
                onChange={e=>set('in_etc',e.target.value)} 
              />
            </div>
            {!isTaskSubmit && (
              <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="block text-sm font-semibold text-slate-700 mb-3">ไฟล์มติ ก.ก. (PDF)</label>
              <div className="flex flex-wrap gap-4 mb-4">
                {['none','upload','link'].map(m=>(
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer" 
                      checked={form.mkk_file_mode===m} 
                      onChange={()=>set('mkk_file_mode',m)} 
                    />
                    <span className="text-sm text-slate-700">
                      {m==='none'?'ไม่มีไฟล์':m==='upload'?'อัปโหลด':'ใส่ Link'}
                    </span>
                  </label>
                ))}
              </div>
              {form.mkk_file_mode==='upload' && (
                <div className="flex items-stretch gap-2 animate__animated animate__fadeIn">
                  <input 
                    type="file" 
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                    accept=".pdf" 
                    onChange={e=>setFile(e.target.files?.[0])} 
                  />
                  {file && (
                    <>
                      <a 
                        href={URL.createObjectURL(file)} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                      >
                        <i className='bx bx-show text-sm'></i>
                        <span>ดูไฟล์</span>
                      </a>
                      <button
                        type="button"
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-sm"
                        onClick={async () => {
                          if (!file) return
                          const fd = new FormData()
                          fd.append('mkk_ref_upload_in', file)
                          try {
                            Swal.showLoading()
                            const res = await adminApi.uploadSingle(fd)
                            if (res.status && res.response?.filename) {
                              set('existing_file_in', res.response.filename)
                              set('mkk_file_mode', 'existing')
                              setFile(null)
                              Swal.fire({ icon: 'success', text: 'อัปโหลดไฟล์มติสำเร็จ', timer: 1500, showConfirmButton: false })
                            } else {
                              Swal.fire('ผิดพลาด', res.message || 'อัปโหลดล้มเหลว', 'error')
                            }
                          } catch (err: any) {
                            Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาดในการอัปโหลด', 'error')
                          }
                        }}
                      >
                        <i className='bx bx-upload text-sm'></i>
                        <span>อัปโหลดทันที</span>
                      </button>
                    </>
                  )}
                </div>
              )}
              {form.mkk_file_mode==='link' && (
                <input 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                  placeholder="https://..." 
                  value={form.mkk_ref_link_in}
                  onChange={e=>set('mkk_ref_link_in',e.target.value)} 
                />
              )}
              {form.mkk_file_mode==='existing' && form.existing_file_in && (
                <div className="flex items-center gap-2">
                  <div className="text-sm text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 inline-block">
                    <i className='bx bxs-file-pdf text-rose-500 mr-2'></i>ไฟล์เดิม: {form.existing_file_in}
                  </div>
                  <a 
                    href={form.existing_file_in.startsWith('http') ? form.existing_file_in : `${BASE_URL}/uploads/${form.existing_file_in}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                  >
                    <i className='bx bx-show text-sm'></i>
                    <span>ดูไฟล์เดิม</span>
                  </a>
                </div>
              )}
            </div>
            )}

          </div>
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button 
            type="button"
            className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition" 
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button 
            type="button"
            className="px-5 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? (
              <><i className='bx bx-loader-alt animate-spin text-lg'></i>กำลังบันทึก...</>
            ) : (
              <><i className='bx bx-save text-lg'></i>บันทึกข้อมูล</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

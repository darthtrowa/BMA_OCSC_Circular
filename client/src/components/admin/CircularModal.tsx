import { useState, useEffect } from 'react'
import Select from 'react-select'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'
import moment from 'moment/min/moment-with-locales'
moment.locale('th')

export default function CircularModal({ allData, editItem, onClose, onSaved }) {
  const isEdit = !!editItem
  const [form, setForm] = useState({
    in_num_date: '', in_detail: '', in_detail_ag: '',
    in_mkk_id: '', in_mw_id: '', in_results_id: '', in_year_id: '',
    in_status_id: '', in_etc: '', in_link: '',
    ag_id: [], cat_id: [], in_id_ref: [],
    mkk_file_mode: 'none',
    mkk_ref_link_in: '',
    existing_file_in: '',
  })
  const [file, setFile]     = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editItem) return
    const e = editItem
    setForm({
      in_num_date:    e.in_num_date || '',
      in_detail:      e.in_detail || '',
      in_detail_ag:   e.in_detail_ag || '',
      in_mkk_id:      e.mati_kk?.mkk_id || '',
      in_mw_id:       e.mati_work?.mw_id || '',
      in_results_id:  e.results?.results_id || '',
      in_year_id:     e.year?.year_id || '',
      in_status_id:   e.status_a?.status_id || '',
      in_etc:         e.in_etc === '-' ? '' : (e.in_etc || ''),
      in_link:        e.in_link === '-' ? '' : (e.in_link || ''),
      ag_id:   (e.agency||[]).map(a => ({ value: String(a.ag_id), label: a.ag_name })),
      cat_id:  (e.categories||[]).map(c => ({ value: String(c.cat_id), label: c.cat_name })),
      in_id_ref: (e.references_info||[]).map(r => ({
        value: String(r.in_id), label: `${r.in_num_date} — ${(r.in_detail||'').substring(0,50)}`
      })),
      mkk_file_mode:    e.in_file_mkk && e.in_file_mkk !== '-' ? 'existing' : 'none',
      mkk_ref_link_in:  '',
      existing_file_in: e.in_file_mkk && e.in_file_mkk !== '-' ? e.in_file_mkk : '',
    })
  }, [editItem])

  const makeOptions = (arr, idKey, labelFn) =>
    (arr||[]).map(item => ({ value: String(item[idKey]), label: labelFn(item) }))

  const formatMati = (item, nameKey, dateKey) => {
    const name = item[nameKey] || ''
    const d = item[dateKey]
    const isDummyDate = d && moment(d).format('YYYY-MM-DD') === '2222-01-01'
    if (!d || isDummyDate || name.includes('รอเข้า')) return name
    return `ครั้งที่ ${name} วันที่ ${moment(d).locale('th').add(543, 'year').format('DD MMM YYYY')}`
  }

  const refOptions = (allData?.information||[]).map(i => ({
    value: String(i.in_id),
    label: `${i.in_num_date} — ${(i.in_detail||'').substring(0,50)}`
  }))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.in_num_date)       return Swal.fire({ icon: 'warning', text: 'กรุณากรอกเลขที่หนังสือ' })
    if (!form.in_detail)         return Swal.fire({ icon: 'warning', text: 'กรุณากรอกชื่อเรื่อง' })
    if (!form.in_results_id)     return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกผลการพิจารณา' })
    if (!form.in_year_id)        return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกปี พ.ศ.' })
    if (form.ag_id.length === 0) return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกผู้รับผิดชอบ' })
    if (form.cat_id.length === 0) return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกหมวดหมู่' })

    const fd = new FormData()
    fd.append('submit_create_circular_hidden', '1')
    if (isEdit) fd.append('in_id', editItem.in_id)
    fd.append('in_num_date',   form.in_num_date)
    fd.append('in_detail',     form.in_detail)
    fd.append('in_detail_ag',  form.in_detail_ag)
    fd.append('in_mkk_id',     form.in_mkk_id)
    fd.append('in_mw_id',      form.in_mw_id)
    fd.append('in_results_id', form.in_results_id)
    fd.append('in_year_id',    form.in_year_id)
    fd.append('in_status_id',  form.in_status_id)
    fd.append('in_etc',        form.in_etc)
    fd.append('in_link',       form.in_link)
    if (!form.in_link) fd.append('lkk_none', '-')
    form.ag_id.forEach(o  => fd.append('ag_id[]', o.value))
    form.cat_id.forEach(o => fd.append('cat_id[]', o.value))

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
      form.in_id_ref.forEach(o => fd.append('in_id_ref[]', o.value))
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate__animated animate__fadeIn animate__faster">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate__animated animate__zoomIn animate__faster">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h5 className="m-0 font-bold text-xl text-slate-800 font-saochingcha">
            {isEdit ? 'แก้ไขหนังสือเวียน' : 'เพิ่มหนังสือเวียน'}
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
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">เลขที่หนังสือ/ลงวันที่ <span className="text-rose-500">*</span></label>
              <input 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                value={form.in_num_date} 
                onChange={e=>set('in_num_date',e.target.value)} 
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
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อเรื่อง <span className="text-rose-500">*</span></label>
              <textarea 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none" 
                rows={2} 
                value={form.in_detail} 
                onChange={e=>set('in_detail',e.target.value)} 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">รายละเอียดเพิ่มเติม</label>
              <textarea 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none" 
                rows={2} 
                value={form.in_detail_ag} 
                onChange={e=>set('in_detail_ag',e.target.value)} 
              />
            </div>
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
            <div className="md:col-span-2 relative z-[60]">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">ผู้รับผิดชอบ <span className="text-rose-500">*</span></label>
              <Select isMulti placeholder="-- เลือกผู้รับผิดชอบ --"
                styles={{ control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e2e8f0', padding: '0.1rem' }) }}
                options={makeOptions(allData?.agency, 'ag_id', (i: any)=>i.ag_name)}
                value={form.ag_id} onChange={v=>set('ag_id',v)} />
            </div>
            <div className="md:col-span-2 relative z-[50]">
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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">หมายเหตุ</label>
              <input 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                value={form.in_etc} 
                onChange={e=>set('in_etc',e.target.value)} 
              />
            </div>
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
                <input 
                  type="file" 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" 
                  accept=".pdf" 
                  onChange={e=>setFile(e.target.files?.[0])} 
                />
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
                <div className="text-sm text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 inline-block">
                  <i className='bx bxs-file-pdf text-rose-500 mr-2'></i>ไฟล์เดิม: {form.existing_file_in}
                </div>
              )}
            </div>
            <div className="md:col-span-2 relative z-[40]">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">อ้างอิงหนังสือเวียน</label>
              <Select isMulti placeholder="-- เลือกหนังสืออ้างอิง --"
                styles={{ control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e2e8f0', padding: '0.1rem' }) }}
                options={refOptions.filter(o => !isEdit || o.value !== String(editItem?.in_id))}
                value={form.in_id_ref} onChange={v=>set('in_id_ref',v)} />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button 
            className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition" 
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button 
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
    </div>
  )
}

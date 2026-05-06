import { useState, useEffect } from 'react'
import Select from 'react-select'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'

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
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{isEdit ? 'แก้ไขหนังสือเวียน' : 'เพิ่มหนังสือเวียน'}</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">เลขที่หนังสือ/ลงวันที่ <span className="text-danger">*</span></label>
                <input className="form-control" value={form.in_num_date} onChange={e=>set('in_num_date',e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">ปี พ.ศ. <span className="text-danger">*</span></label>
                <select className="form-select" value={form.in_year_id} onChange={e=>set('in_year_id',e.target.value)}>
                  <option value="">-- เลือกปี --</option>
                  {(allData?.year||[]).map(y=><option key={y.year_id} value={y.year_id}>{y.year_value}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">ชื่อเรื่อง <span className="text-danger">*</span></label>
                <textarea className="form-control" rows={2} value={form.in_detail} onChange={e=>set('in_detail',e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">รายละเอียดเพิ่มเติม</label>
                <textarea className="form-control" rows={2} value={form.in_detail_ag} onChange={e=>set('in_detail_ag',e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">มติ ก.ก.</label>
                <select className="form-select" value={form.in_mkk_id} onChange={e=>set('in_mkk_id',e.target.value)}>
                  <option value="">-- ไม่ระบุ --</option>
                  {(allData?.mati_kk||[]).map(m=><option key={m.mkk_id} value={m.mkk_id}>{m.mkk_name}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">มติคณะทำงาน</label>
                <select className="form-select" value={form.in_mw_id} onChange={e=>set('in_mw_id',e.target.value)}>
                  <option value="">-- ไม่ระบุ --</option>
                  {(allData?.mati_work||[]).map(m=><option key={m.mw_id} value={m.mw_id}>{m.mw_name}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">ผลการพิจารณา <span className="text-danger">*</span></label>
                <select className="form-select" value={form.in_results_id} onChange={e=>set('in_results_id',e.target.value)}>
                  <option value="">-- เลือกผล --</option>
                  {(allData?.results||[]).map(r=><option key={r.results_id} value={r.results_id}>{r.results_detail}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">สถานะ <span className="text-danger">*</span></label>
                <select className="form-select" value={form.in_status_id} onChange={e=>set('in_status_id',e.target.value)}>
                  <option value="">-- เลือกสถานะ --</option>
                  {(allData?.status||[]).map(s=><option key={s.status_id} value={s.status_id}>{s.status_value}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">ผู้รับผิดชอบ <span className="text-danger">*</span></label>
                <Select isMulti placeholder="-- เลือกผู้รับผิดชอบ --"
                  options={makeOptions(allData?.agency, 'ag_id', i=>i.ag_name)}
                  value={form.ag_id} onChange={v=>set('ag_id',v)} />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">หมวดหมู่ <span className="text-danger">*</span></label>
                <Select isMulti placeholder="-- เลือกหมวดหมู่ --"
                  options={makeOptions(allData?.categories, 'cat_id', i=>i.cat_name)}
                  value={form.cat_id} onChange={v=>set('cat_id',v)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Link เว็บไซต์</label>
                <input className="form-control" placeholder="https://..." value={form.in_link} onChange={e=>set('in_link',e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">หมายเหตุ</label>
                <input className="form-control" value={form.in_etc} onChange={e=>set('in_etc',e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">ไฟล์มติ ก.ก. (PDF)</label>
                <div className="d-flex gap-2 mb-2">
                  {['none','upload','link'].map(m=>(
                    <div key={m} className="form-check">
                      <input type="radio" className="form-check-input" id={`mode-${m}`}
                        checked={form.mkk_file_mode===m} onChange={()=>set('mkk_file_mode',m)} />
                      <label className="form-check-label" htmlFor={`mode-${m}`}>
                        {m==='none'?'ไม่มีไฟล์':m==='upload'?'อัปโหลด':'ใส่ Link'}
                      </label>
                    </div>
                  ))}
                </div>
                {form.mkk_file_mode==='upload' && (
                  <input type="file" className="form-control" accept=".pdf" onChange={e=>setFile(e.target.files[0])} />
                )}
                {form.mkk_file_mode==='link' && (
                  <input className="form-control" placeholder="https://..." value={form.mkk_ref_link_in}
                    onChange={e=>set('mkk_ref_link_in',e.target.value)} />
                )}
                {form.mkk_file_mode==='existing' && form.existing_file_in && (
                  <small className="text-muted">ไฟล์เดิม: {form.existing_file_in}</small>
                )}
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">อ้างอิงหนังสือเวียน</label>
                <Select isMulti placeholder="-- เลือกหนังสืออ้างอิง --"
                  options={refOptions.filter(o => !isEdit || o.value !== String(editItem?.in_id))}
                  value={form.in_id_ref} onChange={v=>set('in_id_ref',v)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-2"/>กำลังบันทึก...</> : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

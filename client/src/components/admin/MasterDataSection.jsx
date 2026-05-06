import { useState } from 'react'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'
import moment from 'moment/min/moment-with-locales'
moment.locale('th')

const masterConfig = {
  year:       { dataKey: 'year',       title: 'ปี พ.ศ.',         pk: 'year_id',    columns: ['year_value'],          headers: ['ปี พ.ศ.'] },
  results:    { dataKey: 'results',    title: 'ผลการพิจารณา',     pk: 'results_id', columns: ['results_detail'],       headers: ['รายละเอียด'] },
  agency:     { dataKey: 'agency',     title: 'ผู้รับผิดชอบ',     pk: 'ag_id',      columns: ['ag_name'],              headers: ['ชื่อ'] },
  categories: { dataKey: 'categories', title: 'หมวดหมู่',          pk: 'cat_id',     columns: ['cat_name'],             headers: ['ชื่อ'] },
  mkk:        { dataKey: 'mati_kk',   title: 'มติ ก.ก.',          pk: 'mkk_id',     columns: ['mkk_name','mkk_date'],  headers: ['ชื่อมติ','วันที่'] },
  mw:         { dataKey: 'mati_work', title: 'มติคณะทำงาน',       pk: 'mw_id',      columns: ['mw_name','mw_date'],    headers: ['ชื่อมติ','วันที่'] },
  status:     { dataKey: 'status',    title: 'สถานะการใช้งาน',    pk: 'status_id',  columns: ['status_value'],         headers: ['สถานะ'] },
}

export default function MasterDataSection({ type, allData, onReload }) {
  const conf  = masterConfig[type]
  const [search, setSearch] = useState('')

  if (!conf || !allData) return null

  const rows = (allData[conf.dataKey] || []).filter(item =>
    !search || (item[conf.columns[0]]||'').toLowerCase().includes(search.toLowerCase())
  )

  const formatCell = (item, col) => {
    const v = item[col]
    if (v === '2222-01-01' || !v) return '-'
    if (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/))
      return moment(v).locale('th').add(543, 'year').format('DD MMM YYYY')
    return v
  }

  const openModal = async (id = null, currentVal = '') => {
    const { value } = await Swal.fire({
      title: id ? `แก้ไขข้อมูล: ${conf.title}` : `เพิ่มข้อมูล: ${conf.title}`,
      input: 'text', inputValue: currentVal,
      inputPlaceholder: 'กรอกข้อมูล...',
      showCancelButton: true,
      confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
      inputValidator: (v) => { if (!v) return 'กรุณากรอกข้อมูล!' },
    })
    if (!value) return
    try {
      const action = id ? 'update' : 'create'
      const data = await adminApi.masterAction(action, type, id, value)
      if (data.status) {
        Swal.fire({ icon: 'success', text: data.message, timer: 1500, showConfirmButton: false })
        onReload()
      } else {
        Swal.fire('ผิดพลาด', data.message, 'error')
      }
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
    }
  }

  const handleDelete = async (id) => {
    const r = await Swal.fire({
      title: 'ยืนยันการลบ?', text: 'ข้อมูลนี้จะถูกลบออกจากระบบ!', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก',
    })
    if (!r.isConfirmed) return
    try {
      const data = await adminApi.masterAction('delete', type, id)
      if (data.status) {
        Swal.fire({ icon: 'success', text: data.message, timer: 1500, showConfirmButton: false })
        onReload()
      } else {
        Swal.fire('ผิดพลาด', data.message, 'error')
      }
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
    }
  }

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h6 className="mb-0 fw-bold">
          <i className='bx bx-data me-2 text-primary'></i>ข้อมูลหลัก: {conf.title}
        </h6>
        <div className="d-flex gap-2">
          <input type="text" className="form-control form-control-sm" placeholder="ค้นหา..."
            style={{ width: 200 }} value={search} onChange={e=>setSearch(e.target.value)} />
          <button className="btn btn-sm btn-primary" onClick={() => openModal()}>
            <i className='bx bx-plus me-1'></i>เพิ่ม
          </button>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                {conf.headers.map(h => <th key={h}>{h}</th>)}
                <th style={{ width: 100 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={conf.headers.length+2} className="text-center text-muted py-4">ไม่พบข้อมูล</td></tr>
              )}
              {rows.map((item, idx) => (
                <tr key={item[conf.pk]}>
                  <td>{idx+1}</td>
                  {conf.columns.map(col => <td key={col}>{formatCell(item, col)}</td>)}
                  <td>
                    <button className="btn btn-sm btn-warning me-1"
                      onClick={() => openModal(item[conf.pk], item[conf.columns[0]] || '')}>
                      <i className='bx bx-edit'></i>
                    </button>
                    <button className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(item[conf.pk])}>
                      <i className='bx bx-trash'></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

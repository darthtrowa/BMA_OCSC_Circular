import { useState } from 'react'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'
import moment from 'moment/min/moment-with-locales'
moment.locale('th')

const TH_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

const masterConfig = {
  year:       { dataKey: 'year',       title: 'ปี พ.ศ.',         pk: 'year_id',    columns: ['year_value'],          headers: ['ปี พ.ศ.'] },
  results:    { dataKey: 'results',    title: 'ผลการพิจารณา',     pk: 'results_id', columns: ['results_detail', 'results_etc'], headers: ['ผลการพิจารณา', 'นิยาม/คำอธิบาย'] },
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
    const isDummy = v && moment(v).format('YYYY-MM-DD') === '2222-01-01'
    if (!v || isDummy) return '--'
    
    if (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/))
      return moment(v).locale('th').add(543, 'year').format('DD MMM YYYY')
    return v
  }



  const openModal = async (id = null, item = null) => {
    let resultValue = ''
    let resultValue2 = ''

    if (type === 'results') {
      const { value } = await Swal.fire({
        title: id ? `แก้ไขข้อมูล: ${conf.title}` : `เพิ่มข้อมูล: ${conf.title}`,
        html: `
          <div class="text-start">
            <label class="form-label fw-semibold">ผลการพิจารณา</label>
            <input id="swal-input1" class="form-control mb-3" placeholder="เช่น นำมาปรับใช้" value="${item?.results_detail || ''}">
            <label class="form-label fw-semibold">นิยาม/คำอธิบาย</label>
            <textarea id="swal-input2" class="form-control" rows="4" placeholder="ระบุรายละเอียด...">${item?.results_etc && item.results_etc !== '-' ? item.results_etc : ''}</textarea>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
          const v1 = (document.getElementById('swal-input1') as HTMLInputElement).value
          const v2 = (document.getElementById('swal-input2') as HTMLTextAreaElement).value
          if (!v1) return Swal.showValidationMessage('กรุณากรอกผลการพิจารณา!')
          return [v1, v2]
        }
      })
      if (!value) return
      resultValue = value[0]
      resultValue2 = value[1]
    } else if (type === 'mkk' || type === 'mw') {
      const dateVal = item?.[conf.columns[1]]
      const isDummy = !dateVal || dateVal === '2222-01-01'
      const m = dateVal && dateVal !== '2222-01-01' ? moment(dateVal) : moment()
      const initD = isDummy ? 1 : m.date()
      const initM = isDummy ? 0 : m.month()
      const initY = isDummy ? moment().year() + 543 : m.year() + 543

      const { value } = await Swal.fire({
        title: id ? `แก้ไขข้อมูล: ${conf.title}` : `เพิ่มข้อมูล: ${conf.title}`,
        html: `
          <div class="text-start">
            <div class="row align-items-center mb-3">
              <div class="col-sm-4">
                <label class="form-label fw-semibold mb-0">ชื่อมติ</label>
              </div>
              <div class="col-sm-8">
                <input id="swal-input1" class="form-control" placeholder="เช่น ครั้งที่ 1/2567" value="${item?.[conf.columns[0]] || ''}">
              </div>
            </div>
            
            <div class="row align-items-center mb-2">
              <div class="col-sm-4">
                <label class="form-label fw-semibold mb-0">วันที่ประชุม (พ.ศ.)</label>
              </div>
              <div class="col-sm-8">
                <div class="input-group">
                  <input type="text" id="swal-datepicker" class="form-control" ${isDummy ? 'disabled' : ''} placeholder="เลือกวันที่..." readonly>
                  <span class="input-group-text bg-white"><i class='bx bx-calendar'></i></span>
                </div>
              </div>
            </div>

            <div class="row">
              <div class="col-sm-4"></div>
              <div class="col-sm-8">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="swal-no-date" ${isDummy ? 'checked' : ''} 
                    onchange="document.getElementById('swal-datepicker').disabled = this.checked;">
                  <label class="form-check-label text-slate-600" for="swal-no-date">ไม่ระบุวันที่</label>
                </div>
              </div>
            </div>
          </div>
        `,
        didOpen: () => {
          const initDate = isDummy ? null : (item?.[conf.columns[1]] || null);
          (window as any).flatpickr('#swal-datepicker', {
            locale: 'th',
            dateFormat: 'Y-m-d',
            defaultDate: initDate,
            altInput: true,
            altFormat: 'd/m/Y',
            onReady: (selectedDates, dateStr, instance) => {
              const yearInput = instance.calendarContainer.querySelector('.cur-year') as HTMLInputElement;
              if (yearInput) yearInput.value = String(parseInt(yearInput.value) + 543);
              const altInput = instance.altInput;
              if (altInput && initDate) {
                const y = moment(initDate).year() + 543;
                altInput.value = moment(initDate).format(`DD/MM/${y}`);
              }
            },
            onMonthChange: (selectedDates, dateStr, instance) => {
              setTimeout(() => {
                const yearInput = instance.calendarContainer.querySelector('.cur-year') as HTMLInputElement;
                if (yearInput) yearInput.value = String(parseInt(yearInput.value) + 543);
              }, 0);
            },
            onYearChange: (selectedDates, dateStr, instance) => {
              setTimeout(() => {
                const yearInput = instance.calendarContainer.querySelector('.cur-year') as HTMLInputElement;
                if (yearInput) yearInput.value = String(parseInt(yearInput.value) + 543);
              }, 0);
            },
            onChange: (selectedDates, dateStr, instance) => {
              const altInput = instance.altInput;
              if (altInput && selectedDates.length > 0) {
                const y = moment(selectedDates[0]).year() + 543;
                altInput.value = moment(selectedDates[0]).format(`DD/MM/${y}`);
              }
            }
          });
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
          const v1 = (document.getElementById('swal-input1') as HTMLInputElement).value
          const isNoDate = (document.getElementById('swal-no-date') as HTMLInputElement).checked
          
          if (!v1) return Swal.showValidationMessage('กรุณากรอกชื่อมติ!')
          
          let v2 = '2222-01-01'
          if (!isNoDate) {
            v2 = (document.getElementById('swal-datepicker') as HTMLInputElement).value
            if (!v2) return Swal.showValidationMessage('กรุณาเลือกวันที่ หรือติ๊กไม่ระบุ!')
          }
          
          return [v1, v2]
        }
      })
      if (!value) return
      resultValue = value[0]
      resultValue2 = value[1]
    } else {
      const { value } = await Swal.fire({
        title: id ? `แก้ไขข้อมูล: ${conf.title}` : `เพิ่มข้อมูล: ${conf.title}`,
        input: 'text', inputValue: item ? item[conf.columns[0]] : '',
        inputPlaceholder: 'กรอกข้อมูล...',
        showCancelButton: true,
        confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
        inputValidator: (v) => { if (!v) return 'กรุณากรอกข้อมูล!' },
      })
      if (!value) return
      resultValue = value
    }

    try {
      const action = id ? 'update' : 'create'
      const data = await adminApi.masterAction(action, type, id, resultValue, resultValue2)
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
      const data = await adminApi.masterAction('delete', type, id, null)
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
    <div className="bg-white rounded-3xl shadow-sm mb-8 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <h6 className="m-0 font-bold text-lg text-slate-800 flex items-center font-saochingcha">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mr-3">
            <i className='bx bx-data text-xl'></i>
          </div>
          ข้อมูลหลัก: {conf.title}
        </h6>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="bx bx-search text-slate-400"></i>
            </div>
            <input 
              type="text" 
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              placeholder="ค้นหา..."
              value={search} 
              onChange={e=>setSearch(e.target.value)} 
            />
          </div>
          <button 
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
            onClick={() => openModal()}
          >
            <i className='bx bx-plus text-lg'></i> เพิ่มข้อมูล
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left border-collapse min-w-max">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold w-16">#</th>
              {conf.headers.map((h: string) => <th key={h} className="px-6 py-4 font-semibold">{h}</th>)}
              <th className="px-6 py-4 font-semibold text-right" style={{ width: 120 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.length === 0 && (
              <tr><td colSpan={conf.headers.length+2} className="text-center text-slate-400 py-12">ไม่พบข้อมูล</td></tr>
            )}
            {rows.map((item: any, idx: number) => (
              <tr key={item[conf.pk]} className="hover:bg-slate-50 border-b border-slate-100 transition last:border-0">
                <td className="px-6 py-4 text-slate-400">{idx+1}</td>
                {conf.columns.map((col: string) => <td key={col} className="px-6 py-4 text-slate-700">{formatCell(item, col)}</td>)}
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 transition flex items-center justify-center"
                      onClick={() => openModal(item[conf.pk], item)}
                      title="แก้ไข"
                    >
                      <i className='bx bx-edit-alt text-lg'></i>
                    </button>
                    <button 
                      className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition flex items-center justify-center"
                      onClick={() => handleDelete(item[conf.pk])}
                      title="ลบ"
                    >
                      <i className='bx bx-trash text-lg'></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

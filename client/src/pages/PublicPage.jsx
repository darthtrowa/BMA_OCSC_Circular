import { useState, useEffect } from 'react'
import Select from 'react-select'
import Swal from 'sweetalert2'
import moment from 'moment/min/moment-with-locales'
import StatsCards from '../components/public/StatsCards'
import ResultTable from '../components/public/ResultTable'
moment.locale('th')

import { publicApi, LOGO_URL } from '../api/apiService'

export default function PublicPage() {
  const [filters, setFilters] = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [statsData, setStatsData] = useState(null)
  const [searchDone, setSearchDone] = useState(false)
  const [activeCard, setActiveCard] = useState(null)   // card ที่กดอยู่
  const [searchForm, setSearchForm] = useState({
    in_year_id: [], ag_id: [], cat_id: [], in_mkk_id: [],
    in_results_id: [], in_mw_id: [], in_status_id: [],
    in_num_date: '', in_detail: '',
  })

  // โหลด filter dropdowns และสถิติ
  useEffect(() => {
    publicApi.getFilters()
      .then((data) => {
        if (data) {
          const lastItems = ["ไม่ระบุ", "*ไม่พิจารณา", "ไม่พิจารณา"];
          const sortList = (list, key) => {
            if (!list) return [];
            const top = list.filter(i => !lastItems.some(last => (i[key] || '').includes(last)));
            const bottom = list.filter(i => lastItems.some(last => (i[key] || '').includes(last)));
            return [...top, ...bottom];
          };
          
          data.results = sortList(data.results, 'results_detail');
          data.mati_kk = sortList(data.mati_kk, 'mkk_name');
          data.mati_work = sortList(data.mati_work, 'mw_name');
        }
        setFilters(data);
      })
      .catch(() => Swal.fire({ icon: 'error', text: 'ไม่สามารถโหลดข้อมูลตัวกรอง' }))

    publicApi.getStats()
      .then((data) => setStatsData(data))
      .catch(() => { })
  }, [])

  const makeOptions = (arr, idKey, labelFn) =>
    (arr || []).map(item => ({ value: item[idKey], label: labelFn(item) }))

  const formatMati = (item, nameKey, dateKey) => {
    const name = item[nameKey] || ''
    const d = item[dateKey]
    const isDummyDate = d && moment(d).format('YYYY-MM-DD') === '2222-01-01'
    
    if (!d || isDummyDate || name.includes('รอเข้า')) return name
    return `ครั้งที่ ${name} วันที่ ${moment(d).locale('th').add(543, 'year').format('DD MMM YYYY')}`
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    const hasFilter = Object.entries(searchForm).some(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v.trim() !== ''
    )
    if (!hasFilter) return Swal.fire({ icon: 'info', text: 'โปรดระบุข้อมูลเพื่อค้นหา...' })

    setLoading(true)
    setActiveCard(null)
    try {
      const payload = {
        in_year_id: searchForm.in_year_id.map(o => o.value),
        ag_id: searchForm.ag_id.map(o => o.value),
        cat_id: searchForm.cat_id.map(o => o.value),
        in_mkk_id: searchForm.in_mkk_id.map(o => o.value),
        in_results_id: searchForm.in_results_id.map(o => o.value),
        in_mw_id: searchForm.in_mw_id.map(o => o.value),
        in_status_id: searchForm.in_status_id.map(o => o.value),
        in_num_date: searchForm.in_num_date,
        in_detail: searchForm.in_detail,
      }
      const data = await publicApi.search(payload)
      setResults(data)
      setSearchDone(true)
    } catch (err) {
      Swal.fire({ icon: 'error', text: err.response?.data?.message || 'เกิดข้อผิดพลาด' })
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setSearchForm({
      in_year_id: [], ag_id: [], cat_id: [], in_mkk_id: [],
      in_results_id: [], in_mw_id: [], in_status_id: [],
      in_num_date: '', in_detail: '',
    })
    setResults(null)
    setSearchDone(false)
    setActiveCard(null)
  }

  // กด Stats Card: toggle filter หรือ reset
  const handleCardClick = (card) => {
    if (!searchDone && !results) {
      // ยังไม่ได้ค้นหา — ไม่ทำอะไร (หรือจะ scroll ลงก็ได้)
      return
    }
    if (activeCard?.id === card.id) {
      setActiveCard(null)   // กดซ้ำ = ยกเลิก filter
    } else {
      setActiveCard(card)
    }
  }

  // ข้อมูลที่ใช้แสดงใน ResultTable (กรองตาม card ที่เลือก)
  const displayData = (() => {
    if (!results) return []
    if (!activeCard || activeCard.id === 'all') return results
    return results.filter(item => item.results?.results_id == activeCard.resultId)
  })()

  const selectStyle = {
    control: (b) => ({ 
      ...b, 
      minHeight: '45px', 
      borderColor: '#e2e8f0', 
      borderRadius: '0.75rem',
      padding: '2px 8px',
      boxShadow: 'none',
      background: '#f8fafc',
      '&:hover': { borderColor: '#065f46', background: '#fff' }
    }),
    valueContainer: (b) => ({ ...b, padding: '0 6px' }),
    input: (b) => ({ ...b, margin: '0' }),
    menu: (b) => ({ ...b, zIndex: 9999, borderRadius: '0.75rem' }),
  }

  return (
    <div className="public-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #eef7f2 0%, #dcfce7 100%)' }}>
      {/* Header */}
      <header className="public-header py-4 px-3">
        <div className="container">
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <div className="bg-green rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px', backgroundColor: '#065f46', overflow: 'hidden' }}>
                <img 
                  src={LOGO_URL} 
                  alt="Logo" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <i className='bx bx-spreadsheet fs-3 text-white' style={{ display: 'none' }}></i>
              </div>
              <div>
                <h1 className="fs-5 mb-0 fw-bold font-saochingcha" style={{ color: '#065f46' }}>
                  ระบบสืบค้นผลการพิจารณาหนังสือเวียนสำนักงาน ก.พ.
                </h1>
                <small className="text-muted">สำนักงานคณะกรรมการข้าราชการกรุงเทพมหานคร</small>
              </div>
            </div>

            <div className="d-flex gap-2">
              <a 
                href="https://docs.google.com/forms/d/e/1FAIpQLSdkqK5KxLxvG-nenSYNhbq2m2fctMmvQNG_i5B1m4Z-vC08Kg/viewform" 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-sm btn-outline-primary"
              >
                <i className='bx bx-edit me-1'></i>แบบประเมินความพึงพอใจ
              </a>
              <a href="/chat" className="btn btn-sm btn-outline-success">
                <i className='bx bx-bot me-1'></i>ผู้ช่วย AI
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="container mt-2 text-center">
        <p className="mb-0 text-dark opacity-85 medium fw-medium" style={{ lineHeight: '1.6' }}>
          การติดตามความคืบหน้าของการนำหนังสือเวียน ก.พ. ไปใช้/ปรับใช้ หรือดำเนินการอื่นๆที่เกี่ยวข้อง จากส่วนราชการในสังกัดสำนักงาน ก.ก.
          ที่ได้รับมอบหมายให้รับผิดชอบพิจารณาหนังสือเวียน ก.พ.
        </p>
      </div>

      <div className="container mt-4 mb-5">
        {/* Stats Cards */}
        <StatsCards
          data={statsData}
          resultsData={searchDone && results ? displayData : null}
          activeCardId={activeCard?.id || null}
          onCardClick={handleCardClick}
        />

        {/* Search Form */}
        <div className="card shadow-sm border-0 rounded-xl overflow-hidden mb-5">
          <div className="card-body p-4 p-md-5">
            <h5 className="fw-semibold text-green mb-1">
              <i className='bx bx-search me-2'></i>ค้นหาหนังสือเวียนสำนักงาน ก.พ.
            </h5>
            <hr className="mt-0" />
            <form onSubmit={handleSearch}>
              <div className="row g-3">
                {/* แถวที่ 1: ปี, เลขที่, ชื่อเรื่อง */}
                <div className="col-md-2">
                  <label className="form-label small fw-semibold">ปี พ.ศ.</label>
                  <Select isMulti placeholder="ปี" styles={selectStyle}
                    menuPortalTarget={document.body}
                    options={makeOptions(filters?.year, 'year_id', i => i.year_value)}
                    value={searchForm.in_year_id}
                    onChange={v => setSearchForm({ ...searchForm, in_year_id: v })} />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold">เลขที่หนังสือ/ลงวันที่</label>
                  <input type="text" className="form-control" placeholder="ระบุเลขที่..."
                    value={searchForm.in_num_date}
                    onChange={e => setSearchForm({ ...searchForm, in_num_date: e.target.value })} />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">ชื่อเรื่อง</label>
                  <input type="text" className="form-control" placeholder="ระบุชื่อเรื่อง..."
                    value={searchForm.in_detail}
                    onChange={e => setSearchForm({ ...searchForm, in_detail: e.target.value })} />
                </div>

                {/* แถวที่ 2: ผู้รับผิดชอบ, หมวดหมู่, ผลการพิจารณา */}
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">ผู้รับผิดชอบ</label>
                  <Select isMulti placeholder="เลือกผู้รับผิดชอบ" styles={selectStyle}
                    menuPortalTarget={document.body}
                    options={makeOptions(filters?.agency, 'ag_id', i => i.ag_name)}
                    value={searchForm.ag_id}
                    onChange={v => setSearchForm({ ...searchForm, ag_id: v })} />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold">หมวดหมู่</label>
                  <Select isMulti placeholder="เลือกหมวดหมู่" styles={selectStyle}
                    menuPortalTarget={document.body}
                    options={makeOptions(filters?.categories, 'cat_id', i => i.cat_name)}
                    value={searchForm.cat_id}
                    onChange={v => setSearchForm({ ...searchForm, cat_id: v })} />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold">ผลการพิจารณา</label>
                  <Select isMulti placeholder="เลือกผลการพิจารณา" styles={selectStyle}
                    menuPortalTarget={document.body}
                    options={makeOptions(filters?.results, 'results_id', i => i.results_detail)}
                    value={searchForm.in_results_id}
                    onChange={v => setSearchForm({ ...searchForm, in_results_id: v })} />
                </div>

                {/* แถวที่ 3: มติคณะทำงาน, มติ ก.ก. */}
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">มติคณะทำงาน</label>
                  <Select isMulti placeholder="ระบุมติคณะทำงาน" styles={selectStyle}
                    menuPortalTarget={document.body}
                    options={makeOptions(filters?.mati_work, 'mw_id', i => formatMati(i, 'mw_name', 'mw_date'))}
                    value={searchForm.in_mw_id}
                    onChange={v => setSearchForm({ ...searchForm, in_mw_id: v })} />
                </div>

                <div className="col-md-8">
                  <label className="form-label small fw-semibold">มติ ก.ก.</label>
                  <Select isMulti placeholder="ระบุมติ ก.ก." styles={selectStyle}
                    menuPortalTarget={document.body}
                    options={makeOptions(filters?.mati_kk, 'mkk_id', i => formatMati(i, 'mkk_name', 'mkk_date'))}
                    value={searchForm.in_mkk_id}
                    onChange={v => setSearchForm({ ...searchForm, in_mkk_id: v })} />
                </div>
              </div>

              <div className="text-end mt-4">
                <button type="button" className="btn btn-outline-secondary me-2" onClick={handleClear}>
                  <i className='bx bx-reset me-1'></i>ล้างค่า
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading
                    ? <><span className="spinner-border spinner-border-sm me-2" />กำลังค้นหา...</>
                    : <><i className='bx bx-search me-1'></i>ค้นหาข้อมูล</>}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Results */}
        {!searchDone && !loading && (
          <div className="text-center py-5 text-muted">
            <i className='bx bx-search-alt' style={{ fontSize: '3.5rem', opacity: 0.4 }}></i>
            <p className="mt-3">กรุณาระบุเงื่อนไขและกดปุ่ม <strong>ค้นหาข้อมูล</strong></p>
          </div>
        )}

        {searchDone && results !== null && (
          <ResultTable data={displayData} />
        )}
      </div>
    </div>
  )
}

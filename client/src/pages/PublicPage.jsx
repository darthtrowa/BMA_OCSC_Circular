import { useState, useEffect } from 'react'
import Select from 'react-select'
import Swal from 'sweetalert2'
import moment from 'moment/min/moment-with-locales'
import StatsCards from '../components/public/StatsCards'
import ResultTable from '../components/public/ResultTable'
import { publicApi } from '../api/apiService'

moment.locale('th')

export default function PublicPage() {
  const [filters, setFilters]       = useState(null)
  const [results, setResults]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [statsData, setStatsData]   = useState(null)
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
      .then((data) => setFilters(data))
      .catch(() => Swal.fire({ icon: 'error', text: 'ไม่สามารถโหลดข้อมูลตัวกรอง' }))

    publicApi.getStats()
      .then((data) => setStatsData(data))
      .catch(() => {})
  }, [])

  const makeOptions = (arr, idKey, labelFn) =>
    (arr || []).map(item => ({ value: item[idKey], label: labelFn(item) }))

  const formatMati = (item, nameKey, dateKey) => {
    const d = item[dateKey]
    if (!d || d === '2222-01-01') return item[nameKey]
    return `ครั้งที่ ${item[nameKey]} วันที่ ${moment(d).locale('th').add(543, 'year').format('DD MMM YYYY')}`
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
        in_year_id:    searchForm.in_year_id.map(o => o.value),
        ag_id:         searchForm.ag_id.map(o => o.value),
        cat_id:        searchForm.cat_id.map(o => o.value),
        in_mkk_id:     searchForm.in_mkk_id.map(o => o.value),
        in_results_id: searchForm.in_results_id.map(o => o.value),
        in_mw_id:      searchForm.in_mw_id.map(o => o.value),
        in_status_id:  searchForm.in_status_id.map(o => o.value),
        in_num_date:   searchForm.in_num_date,
        in_detail:     searchForm.in_detail,
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
    control: (b) => ({ ...b, minHeight: '38px', borderColor: '#aaa', borderRadius: '0.2rem' }),
    menu: (b) => ({ ...b, zIndex: 9999 }),
  }

  return (
    <div className="public-page">
      {/* Header */}
      <header className="public-header bg-pale-primary py-4 px-3">
        <div className="container">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h1 className="fs-5 text-green mb-0 fw-bold">
                <i className='bx bx-file-blank me-2'></i>
                ระบบสืบค้นผลการพิจารณาหนังสือเวียน ก.พ.
              </h1>
              <small className="text-muted">สำนักงานคณะกรรมการข้าราชการกรุงเทพมหานคร</small>
            </div>
            <a href="/chat" className="btn btn-sm btn-outline-success">
              <i className='bx bx-bot me-1'></i>ผู้ช่วย AI
            </a>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <StatsCards
        data={statsData}
        resultsData={searchDone && results ? displayData : null}
        activeCardId={activeCard?.id || null}
        onCardClick={handleCardClick}
      />

      {/* Search Form */}
      <div className="container py-4">
        <div className="card bg-pale-navy shadow-sm">
          <div className="card-body">
            <h5 className="fw-semibold text-green mb-3">
              <i className='bx bx-search me-2'></i>ค้นหาหนังสือเวียน
            </h5>
            <hr />
            <form onSubmit={handleSearch}>
              <div className="row g-3">
                {/* ปี พ.ศ. */}
                <div className="col-lg-3">
                  <label className="form-label small fw-semibold">ปี พ.ศ.</label>
                  <Select isMulti placeholder="ระบุปี พ.ศ." styles={selectStyle}
                    options={makeOptions(filters?.year, 'year_id', i => i.year_value)}
                    value={searchForm.in_year_id}
                    onChange={v => setSearchForm({ ...searchForm, in_year_id: v })} />
                </div>

                {/* เลขที่หนังสือ */}
                <div className="col-lg-7">
                  <label className="form-label small fw-semibold">เลขที่หนังสือ/ลงวันที่</label>
                  <input type="text" className="form-control" placeholder="ระบุเลขที่หนังสือ..."
                    value={searchForm.in_num_date}
                    onChange={e => setSearchForm({ ...searchForm, in_num_date: e.target.value })} />
                </div>

                {/* ชื่อเรื่อง */}
                <div className="col-lg-10">
                  <label className="form-label small fw-semibold">ชื่อเรื่อง</label>
                  <input type="text" className="form-control" placeholder="ระบุชื่อเรื่อง..."
                    value={searchForm.in_detail}
                    onChange={e => setSearchForm({ ...searchForm, in_detail: e.target.value })} />
                </div>

                {/* ผู้รับผิดชอบ */}
                <div className="col-lg-5">
                  <label className="form-label small fw-semibold">ผู้รับผิดชอบ</label>
                  <Select isMulti placeholder="เลือกผู้รับผิดชอบ" styles={selectStyle}
                    options={makeOptions(filters?.agency, 'ag_id', i => i.ag_name)}
                    value={searchForm.ag_id}
                    onChange={v => setSearchForm({ ...searchForm, ag_id: v })} />
                </div>

                {/* หมวดหมู่ */}
                <div className="col-lg-5">
                  <label className="form-label small fw-semibold">หมวดหมู่</label>
                  <Select isMulti placeholder="เลือกหมวดหมู่" styles={selectStyle}
                    options={makeOptions(filters?.categories, 'cat_id', i => i.cat_name)}
                    value={searchForm.cat_id}
                    onChange={v => setSearchForm({ ...searchForm, cat_id: v })} />
                </div>

                {/* มติ ก.ก. */}
                <div className="col-lg-5">
                  <label className="form-label small fw-semibold">มติ ก.ก.</label>
                  <Select isMulti placeholder="ระบุมติ ก.ก." styles={selectStyle}
                    options={makeOptions(filters?.mati_kk, 'mkk_id', i => formatMati(i, 'mkk_name', 'mkk_date'))}
                    value={searchForm.in_mkk_id}
                    onChange={v => setSearchForm({ ...searchForm, in_mkk_id: v })} />
                </div>

                {/* ผลการพิจารณา */}
                <div className="col-lg-5">
                  <label className="form-label small fw-semibold">ผลการพิจารณา</label>
                  <Select isMulti placeholder="เลือกผลการพิจารณา" styles={selectStyle}
                    options={makeOptions(filters?.results, 'results_id', i => i.results_detail)}
                    value={searchForm.in_results_id}
                    onChange={v => setSearchForm({ ...searchForm, in_results_id: v })} />
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

      {/* Chat button */}
      <a href="/chat" className="chatbot-btn" title="ผู้ช่วย AI">
        <i className='bx bx-bot'></i>
      </a>
    </div>
  )
}

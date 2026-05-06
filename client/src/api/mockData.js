/**
 * mockData.js
 * ข้อมูลจำลองสำหรับใช้งาน standalone (ไม่ต้อง backend)
 * เปลี่ยนเป็น real API โดยแก้ไขที่ apiService.js
 */

export const MOCK_FILTERS = {
  year: [
    { year_id: 1, year_value: '2565' },
    { year_id: 2, year_value: '2566' },
    { year_id: 3, year_value: '2567' },
  ],
  agency: [
    { ag_id: 1, ag_name: 'สำนักงาน ก.ก.' },
    { ag_id: 2, ag_name: 'กองการเจ้าหน้าที่' },
    { ag_id: 3, ag_name: 'ฝ่ายทรัพยากรบุคคล' },
  ],
  categories: [
    { cat_id: 1, cat_name: 'การบรรจุแต่งตั้ง' },
    { cat_id: 2, cat_name: 'วินัยและการรักษาวินัย' },
    { cat_id: 3, cat_name: 'สวัสดิการและประโยชน์เกื้อกูล' },
    { cat_id: 4, cat_name: 'การลา' },
  ],
  mati_kk: [
    { mkk_id: 1, mkk_name: '1', mkk_date: '2565-03-15' },
    { mkk_id: 2, mkk_name: '2', mkk_date: '2566-06-20' },
  ],
  mati_work: [
    { mw_id: 1, mw_name: '1', mw_date: '2565-05-01' },
    { mw_id: 2, mw_name: '2', mw_date: '2566-08-10' },
  ],
  results: [
    { results_id: 1, results_detail: 'ปฏิบัติได้', results_color: '28a745' },
    { results_id: 2, results_detail: 'ปฏิบัติไม่ได้', results_color: 'dc3545' },
    { results_id: 3, results_detail: 'อยู่ระหว่างพิจารณา', results_color: 'ffc107' },
  ],
  status: [
    { status_id: 1, status_value: 'ใช้งาน' },
    { status_id: 2, status_value: 'ไม่ใช้งาน' },
  ],
}

export const MOCK_STATS = {
  total: 128,
  can_do: 85,
  cannot_do: 30,
  pending: 13,
}

export const MOCK_CIRCULARS = [
  {
    in_id: 1,
    in_num_date: 'นร 1006/ว 10 ลว. 15 มีนาคม 2565',
    in_detail: 'หลักเกณฑ์และวิธีการประเมินผลการปฏิบัติราชการของข้าราชการพลเรือน',
    in_detail_ag: '',
    in_etc: '-',
    in_link: 'https://www.ocsc.go.th',
    in_file_mkk: '-',
    year: { year_id: 1, year_value: '2565' },
    results: { results_id: 1, results_detail: 'ปฏิบัติได้', results_color: '28a745' },
    status_a: { status_id: 1, status_value: 'ใช้งาน' },
    agency: [{ ag_id: 1, ag_name: 'สำนักงาน ก.ก.' }],
    categories: [{ cat_id: 1, cat_name: 'การบรรจุแต่งตั้ง' }],
    mati_kk: { mkk_id: 1, mkk_name: '1', mkk_date: '2565-03-15' },
    mati_work: null,
    references_info: [],
  },
  {
    in_id: 2,
    in_num_date: 'นร 1008/ว 3 ลว. 20 มิถุนายน 2566',
    in_detail: 'การกำหนดวันหยุดราชการเพิ่มเป็นกรณีพิเศษ',
    in_detail_ag: 'เพิ่มวันหยุดประจำปี 2566',
    in_etc: '-',
    in_link: '-',
    in_file_mkk: '-',
    year: { year_id: 2, year_value: '2566' },
    results: { results_id: 2, results_detail: 'ปฏิบัติไม่ได้', results_color: 'dc3545' },
    status_a: { status_id: 1, status_value: 'ใช้งาน' },
    agency: [{ ag_id: 2, ag_name: 'กองการเจ้าหน้าที่' }],
    categories: [{ cat_id: 4, cat_name: 'การลา' }],
    mati_kk: null,
    mati_work: null,
    references_info: [],
  },
  {
    in_id: 3,
    in_num_date: 'นร 1012/ว 7 ลว. 10 สิงหาคม 2567',
    in_detail: 'การให้ข้าราชการพลเรือนสามัญได้รับเงินเดือน',
    in_detail_ag: '',
    in_etc: 'อยู่ระหว่างพิจารณา',
    in_link: '-',
    in_file_mkk: '-',
    year: { year_id: 3, year_value: '2567' },
    results: { results_id: 3, results_detail: 'อยู่ระหว่างพิจารณา', results_color: 'ffc107' },
    status_a: { status_id: 1, status_value: 'ใช้งาน' },
    agency: [
      { ag_id: 1, ag_name: 'สำนักงาน ก.ก.' },
      { ag_id: 3, ag_name: 'ฝ่ายทรัพยากรบุคคล' },
    ],
    categories: [{ cat_id: 2, cat_name: 'วินัยและการรักษาวินัย' }],
    mati_kk: null,
    mati_work: { mw_id: 2, mw_name: '2', mw_date: '2566-08-10' },
    references_info: [{ in_id: 1, in_num_date: 'นร 1006/ว 10', in_detail: 'หลักเกณฑ์และวิธีการประเมินผล' }],
  },
]

export const MOCK_ADMIN_DATA = {
  information: MOCK_CIRCULARS,
  year:        MOCK_FILTERS.year,
  agency:      MOCK_FILTERS.agency,
  categories:  MOCK_FILTERS.categories,
  mati_kk:     MOCK_FILTERS.mati_kk,
  mati_work:   MOCK_FILTERS.mati_work,
  results:     MOCK_FILTERS.results,
  status:      MOCK_FILTERS.status,
}

export const MOCK_ADMIN_USER = {
  token:   'mock_jwt_token_for_dev',
  name:    'ผู้ดูแลระบบ',
  permiss: 'superadmin',
  a_username: 'admin',
}

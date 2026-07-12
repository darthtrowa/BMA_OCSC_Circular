import pool from './src/config/database.js';

async function checkDashboardQuery() {
  try {
    const sql = `
      SELECT
        c_information.in_id, 
        c_information.in_workflow_status, 
        c_information.in_current_owner_id, 
        c_information.in_creator_id
      FROM c_information
      LEFT JOIN c_information_categories ON c_information.in_id=c_information_categories.in_id
      LEFT JOIN c_categories             ON c_information_categories.cat_id=c_categories.cat_id
      LEFT JOIN c_information_agency     ON c_information.in_id=c_information_agency.in_id
      LEFT JOIN c_agency                 ON c_information_agency.ag_id=c_agency.ag_id
      LEFT JOIN c_year                   ON c_information.in_year_id=c_year.year_id
      LEFT JOIN c_status                 ON c_information.in_status_id=c_status.status_id
      LEFT JOIN c_mati_work              ON c_information.in_mw_id=c_mati_work.mw_id
      LEFT JOIN c_mati_kk                ON c_information.in_mkk_id=c_mati_kk.mkk_id
      LEFT JOIN c_results                ON c_information.in_results_id=c_results.results_id
      LEFT JOIN c_information_information ON c_information.in_id=c_information_information.in_id
      LEFT JOIN c_information AS ref_info ON c_information_information.in_id_ref=ref_info.in_id
      WHERE c_information.in_id = 509
      GROUP BY c_information.in_id, c_year.year_value
    `;
    const res = await pool.query(sql);
    console.log('Dashboard query result for 509:', res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkDashboardQuery();

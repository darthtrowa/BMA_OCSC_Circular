const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:MKhNYeMDtZ4nuUCy@localhost:5432/circular' });

async function run() {
  try {
    const adminId = 9;
    const sql = `
      SELECT
        c_information.in_id, c_information.in_num_date, c_information.in_doc_date, c_information.in_detail,
        c_information.in_workflow_status, c_information.in_current_owner_id, c_information.in_creator_id,
        c_information.in_is_parallel, c_information.in_flow_state,
        (
          SELECT STRING_AGG(DISTINCT CAST(pa.current_owner_id AS TEXT), ',')
          FROM c_parallel_assignments pa
          WHERE pa.in_id = c_information.in_id AND pa.pa_status IN ('PENDING', 'IN_PROGRESS')
        ) AS parallel_owner_ids
      FROM c_information
      GROUP BY c_information.in_id
    `;
    const res = await pool.query(sql);
    const info = res.rows;

    const checkIsCurrentOwner = (item, userId) => {
      if (!userId) return false;
      if (item.in_is_parallel && item.parallel_owner_ids) {
        const pIds = String(item.parallel_owner_ids).split(',').map(Number);
        return pIds.includes(Number(userId));
      }
      return Number(item.in_current_owner_id) === Number(userId);
    };

    const myTasks = info.filter(item => checkIsCurrentOwner(item, adminId));
    console.log("myTasks for user 9:", myTasks.map(t => ({ in_id: t.in_id, in_num_date: t.in_num_date, is_parallel: t.in_is_parallel, parallel_owner_ids: t.parallel_owner_ids })));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();

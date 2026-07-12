import db from './src/config/database.js';

async function searchImportedDoc() {
  const { rows } = await db.query(`
    SELECT in_id, in_num_date, in_doc_date, in_detail, in_workflow_status, created_at 
    FROM c_information 
    WHERE in_num_date LIKE '%ว5%' OR in_num_date LIKE '%ว 5%' OR in_detail LIKE '%ว5%' OR in_detail LIKE '%ว 5%'
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  console.log(rows);
  process.exit(0);
}

searchImportedDoc();

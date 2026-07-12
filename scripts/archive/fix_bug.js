import fs from 'fs';

const p = 'e:/BMA_OCSC_Circular/server/src/routes/admin.ts';
let code = fs.readFileSync(p, 'utf-8');

const target = `    const { rows: inserted } = await db.query(\`
      INSERT INTO c_information (
        in_num_date, in_doc_date, in_detail, in_detail_ag, in_etc, in_link, in_file_mkk,
        updated_user, in_mkk_id, in_mw_id, in_results_id, in_year_id, in_status_id,
        created_at, updated_at, in_ordering, in_circular_detail, in_original_link, in_attachment_link,
        in_workflow_status
      ) VALUES (
        $1, $2, $3, '-', '-', $4, '-',
        $5, NULL, NULL, NULL, $6, NULL,
        NOW(), NOW(), $7, '-', '-', '-',
        'DRAFT'
      ) RETURNING in_id
    \`, [
      in_num_date, in_doc_date || null, in_detail, in_link,
      req.admin?.name || 'Admin', in_year_id || null, newOrder
    ]);`;

const replacement = `    const { rows: inserted } = await db.query(\`
      INSERT INTO c_information (
        in_num_date, in_doc_date, in_detail, in_detail_ag, in_etc, in_link, in_file_mkk,
        updated_user, in_mkk_id, in_mw_id, in_results_id, in_year_id, in_status_id,
        created_at, updated_at, in_ordering, in_circular_detail, in_original_link, in_attachment_link,
        in_workflow_status, in_current_owner_id, in_creator_id
      ) VALUES (
        $1, $2, $3, '-', '-', $4, '-',
        $5, NULL, NULL, NULL, $6, NULL,
        NOW(), NOW(), $7, '-', '-', '-',
        'DRAFT', $8, $8
      ) RETURNING in_id
    \`, [
      in_num_date, in_doc_date || null, in_detail, in_link,
      req.admin?.name || 'Admin', in_year_id || null, newOrder, req.admin?.id || null
    ]);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Successfully replaced code.');
} else {
  console.log('Target code not found. Trying regex...');
  
  const targetRegex = /INSERT INTO c_information \([\s\S]*?in_workflow_status\s*\)\s*VALUES\s*\([\s\S]*?'DRAFT'\s*\)\s*RETURNING in_id\s*`,\s*\[[\s\S]*?newOrder\s*\]\);/;
  
  const match = code.match(targetRegex);
  if (match) {
     const replacement2 = `INSERT INTO c_information (
        in_num_date, in_doc_date, in_detail, in_detail_ag, in_etc, in_link, in_file_mkk,
        updated_user, in_mkk_id, in_mw_id, in_results_id, in_year_id, in_status_id,
        created_at, updated_at, in_ordering, in_circular_detail, in_original_link, in_attachment_link,
        in_workflow_status, in_current_owner_id, in_creator_id
      ) VALUES (
        $1, $2, $3, '-', '-', $4, '-',
        $5, NULL, NULL, NULL, $6, NULL,
        NOW(), NOW(), $7, '-', '-', '-',
        'DRAFT', $8, $8
      ) RETURNING in_id
    \`, [
      in_num_date, in_doc_date || null, in_detail, in_link,
      req.admin?.name || 'Admin', in_year_id || null, newOrder, req.admin?.id || null
    ]);`;
     code = code.replace(match[0], replacement2);
     fs.writeFileSync(p, code, 'utf-8');
     console.log('Successfully replaced code using regex.');
  } else {
     console.log('Still not found!');
  }
}

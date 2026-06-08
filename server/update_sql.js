import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/server/src/routes/admin.ts';
let code = fs.readFileSync(p, 'utf-8');

const targetStr = "`UPDATE c_information SET in_num_date=$1,in_doc_date=$2,in_detail=$3,in_detail_ag=$4,in_etc=$5,in_link=$6,in_qr_link=$7,in_file_mkk=$8,updated_user=$9,in_mkk_id=$10,in_mw_id=$11,in_results_id=$12,in_year_id=$13,in_status_id=$14,in_circular_detail=$15,in_original_link=$16,in_attachment_link=$17,updated_at=NOW() WHERE in_id=$18`,";

const replacementStr = "`UPDATE c_information SET in_num_date=$1,in_doc_date=$2,in_detail=$3,in_detail_ag=$4,in_etc=$5,in_link=$6,in_qr_link=$7,in_file_mkk=$8,updated_user=(CASE WHEN updated_user = 'legend' THEN 'legend' ELSE $9 END),in_mkk_id=$10,in_mw_id=$11,in_results_id=$12,in_year_id=$13,in_status_id=$14,in_circular_detail=$15,in_original_link=$16,in_attachment_link=$17,updated_at=NOW() WHERE in_id=$18`,";

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target string not found.');
}

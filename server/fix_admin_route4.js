import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/server/src/routes/admin.ts';
let code = fs.readFileSync(p, 'utf-8');

// 1. Change the SQL query to include parent_ag_id
const regexSql = /let sql = `SELECT a_id, a_name, a_role, a_position, a_agency_id FROM admin WHERE a_status = \$1`;/g;
const replacementSql = `let sql = \`SELECT a.a_id, a.a_name, a.a_role, a.a_position, a.a_agency_id, c.parent_ag_id 
           FROM admin a 
           LEFT JOIN c_agency c ON a.a_agency_id = c.ag_id 
           WHERE a.a_status = \$1\`;`;
code = code.replace(regexSql, replacementSql);

// 2. Change the filter logic
const regexFilter = /if \(isRequestingGrpLeader && r\.a_role === 'GRP_LEADER'\) \{\s*return Number\(r\.a_agency_id\) === Number\(effectiveUserAgencyId\) \|\|\s*\(effectiveUserAgencyParentId && Number\(r\.a_agency_id\) === Number\(effectiveUserAgencyParentId\)\);\s*\}/g;

const replacementFilter = `if (isRequestingGrpLeader && r.a_role === 'GRP_LEADER') {
                if (Number(r.a_agency_id) === Number(effectiveUserAgencyId)) return true;
                if (effectiveUserAgencyParentId && Number(r.parent_ag_id) === Number(effectiveUserAgencyParentId)) return true;
                if (effectiveUserAgencyParentId && Number(r.a_agency_id) === Number(effectiveUserAgencyParentId)) return true;
                return false;
              }`;
code = code.replace(regexFilter, replacementFilter);

fs.writeFileSync(p, code, 'utf-8');
console.log('Replaced successfully.');

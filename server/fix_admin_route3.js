import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/server/src/routes/admin.ts';
let code = fs.readFileSync(p, 'utf-8');

const regex = /if \(isRequestingGrpLeader && r\.a_role === 'GRP_LEADER'\) \{\s*return Number\(r\.a_agency_id\) === Number\(effectiveUserAgencyId\);\s*\}/g;

const replacementStr = `if (isRequestingGrpLeader && r.a_role === 'GRP_LEADER') {
                return Number(r.a_agency_id) === Number(effectiveUserAgencyId) ||
                       (effectiveUserAgencyParentId && Number(r.a_agency_id) === Number(effectiveUserAgencyParentId));
              }`;

if (regex.test(code)) {
  code = code.replace(regex, replacementStr);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target string not found.');
}

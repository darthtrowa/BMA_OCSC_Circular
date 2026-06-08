import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/server/src/routes/admin.ts';
let code = fs.readFileSync(p, 'utf-8');

const targetStr = `        } else {
          // Others: can see parent-agency users (supervisor) + child-agency users (subordinates)
          // NOT peers (same agency)
          rows = rows.filter((r: any) =>
            (effectiveUserAgencyParentId && Number(r.a_agency_id) === Number(effectiveUserAgencyParentId)) ||
            childAgencyIds.includes(Number(r.a_agency_id))
          );
        }`;

const replacementStr = `        } else {
          // Others: can see parent-agency users (supervisor) + child-agency users (subordinates)
          // AND peers IF we are requesting GRP_LEADER
          const isRequestingGrpLeader = roles && roles.includes('GRP_LEADER');
          rows = rows.filter((r: any) => {
            if (isRequestingGrpLeader && r.a_role === 'GRP_LEADER') {
              return Number(r.a_agency_id) === Number(effectiveUserAgencyId);
            }
            return (effectiveUserAgencyParentId && Number(r.a_agency_id) === Number(effectiveUserAgencyParentId)) ||
                   childAgencyIds.includes(Number(r.a_agency_id));
          });
        }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target string not found.');
}

import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowActionModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

const targetRegex = /const getActionConfig = \(\) => \{[\s\S]*?const config = getActionConfig\(\);\s*const isDynamic = dynamicOptions\.length > 0;\s*const isParallelReject = paId \? \(actionType === 'reject' \|\| actionType === 'actingReject'\) : false;\s*let effectiveUsers = \(actionType === 'reject' \|\| actionType === 'actingReject'\) \? users : dynamicUsers;\s*let dynamicTitle = '';\s*if \(isDynamic\) \{\s*const opt = dynamicOptions\[0\];\s*effectiveUsers = opt\.eligible_users;\s*dynamicTitle = opt\.step_name;\s*\}/;

const replacementStr = `const isDynamic = dynamicOptions.length > 0;
    const isParallelReject = paId ? (actionType === 'reject' || actionType === 'actingReject') : false;
    
    let effectiveUsers = (actionType === 'reject' || actionType === 'actingReject') ? users : dynamicUsers;
    let dynamicTitle = '';
    
    if (isDynamic) {
      const opt = dynamicOptions[0]; // For now we assume single next node
      effectiveUsers = opt.eligible_users;
      dynamicTitle = opt.step_name;
    }

    const getActionConfig = () => {
      switch (actionType) {
        case 'submitToHr':    return { title: 'ส่ง ผอ. สำนักงาน', buttonText: 'ส่งเรื่อง', requiresUser: true };
        case 'submitToGrpLeader': {
          let pos = 'ตำแหน่งระดับสูงกว่า';
          if (effectiveUsers && effectiveUsers.length > 0) {
            const positions = Array.from(new Set(effectiveUsers.map((u: any) => u.a_position || u.position).filter(Boolean)));
            if (positions.length > 0) {
              pos = positions.join(' / ');
            }
          }
          return { title: \`เสนองาน (\${pos})\`, buttonText: 'ส่งเรื่อง', requiresUser: true };
        }
        case 'delegate':      return { title: 'มอบหมายงาน',                  buttonText: 'มอบหมาย',  requiresUser: true };
        case 'submitReview':  return { title: 'ส่งผลการดำเนินงาน',           buttonText: 'ส่งผล',    requiresUser: false };
        case 'approve':       return { title: 'อนุมัติ / เห็นชอบ',           buttonText: approvalContext === 'ACTING' ? 'อนุมัติในฐานะรักษาการ' : 'อนุมัติ', requiresUser: true };
        case 'actingApprove': return { title: 'ดำเนินการ (ในฐานะรักษาการ)', buttonText: 'ดำเนินการ', requiresUser: true };
        case 'reject':        return { title: 'ตีกลับ / ไม่อนุมัติ',           buttonText: 'ตีกลับ',   requiresUser: true };
        case 'actingReject':  return { title: 'ส่งงานกลับ (ในฐานะรักษาการ)', buttonText: 'ส่งกลับ',   requiresUser: true };
        default:              return { title: 'ดำเนินการ',                     buttonText: 'ยืนยัน',  requiresUser: false };
      }
    };
  
    const config = getActionConfig();`;

if (targetRegex.test(code)) {
  code = code.replace(targetRegex, replacementStr);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target regex not found.');
}

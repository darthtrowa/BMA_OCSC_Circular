import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowActionModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

const regex = /case 'submitToGrpLeader': return \{ title: '[^']+', buttonText: '[^']+', requiresUser: true \};/;
const replacementStr = `case 'submitToGrpLeader': return { title: 'เสนองาน (ส่งเรื่องให้ตำแหน่งระดับสูงกว่า)', buttonText: 'ส่งเรื่อง', requiresUser: true };`;

if (regex.test(code)) {
  code = code.replace(regex, replacementStr);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target regex not found.');
}

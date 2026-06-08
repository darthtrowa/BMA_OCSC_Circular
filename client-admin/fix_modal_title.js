import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowActionModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

const regex = /case 'submitToGrpLeader': \{\s*return \{ title: `เสนองาน`, buttonText: 'เสนองาน', requiresUser: false \}; \/\/ Auto assign\s*\}/g;

const replacementStr = `case 'submitToGrpLeader': {
          let pos = 'ตำแหน่งระดับสูงกว่า';
          if (effectiveUsers && effectiveUsers.length > 0) {
            // ดึงตำแหน่งของบัญชีหลัก (ตัวแรกสุดที่ไม่ได้เป็นรักษาการ)
            const mainUser = effectiveUsers.find((u: any) => !u.isActing) || effectiveUsers[0];
            if (mainUser && (mainUser.a_position || mainUser.position)) {
              pos = mainUser.a_position || mainUser.position;
            }
          }
          return { title: \`เสนองาน (\${pos})\`, buttonText: 'เสนองาน', requiresUser: false };
        }`;

if (regex.test(code)) {
  code = code.replace(regex, replacementStr);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target string not found.');
}

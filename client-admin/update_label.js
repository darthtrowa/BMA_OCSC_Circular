import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowInboxSection.tsx';
let code = fs.readFileSync(p, 'utf-8');

const regex = /'PENDING_REVIEW': \{ label: 'รอตรวจสอบผล', color: 'bg-purple-100 text-purple-700' \},/g;
const replacement = `'PENDING_REVIEW': { label: 'เสนองาน', color: 'bg-indigo-100 text-indigo-700' },`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target string not found.');
}

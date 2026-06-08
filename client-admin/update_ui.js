import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowInboxSection.tsx';
let code = fs.readFileSync(p, 'utf-8');

const targetStr = `          {canAct && (
            (admin?.role === 'HR_DIRECTOR' && item.in_workflow_status === 'PENDING_HR_APPROVAL' && !item.in_is_parallel)
          ) && (
            <button
              className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition text-xs font-semibold flex items-center gap-1"
              onClick={() => { setParallelDocId(item.in_id); setShowParallelModal(true); }}
              title="อนุมัติและกระจายงานให้ส่วนราชการพิจารณาร่วมกัน"
            >
              <i className="bx bx-git-branch"></i> อนุมัติและกระจายงาน
            </button>
          )}`;

const replacementStr = `          {canAct && (
            (admin?.role === 'HR_DIRECTOR' && item.in_workflow_status === 'PENDING_HR_APPROVAL' && !item.in_is_parallel) ||
            (admin?.permiss === 'superadmin' && !item.in_is_parallel && !['COMPLETED', 'REJECTED'].includes(item.in_workflow_status)) ||
            (admin?.role === 'COORDINATOR' && ['DRAFT', 'PENDING_HR_APPROVAL'].includes(item.in_workflow_status) && !item.in_is_parallel)
          ) && (
            <button
              className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition text-xs font-semibold flex items-center gap-1"
              onClick={() => { setParallelDocId(item.in_id); setShowParallelModal(true); }}
              title="กำหนดส่วนราชการที่ต้องการส่งเรื่องไปให้พิจารณาแบบคู่ขนาน"
            >
              <i className="bx bx-git-branch"></i> กำหนดส่วนราชการเป้าหมาย
            </button>
          )}`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target string not found.');
}

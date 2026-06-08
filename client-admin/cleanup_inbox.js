import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowInboxSection.tsx';
let code = fs.readFileSync(p, 'utf-8');

const regex = /\s*\) && \(\s*<button\s*className="px-3 py-1\.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition text-xs \s*font-semibold flex items-center gap-1"\s*onClick=\{[^}]+\}\s*title="[^"]+"\s*>\s*<i className="bx bx-git-branch"><\/i> กำหนดส่วนราชการพิจารณา\s*<\/button>\s*\)/;

// Alternatively, just string replace the exact messed up part
const target = `          ) && (
            <button
              className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition text-xs font-semibold flex items-center gap-1"
              onClick={() => { setParallelDocId(item.in_id); setShowParallelModal(true); }}
              title="กำหนดส่วนราชการที่ต้องการส่งเรื่องไปให้พิจารณาแบบคู่ขนาน"
            >
              <i className="bx bx-git-branch"></i> กำหนดส่วนราชการพิจารณา
            </button>
          )}`;

if (code.includes(target)) {
  code = code.replace(target, '');
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Cleaned up button.');
} else {
  console.log('Target string not found.');
}

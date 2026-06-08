import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowInboxSection.tsx';
let code = fs.readFileSync(p, 'utf-8');

const regex = /const renderStatusBadge = \(status: string\) => \{[\s\S]*?if \(!s\) return <span className="px-2\.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700">\{status\}<\/span>;\s*return <span className={`px-2\.5 py-1 text-xs font-bold rounded-lg \$\{s\.color\}`}>\{s\.label\}<\/span>;\s*\};/;

const replacement = `const renderStatusBadge = (status: string, item?: any) => {
    let label = status;
    let color = 'bg-slate-100 text-slate-700';
    const role = admin?.role || '';
    
    if (status === 'DRAFT' || status === 'PENDING_HR_APPROVAL') {
      if (role === 'COORDINATOR') {
        label = 'เสนองาน'; color = 'bg-indigo-100 text-indigo-700';
      } else if (role === 'HR_DIRECTOR') {
        label = 'เสนอให้พิจารณา'; color = 'bg-amber-100 text-amber-700';
      } else {
        label = 'รอพิจารณา'; color = 'bg-amber-100 text-amber-700';
      }
    } else if (status === 'PENDING_DELEGATION') {
      label = 'มอบหมาย'; color = 'bg-blue-100 text-blue-700';
    } else if (status === 'PENDING_REVIEW') {
      if (role === 'DIV_DIRECTOR') {
        label = 'ส่งผลการพิจารณา'; color = 'bg-purple-100 text-purple-700';
      } else {
        label = 'เสนองาน'; color = 'bg-indigo-100 text-indigo-700';
      }
    } else if (status === 'PENDING_CLOSE') {
      if (role === 'HR_DIRECTOR') {
        label = 'มอบหมาย'; color = 'bg-blue-100 text-blue-700';
      } else {
        label = 'จบงาน'; color = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      }
    } else if (status === 'COMPLETED') {
      label = 'จบงาน'; color = 'bg-emerald-100 text-emerald-700';
    } else if (status === 'REJECTED') {
      label = 'ถูกตีกลับ'; color = 'bg-red-100 text-red-700';
    } else if (status === 'PENDING_PARALLEL') {
      label = 'รอผ่านคู่ขนาน'; color = 'bg-violet-100 text-violet-700';
    } else {
      label = status;
    }

    return <span className={\`px-2.5 py-1 text-xs font-bold rounded-lg \${color}\`}>{label}</span>;
  };`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  
  // Also need to update calls to renderStatusBadge to pass 'item'
  // It's used like: renderStatusBadge(item.in_workflow_status)
  // Let's replace it:
  code = code.replace(/renderStatusBadge\(item\.in_workflow_status\)/g, "renderStatusBadge(item.in_workflow_status, item)");

  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target string not found.');
}

import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowActionModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

// 1. Replace getActionConfig
const regexConfig = /const getActionConfig = \(\) => \{[\s\S]*?default:              return \{ title: 'ดำเนินการ',                     buttonText: 'ยืนยัน',  requiresUser: false \};\s*\}\s*\};/g;

const newConfig = `const getActionConfig = () => {
      switch (actionType) {
        case 'submitToHr':    return { title: 'เสนอให้พิจารณา', buttonText: 'เสนอให้พิจารณา', requiresUser: true };
        case 'submitToGrpLeader': {
          return { title: \`เสนองาน\`, buttonText: 'เสนองาน', requiresUser: false }; // Auto assign
        }
        case 'delegate':      return { title: 'มอบหมาย',                  buttonText: 'มอบหมาย',  requiresUser: true };
        case 'submitReview':  
          return { title: admin?.role === 'DIV_DIRECTOR' ? 'ส่งผลการพิจารณา' : 'เสนองาน', buttonText: admin?.role === 'DIV_DIRECTOR' ? 'ส่งผลการพิจารณา' : 'เสนองาน', requiresUser: false };
        case 'approve':       
          if (admin?.role === 'DIV_DIRECTOR') return { title: 'ส่งผลการพิจารณา', buttonText: 'ส่งผลการพิจารณา', requiresUser: true };
          if (admin?.role === 'HR_DIRECTOR') return { title: 'มอบหมาย', buttonText: 'มอบหมาย', requiresUser: true };
          return { title: 'อนุมัติ / เห็นชอบ', buttonText: approvalContext === 'ACTING' ? 'อนุมัติในฐานะรักษาการ' : 'อนุมัติ', requiresUser: true };
        case 'actingApprove': 
          if (admin?.role === 'DIV_DIRECTOR') return { title: 'ส่งผลการพิจารณา (รักษาการ)', buttonText: 'ส่งผลการพิจารณา', requiresUser: true };
          if (admin?.role === 'HR_DIRECTOR') return { title: 'มอบหมาย (รักษาการ)', buttonText: 'มอบหมาย', requiresUser: true };
          return { title: 'ดำเนินการ (ในฐานะรักษาการ)', buttonText: 'ดำเนินการ', requiresUser: true };
        case 'reject':        return { title: 'ตีกลับ / ไม่อนุมัติ',           buttonText: 'ตีกลับ',   requiresUser: true };
        case 'actingReject':  return { title: 'ส่งงานกลับ (ในฐานะรักษาการ)', buttonText: 'ส่งกลับ',   requiresUser: true };
        default:              return { title: 'ดำเนินการ',                     buttonText: 'ยืนยัน',  requiresUser: false };
      }
    };`;

code = code.replace(regexConfig, newConfig);

// 2. Replace handleSubmit to intercept submitToGrpLeader
const targetHandleSubmit = `const targetUserId = selectedUserId ? Number(String(selectedUserId).split('-')[0]) : 0;`;
const newHandleSubmit = `let targetUserId = selectedUserId ? Number(String(selectedUserId).split('-')[0]) : 0;
        
        if (actionType === 'submitToGrpLeader' && !targetUserId) {
          if (effectiveUsers && effectiveUsers.length > 0) {
            targetUserId = Number(effectiveUsers[0].a_id || effectiveUsers[0].id);
          }
        }`;
code = code.replace(targetHandleSubmit, newHandleSubmit);

// 3. Inject Auto-Assign UI
// Locate the user selector block
const targetSelector = /\{\(\(config\.requiresUser && !isParallelReject\) \|\| \(isDynamic && dynamicOptions\[0\]\.node_id !== null\)\) && \(/g;

const newSelector = `{ actionType === 'submitToGrpLeader' && (
              <div className="animate__animated animate__fadeInUp animate__faster animate__delay-1s bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4 text-sm text-blue-800">
                <p className="font-semibold mb-1">ส่งงานให้ Group Leader อัตโนมัติ:</p>
                {effectiveUsers.map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
                    <i className="bx bxs-user-circle"></i>
                    <span>{u.name || u.a_name} ({u.position || u.role || u.a_position || u.a_role})</span>
                    {i > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">รักษาการ</span>}
                    {i === 0 && <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-medium">บัญชีหลัก</span>}
                  </div>
                ))}
              </div>
            )}
            
            {((config.requiresUser && !isParallelReject) || (isDynamic && dynamicOptions[0].node_id !== null)) && (`;

code = code.replace(targetSelector, newSelector);

fs.writeFileSync(p, code, 'utf-8');
console.log('Action modal updated');

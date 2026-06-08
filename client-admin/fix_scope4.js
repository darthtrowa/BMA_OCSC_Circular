import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowActionModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

const target1 = `  const getActionConfig = () => {`;
const target2 = `  const config = getActionConfig();
  
  const isDynamic = dynamicOptions.length > 0;
  const isParallelReject = paId ? (actionType === 'reject' || actionType === 'actingReject') : false;
  
  let effectiveUsers = (actionType === 'reject' || actionType === 'actingReject') ? users : dynamicUsers;
  let dynamicTitle = '';
  
  if (isDynamic) {
    const opt = dynamicOptions[0]; // For now we assume single next node
    effectiveUsers = opt.eligible_users;
    dynamicTitle = opt.step_name;
  }`;

if (code.includes(target1) && code.includes(target2)) {
  code = code.replace(target2, '');
  code = code.replace(target1, `  const isDynamic = dynamicOptions.length > 0;
  const isParallelReject = paId ? (actionType === 'reject' || actionType === 'actingReject') : false;
  
  let effectiveUsers = (actionType === 'reject' || actionType === 'actingReject') ? users : dynamicUsers;
  let dynamicTitle = '';
  
  if (isDynamic) {
    const opt = dynamicOptions[0]; // For now we assume single next node
    effectiveUsers = opt.eligible_users;
    dynamicTitle = opt.step_name;
  }

  const getActionConfig = () => {`);

  // we also need to append \`const config = getActionConfig();\`
  // right after the getActionConfig function.
  // It looks like:
  /*
        default:              return { title: 'ดำเนินการ',                     buttonText: 'ยืนยัน',  requiresUser: false };
      }
    };
  */
  const endOfFunc = `default:              return { title: 'ดำเนินการ',                     buttonText: 'ยืนยัน',  requiresUser: false };
    }
  };`;

  if (code.includes(endOfFunc)) {
     code = code.replace(endOfFunc, endOfFunc + '\n\n  const config = getActionConfig();');
  }

  fs.writeFileSync(p, code, 'utf-8');
  console.log('Fixed scope successfully!');
} else {
  console.log('Targets not found.');
}

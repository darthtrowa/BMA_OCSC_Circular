import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowActionModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

const target1 = `  const getActionConfig = () => {`;
const target2 = `    const isDynamic = dynamicOptions.length > 0;
    const isParallelReject = paId ? (actionType === 'reject' || actionType === 'actingReject') : false;
    
    let effectiveUsers = (actionType === 'reject' || actionType === 'actingReject') ? users : dynamicUsers;
    let dynamicTitle = '';
    
    if (isDynamic) {
      const opt = dynamicOptions[0]; // For now we assume single next node
      effectiveUsers = opt.eligible_users;
      dynamicTitle = opt.step_name;
    }`;

if (code.includes(target1) && code.includes(target2)) {
  // Remove target2 from its original location
  code = code.replace(target2, '');
  
  // Insert target2 before target1
  code = code.replace(target1, target2 + '\n\n' + target1);
  
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Fixed scope successfully.');
} else {
  console.log('Failed to find targets.');
}

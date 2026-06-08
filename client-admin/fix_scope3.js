import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowActionModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

const getActionConfigStr = `  const getActionConfig = () => {`;
const varStr = `  const config = getActionConfig();
  
  const isDynamic = dynamicOptions.length > 0;
  const isParallelReject = paId ? (actionType === 'reject' || actionType === 'actingReject') : false;
  
  let effectiveUsers = (actionType === 'reject' || actionType === 'actingReject') ? users : dynamicUsers;
  let dynamicTitle = '';
  
  if (isDynamic) {
    const opt = dynamicOptions[0]; // For now we assume single next node
    effectiveUsers = opt.eligible_users;
    dynamicTitle = opt.step_name;
  }`;

const replacedVarStr = `  const isDynamic = dynamicOptions.length > 0;
  const isParallelReject = paId ? (actionType === 'reject' || actionType === 'actingReject') : false;
  
  let effectiveUsers = (actionType === 'reject' || actionType === 'actingReject') ? users : dynamicUsers;
  let dynamicTitle = '';
  
  if (isDynamic) {
    const opt = dynamicOptions[0]; // For now we assume single next node
    effectiveUsers = opt.eligible_users;
    dynamicTitle = opt.step_name;
  }

  const getActionConfig = () => {`;

if (code.includes(getActionConfigStr)) {
    // 1. remove varStr, wait, formatting might be slightly off.
    // let's do a regex replacement for the bottom block and top block.
    
    // strip the bottom block:
    const regex1 = /\s*const config = getActionConfig\(\);\s*const isDynamic = dynamicOptions\.length > 0;\s*const isParallelReject = paId \? \(actionType === 'reject' \|\| actionType === 'actingReject'\) : false;\s*let effectiveUsers = \(actionType === 'reject' \|\| actionType === 'actingReject'\) \? users : dynamicUsers;\s*let dynamicTitle = '';\s*if \(isDynamic\) \{\s*const opt = dynamicOptions\[0\];\s*\/\/ For now we assume single next node\s*effectiveUsers = opt\.eligible_users;\s*dynamicTitle = opt\.step_name;\s*\}/g;
    
    code = code.replace(regex1, '');
    
    // add it to the top block:
    code = code.replace('  const getActionConfig = () => {', 
\`  const isDynamic = dynamicOptions.length > 0;
  const isParallelReject = paId ? (actionType === 'reject' || actionType === 'actingReject') : false;
  
  let effectiveUsers = (actionType === 'reject' || actionType === 'actingReject') ? users : dynamicUsers;
  let dynamicTitle = '';
  
  if (isDynamic) {
    const opt = dynamicOptions[0]; // For now we assume single next node
    effectiveUsers = opt.eligible_users;
    dynamicTitle = opt.step_name;
  }

  const getActionConfig = () => {\`);
  
    // append \`const config = getActionConfig();\` right after the function closes.
    // the function closes with \`  };\` followed by \`  // Dynamic button color\`
    code = code.replace('  };\n\n  // Dynamic button color', '  };\n\n  const config = getActionConfig();\n\n  // Dynamic button color');
    // just in case it doesn't match:
    if (!code.includes('const config = getActionConfig();')) {
       code = code.replace('  };\n\n  const buttonColorClass', '  };\n\n  const config = getActionConfig();\n\n  const buttonColorClass');
    }

    fs.writeFileSync(p, code, 'utf-8');
    console.log('Fixed scope successfully using script!');
}

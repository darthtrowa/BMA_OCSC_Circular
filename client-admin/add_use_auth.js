import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowActionModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

if (!code.includes("import { useAuth } from '../../contexts/AuthContext';")) {
  code = code.replace(
    "import { workflowApi, adminApi, DelegationItem } from '../../api/apiService';",
    "import { workflowApi, adminApi, DelegationItem } from '../../api/apiService';\nimport { useAuth } from '../../contexts/AuthContext';"
  );
}

if (!code.includes("const { admin } = useAuth();")) {
  code = code.replace(
    "export default function WorkflowActionModal({",
    "export default function WorkflowActionModal({\n  "
  );
  
  // Find where the component starts and insert const { admin } = useAuth();
  code = code.replace(
    /export default function WorkflowActionModal\(\{[\s\S]*?\}\) \{/,
    (match) => match + "\n  const { admin } = useAuth();"
  );
}

fs.writeFileSync(p, code, 'utf-8');
console.log('useAuth added');

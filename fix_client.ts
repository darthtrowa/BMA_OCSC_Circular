
import fs from "fs";

const file = "e:/BMA_OCSC_Circular/client/src/components/admin/UserSection.tsx";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/\{showAssignDelegationModal && \([\s\S]*?\)\}/, "");
content = content.replace(/\{showManageDelegationModal && \([\s\S]*?\)\}/, "");

fs.writeFileSync(file, content);


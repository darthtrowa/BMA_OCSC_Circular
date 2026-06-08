
import fs from "fs";

const file = "e:/BMA_OCSC_Circular/client-admin/src/api/apiService.ts";
let content = fs.readFileSync(file, "utf8");

// Remove old methods
content = content.replace(/submitToHr: async[\s\S]*?\},/, "");
content = content.replace(/submitToGrpLeader: async[\s\S]*?\},/, "");
content = content.replace(/delegate: async[\s\S]*?\},/, "");
content = content.replace(/submitReview: async[\s\S]*?\},/, "");

const approveRegex = /approveWorkflow: async \([\s\S]*?\}\),/;
const rejectRegex = /rejectWorkflow: async \([\s\S]*?\}\),/;

const forwardMethod = `forwardWorkflow: async (
    docId: number,
    toUserId: number,
    comments?: string,
    approval_context: "SELF" | "ACTING" = "SELF",
    delegation_id?: number
  ): Promise<any> => {
    const { data } = await http.post("/api/admin/workflow/forward", { docId, toUserId, comments, approval_context, delegation_id });
    return data;
  },`;

content = content.replace(approveRegex, forwardMethod);

content = content.replace(rejectRegex, `rejectWorkflow: async (
    docId: number,
    rejectToUserId: number,
    comments?: string,
    approval_context: "SELF" | "ACTING" = "SELF",
    delegation_id?: number
  ): Promise<any> => {
    const { data } = await http.post("/api/admin/workflow/reject", { docId, rejectToUserId, comments, approval_context, delegation_id });
    return data;
  },`);

fs.writeFileSync(file, content);


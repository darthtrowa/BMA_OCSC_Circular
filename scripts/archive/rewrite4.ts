import fs from "fs";

const file = "e:/BMA_OCSC_Circular/server/src/routes/workflowRoutes.ts";
let content = fs.readFileSync(file, "utf8");

const startRoute = "/**\r\n * 1. COORDINATOR submits to HR_DIRECTOR (Legacy)";
const endRoute = "/**\r\n * 5. Reject (Send back)";

let startIndex = content.indexOf(startRoute);
if (startIndex === -1) startIndex = content.indexOf("/**\n * 1. COORDINATOR submits to HR_DIRECTOR (Legacy)");

let endIndex = content.indexOf(endRoute);
if (endIndex === -1) endIndex = content.indexOf("/**\n * 5. Reject (Send back)");

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `/**
 * Forward a document (Rank-based routing)
 */
router.post(
  "/forward",
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId, toUserId, comments, approval_context, delegation_id } = forwardSchema.parse(req.body);
      const fromUserId = req.admin!.id;

      await WorkflowService.forward(
        docId, 
        fromUserId, 
        toUserId, 
        comments, 
        approval_context === "ACTING" ? delegation_id : undefined
      );
      
      return res.json({ success: true, message: "Document forwarded successfully" });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

`;
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
}

// Fix schema replacing
content = content.replace(/const submitToHrSchema.*?const rejectSchema =/s, "const forwardSchema = z.object({\n  docId: z.number().int().positive(),\n  toUserId: z.number().int().positive(),\n  comments: z.string().optional().default(''),\n  approval_context: z.enum(['SELF', 'ACTING']).optional().default('SELF'),\n  delegation_id: z.number().int().positive().optional(),\n});\n\nconst rejectSchema =");

// Fix reject route call
content = content.replace(
  /await WorkflowService\.reject\([\s\S]*?\);/,
  `await WorkflowService.reject(
        docId,
        req.admin!.id,
        rejectToUserId!,
        comments,
        approval_context === 'ACTING' ? delegation_id : undefined
      );`
);

// Fix closeWorkflow call
content = content.replace(
  /await WorkflowService\.closeWorkflow\([\s\S]*?\);/,
  `await WorkflowService.closeWorkflow(data.docId, adminId, '');`
);

fs.writeFileSync(file, content);

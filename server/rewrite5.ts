import fs from "fs";

const file = "e:/BMA_OCSC_Circular/server/src/routes/workflowRoutes.ts";
let content = fs.readFileSync(file, "utf8");

// We want to replace the schemas.
// The old schemas start at "const submitToHrSchema" and go until "const rejectSchema = "
const schemaStartStr = "const submitToHrSchema";
const schemaEndStr = "const rejectSchema = ";

const schemaStartIdx = content.indexOf(schemaStartStr);
const schemaEndIdx = content.indexOf(schemaEndStr);

if (schemaStartIdx !== -1 && schemaEndIdx !== -1) {
  content = content.substring(0, schemaStartIdx) +
`const forwardSchema = z.object({
  docId: z.number().int().positive(),
  toUserId: z.number().int().positive(),
  comments: z.string().optional().default(''),
  approval_context: z.enum(['SELF', 'ACTING']).optional().default('SELF'),
  delegation_id: z.number().int().positive().optional(),
});

` + content.substring(schemaEndIdx);
}

// Now replace the legacy endpoints.
const routeStartStr = "/**\r\n * 1. COORDINATOR submits to HR_DIRECTOR (Legacy)";
const routeEndStr = "/**\r\n * 5. Reject (Send back)";

let routeStartIdx = content.indexOf(routeStartStr);
if (routeStartIdx === -1) routeStartIdx = content.indexOf("/**\n * 1. COORDINATOR submits to HR_DIRECTOR (Legacy)");

let routeEndIdx = content.indexOf(routeEndStr);
if (routeEndIdx === -1) routeEndIdx = content.indexOf("/**\n * 5. Reject (Send back)");

if (routeStartIdx !== -1 && routeEndIdx !== -1) {
  content = content.substring(0, routeStartIdx) +
`/**
 * Forward a document (Rank-based routing)
 */
router.post(
  '/forward',
  requireAdmin,
  async (req: AdminRequest, res: Response): Promise<any> => {
    try {
      const { docId, toUserId, comments, approval_context, delegation_id } = forwardSchema.parse(req.body);
      const reviewerId = req.admin!.id;

      let resolvedDelegationId: number | null = null;
      if (approval_context === 'ACTING') {
        if (!delegation_id) {
          return res.status(400).json({ success: false, message: 'ต้องระบุ delegation_id เมื่อลงนามในฐานะรักษาการ' });
        }
        const { rows: delRows } = await db.query(
          \`SELECT delegation_id, delegated_role, assigner_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE\`,
          [delegation_id, reviewerId]
        );
        if (!delRows.length) {
          return res.status(403).json({ success: false, message: 'ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว' });
        }
        resolvedDelegationId = delRows[0].delegation_id;
      }

      await WorkflowService.forward(
        docId, 
        reviewerId, 
        toUserId, 
        comments, 
        resolvedDelegationId
      );
      
      recordAuditLog({
        userId:           reviewerId,
        userName:         req.admin!.name,
        action:           'WORKFLOW_FORWARD',
        targetResource:   'workflow',
        targetId:         String(docId),
        payload:          { docId, toUserId, comments, approval_context },
        ipAddress:        (req.ip as string) || null,
        userAgent:        (req.headers['user-agent'] as string) || null,
        isActing:         approval_context === 'ACTING',
        delegationId:     resolvedDelegationId || undefined
      });

      return res.json({ success: true, message: 'Document forwarded successfully' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

` + content.substring(routeEndIdx);
}

// Fix reject
content = content.replace(
  /await WorkflowService\.reject\([\s\S]*?\);/,
  `await WorkflowService.reject(
        docId,
        reviewerId,
        rejectToUserId!,
        comments,
        resolvedDelegationId
      );`
);

// Fix closeWorkflow (this is in the Close route, let's just make sure it parses correctly)
content = content.replace(
  /await WorkflowService\.closeWorkflow\([\s\S]*?\);/,
  `await WorkflowService.closeWorkflow(data.docId, adminId, '');`
);

fs.writeFileSync(file, content);

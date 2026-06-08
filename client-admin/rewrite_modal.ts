
import fs from "fs";

const file = "e:/BMA_OCSC_Circular/client-admin/src/components/admin/WorkflowActionModal.tsx";
let content = fs.readFileSync(file, "utf8");

const handleSubmitRegex = /const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?setSubmitting\(false\);\n  \};/s;

const newHandleSubmit = `const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (config.requiresUser && !selectedUserId) {
      Swal.fire("Error", "กรุณาเลือกผู้รับมอบหมาย/ผู้รับผิดชอบ", "error");
      return;
    }
    if (showContextSelector && approvalContext === "ACTING" && !selectedDelegationId) {
      Swal.fire("แจ้งเตือน", "กรุณาเลือกตำแหน่งที่ต้องการรักษาการแทน", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const targetUserId = selectedUserId ? Number(String(selectedUserId).split("-")[0]) : 0;

      if (actionType === "reject" || actionType === "actingReject") {
        await workflowApi.reject(
          docId, 
          targetUserId, 
          comments, 
          approvalContext, 
          approvalContext === "ACTING" ? Number(selectedDelegationId) : undefined
        );
      } else {
        // All other actions (submitToHr, submitToGrpLeader, delegate, submitReview, approve, actingApprove) 
        // are now mapped to the universal "forward" rank-based routing method.
        await workflowApi.forward(
          docId,
          targetUserId,
          comments,
          approvalContext,
          approvalContext === "ACTING" ? Number(selectedDelegationId) : undefined,
        );
      }

      Swal.fire("Success", "ดำเนินการสำเร็จ", "success");
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire("Error", error.message || "เกิดข้อผิดพลาด", "error");
    } finally {
      setSubmitting(false);
    }
  };`;

content = content.replace(handleSubmitRegex, newHandleSubmit);

fs.writeFileSync(file, content);


import express, { type Response } from "express";
import { z } from "zod";
import db from "../config/database.js";
import {
	type AdminRequest,
	requireAdmin,
	requireRole,
} from "../middleware/auth.js";
import { DynamicWorkflowService } from "../services/dynamicWorkflowService.js";
import { ParallelWorkflowService } from "../services/parallelWorkflowService.js";
import { WorkflowService } from "../services/workflowService.js";
import { recordAuditLog } from "../utils/auditLogger.js";

interface RejectAssignee {
	a_id: number;
	a_name: string;
	a_position: string;
	a_role: string;
}

const router = express.Router();

// Middleware: All routes require authentication
router.use(requireAdmin);

// Schemas
export const StartWorkflowSchema = z.object({
	docId: z.number(),
});

export const forwardSchema = z.object({
	docId: z.number().int().positive(),
	toUserId: z.number().int().positive(),
	comments: z.string().optional().default(""),
	approval_context: z.enum(["SELF", "ACTING"]).optional().default("SELF"),
	delegation_id: z.number().int().positive().optional(),
});

const rejectSchema = z.object({
	docId: z.number(),
	comments: z.string().optional().default(""),
	rejectToUserId: z.number().optional(), // Required only for reject
	// บริบทการลงนาม: SELF = ตนเอง, ACTING = รักษาการแทน
	approval_context: z.enum(["SELF", "ACTING"]).optional().default("SELF"),
	delegation_id: z.number().int().positive().optional(),
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/workflow/start
// ─────────────────────────────────────────────────────────────
router.post(
	"/start",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const data = StartWorkflowSchema.parse(req.body);
			const adminId = admin.id;

			await WorkflowService.startWorkflow(data.docId, adminId);
			return res.json({
				success: true,
				message: "Workflow started successfully",
			});
		} catch (error) {
			const err = error as Error;
			console.error("Error starting workflow:", err);
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * Forward a document (Rank-based routing)
 */
router.post(
	"/forward",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const { docId, toUserId, comments, approval_context, delegation_id } =
				forwardSchema.parse(req.body);
			const reviewerId = admin.id;

			// ── ACTING context: ตรวจสอบ delegation ก่อน ──────────────────────────
			let resolvedDelegationId: number | null = null;
			if (approval_context === "ACTING") {
				if (!delegation_id) {
					return res.status(400).json({
						success: false,
						message: "ต้องระบุ delegation_id เมื่อลงนามในฐานะรักษาการ",
					});
				}
				// Strict verify: delegation ต้อง active และเป็นของผู้ใช้นี้
				const { rows: delRows } = await db.query(
					`SELECT delegation_id, delegated_role, assigner_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE`,
					[delegation_id, reviewerId],
				);
				if (!delRows.length) {
					return res.status(403).json({
						success: false,
						message: "ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว",
					});
				}
				resolvedDelegationId = delRows[0].delegation_id;
			}

			await WorkflowService.forward(
				docId,
				reviewerId,
				toUserId,
				comments,
				resolvedDelegationId,
			);

			// ── บันทึก audit log พร้อม delegation context ─────────────────────
			recordAuditLog({
				userId: reviewerId,
				userName: admin.name,
				action: "WORKFLOW_FORWARD",
				targetResource: "workflow",
				targetId: String(docId),
				payload: { docId, toUserId, comments, approval_context },
				ipAddress: (req.ip as string) || null,
				userAgent: (req.headers["user-agent"] as string) || null,
				isActing: approval_context === "ACTING",
				delegation_id: resolvedDelegationId || undefined,
			});

			return res.json({
				success: true,
				message: "Document forwarded successfully",
			});
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * 5. Reject review (moves down the chain)
 */
router.post(
	"/reject",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const {
				docId,
				comments,
				rejectToUserId,
				approval_context,
				delegation_id,
			} = rejectSchema.parse(req.body);
			const reviewerId = admin.id;

			if (rejectToUserId === undefined) {
				return res
					.status(400)
					.json({ success: false, message: "rejectToUserId is required" });
			}

			// ── ACTING context: ตรวจสอบ delegation ก่อน ──────────────────────────
			let resolvedDelegationId: number | null = null;
			if (approval_context === "ACTING") {
				if (!delegation_id) {
					return res.status(400).json({
						success: false,
						message: "ต้องระบุ delegation_id เมื่อตีกลับในฐานะรักษาการ",
					});
				}
				const { rows: delRows } = await db.query(
					`SELECT delegation_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE`,
					[delegation_id, reviewerId],
				);
				if (!delRows.length) {
					return res.status(403).json({
						success: false,
						message: "ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว",
					});
				}
				resolvedDelegationId = delRows[0].delegation_id;
			}

			await WorkflowService.reject(
				docId,
				reviewerId,
				rejectToUserId,
				comments,
				resolvedDelegationId,
			);

			// ── บันทึก audit log พร้อม delegation context ─────────────────────
			recordAuditLog({
				userId: reviewerId,
				userName: admin.name,
				action: "WORKFLOW_REJECT",
				targetResource: "workflow",
				targetId: String(docId),
				payload: { docId, comments, rejectToUserId, approval_context },
				ipAddress: (req.ip as string) || null,
				userAgent: (req.headers["user-agent"] as string) || null,
				isActing: approval_context === "ACTING",
				approval_context: approval_context,
				delegation_id: resolvedDelegationId,
			});

			return res.json({ success: true, message: "Rejected successfully" });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * 6. Get Workflow History for a document
 */
router.get("/:docId/history", async (req: AdminRequest, res: Response) => {
	try {
		const docId = parseInt(req.params.docId as string, 10);
		if (Number.isNaN(docId))
			return res.status(400).json({ success: false, message: "Invalid docId" });

		const history = await WorkflowService.getHistory(docId);
		return res.json({ success: true, data: history });
	} catch (error) {
		const err = error as Error;
		return res.status(400).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────
// DYNAMIC WORKFLOW ENDPOINTS
// ─────────────────────────────────────────────────────────────

router.get(
	"/:docId/next-assignees",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const docId = parseInt(req.params.docId as string, 10);
			if (Number.isNaN(docId))
				return res
					.status(400)
					.json({ success: false, message: "Invalid docId" });

			const context = (req.query.context as string) || "SELF";
			const delegationIdStr = req.query.delegationId as string;
			const delegationId = delegationIdStr
				? parseInt(delegationIdStr, 10)
				: undefined;

			const assignees = await WorkflowService.getNextAssignees(
				docId,
				admin.id,
				context === "ACTING" && delegationId ? delegationId : undefined,
			);

			return res.json({ success: true, data: assignees });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

router.get(
	"/:docId/reject-assignees",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const docId = parseInt(req.params.docId as string, 10);
			if (Number.isNaN(docId))
				return res
					.status(400)
					.json({ success: false, message: "Invalid docId" });

			const context = (req.query.context as string) || "SELF";
			const delegationIdStr = req.query.delegationId as string;
			const delegationId = delegationIdStr
				? parseInt(delegationIdStr, 10)
				: undefined;

			const assignees = await WorkflowService.getRejectAssignees(
				docId,
				admin.id,
				admin.role || "",
				context === "ACTING" && delegationId ? delegationId : undefined,
			);

			return res.json({ success: true, data: assignees });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

router.post(
	"/dynamic-approve",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const { docId, nextNodeId, nextOwnerId, comments, delegation_id, paId } =
				req.body;
			const reviewerId = admin.id;

			await DynamicWorkflowService.approve(
				docId,
				reviewerId,
				nextNodeId,
				nextOwnerId,
				comments || "",
				delegation_id,
				paId,
			);
			return res.json({ success: true, message: "ดำเนินการสำเร็จ" });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * POST /api/admin/workflow/close
 * COORDINATOR ปิดงานพิจารณาหนังสือเวียน
 */
router.post(
	"/close",
	requireRole(["COORDINATOR"]),
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const { docId } = z.object({ docId: z.number() }).parse(req.body);
			const coordinatorId = admin.id;
			await WorkflowService.closeWorkflow(docId, coordinatorId, "");
			return res.json({ success: true, message: "ปิดงานสำเร็จ" });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

// ─────────────────────────────────────────────────────────────
// PARALLEL WORKFLOW ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/workflow/parallel-assign
 * COORDINATOR/HR_DIRECTOR มอบให้หลาย Track พร้อมกัน
 */
router.post(
	"/parallel-assign",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const { docId, tracks, approval_context, delegation_id } = req.body;
			if (!docId || !Array.isArray(tracks) || tracks.length === 0) {
				return res.status(400).json({
					success: false,
					message: `ข้อมูลไม่ครบถ้วน: docId=${docId}, tracks_is_array=${Array.isArray(tracks)}, tracks_length=${tracks?.length}`,
				});
			}

			let coordinatorId = admin.id;
			if (approval_context === "ACTING") {
				if (!delegation_id) {
					return res.status(400).json({
						success: false,
						message: "ต้องระบุ delegation_id เมื่อกระจายงานในฐานะรักษาการ",
					});
				}
				const { rows: delRows } = await db.query(
					`SELECT assigner_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE`,
					[delegation_id, admin.id],
				);
				if (!delRows.length) {
					return res.status(403).json({
						success: false,
						message: "ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว",
					});
				}
				coordinatorId = delRows[0].assigner_id;
			}

			const result = await ParallelWorkflowService.assignParallel(
				docId,
				coordinatorId,
				tracks,
			);
			return res.json({
				success: true,
				message: `มอบหมายสำเร็จ (${tracks.length} Track)`,
				data: result,
			});
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * POST /api/admin/workflow/parallel-delegate
 * Owner ใน Track delegate ลงไปยัง subordinate
 */
router.post(
	"/parallel-delegate",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const {
				docId,
				paId,
				toUserId,
				comments,
				approval_context,
				delegation_id,
			} = req.body;
			if (!docId || !paId || !toUserId)
				return res
					.status(400)
					.json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });

			let fromUserId = admin.id;
			if (approval_context === "ACTING") {
				if (!delegation_id) {
					return res.status(400).json({
						success: false,
						message: "ต้องระบุ delegation_id เมื่อมอบหมายในฐานะรักษาการ",
					});
				}
				const { rows: delRows } = await db.query(
					`SELECT assigner_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE`,
					[delegation_id, admin.id],
				);
				if (!delRows.length) {
					return res.status(403).json({
						success: false,
						message: "ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว",
					});
				}
				fromUserId = delRows[0].assigner_id;
			}

			await ParallelWorkflowService.delegateWithinTrack(
				docId,
				paId,
				fromUserId,
				toUserId,
				comments || "",
			);
			return res.json({ success: true, message: "มอบหมายใน Track สำเร็จ" });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * POST /api/admin/workflow/parallel-submit
 * ผู้รับ Track ส่งผลการดำเนินงาน
 */
router.post(
	"/parallel-submit",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const {
				docId,
				paId,
				resultComments,
				resultsId,
				approval_context,
				delegation_id,
			} = req.body;
			if (!docId || !paId)
				return res
					.status(400)
					.json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });

			let userId = admin.id;
			if (approval_context === "ACTING") {
				if (!delegation_id) {
					return res.status(400).json({
						success: false,
						message: "ต้องระบุ delegation_id เมื่อส่งผลในฐานะรักษาการ",
					});
				}
				const { rows: delRows } = await db.query(
					`SELECT assigner_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE`,
					[delegation_id, admin.id],
				);
				if (!delRows.length) {
					return res.status(403).json({
						success: false,
						message: "ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว",
					});
				}
				userId = delRows[0].assigner_id;
			}

			await ParallelWorkflowService.submitTrackResult(
				docId,
				paId,
				userId,
				resultComments || "",
				resultsId ? Number(resultsId) : null,
			);
			return res.json({ success: true, message: "ส่งผลการดำเนินงานสำเร็จ" });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * POST /api/admin/workflow/parallel-save
 * ผู้รับ Track บันทึกความเห็น (แต่ยังไม่ส่งต่อ)
 */
router.post(
	"/parallel-save",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const {
				docId,
				paId,
				resultComments,
				resultsId,
				approval_context,
				delegation_id,
			} = req.body;
			if (!docId || !paId)
				return res
					.status(400)
					.json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });

			let userId = admin.id;
			if (approval_context === "ACTING") {
				if (!delegation_id) {
					return res.status(400).json({
						success: false,
						message: "ต้องระบุ delegation_id เมื่อบันทึกในฐานะรักษาการ",
					});
				}
				const { rows: delRows } = await db.query(
					`SELECT assigner_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE`,
					[delegation_id, admin.id],
				);
				if (!delRows.length) {
					return res.status(403).json({
						success: false,
						message: "ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว",
					});
				}
				userId = delRows[0].assigner_id;
			}

			await ParallelWorkflowService.saveTrackResult(
				docId,
				paId,
				userId,
				resultComments || "",
				resultsId ? Number(resultsId) : null,
			);
			return res.json({ success: true, message: "บันทึกความเห็นสำเร็จ" });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * POST /api/admin/workflow/parallel-reject
 * ผู้รับ Track ตีกลับ (Tracks อื่นทำต่อได้อิสระ)
 */
router.post(
	"/parallel-reject",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const admin = req.admin;
			if (!admin)
				return res
					.status(401)
					.json({ success: false, message: "Unauthorized" });
			const { docId, paId, comments, approval_context, delegation_id } =
				req.body;
			if (!docId || !paId)
				return res
					.status(400)
					.json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });

			let userId = admin.id;
			if (approval_context === "ACTING") {
				if (!delegation_id) {
					return res.status(400).json({
						success: false,
						message: "ต้องระบุ delegation_id เมื่อส่งผลในฐานะรักษาการ",
					});
				}
				const { rows: delRows } = await db.query(
					`SELECT assigner_id
           FROM   c_workflow_delegations
           WHERE  delegation_id = $1
             AND  assignee_id   = $2
             AND  is_active     = TRUE`,
					[delegation_id, admin.id],
				);
				if (!delRows.length) {
					return res.status(403).json({
						success: false,
						message: "ไม่พบการมอบอำนาจที่ถูกต้อง หรือถูกยกเลิกแล้ว",
					});
				}
				userId = delRows[0].assigner_id;
			}

			await ParallelWorkflowService.rejectTrack(
				docId,
				paId,
				userId,
				comments || "",
			);
			return res.json({ success: true, message: "ตีกลับ Track สำเร็จ" });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * GET /api/admin/workflow/:docId/parallel-tracks
 * ดึงสถานะทุก Track ของหนังสือ
 */
router.get(
	"/:docId/parallel-tracks",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const docId = parseInt(req.params.docId as string, 10);
			if (Number.isNaN(docId))
				return res
					.status(400)
					.json({ success: false, message: "Invalid docId" });
			const tracks = await ParallelWorkflowService.getParallelTracks(docId);
			return res.json({ success: true, data: tracks });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

/**
 * POST /api/admin/workflow/simulate
 * stateless workflow simulation
 */
router.post(
	"/simulate",
	requireAdmin,
	async (req: AdminRequest, res: Response) => {
		try {
			const {
				task,
				activeUserId,
				action,
				targetUserId,
				comments,
				delegationId,
				resultsId,
				paId,
			} = req.body;

			if (!task || !activeUserId) {
				return res.status(400).json({
					success: false,
					message: "ข้อมูลไม่ครบถ้วน: ต้องระบุ task และ activeUserId",
				});
			}

			if (action) {
				const result = await WorkflowService.simulateNextAction(
					task,
					Number(activeUserId),
					action,
					{
						targetUserId: targetUserId ? Number(targetUserId) : undefined,
						comments: comments || "",
						delegationId: delegationId ? Number(delegationId) : undefined,
						resultsId: resultsId ? Number(resultsId) : undefined,
						paId: paId ? Number(paId) : undefined,
					},
				);
				return res.json({ success: true, data: result });
			} else {
				const options = await WorkflowService.simulateNextAssignees(
					task,
					Number(activeUserId),
					delegationId ? Number(delegationId) : undefined,
				);

				// Compute reject assignees statelessly using log history
				const history = req.body.history || [];
				const seen = new Set<number>();
				const rejectAssignees: RejectAssignee[] = [];
				for (let i = history.length - 1; i >= 0; i--) {
					const h = history[i];
					const uid = h.from_user_id;
					if (
						uid &&
						Number(uid) !== Number(activeUserId) &&
						!seen.has(Number(uid))
					) {
						seen.add(Number(uid));
						rejectAssignees.push({
							a_id: uid,
							a_name: h.from_user_name,
							a_position: h.from_user_position,
							a_role: h.from_user_role || "ผู้ร่วมทวนทาน",
						});
					}
				}

				return res.json({
					success: true,
					data: {
						autoUpAssignee: options.autoUpAssignee,
						manualAssignees: options.manualAssignees,
						assignedAgencies: options.assignedAgencies,
						useParallelAssign: options.useParallelAssign,
						rejectAssignees,
					},
				});
			}
		} catch (error) {
			const err = error as Error;
			console.error("Simulation error:", err);
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

export default router;

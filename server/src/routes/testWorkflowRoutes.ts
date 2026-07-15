/**
 * testWorkflowRoutes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend orchestration API for the Interactive E2E Real Workflow Tester.
 * SUPERADMIN-only. Uses REAL production services — no mock logic whatsoever.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import express, { type Response } from "express";
import db from "../config/database.js";
import { type AdminRequest, requireSuperAdmin } from "../middleware/auth.js";
import { WorkflowService } from "../services/workflowService.js";

const router = express.Router();

// All routes require authenticated superadmin (test-driving workflow is privileged)
router.use(requireSuperAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/test-workflow/init
// Creates a real DRAFT document and starts the workflow on behalf of the
// given coordinatorId. Returns docId and the initial state snapshot.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/init", async (req: AdminRequest, res: Response) => {
	try {
		const admin = req.admin;
		if (!admin)
			return res.status(401).json({ success: false, message: "Unauthorized" });

		const { coordinatorId } = req.body;
		if (!coordinatorId || Number.isNaN(Number(coordinatorId))) {
			return res
				.status(400)
				.json({ success: false, message: "coordinatorId is required" });
		}

		const coordId = Number(coordinatorId);

		// Verify coordinator exists
		const { rows: coordRows } = await db.query(
			"SELECT a_id, a_name, a_role FROM admin WHERE a_id = $1",
			[coordId],
		);
		if (coordRows.length === 0) {
			return res
				.status(404)
				.json({ success: false, message: `User with id ${coordId} not found` });
		}

		// Get latest year_id from c_year
		const { rows: yearRows } = await db.query(
			"SELECT year_id FROM c_year ORDER BY year_value DESC LIMIT 1",
		);
		if (yearRows.length === 0) {
			return res.status(500).json({
				success: false,
				message: "No year record found in database c_year table",
			});
		}
		const yearId = yearRows[0].year_id;

		// Get next in_ordering
		const { rows: orderRows } = await db.query(
			"SELECT COALESCE(MAX(in_ordering), 0) AS max_val FROM c_information",
		);
		const nextOrdering = Number(orderRows[0].max_val) + 1;

		// Create a minimal, real document in c_information
		const { rows: docRows } = await db.query(
			`INSERT INTO c_information (
          in_detail, in_num_date, in_doc_date, in_workflow_status, in_flow_state,
          in_current_owner_id, in_creator_id, updated_at, created_at,
          in_detail_ag, in_etc, in_link, in_file_mkk, in_circular_detail,
          in_original_link, in_attachment_link, in_qr_link, updated_user,
          in_year_id, in_ordering
        ) VALUES (
          $1, $2, NOW(), 'DRAFT', 'start', $3, $3, NOW(), NOW(),
          '-', '-', '-', '-', '-',
          '-', '-', '-', $4, $5, $6
        ) RETURNING in_id`,
			[
				`[E2E-TEST] ทดสอบ Workflow ${new Date().toLocaleString("th-TH")}`,
				`TEST-${Date.now()}`,
				coordId,
				coordRows[0].a_name || "E2E-Tester",
				yearId,
				nextOrdering,
			],
		);

		const docId: number = docRows[0].in_id;

		// Immediately fetch next assignees from REAL WorkflowService
		let nextAssignees: Record<string, any> | null = null;
		try {
			nextAssignees = (await WorkflowService.getNextAssignees(
				docId,
				coordId,
			)) as any;
		} catch (_e) {
			// Non-fatal; UI will re-fetch
		}

		return res.json({
			success: true,
			data: {
				docId,
				currentUserId: coordId,
				currentUserName: coordRows[0].a_name,
				currentUserRole: coordRows[0].a_role,
				status: "DRAFT",
				flowState: "start",
				nextAssignees,
			},
		});
	} catch (error) {
		const err = error as Error;
		console.error("[test-workflow/init] Error:", err);
		return res.status(500).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/test-workflow/:docId/next-assignees
// Calls the REAL WorkflowService.getNextAssignees() impersonating `asUserId`.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
	"/:docId/next-assignees",
	async (req: AdminRequest, res: Response) => {
		try {
			const docId = parseInt(req.params.docId as string, 10);
			const asUserId = parseInt(req.query.asUserId as string, 10);

			if (Number.isNaN(docId) || Number.isNaN(asUserId)) {
				return res
					.status(400)
					.json({ success: false, message: "docId and asUserId are required" });
			}

			const assignees = await WorkflowService.getNextAssignees(docId, asUserId);
			return res.json({ success: true, data: assignees });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/test-workflow/:docId/reject-assignees
// Calls the REAL WorkflowService.getRejectAssignees() impersonating `asUserId`.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
	"/:docId/reject-assignees",
	async (req: AdminRequest, res: Response) => {
		try {
			const docId = parseInt(req.params.docId as string, 10);
			const asUserId = parseInt(req.query.asUserId as string, 10);
			const asUserRole = (req.query.asUserRole as string) || "";

			if (Number.isNaN(docId) || Number.isNaN(asUserId)) {
				return res
					.status(400)
					.json({ success: false, message: "docId and asUserId are required" });
			}

			const assignees = await WorkflowService.getRejectAssignees(
				docId,
				asUserId,
				asUserRole,
			);
			return res.json({ success: true, data: assignees });
		} catch (error) {
			const err = error as Error;
			return res.status(400).json({ success: false, message: err.message });
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/test-workflow/:docId/status
// Returns the live document + workflow state from the DB.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:docId/status", async (req: AdminRequest, res: Response) => {
	try {
		const docId = parseInt(req.params.docId as string, 10);
		if (Number.isNaN(docId)) {
			return res.status(400).json({ success: false, message: "Invalid docId" });
		}

		const { rows } = await db.query(
			`SELECT
          ci.in_id, ci.in_workflow_status, ci.in_flow_state,
          ci.in_current_owner_id, ci.in_is_parallel,
          a.a_name AS current_owner_name,
          a.a_role AS current_owner_role
        FROM c_information ci
        LEFT JOIN admin a ON a.a_id = ci.in_current_owner_id
        WHERE ci.in_id = $1`,
			[docId],
		);

		if (rows.length === 0) {
			return res
				.status(404)
				.json({ success: false, message: "Document not found" });
		}

		const history = await WorkflowService.getHistory(docId);

		const { rows: assignedAgencies } = await db.query(
			`SELECT ag.ag_id, ag.ag_name, ag.ag_type 
				 FROM c_information_agency ia
				 JOIN c_agency ag ON ia.ag_id = ag.ag_id
				 WHERE ia.in_id = $1`,
			[docId],
		);

		const { rows: parallelTracks } = await db.query(
			`SELECT pa.pa_id, pa.ag_id, pa.ag_name, pa.current_owner_id, pa.pa_status,
                a.a_name AS owner_name, a.a_role AS owner_role
         FROM c_parallel_assignments pa
         LEFT JOIN admin a ON a.a_id = pa.current_owner_id
         WHERE pa.in_id = $1`,
			[docId],
		);

		return res.json({
			success: true,
			data: {
				...rows[0],
				history,
				assignedAgencies,
				parallelTracks,
			},
		});
	} catch (error) {
		const err = error as Error;
		return res.status(400).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/test-workflow/users
// Returns all admin users grouped by role for the user-selector.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/users", async (_req: AdminRequest, res: Response) => {
	try {
		const { rows } = await db.query(
			`SELECT a.a_id, a.a_name, a.a_role, a.a_position, ag.ag_name AS agency_name
         FROM admin a
         LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
         WHERE a.a_role IN ('COORDINATOR','GRP_LEADER','HR_GRP_LEADER','SEC_DIRECTOR','HR_SEC_DIRECTOR','DIV_DIRECTOR','HR_DIRECTOR','STAFF')
         ORDER BY a.a_role, a.a_name`,
		);
		return res.json({ success: true, data: rows });
	} catch (error) {
		const err = error as Error;
		return res.status(500).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/test-workflow/forward
// Calls the REAL WorkflowService.forward() impersonating `fromUserId`.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/forward", async (req: AdminRequest, res: Response) => {
	try {
		const { docId, fromUserId, toUserId, comments } = req.body;
		if (!docId || !fromUserId || !toUserId) {
			return res.status(400).json({
				success: false,
				message: "docId, fromUserId, toUserId required",
			});
		}

		// Update current owner to fromUserId so WorkflowService can validate
		await db.query(
			"UPDATE c_information SET in_current_owner_id = $1 WHERE in_id = $2",
			[fromUserId, docId],
		);

		await WorkflowService.forward(docId, fromUserId, toUserId, comments || "");

		// Fetch fresh status
		const { rows } = await db.query(
			`SELECT ci.in_workflow_status, ci.in_flow_state, ci.in_current_owner_id,
                a.a_name AS current_owner_name, a.a_role AS current_owner_role
         FROM c_information ci
         LEFT JOIN admin a ON a.a_id = ci.in_current_owner_id
         WHERE ci.in_id = $1`,
			[docId],
		);

		return res.json({ success: true, data: rows[0] });
	} catch (error) {
		const err = error as Error;
		return res.status(400).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/test-workflow/reject
// Calls the REAL WorkflowService.reject() impersonating `fromUserId`.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/reject", async (req: AdminRequest, res: Response) => {
	try {
		const { docId, fromUserId, rejectToUserId, comments } = req.body;
		if (!docId || !fromUserId || !rejectToUserId) {
			return res.status(400).json({
				success: false,
				message: "docId, fromUserId, rejectToUserId required",
			});
		}

		// Update current owner to fromUserId
		await db.query(
			"UPDATE c_information SET in_current_owner_id = $1 WHERE in_id = $2",
			[fromUserId, docId],
		);

		await WorkflowService.reject(
			docId,
			fromUserId,
			rejectToUserId,
			comments || "",
		);

		const { rows } = await db.query(
			`SELECT ci.in_workflow_status, ci.in_flow_state, ci.in_current_owner_id,
                a.a_name AS current_owner_name, a.a_role AS current_owner_role
         FROM c_information ci
         LEFT JOIN admin a ON a.a_id = ci.in_current_owner_id
         WHERE ci.in_id = $1`,
			[docId],
		);

		return res.json({ success: true, data: rows[0] });
	} catch (error) {
		const err = error as Error;
		return res.status(400).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/test-workflow/close
// Calls the REAL WorkflowService.closeWorkflow() impersonating `coordinatorId`.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/close", async (req: AdminRequest, res: Response) => {
	try {
		const { docId, coordinatorId, comments } = req.body;
		if (!docId || !coordinatorId) {
			return res
				.status(400)
				.json({ success: false, message: "docId and coordinatorId required" });
		}

		await db.query(
			"UPDATE c_information SET in_current_owner_id = $1 WHERE in_id = $2",
			[coordinatorId, docId],
		);

		await WorkflowService.closeWorkflow(docId, coordinatorId, comments || "");

		return res.json({ success: true, message: "Workflow closed (COMPLETED)" });
	} catch (error) {
		const err = error as Error;
		return res.status(400).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/test-workflow/agencies
// Returns all active agencies for assigning to the E2E-TEST document.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/agencies", async (_req: AdminRequest, res: Response) => {
	try {
		const { rows } = await db.query(
			`SELECT ag_id, ag_name, ag_type 
				 FROM c_agency 
				 WHERE ag_status = 'active' AND parent_ag_id IS NULL
				 ORDER BY agency_ordering ASC, ag_name ASC`,
		);
		return res.json({ success: true, data: rows });
	} catch (error) {
		const err = error as Error;
		return res.status(500).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/test-workflow/assign-agencies
// Links multiple agencies to the E2E-TEST document in c_information_agency.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/assign-agencies", async (req: AdminRequest, res: Response) => {
	try {
		const { docId, agencyIds } = req.body;
		if (!docId || !Array.isArray(agencyIds)) {
			return res
				.status(400)
				.json({ success: false, message: "docId and agencyIds are required" });
		}

		// Clear existing
		await db.query("DELETE FROM c_information_agency WHERE in_id = $1", [
			docId,
		]);

		// Insert new
		for (const agId of agencyIds) {
			await db.query(
				"INSERT INTO c_information_agency (in_id, ag_id) VALUES ($1, $2)",
				[docId, agId],
			);
		}

		return res.json({
			success: true,
			message: "Agencies assigned successfully",
		});
	} catch (error) {
		const err = error as Error;
		return res.status(400).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/test-workflow/parallel-assign
// Invokes ParallelWorkflowService.assignParallel as fromUserId.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/parallel-assign", async (req: AdminRequest, res: Response) => {
	try {
		const { docId, fromUserId, tracks } = req.body;
		if (
			!docId ||
			!fromUserId ||
			!Array.isArray(tracks) ||
			tracks.length === 0
		) {
			return res.status(400).json({
				success: false,
				message: "docId, fromUserId, and tracks are required",
			});
		}

		// Update main doc owner
		await db.query(
			"UPDATE c_information SET in_current_owner_id = $1 WHERE in_id = $2",
			[fromUserId, docId],
		);

		const { ParallelWorkflowService } = await import(
			"../services/parallelWorkflowService.js"
		);

		const result = await ParallelWorkflowService.assignParallel(
			docId,
			fromUserId,
			tracks,
		);

		return res.json({
			success: true,
			message: "Parallel assignment successful",
			data: result,
		});
	} catch (error) {
		const err = error as Error;
		return res.status(400).json({ success: false, message: err.message });
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/test-workflow/cleanup
// Hard-deletes all test records created by /init. Safe: only removes rows
// matching the given docId and marks them for cleanup via subject prefix.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/cleanup", async (req: AdminRequest, res: Response) => {
	try {
		const { docId } = req.body;
		if (!docId || Number.isNaN(Number(docId))) {
			return res
				.status(400)
				.json({ success: false, message: "docId is required" });
		}
		const id = Number(docId);

		// Verify this is a test document (subject starts with [E2E-TEST])
		const { rows: docCheck } = await db.query(
			"SELECT in_detail FROM c_information WHERE in_id = $1",
			[id],
		);
		if (docCheck.length === 0) {
			return res
				.status(404)
				.json({ success: false, message: "Document not found" });
		}
		if (!docCheck[0].in_detail?.startsWith("[E2E-TEST]")) {
			return res.status(403).json({
				success: false,
				message: "Safety guard: cannot cleanup non-test documents",
			});
		}

		// Clean up in order (FK-safe)
		await db.query("DELETE FROM c_parallel_assignments WHERE in_id = $1", [id]);
		await db.query("DELETE FROM c_information_agency WHERE in_id = $1", [id]);
		await db.query("DELETE FROM c_workflow_history WHERE in_id = $1", [id]);
		await db.query("DELETE FROM audit_logs WHERE target_id = $1", [String(id)]);
		await db.query("DELETE FROM c_information WHERE in_id = $1", [id]);

		return res.json({
			success: true,
			message: `Test document #${id} and all related records deleted.`,
		});
	} catch (error) {
		const err = error as Error;
		console.error("[test-workflow/cleanup] Error:", err);
		return res.status(500).json({ success: false, message: err.message });
	}
});

export default router;

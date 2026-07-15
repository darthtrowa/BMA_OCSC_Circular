/** biome-ignore-all lint/suspicious/noExplicitAny: complex database rows and dynamically constructed query results require type flexibility */
import type { PoolClient } from "pg";
import db from "../config/database.js";
import type { WorkflowAction, WorkflowStatus } from "../types/workflow.js";

export interface WorkflowUser {
	a_id: number;
	a_name: string;
	a_role: string;
	a_position: string;
	a_agency_id: number;
	parent_ag_id: number | null;
	ag_type: string;
	is_acting?: boolean;
	delegated_role?: string;
}

export interface SimulatedUser extends WorkflowUser {
	acting_info?: {
		id: number;
		name: string;
		position: string;
	} | null;
}

export interface AssignedAgency {
	ag_id: number;
	ag_name: string;
	div_director_name?: string;
	div_director_position?: string;
}

export interface SimulatedParallelTrack {
	pa_id: number;
	ag_id: number;
	ag_name: string;
	initial_owner_id: number;
	current_owner_id: number;
	pa_status: string;
	result_comments: string;
	results_id: number | null;
	updated_at: string;
}

export interface SimulatedHistoryEntry {
	id: number;
	in_id: number;
	pa_id: number | null;
	from_user_id: number | null;
	from_user_name: string;
	from_user_position: string;
	from_user_role: string;
	to_user_id: number | null;
	to_user_name: string | null;
	to_user_position: string | null;
	to_user_role: string | null;
	action: string;
	comments: string;
	created_at: string;
}

export interface SimulatedTask {
	id: number;
	in_workflow_status: string;
	in_flow_state: string | null;
	in_current_owner_id: number | null;
	in_is_parallel?: boolean;
	agencies?: number[];
	parallel_assignments?: SimulatedParallelTrack[];
}

export interface WorkflowHistoryRow {
	from_user_id: number;
	from_user_name: string;
	from_user_position: string;
	from_user_role: string;
	from_user_is_acting?: boolean;
	from_user_acting_for?: string;
	to_user_id: number | null;
	to_user_agency_id?: number;
	from_user_agency_id?: number;
}

export interface ReturnedAssignee {
	a_id: number;
	a_name: string;
	a_position: string;
	a_role: string;
	isActing: boolean;
	actingFor: string | null;
}

// biome-ignore lint/complexity/noStaticOnlyClass: class is used as namespace and imported across codebase
export class WorkflowService {
	/**
	 * Starts the workflow for an existing document.
	 */
	static async startWorkflow(docId: number, adminId: number): Promise<void> {
		const client = await db.connect();
		try {
			await client.query("BEGIN");
			const { rowCount } = await client.query(
				`UPDATE c_information 
         SET in_workflow_status = $1, in_current_owner_id = $2, in_creator_id = $2
         WHERE in_id = $3`,
				["DRAFT", adminId, docId],
			);
			if (rowCount === 0) throw new Error("Document not found");

			// Log history
			await WorkflowService.addHistory(
				client,
				docId,
				adminId,
				adminId,
				"STARTED",
				"เริ่มกระบวนการเวียนหนังสือ",
			);

			await client.query("COMMIT");
		} catch (e) {
			await client.query("ROLLBACK");
			throw e;
		} finally {
			client.release();
		}
	}

	private static getNextStatus(
		fromRole: string,
		toRole: string,
	): WorkflowStatus {
		if (toRole === "COORDINATOR") return "PENDING_CLOSE";
		if (toRole === "STAFF") return "PENDING_EXECUTION";

		const roleRank: Record<string, number> = {
			STAFF: 1,
			GRP_LEADER: 2,
			SEC_DIRECTOR: 3,
			DIV_DIRECTOR: 4,
			HR_DIRECTOR: 4,
			COORDINATOR: 0,
		};

		const fromRank = roleRank[fromRole] || 0;
		const toRank = roleRank[toRole] || 0;

		if (fromRank > toRank) {
			return "PENDING_DELEGATION";
		} else {
			if (toRole === "GRP_LEADER") return "PENDING_GRP_REVIEW";
			if (toRole === "SEC_DIRECTOR") return "PENDING_SEC_APPROVAL";
			if (toRole === "HR_DIRECTOR") return "PENDING_HR_APPROVAL";
			if (toRole === "DIV_DIRECTOR") return "PENDING_DIRECTOR_APPROVAL";
			return "PENDING_GRP_REVIEW";
		}
	}

	/**
	 * ============================================================
	 * SHARED CORE ROUTING BRAIN — Single Source of Truth
	 * ============================================================
	 * Pure, synchronous function that determines ALL routing state
	 * transitions based solely on role strings.
	 *
	 * READ-ONLY GUARANTEE: This function MUST NEVER call any DB
	 * write operations (.update, .create, .delete). It may only
	 * derive state from its input parameters.
	 *
	 * Used by BOTH the real workflow (forward/reject) and the
	 * Workflow Simulator (simulateNextAction) to guarantee 100%
	 * parity between simulated and real outcomes.
	 * ============================================================
	 */
	static calculateNextRoutingState(
		fromRole: string,
		toRole: string,
		action: "FORWARD" | "REJECT",
		currentFlowState: string | null,
	): {
		newStatus: WorkflowStatus;
		newFlowState: string | null;
		historyAction: WorkflowAction;
	} {
		if (action === "REJECT") {
			// REJECT always sets status to REJECTED.
			// flow_state becomes "out" only if returning to a STAFF member.
			const newFlowState = toRole === "STAFF" ? "out" : currentFlowState;
			return {
				newStatus: "REJECTED",
				newFlowState,
				historyAction: "REJECTED",
			};
		}

		// --- FORWARD action ---
		let newStatus = WorkflowService.getNextStatus(fromRole, toRole);
		let historyAction: WorkflowAction = "APPROVED";
		let newFlowState: string | null = currentFlowState;

		// Override for COORDINATOR as receiver → finalization step
		if (toRole === "COORDINATOR") {
			newStatus = "PENDING_CLOSE";
			historyAction = "FINALIZED";
		}

		// Determine the new in_flow_state based on role transitions
		if (fromRole === "COORDINATOR") {
			newFlowState = "out";
		} else if (fromRole === "HR_DIRECTOR" && toRole === "DIV_DIRECTOR") {
			newFlowState = "in";
		} else if (toRole === "STAFF") {
			newFlowState = "out";
		} else if (fromRole === "STAFF") {
			newFlowState = "out";
		} else if (fromRole === "DIV_DIRECTOR" && toRole === "HR_DIRECTOR") {
			newFlowState = "in";
		}

		return { newStatus, newFlowState, historyAction };
	}

	static async forward(
		docId: number,
		fromUserId: number,
		toUserId: number,
		comments: string,
		fromDelegationId?: number | null,
	) {
		const db = await import("../config/database.js").then((m) => m.default);
		const client = await db.connect();
		try {
			await client.query("BEGIN");

			let currentOwnerId: number | null = fromUserId;
			let delegatedRole = null;
			if (fromDelegationId) {
				const delRes = await client.query(
					"SELECT assigner_id, delegated_role FROM c_workflow_delegations WHERE delegation_id = $1",
					[fromDelegationId],
				);
				if (delRes.rows.length === 0) throw new Error("Delegation not found");
				if (delRes.rows[0].assigner_id) {
					currentOwnerId = delRes.rows[0].assigner_id;
				} else {
					currentOwnerId = null;
					delegatedRole = delRes.rows[0].delegated_role;
				}
			}

			let fromRole = delegatedRole;
			if (currentOwnerId !== null) {
				const fromRes = await client.query(
					`SELECT a.a_role, ag.ag_role 
           FROM admin a 
           LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id 
           WHERE a.a_id = $1`,
					[currentOwnerId],
				);
				if (fromRes.rows.length === 0) throw new Error("User not found");
				fromRole = fromRes.rows[0].ag_role || fromRes.rows[0].a_role;
			}
			if (!fromRole)
				throw new Error("Could not determine role for forward action");

			const toRes = await client.query(
				`SELECT a.a_role, ag.ag_role 
         FROM admin a 
         LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id 
         WHERE a.a_id = $1`,
				[toUserId],
			);
			if (toRes.rows.length === 0) throw new Error("User not found");

			// Resolve delegated role if target is acting under a delegation
			const toDelegationRes = await client.query(
				`SELECT delegated_role FROM c_workflow_delegations 
         WHERE assignee_id = $1 AND is_active = true LIMIT 1`,
				[toUserId],
			);
			let toRole = toRes.rows[0].ag_role || toRes.rows[0].a_role;
			if (toDelegationRes.rows.length > 0) {
				toRole = toDelegationRes.rows[0].delegated_role;
			}
			// --- SHARED CORE: Delegate routing decision to calculateNextRoutingState() ---
			const { newStatus, newFlowState, historyAction: action } =
				WorkflowService.calculateNextRoutingState(fromRole, toRole, "FORWARD", null);

			const docRes = await client.query(
				"SELECT in_is_parallel FROM c_information WHERE in_id = $1",
				[docId],
			);
			const isParallel =
				docRes.rows.length > 0 ? docRes.rows[0].in_is_parallel : false;

			if (isParallel) {
				const paRes = await client.query(
					"SELECT pa_id FROM c_parallel_assignments WHERE in_id = $1 AND current_owner_id = $2 AND pa_status IN ('PENDING', 'IN_PROGRESS')",
					[docId, currentOwnerId],
				);
				if (paRes.rows.length > 0) {
					const paId = paRes.rows[0].pa_id;

					// ในแบบ Parallel เราจะไม่เปลี่ยนแปลง flow_state ของเอกสารหลักระหว่างทาง
					// เพื่อป้องกันไม่ให้การมอบหมายงานใน Track หนึ่งไปกระทบกับสถานะ 'รับเข้า (in)' ของ Track อื่นๆ
					await client.query("COMMIT");

					const { ParallelWorkflowService } = await import(
						"./parallelWorkflowService.js"
					);
					if (
						newFlowState === "in" ||
						toRole === "HR_DIRECTOR" ||
						toRole === "COORDINATOR"
					) {
						await ParallelWorkflowService.submitTrackResult(
							docId,
							paId,
							currentOwnerId as number,
							comments,
						);
					} else {
						await ParallelWorkflowService.delegateWithinTrack(
							docId,
							paId,
							currentOwnerId as number,
							toUserId,
							comments,
						);
					}
					return { success: true };
				}
			}

			let query =
				"UPDATE c_information SET in_workflow_status = $1, in_current_owner_id = $2";
			const params: (string | number | null)[] = [newStatus, toUserId];

			if (newFlowState) {
				query += ", in_flow_state = $3";
				params.push(newFlowState);
			}
			query += ` WHERE in_id = $${params.length + 1}`;
			params.push(docId);

			await client.query(query, params);

			await WorkflowService.addHistory(
				client,
				docId,
				fromUserId,
				toUserId,
				action,
				comments,
				fromDelegationId,
			);

			await client.query("COMMIT");
			return { success: true };
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}

	static async reject(
		docId: number,
		reviewerId: number,
		rejectToUserId: number,
		comments: string,
		delegationId?: number | null,
	) {
		const db = await import("../config/database.js").then((m) => m.default);
		const client = await db.connect();
		try {
			await client.query("BEGIN");

			let currentOwnerId = reviewerId;
			if (delegationId) {
				const delRes = await client.query(
					"SELECT assigner_id FROM c_workflow_delegations WHERE delegation_id = $1",
					[delegationId],
				);
				if (delRes.rows.length > 0 && delRes.rows[0].assigner_id) {
					currentOwnerId = delRes.rows[0].assigner_id;
				}
			}

			const targetUserRes = await client.query(
				`SELECT a.a_role, ag.ag_role 
         FROM admin a 
         LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id 
         WHERE a.a_id = $1`,
				[rejectToUserId],
			);
			if (targetUserRes.rows.length === 0)
				throw new Error("Target user not found");
			const targetRole = targetUserRes.rows[0].ag_role || targetUserRes.rows[0].a_role;

			// --- SHARED CORE: Delegate routing decision to calculateNextRoutingState() ---
			const { newStatus, newFlowState } =
				WorkflowService.calculateNextRoutingState("", targetRole, "REJECT", null);

			const docRes = await client.query(
				"SELECT in_is_parallel FROM c_information WHERE in_id = $1",
				[docId],
			);
			const isParallel =
				docRes.rows.length > 0 ? docRes.rows[0].in_is_parallel : false;

			if (isParallel) {
				const paRes = await client.query(
					"SELECT pa_id FROM c_parallel_assignments WHERE in_id = $1 AND current_owner_id = $2 AND pa_status IN ('PENDING', 'IN_PROGRESS')",
					[docId, currentOwnerId],
				);
				if (paRes.rows.length > 0) {
					const paId = paRes.rows[0].pa_id;

					// ในแบบ Parallel เราจะไม่เปลี่ยนแปลง flow_state ของเอกสารหลักระหว่างการตีกลับภายใน Track
					// เพื่อไม่ให้กระทบกับสถานะ 'รับเข้า (in)' ของ Track อื่นๆ
					await client.query("COMMIT");

					const { ParallelWorkflowService } = await import(
						"./parallelWorkflowService.js"
					);
					if (targetRole === "HR_DIRECTOR" || targetRole === "COORDINATOR") {
						await ParallelWorkflowService.rejectTrack(
							docId,
							paId,
							currentOwnerId as number,
							comments,
						);
					} else {
						await ParallelWorkflowService.delegateWithinTrack(
							docId,
							paId,
							currentOwnerId as number,
							rejectToUserId,
							comments,
						);
					}
					return { success: true };
				}
			}

			let query =
				"UPDATE c_information SET in_workflow_status = $1, in_current_owner_id = $2";
			const params: (string | number | null)[] = [newStatus, rejectToUserId];

			if (newFlowState) {
				query += ", in_flow_state = $3";
				params.push(newFlowState);
			}
			query += ` WHERE in_id = $${params.length + 1}`;
			params.push(docId);

			await client.query(query, params);

			await WorkflowService.addHistory(
				client,
				docId,
				reviewerId,
				rejectToUserId,
				"REJECTED",
				comments,
				delegationId,
			);

			await client.query("COMMIT");
			return { success: true };
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}

	static async closeWorkflow(
		docId: number,
		coordinatorId: number,
		comments: string,
	) {
		const db = await import("../config/database.js").then((m) => m.default);
		const client = await db.connect();
		try {
			await client.query("BEGIN");

			await client.query(
				"UPDATE c_information SET in_workflow_status = $1, in_flow_state = $2 WHERE in_id = $3",
				["COMPLETED", "end", docId],
			);

			await WorkflowService.addHistory(
				client,
				docId,
				coordinatorId,
				null,
				"FINALIZED",
				comments,
			);

			await client.query("COMMIT");
			return { success: true };
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Fetch workflow history for a document
	 */
	static async getHistory(docId: number) {
		const db = await import("../config/database.js").then((m) => m.default);
		const res = await db.query(
			`SELECT
         h.*,
         -- ตรวจว่า from_user กำลังรักษาการแทนใครอยู่ในปัจจุบัน
         d.is_active                          AS from_user_is_acting,
         assigner.a_name                     AS from_user_acting_for,
         assigner.a_position                 AS from_user_acting_for_position,
         fu.a_role                           AS from_user_role,
         fu.a_agency_id                      AS from_user_agency_id
       FROM c_workflow_history h
       LEFT JOIN c_workflow_delegations d
              ON d.assignee_id = h.from_user_id
             AND d.is_active = true
       LEFT JOIN admin assigner
              ON assigner.a_id = d.assigner_id
       LEFT JOIN admin fu
              ON fu.a_id = h.from_user_id
       WHERE h.in_id = $1
       ORDER BY h.created_at ASC`,
			[docId],
		);
		return res.rows;
	}

	/**
	 * Helper to insert history with embedded text
	 */
	private static async addHistory(
		client: PoolClient,
		docId: number,
		fromUserId: number | null,
		toUserId: number | null,
		action: string,
		comments: string,
		fromDelegationId?: number | null,
		toDelegationId?: number | null,
	) {
		let fromName = null,
			fromPos = null;
		let toName = null,
			toPos = null;

		if (fromUserId) {
			const res = await client.query(
				"SELECT a_name, a_position, a_role FROM admin WHERE a_id = $1",
				[fromUserId],
			);
			if (res.rows.length > 0) {
				fromName = res.rows[0].a_name;
				fromPos = res.rows[0].a_position || res.rows[0].a_role;

				if (fromDelegationId) {
					const delRes = await client.query(
						"SELECT assigner_id, assigner_ag_id FROM c_workflow_delegations WHERE delegation_id = $1",
						[fromDelegationId],
					);
					if (delRes.rows.length > 0) {
						if (delRes.rows[0].assigner_id) {
							const assignerRes = await client.query(
								"SELECT a_name FROM admin WHERE a_id = $1",
								[delRes.rows[0].assigner_id],
							);
							if (assignerRes.rows.length > 0) {
								fromName = `${fromName} (รักษาการแทน ${assignerRes.rows[0].a_name})`;
							}
						} else if (delRes.rows[0].assigner_ag_id) {
							const agRes = await client.query(
								"SELECT ag_name FROM c_agency WHERE ag_id = $1",
								[delRes.rows[0].assigner_ag_id],
							);
							if (agRes.rows.length > 0) {
								fromName = `${fromName} (รักษาการแทน ${agRes.rows[0].ag_name})`;
							}
						}
					}
				}
			}
		}

		if (toUserId) {
			const res = await client.query(
				"SELECT a_name, a_position, a_role FROM admin WHERE a_id = $1",
				[toUserId],
			);
			if (res.rows.length > 0) {
				toName = res.rows[0].a_name;
				toPos = res.rows[0].a_position || res.rows[0].a_role;

				if (toDelegationId) {
					const delRes = await client.query(
						"SELECT assigner_id, assigner_ag_id FROM c_workflow_delegations WHERE delegation_id = $1",
						[toDelegationId],
					);
					if (delRes.rows.length > 0) {
						if (delRes.rows[0].assigner_id) {
							const assignerRes = await client.query(
								"SELECT a_name FROM admin WHERE a_id = $1",
								[delRes.rows[0].assigner_id],
							);
							if (assignerRes.rows.length > 0) {
								toName = `${toName} (รักษาการแทน ${assignerRes.rows[0].a_name})`;
							}
						} else if (delRes.rows[0].assigner_ag_id) {
							const agRes = await client.query(
								"SELECT ag_name FROM c_agency WHERE ag_id = $1",
								[delRes.rows[0].assigner_ag_id],
							);
							if (agRes.rows.length > 0) {
								toName = `${toName} (รักษาการแทน ${agRes.rows[0].ag_name})`;
							}
						}
					}
				}
			}
		}

		await client.query(
			`INSERT INTO c_workflow_history (
        in_id, from_user_id, from_user_name, from_user_position,
        to_user_id, to_user_name, to_user_position, action, comments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				docId,
				fromUserId,
				fromName,
				fromPos,
				toUserId,
				toName,
				toPos,
				action,
				comments,
			],
		);
	}

	/**
	 * Smart Auto-Routing logic to find next assignees
	 */
	static async getNextAssignees(
		docId: number,
		currentUserId: number,
		delegationId?: number,
	) {
		const db = await import("../config/database.js").then((m) => m.default);

		// Fetch in_flow_state
		const docRes = await db.query(
			"SELECT in_flow_state FROM c_information WHERE in_id = $1",
			[docId],
		);
		const flowState =
			docRes.rows.length > 0 ? docRes.rows[0].in_flow_state : null;

		// 1. Get effective user ID
		let effectiveUserId = currentUserId;
		let delegatedUser: WorkflowUser | null = null;

		if (delegationId) {
			const delRes = await db.query(
				"SELECT assigner_id, delegated_role, assigner_ag_id FROM c_workflow_delegations WHERE delegation_id = $1",
				[delegationId],
			);
			if (delRes.rows.length > 0) {
				const delRow = delRes.rows[0];
				if (delRow.assigner_id) {
					effectiveUserId = delRow.assigner_id;
				} else if (delRow.delegated_role && delRow.assigner_ag_id) {
					// Vacant position delegation: simulate the user
					const agRes = await db.query(
						"SELECT parent_ag_id, ag_type FROM c_agency WHERE ag_id = $1",
						[delRow.assigner_ag_id],
					);
					if (agRes.rows.length > 0) {
						delegatedUser = {
							a_id: -1, // fake ID
							a_name: "รักษาการตำแหน่งว่าง",
							a_role: delRow.delegated_role,
							a_position: "รักษาการ",
							a_agency_id: delRow.assigner_ag_id,
							parent_ag_id: agRes.rows[0].parent_ag_id,
							ag_type: agRes.rows[0].ag_type,
						};
					}
				}
			}
		}

		let user: WorkflowUser;
		if (delegatedUser) {
			user = delegatedUser;
		} else {
			const userRes = await db.query(
				`
        SELECT a.a_id, a.a_name, COALESCE(ag.ag_role, a.a_role) AS a_role, 
               COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position,
               a.a_agency_id, ag.parent_ag_id, ag.ag_type
        FROM admin a
        LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
        WHERE a.a_id = $1
      `,
				[effectiveUserId],
			);

			if (userRes.rows.length === 0) throw new Error("User not found");
			user = userRes.rows[0];
		}

		const roleRank: Record<string, number> = {
			STAFF: 1,
			COORDINATOR: 1,
			GRP_LEADER: 2,
			SEC_DIRECTOR: 3,
			DIV_DIRECTOR: 4,
			HR_DIRECTOR: 4,
		};
		const currentRank = roleRank[user.a_role] ?? 0;

		const allUsersRes = await db.query(
			`
      SELECT a.a_id, a.a_name, COALESCE(ag.ag_role, a.a_role) AS a_role, 
             COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position,
             a.a_agency_id, ag.parent_ag_id, ag.ag_name, ag.ag_type
      FROM admin a
      LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
      WHERE COALESCE(ag.ag_role, a.a_role) IN ('HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF', 'COORDINATOR')
        AND a.a_id != $1
    `,
			[effectiveUserId],
		);

		const allUsers = allUsersRes.rows;

		let autoUpAssignee = null;
		let manualAssignees: WorkflowUser[] = [];

		if (user.a_role === "COORDINATOR") {
			const groupAgencyId =
				user.ag_type === "POSITION" ? user.parent_ag_id : user.a_agency_id;
			if (groupAgencyId) {
				// Query group's normal GRP_LEADERs
				const grpRes = await db.query(
					`
          SELECT a.a_id, a.a_name, a.a_role, 
                 COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position,
                 a.a_agency_id, ag.parent_ag_id, ag.ag_type
          FROM admin a
          LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
          WHERE a.a_role = 'GRP_LEADER' AND (a.a_agency_id = $1 OR ag.parent_ag_id = $1)
        `,
					[groupAgencyId],
				);

				const grpLeaders = grpRes.rows as WorkflowUser[];
				if (grpLeaders.length > 0) {
					autoUpAssignee = grpLeaders[0];
				}

				// Query active GRP_LEADER delegations in this group
				const actingRes = await db.query(
					`
          SELECT d.delegation_id, d.assignee_id as a_id, a.a_name, a.a_role, 
                 a.a_position, a.a_agency_id, ag.parent_ag_id, ag.ag_type,
                 true as is_acting, d.delegated_role
          FROM c_workflow_delegations d
          JOIN admin a ON a.a_id = d.assignee_id
          LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
          WHERE d.delegated_role = 'GRP_LEADER' 
            AND d.is_active = true
            AND (d.assigner_id IN (SELECT a_id FROM admin WHERE a_agency_id = $1 OR (SELECT parent_ag_id FROM c_agency WHERE ag_id = a.a_agency_id) = $1)
                 OR d.assigner_ag_id IN (SELECT ag_id FROM c_agency WHERE parent_ag_id = $1 OR ag_id = $1))
        `,
					[groupAgencyId],
				);

				const actingGrpLeaders = actingRes.rows as WorkflowUser[];

				const seenIds = new Set<number>();
				const finalManual: WorkflowUser[] = [];
				for (const u of grpLeaders) {
					if (!seenIds.has(u.a_id)) {
						seenIds.add(u.a_id);
						finalManual.push(u);
					}
				}
				for (const u of actingGrpLeaders) {
					if (!seenIds.has(u.a_id)) {
						seenIds.add(u.a_id);
						finalManual.push(u);
					}
				}
				manualAssignees = finalManual;
			}
		} else if (user.a_role === "GRP_LEADER") {
			if (flowState !== "in") {
				// 1. Resolve Auto-Up structural supervisor (own SEC_DIRECTOR, DIV_DIRECTOR, or HR_DIRECTOR)
				let currentLookupAgency = user.a_agency_id;
				let foundSupervisor = null;
				while (currentLookupAgency) {
					const higherRankUsers = allUsers.filter(
						(u) =>
							(u.a_agency_id === currentLookupAgency ||
								(u.parent_ag_id === currentLookupAgency &&
									u.ag_type === "POSITION")) &&
							(u.a_role === "SEC_DIRECTOR" ||
								u.a_role === "DIV_DIRECTOR" ||
								u.a_role === "HR_DIRECTOR"),
					);

					if (higherRankUsers.length > 0) {
						higherRankUsers.sort(
							(a, b) => (roleRank[a.a_role] ?? 0) - (roleRank[b.a_role] ?? 0),
						);
						foundSupervisor = higherRankUsers[0];
						break;
					}

					const parentRes = await db.query(
						"SELECT parent_ag_id FROM c_agency WHERE ag_id = $1",
						[currentLookupAgency],
					);
					if (parentRes.rows.length === 0 || !parentRes.rows[0].parent_ag_id) {
						break;
					}
					currentLookupAgency = parentRes.rows[0].parent_ag_id;
				}
				autoUpAssignee = foundSupervisor;

				// 2. Resolve manualAssignees:
				// (a) All DIV_DIRECTORs and HR_DIRECTORs (for cross-agency/upward)
				const directorsRes = await db.query(`
          SELECT a.a_id, a.a_name, a.a_role, 
                 COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position,
                 a.a_agency_id, ag.parent_ag_id, ag.ag_type
          FROM admin a
          LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
          WHERE a.a_role IN ('DIV_DIRECTOR', 'HR_DIRECTOR')
        `);
				const directors = directorsRes.rows as WorkflowUser[];

				// (b) Active delegations for HR_DIRECTOR and DIV_DIRECTOR
				const actingRes = await db.query(`
          SELECT d.delegation_id, d.assignee_id as a_id, a.a_name, a.a_role, 
                 a.a_position, a.a_agency_id, ag.parent_ag_id, ag.ag_type,
                 true as is_acting, d.delegated_role, d.assigner_id, d.assigner_ag_id
          FROM c_workflow_delegations d
          JOIN admin a ON a.a_id = d.assignee_id
          LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
          WHERE d.delegated_role IN ('DIV_DIRECTOR', 'HR_DIRECTOR') 
            AND d.is_active = true
        `);
				const actingDirectors = actingRes.rows as WorkflowUser[];

				// Filter list to only show their own direct division head (and acting heads)
				let finalDirectors = directors;
				let finalActingDirectors = actingDirectors;
				if (foundSupervisor) {
					finalDirectors = directors.filter((d) => d.a_id === foundSupervisor.a_id);
					finalActingDirectors = actingDirectors.filter((d: any) => 
						d.assigner_id === foundSupervisor.a_id ||
						(foundSupervisor.a_agency_id && d.assigner_ag_id === foundSupervisor.a_agency_id)
					);
				}

				const seenIds = new Set<number>();
				const finalManual: WorkflowUser[] = [];
				for (const u of finalDirectors) {
					if (!seenIds.has(u.a_id)) {
						seenIds.add(u.a_id);
						finalManual.push(u);
					}
				}
				for (const u of finalActingDirectors) {
					if (!seenIds.has(u.a_id)) {
						seenIds.add(u.a_id);
						finalManual.push(u);
					}
				}
				manualAssignees = finalManual;
			} else {
				// flowState === "in": GRP_LEADER sends to STAFF/COORDINATOR subordinates
				const groupAgencyId =
					user.ag_type === "POSITION" ? user.parent_ag_id : user.a_agency_id;
				let subordinates: WorkflowUser[] = [];
				if (groupAgencyId) {
					const descRes = await db.query(
						`
            WITH RECURSIVE agency_tree AS (
              SELECT ag_id FROM c_agency WHERE parent_ag_id = $1 OR ag_id = $1
              UNION ALL
              SELECT a.ag_id FROM c_agency a
              INNER JOIN agency_tree t ON a.parent_ag_id = t.ag_id
            )
            SELECT ag_id FROM agency_tree
          `,
						[groupAgencyId],
					);
					const childAgencyIds = descRes.rows.map((r) => Number(r.ag_id));
					subordinates = allUsers.filter(
						(u) =>
							childAgencyIds.includes(Number(u.a_agency_id)) &&
							(u.a_role === "STAFF" || u.a_role === "COORDINATOR"),
					) as WorkflowUser[];
				}

				if (subordinates.length > 0) {
					const coords = subordinates.filter(u => u.a_role === "COORDINATOR");
					autoUpAssignee = coords.length > 0 ? coords[0] : subordinates[0];
				}

				// Query active delegations for COORDINATOR/STAFF
				const actingRes = await db.query(`
          SELECT d.delegation_id, d.assignee_id as a_id, a.a_name, a.a_role, 
                 a.a_position, a.a_agency_id, ag.parent_ag_id, ag.ag_type,
                 true as is_acting, d.delegated_role
          FROM c_workflow_delegations d
          JOIN admin a ON a.a_id = d.assignee_id
          LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
          WHERE d.delegated_role IN ('STAFF', 'COORDINATOR') 
            AND d.is_active = true
        `);
				const actingSubordinates = actingRes.rows as WorkflowUser[];

				const seenIds = new Set<number>();
				const finalManual: WorkflowUser[] = [];
				for (const u of subordinates) {
					if (!seenIds.has(u.a_id)) {
						seenIds.add(u.a_id);
						finalManual.push(u);
					}
				}
				for (const u of actingSubordinates) {
					if (!seenIds.has(u.a_id)) {
						seenIds.add(u.a_id);
						finalManual.push(u);
					}
				}
				manualAssignees = finalManual;
			}
		} else {
			// Auto UP Logic: Traverse up the tree starting from the user's CURRENT agency
			if (flowState !== "in") {
				let currentLookupAgency = user.a_agency_id;
				while (currentLookupAgency) {
					const higherRankUsers = allUsers.filter(
						(u) =>
							(u.a_agency_id === currentLookupAgency ||
								(u.parent_ag_id === currentLookupAgency &&
									u.ag_type === "POSITION")) &&
							(roleRank[u.a_role] ?? 0) > currentRank,
					);

					if (higherRankUsers.length > 0) {
						higherRankUsers.sort(
							(a, b) => (roleRank[a.a_role] ?? 0) - (roleRank[b.a_role] ?? 0),
						);
						autoUpAssignee = higherRankUsers[0];
						break;
					}

					const parentRes = await db.query(
						"SELECT parent_ag_id FROM c_agency WHERE ag_id = $1",
						[currentLookupAgency],
					);
					if (parentRes.rows.length === 0 || !parentRes.rows[0].parent_ag_id) {
						break;
					}
					currentLookupAgency = parentRes.rows[0].parent_ag_id;
				}
			}

			// Manual Logic (Cross or Down)
			// Fetch descendant agencies for Forward Down
			const startAgencyId =
				user.ag_type === "POSITION" && user.parent_ag_id
					? user.parent_ag_id
					: user.a_agency_id;

			const descRes = await db.query(
				`
        WITH RECURSIVE agency_tree AS (
          SELECT ag_id FROM c_agency WHERE parent_ag_id = $1 OR ag_id = $1
          UNION ALL
          SELECT a.ag_id FROM c_agency a
          INNER JOIN agency_tree t ON a.parent_ag_id = t.ag_id
        )
        SELECT ag_id FROM agency_tree
      `,
				[startAgencyId],
			);
			const childAgencyIds = descRes.rows.map((r) =>
				Number((r as { ag_id: number }).ag_id),
			);

			// Fetch parent mapping and types of all agencies for SEC_DIRECTOR filter logic
			const agencyParentsRes = await db.query(
				"SELECT ag_id, parent_ag_id, ag_type FROM c_agency",
			);
			const parentMap = new Map<number, number | null>();
			const typeMap = new Map<number, string>();
			for (const row of agencyParentsRes.rows) {
				parentMap.set(
					Number(row.ag_id),
					row.parent_ag_id ? Number(row.parent_ag_id) : null,
				);
				typeMap.set(Number(row.ag_id), row.ag_type);
			}

			// Identify all agencies headed by a SEC_DIRECTOR
			const secDirectorAgencies = new Set<number>();
			for (const u of allUsers) {
				if (u.a_role === "SEC_DIRECTOR") {
					const actualAgId =
						u.ag_type === "POSITION" ? u.parent_ag_id : u.a_agency_id;
					if (actualAgId) secDirectorAgencies.add(Number(actualAgId));
				}
			}
			if (user.a_role === "SEC_DIRECTOR") {
				const actualAgId =
					user.ag_type === "POSITION" ? user.parent_ag_id : user.a_agency_id;
				if (actualAgId) secDirectorAgencies.add(Number(actualAgId));
			}

			manualAssignees = allUsers.filter((u) => {
				const uRank = roleRank[u.a_role] ?? 0;

				if (flowState === "out") {
					if (user.a_role === "DIV_DIRECTOR") {
						return u.a_role === "HR_DIRECTOR";
					} else if (user.a_role === "HR_DIRECTOR") {
						if (uRank < currentRank) return false;
					} else {
						if (uRank <= currentRank) return false;
					}
				} else if (flowState === "in") {
					if (uRank >= currentRank) return false;
				}

				// 1. Cross-Agency Forwarding (Only Rank 4 to Rank 4)
				let isMatch = false;
				if (currentRank === 4 && uRank === 4) {
					isMatch = true;
				}

				// 2. Forward Down (Must be within own or child agencies)
				if (childAgencyIds.includes(Number(u.a_agency_id))) {
					if (uRank < currentRank) {
						isMatch = true;
					}
				}

				if (!isMatch) return false;

				// Filter out users under a SEC_DIRECTOR, unless they are a GRP_LEADER at structural level 2 (โครงสร้างส่วนราชการลำดับที่ 2)
				const uActualAgId =
					u.ag_type === "POSITION" ? u.parent_ag_id : u.a_agency_id;
				if (uActualAgId) {
					let curr = Number(uActualAgId);
					const path: number[] = [];
					while (curr) {
						path.push(curr);
						const parent = parentMap.get(curr);
						if (!parent) break;
						curr = parent;
					}

					const isUnderSecDirector =
						u.a_role !== "SEC_DIRECTOR" &&
						path.some((agId) => secDirectorAgencies.has(agId));
					if (isUnderSecDirector) {
						// Only allow GRP_LEADER if the current user is the SEC_DIRECTOR directly supervising them
						const parentAgId = parentMap.get(Number(uActualAgId));
						if (
							u.a_role === "GRP_LEADER" &&
							user.a_role === "SEC_DIRECTOR" &&
							parentAgId === startAgencyId
						) {
							return true;
						}
						return false;
					}
				}

				return true;
			});
		}

		// Acting Delegation injection
		const processActing = async (
			targetUser: WorkflowUser | null,
		): Promise<SimulatedUser | null> => {
			if (!targetUser) return null;
			const actingRes = await db.query(
				`
        SELECT d.delegation_id, d.assignee_id, a.a_name as acting_name, a.a_position as acting_position, a.a_role as acting_role
        FROM c_workflow_delegations d
        JOIN admin a ON a.a_id = d.assignee_id
        WHERE (d.assigner_id = $1 OR (d.assigner_id IS NULL AND d.assigner_ag_id = $2)) AND d.is_active = true
      `,
				[targetUser.a_id, targetUser.a_agency_id],
			);

			if (actingRes.rows.length > 0) {
				const acting = actingRes.rows[0];
				return {
					...targetUser,
					acting_info: {
						id: acting.assignee_id,
						name: acting.acting_name,
						position: acting.acting_position,
					},
				};
			}
			return targetUser;
		};

		// Do not process acting on autoUpAssignee, keeping actual GRP_LEADER/HR_DIRECTOR as Auto-Up recommended
		const finalManualAssignees: SimulatedUser[] = [];
		for (const u of manualAssignees) {
			const acted = await processActing(u);
			if (acted) finalManualAssignees.push(acted);
		}

		// Sort manualAssignees by rank descending
		finalManualAssignees.sort(
			(a, b) => (roleRank[b.a_role] ?? 0) - (roleRank[a.a_role] ?? 0),
		);

		// Fetch assigned agencies for this document
		const assignedAgenciesRes = await db.query(
			`
      SELECT ag.ag_id, ag.ag_name 
      FROM c_information_agency ia
      JOIN c_agency ag ON ag.ag_id = ia.ag_id
      WHERE ia.in_id = $1
    `,
			[docId],
		);

		const assignedAgencies = assignedAgenciesRes.rows;

		// Enhance each agency with its actual DIV_DIRECTOR or acting DIV_DIRECTOR
		for (const ag of assignedAgencies) {
			const fallbackRes = await db.query(
				`SELECT a.a_id, a.a_name, a.a_position, a.a_role 
         FROM admin a
         LEFT JOIN c_agency ca ON a.a_agency_id = ca.ag_id
         WHERE a.a_status IN ('1', 'true', 'active') 
           AND (a.a_agency_id = $1 OR ca.parent_ag_id = $1) 
           AND a.a_role IN ('DIV_DIRECTOR', 'HR_DIRECTOR') 
         ORDER BY a.a_role ASC 
         LIMIT 1`,
				[ag.ag_id],
			);

			if (fallbackRes.rows.length > 0) {
				ag.div_director_name = fallbackRes.rows[0].a_name;
				ag.div_director_position =
					fallbackRes.rows[0].a_position || fallbackRes.rows[0].a_role;
			} else {
				const actingFallbackRes = await db.query(
					`SELECT d.assignee_id, a.a_name, a.a_position, a.a_role 
           FROM c_workflow_delegations d
           JOIN admin a ON d.assignee_id = a.a_id
           LEFT JOIN c_agency ca ON d.assigner_ag_id = ca.ag_id
           WHERE (d.assigner_ag_id = $1 OR ca.parent_ag_id = $1)
             AND d.delegated_role = 'DIV_DIRECTOR' 
             AND d.is_active = TRUE 
           ORDER BY d.delegation_order ASC 
           LIMIT 1`,
					[ag.ag_id],
				);
				if (actingFallbackRes.rows.length > 0) {
					ag.div_director_name = `${actingFallbackRes.rows[0].a_name} (รักษาการแทน)`;
					ag.div_director_position =
						actingFallbackRes.rows[0].a_position ||
						actingFallbackRes.rows[0].a_role;
				}
			}
		}
		let useParallelAssign = false;
		if (user.a_role === "HR_DIRECTOR" && flowState === "out") {
			if (assignedAgencies.length > 1) {
				useParallelAssign = true;
			} else if (assignedAgencies.length === 1) {
				const ag = assignedAgencies[0];
				const fallbackRes = await db.query(
					`SELECT a.a_id, a.a_name, a.a_position, a.a_role, a.a_agency_id, ca.parent_ag_id, ca.ag_name, ca.ag_type
           FROM admin a
           LEFT JOIN c_agency ca ON a.a_agency_id = ca.ag_id
           WHERE a.a_status IN ('1', 'true', 'active') 
             AND (a.a_agency_id = $1 OR ca.parent_ag_id = $1) 
             AND a.a_role IN ('DIV_DIRECTOR', 'HR_DIRECTOR') 
           ORDER BY a.a_role ASC 
           LIMIT 1`,
					[ag.ag_id],
				);

				let targetUser = null;
				if (fallbackRes.rows.length > 0) {
					targetUser = fallbackRes.rows[0];
				} else {
					const actingFallbackRes = await db.query(
						`SELECT d.assignee_id, a.a_name, a.a_position, a.a_role, a.a_agency_id, ca.parent_ag_id, ca.ag_name, ca.ag_type
             FROM c_workflow_delegations d
             JOIN admin a ON d.assignee_id = a.a_id
             LEFT JOIN c_agency ca ON d.assigner_ag_id = ca.ag_id
             WHERE (d.assigner_ag_id = $1 OR ca.parent_ag_id = $1)
               AND d.delegated_role = 'DIV_DIRECTOR' 
               AND d.is_active = TRUE 
             ORDER BY d.delegation_order ASC 
             LIMIT 1`,
						[ag.ag_id],
					);
					if (actingFallbackRes.rows.length > 0) {
						targetUser = actingFallbackRes.rows[0];
					}
				}

				if (targetUser) {
					autoUpAssignee = await processActing(targetUser);
				}
			}
		}

		return {
			autoUpAssignee,
			manualAssignees: finalManualAssignees,
			assignedAgencies,
			useParallelAssign,
		};
	}

	/**
	 * Determine valid assignees when rejecting/returning work.
	 */
	static async getRejectAssignees(
		docId: number,
		currentUserId: number,
		currentUserRole: string,
		delegationId?: number,
	) {
		const db = await import("../config/database.js").then((m) => m.default);
		let effectiveUserId = currentUserId;
		let effectiveRole = currentUserRole;
		let effectiveAgencyId: number | null = null;
		let effectiveParentAgId: number | null = null;
		let effectiveAgType: string | null = null;

		if (delegationId) {
			const delRes = await db.query(
				"SELECT assigner_id FROM c_workflow_delegations WHERE delegation_id = $1",
				[delegationId],
			);
			if (delRes.rows.length > 0) {
				effectiveUserId = delRes.rows[0].assigner_id;
			}
		}

		const userRes = await db.query(
			`
      SELECT a.a_role, a.a_agency_id, ag.parent_ag_id, ag.ag_type
      FROM admin a
      LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
      WHERE a.a_id = $1
    `,
			[effectiveUserId],
		);

		if (userRes.rows.length > 0) {
			effectiveRole = userRes.rows[0].a_role;
			effectiveAgencyId = userRes.rows[0].a_agency_id;
			effectiveParentAgId = userRes.rows[0].parent_ag_id;
			effectiveAgType = userRes.rows[0].ag_type;
		}

		const history = (await WorkflowService.getHistory(
			docId,
		)) as unknown as WorkflowHistoryRow[];
		if (!history || history.length === 0) return [];

		const targetRoles = [
			"GRP_LEADER",
			"SEC_DIRECTOR",
			"DIV_DIRECTOR",
			"HR_DIRECTOR",
		];

		const formatUser = (h: WorkflowHistoryRow): ReturnedAssignee => ({
			a_id: h.from_user_id,
			a_name: h.from_user_name,
			a_position: h.from_user_position,
			a_role: h.from_user_role || "ผู้ดำเนินการก่อนหน้า",
			isActing: h.from_user_is_acting === true,
			actingFor: h.from_user_acting_for || null,
		});

		if (targetRoles.includes(effectiveRole)) {
			const startAgencyId =
				effectiveAgType === "POSITION" && effectiveParentAgId
					? effectiveParentAgId
					: effectiveAgencyId;

			const descRes = await db.query(
				`
        WITH RECURSIVE agency_tree AS (
          SELECT ag_id FROM c_agency WHERE parent_ag_id = $1 OR ag_id = $1
          UNION ALL
          SELECT a.ag_id FROM c_agency a
          INNER JOIN agency_tree t ON a.parent_ag_id = t.ag_id
        )
        SELECT ag_id FROM agency_tree
      `,
				[startAgencyId],
			);
			const childAgencyIds = descRes.rows.map((r) =>
				Number((r as { ag_id: number }).ag_id),
			);

			const seen = new Set<number>();
			const assignees: ReturnedAssignee[] = [];

			for (let i = history.length - 1; i >= 0; i--) {
				const h = history[i];
				const uid = Number(h.from_user_id);
				if (!uid || uid === Number(effectiveUserId) || seen.has(uid)) continue;

				if (["STAFF", "COORDINATOR"].includes(h.from_user_role)) {
					if (childAgencyIds.includes(Number(h.from_user_agency_id))) {
						seen.add(uid);
						assignees.push(formatUser(h));
					}
				}
			}
			return assignees;
		} else {
			const myLastReceive = [...history]
				.reverse()
				.find((h) => Number(h.to_user_id) === Number(effectiveUserId));
			if (myLastReceive?.from_user_id) {
				return [formatUser(myLastReceive)];
			}

			const seen = new Set<number>();
			const assignees: ReturnedAssignee[] = [];
			for (let i = history.length - 1; i >= 0; i--) {
				const h = history[i];
				const uid = Number(h.from_user_id);
				if (!uid || uid === Number(effectiveUserId) || seen.has(uid)) continue;
				seen.add(uid);
				assignees.push(formatUser(h));
			}
			return assignees;
		}
	}
}

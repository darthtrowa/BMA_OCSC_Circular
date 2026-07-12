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
					"SELECT a_role FROM admin WHERE a_id = $1",
					[currentOwnerId],
				);
				if (fromRes.rows.length === 0) throw new Error("User not found");
				fromRole = fromRes.rows[0].a_role;
			}
			if (!fromRole)
				throw new Error("Could not determine role for forward action");

			const toRes = await client.query(
				"SELECT a_role FROM admin WHERE a_id = $1",
				[toUserId],
			);
			if (toRes.rows.length === 0) throw new Error("User not found");

			const toRole = toRes.rows[0].a_role;
			let newStatus = WorkflowService.getNextStatus(fromRole, toRole);
			let action: WorkflowAction = "APPROVED";
			let newFlowState: string | null = null;

			if (toRole === "COORDINATOR") {
				newStatus = "PENDING_CLOSE";
				action = "FINALIZED";
			}

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
				"SELECT a_role FROM admin WHERE a_id = $1",
				[rejectToUserId],
			);
			if (targetUserRes.rows.length === 0)
				throw new Error("Target user not found");
			const targetRole = targetUserRes.rows[0].a_role;

			const newStatus: WorkflowStatus = "REJECTED";

			let newFlowState: string | null = null;
			if (targetRole === "STAFF") {
				newFlowState = "out";
			}

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
        SELECT a.a_id, a.a_name, a.a_role, 
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
      SELECT a.a_id, a.a_name, a.a_role, 
             COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position,
             a.a_agency_id, ag.parent_ag_id, ag.ag_name, ag.ag_type
      FROM admin a
      LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
      WHERE a.a_role IN ('HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF', 'COORDINATOR')
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
                 a.a_position, a.a_agency_id, ag.parent_ag_id, ag.ag_type
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
			// Find HR_DIRECTOR
			const hrRes = await db.query(`
        SELECT a.a_id, a.a_name, a.a_role, 
               COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position,
               a.a_agency_id, ag.parent_ag_id, ag.ag_type
        FROM admin a
        LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
        WHERE a.a_role = 'HR_DIRECTOR'
      `);
			const hrDirectors = hrRes.rows;
			if (hrDirectors.length > 0) {
				autoUpAssignee = hrDirectors[0];
			}

			// Query active delegations for HR_DIRECTOR
			const actingHrRes = await db.query(`
        SELECT d.delegation_id, d.assignee_id as a_id, a.a_name, a.a_role, 
               a.a_position, a.a_agency_id, ag.parent_ag_id, ag.ag_type
        FROM c_workflow_delegations d
        JOIN admin a ON a.a_id = d.assignee_id
        LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
        WHERE d.delegated_role = 'HR_DIRECTOR' 
          AND d.is_active = true
      `);
			const actingHrDirectors = actingHrRes.rows;

			const seenIds = new Set();
			const finalManual = [];
			for (const u of hrDirectors) {
				if (!seenIds.has(u.a_id)) {
					seenIds.add(u.a_id);
					finalManual.push(u);
				}
			}
			for (const u of actingHrDirectors) {
				if (!seenIds.has(u.a_id)) {
					seenIds.add(u.a_id);
					finalManual.push(u);
				}
			}
			manualAssignees = finalManual;
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
					let level = 1;
					let curr = Number(uActualAgId);
					const path: number[] = [];
					while (curr) {
						path.push(curr);
						const parent = parentMap.get(curr);
						if (!parent) break;
						level++;
						curr = parent;
					}

					const isUnderSecDirector =
						u.a_role !== "SEC_DIRECTOR" &&
						path.some((agId) => secDirectorAgencies.has(agId));
					if (isUnderSecDirector) {
						if (u.a_role === "GRP_LEADER" && level === 2) {
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

		autoUpAssignee = await processActing(autoUpAssignee);
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

	/**
	 * Simulator-specific Next Assignees calculation (Stateless)
	 */
	static async simulateNextAssignees(
		taskState: {
			in_workflow_status: string;
			in_flow_state: string | null;
			agencies: number[];
		},
		currentUserId: number,
		delegationId?: number,
	) {
		const db = await import("../config/database.js").then((m) => m.default);
		const flowState = taskState.in_flow_state;

		// 1. Get effective user ID
		let effectiveUserId = currentUserId;
		let delegatedUser: WorkflowUser | null = null;

		const baseUserRes = await db.query(
			`SELECT a_id, a_role, a_agency_id FROM admin WHERE a_id = $1`,
			[currentUserId],
		);
		if (baseUserRes.rows.length === 0) throw new Error("User not found");
		const baseUser = baseUserRes.rows[0];

		const requiredRoleMap: Record<string, string> = {
			DRAFT: "COORDINATOR",
			PENDING_GRP_REVIEW: "GRP_LEADER",
			PENDING_SEC_APPROVAL: "SEC_DIRECTOR",
			PENDING_DIRECTOR_APPROVAL: "DIV_DIRECTOR",
			PENDING_HR_APPROVAL: "HR_DIRECTOR",
			PENDING_EXECUTION: "STAFF",
			PENDING_CLOSE: "COORDINATOR",
		};
		const requiredRole = requiredRoleMap[taskState.in_workflow_status];

		let resolvedDelegationId = delegationId;
		if (
			!resolvedDelegationId &&
			requiredRole &&
			baseUser.a_role !== requiredRole
		) {
			const activeDelRes = await db.query(
				`SELECT delegation_id FROM c_workflow_delegations 
         WHERE assignee_id = $1 AND delegated_role = $2 AND is_active = true LIMIT 1`,
				[currentUserId, requiredRole],
			);
			if (activeDelRes.rows.length > 0) {
				resolvedDelegationId = activeDelRes.rows[0].delegation_id;
			}
		}

		if (resolvedDelegationId) {
			const delRes = await db.query(
				"SELECT assigner_id, delegated_role, assigner_ag_id FROM c_workflow_delegations WHERE delegation_id = $1",
				[resolvedDelegationId],
			);
			if (delRes.rows.length > 0) {
				const delRow = delRes.rows[0];
				if (delRow.assigner_id) {
					effectiveUserId = delRow.assigner_id;
				} else if (delRow.delegated_role && delRow.assigner_ag_id) {
					const agRes = await db.query(
						"SELECT parent_ag_id, ag_type FROM c_agency WHERE ag_id = $1",
						[delRow.assigner_ag_id],
					);
					if (agRes.rows.length > 0) {
						delegatedUser = {
							a_id: -1,
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
        SELECT a.a_id, a.a_name, a.a_role, 
               COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position,
               a.a_agency_id, ag.parent_ag_id, ag.ag_type
        FROM admin a
        LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
        WHERE a.a_id = $1
      `,
				[effectiveUserId],
			);

			if (userRes.rows.length === 0) throw new Error("User not found");
			user = userRes.rows[0] as WorkflowUser;
		}

		const roleRank: Record<string, number> = {
			STAFF: 1,
			COORDINATOR: 0,
			GRP_LEADER: 2,
			SEC_DIRECTOR: 3,
			DIV_DIRECTOR: 4,
			HR_DIRECTOR: 4,
		};
		const currentRank = roleRank[user.a_role] ?? 0;

		const allUsersRes = await db.query(
			`
      SELECT a.a_id, a.a_name, a.a_role, 
             COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position,
             a.a_agency_id, ag.parent_ag_id, ag.ag_name, ag.ag_type
      FROM admin a
      LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
      WHERE a.a_role IN ('HR_DIRECTOR', 'DIV_DIRECTOR', 'SEC_DIRECTOR', 'GRP_LEADER', 'STAFF', 'COORDINATOR')
        AND a.a_id != $1
    `,
			[effectiveUserId],
		);

		const allUsers = allUsersRes.rows as WorkflowUser[];

		let autoUpAssignee = null;
		let manualAssignees: WorkflowUser[] = [];

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

		if (user.a_role === "COORDINATOR") {
			const groupAgencyId =
				user.ag_type === "POSITION" ? user.parent_ag_id : user.a_agency_id;
			if (groupAgencyId) {
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

				const actingRes = await db.query(
					`
          SELECT d.delegation_id, d.assignee_id as a_id, a.a_name, a.a_role, 
                 a.a_position, a.a_agency_id, ag.parent_ag_id, ag.ag_type
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
			const hrRes = await db.query(`
        SELECT a.a_id, a.a_name, a.a_role, 
               COALESCE(CASE WHEN ag.ag_type = 'POSITION' THEN ag.ag_name ELSE NULL END, a.a_position) AS a_position,
               a.a_agency_id, ag.parent_ag_id, ag.ag_type
        FROM admin a
        LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
        WHERE a.a_role = 'HR_DIRECTOR'
      `);
			const hrDirectors = hrRes.rows as WorkflowUser[];
			if (hrDirectors.length > 0) {
				autoUpAssignee = hrDirectors[0];
			}

			const actingHrRes = await db.query(`
        SELECT d.delegation_id, d.assignee_id as a_id, a.a_name, a.a_role, 
               a.a_position, a.a_agency_id, ag.parent_ag_id, ag.ag_type
        FROM c_workflow_delegations d
        JOIN admin a ON a.a_id = d.assignee_id
        LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
        WHERE d.delegated_role = 'HR_DIRECTOR' 
          AND d.is_active = true
      `);
			const actingHrDirectors = actingHrRes.rows as WorkflowUser[];

			const seenIds = new Set<number>();
			const finalManual: WorkflowUser[] = [];
			for (const u of hrDirectors) {
				if (!seenIds.has(u.a_id)) {
					seenIds.add(u.a_id);
					finalManual.push(u);
				}
			}
			for (const u of actingHrDirectors) {
				if (!seenIds.has(u.a_id)) {
					seenIds.add(u.a_id);
					finalManual.push(u);
				}
			}
			manualAssignees = finalManual;
		} else {
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

				let isMatch = false;
				if (currentRank === 4 && uRank === 4) {
					isMatch = true;
				}

				if (childAgencyIds.includes(Number(u.a_agency_id))) {
					if (uRank < currentRank) {
						isMatch = true;
					}
				}

				if (!isMatch) return false;

				const uActualAgId =
					u.ag_type === "POSITION" ? u.parent_ag_id : u.a_agency_id;
				if (uActualAgId) {
					let level = 1;
					let curr = Number(uActualAgId);
					const path: number[] = [];
					while (curr) {
						path.push(curr);
						const parent = parentMap.get(curr);
						if (!parent) break;
						level++;
						curr = parent;
					}

					const isUnderSecDirector =
						u.a_role !== "SEC_DIRECTOR" &&
						path.some((agId) => secDirectorAgencies.has(agId));
					if (isUnderSecDirector) {
						if (u.a_role === "GRP_LEADER" && level === 2) {
							return true;
						}
						return false;
					}
				}

				return true;
			});
		}

		autoUpAssignee = await processActing(autoUpAssignee);
		const finalManualAssignees: SimulatedUser[] = [];
		for (const u of manualAssignees) {
			const acted = await processActing(u);
			if (acted) finalManualAssignees.push(acted);
		}

		finalManualAssignees.sort((a, b) => {
			return (roleRank[b.a_role] ?? 0) - (roleRank[a.a_role] ?? 0);
		});

		let assignedAgencies: AssignedAgency[] = [];
		if (taskState.agencies && taskState.agencies.length > 0) {
			const assignedAgenciesRes = await db.query(
				`SELECT ag_id, ag_name FROM c_agency WHERE ag_id = ANY($1)`,
				[taskState.agencies],
			);
			assignedAgencies = assignedAgenciesRes.rows as AssignedAgency[];
		}

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
					autoUpAssignee = await processActing(targetUser as WorkflowUser);
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
	 * Statelessly simulate a workflow action and return updated state and history logs.
	 */
	static async simulateNextAction(
		task: SimulatedTask,
		activeUserId: number,
		action:
			| "FORWARD"
			| "REJECT"
			| "CLOSE"
			| "PARALLEL_ASSIGN"
			| "PARALLEL_DELEGATE"
			| "PARALLEL_SUBMIT",
		payload: {
			targetUserId?: number;
			comments?: string;
			delegationId?: number;
			tracks?: SimulatedParallelTrack[];
			paId?: number;
			resultsId?: number | null;
		},
	) {
		const db = await import("../config/database.js").then((m) => m.default);

		// 1. Get active user from DB
		const activeRes = await db.query(
			`SELECT a_id, a_name, a_position, a_role, a_agency_id 
       FROM admin WHERE a_id = $1`,
			[activeUserId],
		);
		if (activeRes.rows.length === 0) throw new Error("Active user not found");
		const activeUser = activeRes.rows[0];

		// 2. Resolve simulated effective user role and agency using delegation if applicable
		const requiredRoleMap: Record<string, string> = {
			DRAFT: "COORDINATOR",
			PENDING_GRP_REVIEW: "GRP_LEADER",
			PENDING_SEC_APPROVAL: "SEC_DIRECTOR",
			PENDING_DIRECTOR_APPROVAL: "DIV_DIRECTOR",
			PENDING_HR_APPROVAL: "HR_DIRECTOR",
			PENDING_EXECUTION: "STAFF",
			PENDING_CLOSE: "COORDINATOR",
		};
		const requiredRole = requiredRoleMap[task.in_workflow_status];

		let resolvedDelegationId = payload.delegationId;
		if (
			!resolvedDelegationId &&
			requiredRole &&
			activeUser.a_role !== requiredRole
		) {
			const activeDelRes = await db.query(
				`SELECT delegation_id FROM c_workflow_delegations 
         WHERE assignee_id = $1 AND delegated_role = $2 AND is_active = true LIMIT 1`,
				[activeUser.a_id, requiredRole],
			);
			if (activeDelRes.rows.length > 0) {
				resolvedDelegationId = activeDelRes.rows[0].delegation_id;
			}
		}

		const { role: effectiveRole } =
			await WorkflowService.getSimulatedEffectiveUser(
				task,
				activeUser,
				resolvedDelegationId,
			);

		const updatedTask = { ...task };
		const newHistoryEntries: SimulatedHistoryEntry[] = [];
		const nowStr = new Date().toISOString();

		if (action === "FORWARD") {
			const targetUserId = payload.targetUserId;
			if (!targetUserId)
				throw new Error("Target user ID is required for forward");

			const targetRes = await db.query(
				`SELECT a_id, a_name, a_position, a_role, a_agency_id FROM admin WHERE a_id = $1`,
				[targetUserId],
			);
			if (targetRes.rows.length === 0) throw new Error("Target user not found");
			const targetUser = targetRes.rows[0];

			let newStatus = WorkflowService.getNextStatus(
				effectiveRole,
				targetUser.a_role,
			);
			let historyAction = "APPROVED";
			let newFlowState = task.in_flow_state;

			if (targetUser.a_role === "COORDINATOR") {
				newStatus = "PENDING_CLOSE";
				historyAction = "FINALIZED";
			}

			// Update flow_state dynamically
			if (effectiveRole === "COORDINATOR") {
				newFlowState = "out";
			} else if (
				effectiveRole === "HR_DIRECTOR" &&
				targetUser.a_role === "DIV_DIRECTOR"
			) {
				newFlowState = "in";
			} else if (targetUser.a_role === "STAFF") {
				newFlowState = "out";
			} else if (effectiveRole === "STAFF") {
				newFlowState = "out";
			} else if (
				effectiveRole === "DIV_DIRECTOR" &&
				targetUser.a_role === "HR_DIRECTOR"
			) {
				newFlowState = "in";
			}

			updatedTask.in_workflow_status = newStatus;
			updatedTask.in_current_owner_id = targetUserId;
			updatedTask.in_flow_state = newFlowState;

			newHistoryEntries.push({
				id: Date.now(),
				in_id: task.id,
				pa_id: null,
				from_user_id: activeUser.a_id,
				from_user_name: activeUser.a_name,
				from_user_position: activeUser.a_position || activeUser.a_role,
				from_user_role: effectiveRole,
				to_user_id: targetUserId,
				to_user_name: targetUser.a_name,
				to_user_position: targetUser.a_position || targetUser.a_role,
				to_user_role: targetUser.a_role,
				action: historyAction,
				comments: payload.comments || "เห็นชอบและส่งดำเนินการขั้นถัดไป",
				created_at: nowStr,
			});
		} else if (action === "REJECT") {
			const targetUserId = payload.targetUserId;
			if (!targetUserId)
				throw new Error("Target user ID is required for reject");

			const targetRes = await db.query(
				`SELECT a_id, a_name, a_position, a_role, a_agency_id FROM admin WHERE a_id = $1`,
				[targetUserId],
			);
			if (targetRes.rows.length === 0) throw new Error("Target user not found");
			const targetUser = targetRes.rows[0];

			let newFlowState = task.in_flow_state;
			if (targetUser.a_role === "STAFF") {
				newFlowState = "out";
			}

			updatedTask.in_workflow_status = "REJECTED";
			updatedTask.in_current_owner_id = targetUserId;
			updatedTask.in_flow_state = newFlowState;

			newHistoryEntries.push({
				id: Date.now(),
				in_id: task.id,
				pa_id: null,
				from_user_id: activeUser.a_id,
				from_user_name: activeUser.a_name,
				from_user_position: activeUser.a_position || activeUser.a_role,
				from_user_role: activeUser.a_role,
				to_user_id: targetUserId,
				to_user_name: targetUser.a_name,
				to_user_position: targetUser.a_position || targetUser.a_role,
				to_user_role: targetUser.a_role,
				action: "REJECTED",
				comments: payload.comments || "ส่งงานกลับพิจารณาแก้ไข",
				created_at: nowStr,
			});
		} else if (action === "CLOSE") {
			updatedTask.in_workflow_status = "COMPLETED";
			updatedTask.in_current_owner_id = null;
			updatedTask.in_flow_state = "end";

			newHistoryEntries.push({
				id: Date.now(),
				in_id: task.id,
				pa_id: null,
				from_user_id: activeUser.a_id,
				from_user_name: activeUser.a_name,
				from_user_position: activeUser.a_position || activeUser.a_role,
				from_user_role: activeUser.a_role,
				to_user_id: null,
				to_user_name: null,
				to_user_position: null,
				to_user_role: null,
				action: "FINALIZED",
				comments: payload.comments || "ปิดงานพิจารณาหนังสือเวียนและเก็บประวัติประมวลผล",
				created_at: nowStr,
			});
		} else if (action === "PARALLEL_ASSIGN") {
			const taskAgencies = task.agencies || [];
			if (taskAgencies.length === 0)
				throw new Error("No agencies selected for parallel distribution");

			const parallelTracks: SimulatedParallelTrack[] = [];
			for (let idx = 0; idx < taskAgencies.length; idx++) {
				const agId = taskAgencies[idx];

				const agRes = await db.query(
					"SELECT ag_name FROM c_agency WHERE ag_id = $1",
					[agId],
				);
				const agName =
					agRes.rows.length > 0 ? agRes.rows[0].ag_name : `หน่วยงาน ${agId}`;

				const directorRes = await db.query(
					`SELECT a.a_id, a.a_name, a.a_position, a.a_role 
           FROM admin a
           LEFT JOIN c_agency ca ON a.a_agency_id = ca.ag_id
           WHERE a.a_status IN ('1', 'true', 'active') 
             AND (a.a_agency_id = $1 OR ca.parent_ag_id = $1) 
             AND a.a_role IN ('DIV_DIRECTOR', 'HR_DIRECTOR') 
           ORDER BY a.a_role ASC 
           LIMIT 1`,
					[agId],
				);

				let director = null;
				if (directorRes.rows.length > 0) {
					director = directorRes.rows[0];
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
						[agId],
					);
					if (actingFallbackRes.rows.length > 0) {
						director = actingFallbackRes.rows[0];
					}
				}

				const initialOwnerId = director ? director.a_id : activeUser.a_id;
				const ownerName = director ? director.a_name : activeUser.a_name;
				const ownerPosition = director
					? director.a_position || director.a_role
					: activeUser.a_position;
				const ownerRole = director ? director.a_role : activeUser.a_role;

				parallelTracks.push({
					pa_id: Date.now() + idx,
					ag_id: agId,
					ag_name: agName,
					initial_owner_id: initialOwnerId,
					current_owner_id: initialOwnerId,
					pa_status: "PENDING",
					result_comments: "",
					results_id: null,
					updated_at: nowStr,
				});

				newHistoryEntries.push({
					id: Date.now() + idx,
					in_id: task.id,
					pa_id: Date.now() + idx,
					from_user_id: activeUser.a_id,
					from_user_name: activeUser.a_name,
					from_user_position: activeUser.a_position || activeUser.a_role,
					from_user_role: effectiveRole,
					to_user_id: initialOwnerId,
					to_user_name: ownerName,
					to_user_position: ownerPosition,
					to_user_role: ownerRole,
					action: "PARALLEL_ASSIGNED",
					comments: `เสนอพิจารณาคู่ขนาน (หน่วยงาน: ${agName}): ${payload.comments || "โปรดพิจารณาดำเนินการ"}`,
					created_at: nowStr,
				});
			}

			updatedTask.in_workflow_status = "PENDING_PARALLEL";
			updatedTask.in_is_parallel = true;
			updatedTask.in_current_owner_id = null;
			updatedTask.in_flow_state = "in";
			updatedTask.parallel_assignments = parallelTracks;
		} else if (action === "PARALLEL_DELEGATE") {
			const paId = payload.paId;
			const targetUserId = payload.targetUserId;
			if (!paId || !targetUserId)
				throw new Error(
					"paId and targetUserId are required for parallel delegation",
				);

			const subRes = await db.query(
				`SELECT a_id, a_name, a_position, a_role FROM admin WHERE a_id = $1`,
				[targetUserId],
			);
			if (subRes.rows.length === 0)
				throw new Error("Subordinate user not found");
			const subUser = subRes.rows[0];

			const updatedTracks = (task.parallel_assignments || []).map(
				(pa: SimulatedParallelTrack) => {
					if (pa.pa_id === paId) {
						return {
							...pa,
							current_owner_id: targetUserId,
							pa_status: "IN_PROGRESS",
							updated_at: nowStr,
						};
					}
					return pa;
				},
			);

			updatedTask.parallel_assignments = updatedTracks;

			newHistoryEntries.push({
				id: Date.now(),
				in_id: task.id,
				pa_id: paId,
				from_user_id: activeUser.a_id,
				from_user_name: activeUser.a_name,
				from_user_position: activeUser.a_position || activeUser.a_role,
				from_user_role: effectiveRole,
				to_user_id: targetUserId,
				to_user_name: subUser.a_name,
				to_user_position: subUser.a_position || subUser.a_role,
				to_user_role: subUser.a_role,
				action: "PARALLEL_DELEGATED",
				comments: payload.comments || "มอบหมายตรวจสอบในสายงานของกอง",
				created_at: nowStr,
			});
		} else if (action === "PARALLEL_SUBMIT") {
			const paId = payload.paId;
			const resultsId = payload.resultsId;
			if (!paId || !resultsId)
				throw new Error("paId and resultsId are required for parallel submit");

			const resTextRes = await db.query(
				"SELECT results_detail FROM c_results WHERE results_id = $1",
				[resultsId],
			);
			const resultsText =
				resTextRes.rows.length > 0
					? resTextRes.rows[0].results_detail
					: "พิจารณาแล้ว";

			const track = (task.parallel_assignments || []).find(
				(pa: SimulatedParallelTrack) => pa.pa_id === paId,
			);
			if (!track) throw new Error("Track not found");

			const updatedTracks = (task.parallel_assignments || []).map(
				(pa: SimulatedParallelTrack) => {
					if (pa.pa_id === paId) {
						return {
							...pa,
							pa_status: "SUBMITTED",
							result_comments: payload.comments || "",
							results_id: Number(resultsId),
							updated_at: nowStr,
						};
					}
					return pa;
				},
			);

			newHistoryEntries.push({
				id: Date.now(),
				in_id: task.id,
				pa_id: paId,
				from_user_id: activeUser.a_id,
				from_user_name: activeUser.a_name,
				from_user_position: activeUser.a_position || activeUser.a_role,
				from_user_role: effectiveRole,
				to_user_id: null,
				to_user_name: null,
				to_user_position: null,
				to_user_role: null,
				action: "PARALLEL_SUBMITTED",
				comments: `รายงานผลของกอง (${track.ag_name}): [ผล: ${resultsText}] - ${payload.comments || "เรียบร้อย"}`,
				created_at: nowStr,
			});

			const totalTracks = updatedTracks.length;
			const terminalTracks = updatedTracks.filter(
				(pa: SimulatedParallelTrack) =>
					["SUBMITTED", "REJECTED"].includes(pa.pa_status),
			).length;

			let newStatus = "PENDING_PARALLEL";
			let newCurrentOwnerId = task.in_current_owner_id;

			if (totalTracks === terminalTracks) {
				const hrRes = await db.query(
					"SELECT a_id, a_name, a_position, a_role FROM admin WHERE a_role = 'HR_DIRECTOR' LIMIT 1",
				);
				const hrDir = hrRes.rows.length > 0 ? hrRes.rows[0] : null;
				newStatus = "PENDING_HR_APPROVAL";
				newCurrentOwnerId = hrDir ? hrDir.a_id : null;

				newHistoryEntries.push({
					id: Date.now() + 1,
					in_id: task.id,
					pa_id: null,
					from_user_id: null,
					from_user_name: "ระบบรวมผลอัตโนมัติ",
					from_user_position: "SYSTEM PROCESSOR",
					from_user_role: "SYSTEM",
					to_user_id: hrDir ? hrDir.a_id : null,
					to_user_name: hrDir ? hrDir.a_name : "ผอ.ศูนย์ฯ",
					to_user_position: hrDir
						? hrDir.a_position || hrDir.a_role
						: "HR_DIRECTOR",
					to_user_role: hrDir ? hrDir.a_role : "HR_DIRECTOR",
					action: "SUBMITTED",
					comments:
						"ทุกส่วนราชการพิจารณาตรวจสอบข้อมูลครบถ้วนแล้ว - ระบบส่งคืนให้ ผอ.ศูนย์ฯ (HR_DIRECTOR) พิจารณาลงนามจบเรื่อง",
					created_at: nowStr,
				});
			}

			updatedTask.in_workflow_status = newStatus;
			updatedTask.in_current_owner_id = newCurrentOwnerId;
			updatedTask.parallel_assignments = updatedTracks;
		}

		return {
			updatedTask,
			newHistoryEntries,
		};
	}

	/**
	 * Helper for simulated effective user role (Stateless helper for simulator)
	 */
	private static async getSimulatedEffectiveUser(
		task: SimulatedTask,
		user: { a_role: string; a_id: number; a_agency_id: number },
		delegationId?: number,
	) {
		if (!task || !user) return { role: "", agencyId: null };

		const requiredRoleMap: Record<string, string> = {
			DRAFT: "COORDINATOR",
			PENDING_GRP_REVIEW: "GRP_LEADER",
			PENDING_SEC_APPROVAL: "SEC_DIRECTOR",
			PENDING_DIRECTOR_APPROVAL: "DIV_DIRECTOR",
			PENDING_HR_APPROVAL: "HR_DIRECTOR",
			PENDING_EXECUTION: "STAFF",
			PENDING_CLOSE: "COORDINATOR",
		};
		const requiredRole = requiredRoleMap[task.in_workflow_status];

		let role = user.a_role;
		let agencyId = user.a_agency_id;

		if (requiredRole && user.a_role !== requiredRole && delegationId) {
			const db = await import("../config/database.js").then((m) => m.default);
			const delRes = await db.query(
				`SELECT delegation_id, delegated_role, assigner_ag_id, assigner_id 
         FROM c_workflow_delegations 
         WHERE delegation_id = $1 AND assignee_id = $2 AND delegated_role = $3 AND is_active = true`,
				[delegationId, user.a_id, requiredRole],
			);
			if (delRes.rows.length > 0) {
				role = requiredRole;
				agencyId = delRes.rows[0].assigner_ag_id || delRes.rows[0].assigner_id;
			}
		}

		return { role, agencyId };
	}
}

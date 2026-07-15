import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../../config/database.js";
import { WorkflowEngine } from "./workflowEngine.js";

vi.mock("../../config/database.js", () => ({
	default: {
		query: vi.fn(),
	},
}));

describe("Modular Workflow Engine - Strategy Pattern", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should route STAFF/COORDINATOR to GRP_LEADER of parent agency if it exists", async () => {
		vi.mocked(db.query).mockImplementation(
			async (sql: string, params: unknown[]) => {
				if (sql.includes("c_agency") && !sql.includes("admin")) {
					const id = params[0];
					if (id === 10) return { rows: [{ ag_id: 10, parent_ag_id: 20 }] };
					if (id === 20)
						return {
							rows: [
								{
									ag_id: 20,
									ag_name: "Parent Dept",
									parent_ag_id: null,
									ag_type: "DEPARTMENT",
								},
							],
						};
				}
				return { rows: [] };
			},
		);

		const user = { a_agency_id: 10, a_role: "STAFF" };
		const res = await WorkflowEngine.processAction("FORWARD_OUT", user, "1");

		expect(res).toEqual({
			success: true,
			predictedNextAssignee: {
				nextRole: "GRP_LEADER",
				nextAgId: 20,
			},
			inFlowState: "out",
		});
	});

	it("should route GRP_LEADER to SEC_DIRECTOR if parent agency has SEC_DIRECTOR role", async () => {
		vi.mocked(db.query).mockImplementation(
			async (sql: string, params: unknown[]) => {
				if (sql.includes("c_agency") && !sql.includes("admin")) {
					const id = params[0];
					if (id === 10) return { rows: [{ ag_id: 10, parent_ag_id: 20 }] };
					if (id === 20)
						return {
							rows: [
								{
									ag_id: 20,
									ag_name: "Parent Dept",
									parent_ag_id: null,
									ag_type: "DEPARTMENT",
								},
							],
						};
				}
				if (sql.includes("admin")) {
					const role = params[1];
					if (role === "SEC_DIRECTOR") return { rows: [{ count: 1 }] };
				}
				return { rows: [] };
			},
		);

		const user = { a_agency_id: 10, a_role: "GRP_LEADER" };
		const res = await WorkflowEngine.processAction("FORWARD_OUT", user, "1");

		expect(res).toEqual({
			success: true,
			predictedNextAssignee: {
				nextRole: "SEC_DIRECTOR",
				nextAgId: 20,
			},
			inFlowState: "out",
		});
	});

	it("should route GRP_LEADER to DIV_DIRECTOR (skipping SEC_DIRECTOR) if parent has no SEC_DIRECTOR", async () => {
		vi.mocked(db.query).mockImplementation(
			async (sql: string, params: unknown[]) => {
				if (sql.includes("c_agency") && !sql.includes("admin")) {
					const id = params[0];
					if (id === 10) return { rows: [{ ag_id: 10, parent_ag_id: 20 }] };
					if (id === 20)
						return {
							rows: [
								{
									ag_id: 20,
									ag_name: "Parent Dept",
									parent_ag_id: 30,
									ag_type: "DEPARTMENT",
								},
							],
						};
					if (id === 30)
						return {
							rows: [
								{
									ag_id: 30,
									ag_name: "Grand Parent Division",
									parent_ag_id: null,
									ag_type: "DIVISION",
								},
							],
						};
				}
				if (sql.includes("admin")) {
					return { rows: [{ count: 0 }] };
				}
				return { rows: [] };
			},
		);

		const user = { a_agency_id: 10, a_role: "GRP_LEADER" };
		const res = await WorkflowEngine.processAction("FORWARD_OUT", user, "1");

		expect(res).toEqual({
			success: true,
			predictedNextAssignee: {
				nextRole: "DIV_DIRECTOR",
				nextAgId: 30,
			},
			inFlowState: "out",
		});
	});

	it("should return null for DIV_DIRECTOR and HR_DIRECTOR", async () => {
		vi.mocked(db.query).mockImplementation(
			async (sql: string, params: unknown[]) => {
				if (sql.includes("c_agency") && !sql.includes("admin")) {
					const id = params[0];
					if (id === 10) return { rows: [{ ag_id: 10, parent_ag_id: 20 }] };
					if (id === 20)
						return {
							rows: [
								{
									ag_id: 20,
									ag_name: "Parent Dept",
									parent_ag_id: null,
									ag_type: "DEPARTMENT",
								},
							],
						};
				}
				return { rows: [] };
			},
		);

		const userDiv = { a_agency_id: 10, a_role: "DIV_DIRECTOR" };
		const resDiv = await WorkflowEngine.processAction(
			"FORWARD_OUT",
			userDiv,
			"1",
		);

		expect(resDiv).toEqual({
			success: true,
			predictedNextAssignee: null,
			inFlowState: "out",
		});

		const userHr = { a_agency_id: 10, a_role: "HR_DIRECTOR" };
		const resHr = await WorkflowEngine.processAction(
			"FORWARD_OUT",
			userHr,
			"1",
		);

		expect(resHr).toEqual({
			success: true,
			predictedNextAssignee: null,
			inFlowState: "out",
		});
	});
});

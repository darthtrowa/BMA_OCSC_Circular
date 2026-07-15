/**
 * InteractiveWorkflowTester.tsx
 * Thin client UI for E2E Real Workflow Testing.
 * Zero workflow logic here - all routing decisions come from the real backend.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { testWorkflowApi } from "../../api/apiService";

type TesterState = "IDLE" | "ACTIVE" | "DONE";

interface AdminUser {
	a_id: number;
	a_name: string;
	a_role: string;
	a_position: string;
	agency_name?: string;
	is_acting?: boolean;
}

interface DocStatus {
	in_workflow_status: string;
	in_flow_state: string | null;
	in_current_owner_id: number | null;
	in_is_parallel?: boolean;
	current_owner_name: string | null;
	current_owner_role: string | null;
	history: HistoryEntry[];
	assignedAgencies?: Array<{ ag_id: number; ag_name: string }>;
	parallelTracks?: Array<{
		pa_id: number;
		ag_id: number;
		ag_name: string;
		current_owner_id: number;
		pa_status: string;
		owner_name: string;
		owner_role: string;
	}>;
}

interface HistoryEntry {
	id: number;
	action: string;
	comments: string;
	created_at: string;
	from_user_name: string;
	from_user_position: string;
	to_user_name: string | null;
	to_user_position: string | null;
}

const ROLE_LABELS: Record<string, string> = {
	COORDINATOR: "Coordinator",
	GRP_LEADER: "Group Leader",
	HR_GRP_LEADER: "HR Group Leader",
	SEC_DIRECTOR: "Sec. Director",
	HR_SEC_DIRECTOR: "HR Sec. Director",
	DIV_DIRECTOR: "Div. Director",
	HR_DIRECTOR: "HR Director",
	STAFF: "Staff",
};

const ROLE_COLORS: Record<string, string> = {
	COORDINATOR: "bg-violet-100 text-violet-800",
	GRP_LEADER: "bg-sky-100 text-sky-800",
	HR_GRP_LEADER: "bg-pink-100 text-pink-800",
	SEC_DIRECTOR: "bg-amber-100 text-amber-800",
	HR_SEC_DIRECTOR: "bg-fuchsia-100 text-fuchsia-800",
	DIV_DIRECTOR: "bg-orange-100 text-orange-800",
	HR_DIRECTOR: "bg-rose-100 text-rose-800",
	STAFF: "bg-slate-100 text-slate-700",
};

const STATUS_COLORS: Record<string, string> = {
	DRAFT: "bg-slate-100 text-slate-700",
	PENDING_GRP_REVIEW: "bg-sky-100 text-sky-800",
	PENDING_HR_GRP_REVIEW: "bg-pink-100 text-pink-800",
	PENDING_SEC_APPROVAL: "bg-amber-100 text-amber-800",
	PENDING_HR_SEC_APPROVAL: "bg-fuchsia-100 text-fuchsia-800",
	PENDING_DIRECTOR_APPROVAL: "bg-orange-100 text-orange-800",
	PENDING_HR_APPROVAL: "bg-rose-100 text-rose-800",
	PENDING_EXECUTION: "bg-purple-100 text-purple-800",
	PENDING_DELEGATION: "bg-indigo-100 text-indigo-800",
	PENDING_CLOSE: "bg-emerald-100 text-emerald-800",
	PENDING_PARALLEL: "bg-violet-100 text-violet-800",
	REJECTED: "bg-red-100 text-red-800",
	COMPLETED: "bg-green-100 text-green-800",
};

const ACTION_ICONS: Record<string, string> = {
	STARTED: "🚀",
	APPROVED: "✅",
	REJECTED: "↩️",
	FINALIZED: "🏁",
	COMPLETED: "🎉",
	PARALLEL_ASSIGNED: "🔀",
	PARALLEL_DELEGATED: "➡️",
};

export default function InteractiveWorkflowTester() {
	const [testerState, setTesterState] = useState<TesterState>("IDLE");
	const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
	const [agencies, setAgencies] = useState<
		Array<{ ag_id: number; ag_name: string }>
	>([]);
	const [selectedAgencies, setSelectedAgencies] = useState<number[]>([]);
	const [loadingUsers, setLoadingUsers] = useState(true);
	const [selectedCoordinator, setSelectedCoordinator] = useState<number | "">(
		"",
	);
	const [docId, setDocId] = useState<number | null>(null);
	const [docStatus, setDocStatus] = useState<DocStatus | null>(null);
	const [currentActorId, setCurrentActorId] = useState<number | "">("");
	const [nextAssignees, setNextAssignees] = useState<AdminUser[]>([]);
	const [rejectAssignees, setRejectAssignees] = useState<AdminUser[]>([]);
	const [selectedTarget, setSelectedTarget] = useState<number | "">("");
	const [selectedRejectTarget, setSelectedRejectTarget] = useState<number | "">(
		"",
	);
	const [useParallelAssign, setUseParallelAssign] = useState(false);
	const [comments, setComments] = useState("");
	const [actionMode, setActionMode] = useState<"forward" | "reject">("forward");
	const [loading, setLoading] = useState(false);
	const [loadingAssignees, setLoadingAssignees] = useState(false);
	const logEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		testWorkflowApi
			.getUsers()
			.then((u) => setAllUsers(u || []))
			.catch(() => setAllUsers([]))
			.finally(() => setLoadingUsers(false));

		testWorkflowApi
			.getAgencies()
			.then((a) => setAgencies(a || []))
			.catch(() => setAgencies([]));
	}, []);

	useEffect(() => {
		logEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const refreshStatus = useCallback(async (id: number) => {
		try {
			const res = await testWorkflowApi.getStatus(id);
			if (res.success) {
				setDocStatus(res.data);
				if (res.data.in_workflow_status === "COMPLETED") {
					setTesterState("DONE");
				}
			}
		} catch {
			/* ignore */
		}
	}, []);

	useEffect(() => {
		if (!docId || !currentActorId) {
			setNextAssignees([]);
			setRejectAssignees([]);
			setSelectedTarget("");
			setSelectedRejectTarget("");
			setUseParallelAssign(false);
			return;
		}
		setLoadingAssignees(true);
		const actor = allUsers.find((u) => u.a_id === currentActorId);
		const roleStr = actor?.a_role || "";

		Promise.all([
			testWorkflowApi.getNextAssignees(docId, currentActorId as number),
			testWorkflowApi.getRejectAssignees(
				docId,
				currentActorId as number,
				roleStr,
			),
		])
			.then(([fwd, rej]) => {
				const fwdData = fwd?.data || {};
				setUseParallelAssign(!!fwdData.useParallelAssign);

				const auto = fwdData.autoUpAssignee ? [fwdData.autoUpAssignee] : [];
				const manual = fwdData.manualAssignees || [];
				const combined = [...auto, ...manual].filter(
					(u: AdminUser, idx: number, arr: AdminUser[]) =>
						arr.findIndex((x) => x.a_id === u.a_id) === idx,
				);
				setNextAssignees(combined);
				setSelectedTarget(combined.length === 1 ? combined[0].a_id : "");
				const rejData = rej?.data || [];
				setRejectAssignees(Array.isArray(rejData) ? rejData : []);
				setSelectedRejectTarget("");
			})
			.catch(() => {
				setNextAssignees([]);
				setRejectAssignees([]);
			})
			.finally(() => setLoadingAssignees(false));
	}, [docId, currentActorId, allUsers]);

	const handleInit = async () => {
		if (!selectedCoordinator) {
			Swal.fire("แจ้งเตือน", "กรุณาเลือก Coordinator ก่อนเริ่มทดสอบ", "warning");
			return;
		}
		setLoading(true);
		try {
			const res = await testWorkflowApi.init(Number(selectedCoordinator));
			if (!res.success) throw new Error(res.message);
			const newDocId = res.data.docId;

			if (selectedAgencies.length > 0) {
				await testWorkflowApi.assignAgencies(newDocId, selectedAgencies);
			}

			setDocId(newDocId);
			setDocStatus({
				in_workflow_status: res.data.status,
				in_flow_state: res.data.flowState,
				in_current_owner_id: res.data.currentUserId,
				current_owner_name: res.data.currentUserName,
				current_owner_role: res.data.currentUserRole,
				history: [],
			});
			setCurrentActorId(res.data.currentUserId);
			setTesterState("ACTIVE");
			await refreshStatus(newDocId);
		} catch (e) {
			Swal.fire("Error", e.message || "เริ่มทดสอบไม่สำเร็จ", "error");
		} finally {
			setLoading(false);
		}
	};

	const handleForward = async () => {
		if (!docId || !currentActorId || !selectedTarget) {
			Swal.fire("แจ้งเตือน", "กรุณาเลือกผู้รับงานก่อน", "warning");
			return;
		}
		setLoading(true);
		try {
			const res = await testWorkflowApi.forward(
				docId,
				Number(currentActorId),
				Number(selectedTarget),
				comments,
			);
			if (!res.success) throw new Error(res.message);
			const newOwnerName =
				allUsers.find((u) => u.a_id === Number(selectedTarget))?.a_name || "?";
			setComments("");
			setSelectedTarget("");
			setSelectedRejectTarget("");
			await refreshStatus(docId);

			// If document is parallel, standard owner becomes NULL, let the tester choose the next actor manually
			if (docStatus?.in_is_parallel) {
				setCurrentActorId("");
			} else {
				setCurrentActorId(Number(selectedTarget));
			}

			Swal.fire({
				icon: "success",
				title: "ส่งต่อสำเร็จ",
				text: `→ ${newOwnerName}`,
				timer: 1500,
				showConfirmButton: false,
			});
		} catch (e) {
			Swal.fire("Error", e.message, "error");
		} finally {
			setLoading(false);
		}
	};

	const handleParallelAssign = async () => {
		if (!docId || !currentActorId || !docStatus?.assignedAgencies) return;
		setLoading(true);
		try {
			const tracks = docStatus.assignedAgencies.map((ag) => ({
				ag_id: ag.ag_id,
				ag_name: ag.ag_name,
			}));

			const res = await testWorkflowApi.parallelAssign(
				docId,
				Number(currentActorId),
				tracks,
			);
			if (!res.success) throw new Error(res.message);

			setComments("");
			setSelectedTarget("");
			setSelectedRejectTarget("");
			await refreshStatus(docId);
			setCurrentActorId("");

			Swal.fire({
				icon: "success",
				title: "กระจายงานคู่ขนานสำเร็จ",
				text: `สร้างแทร็กคู่ขนาน ${tracks.length} แทร็กเรียบร้อยแล้ว`,
				timer: 2000,
				showConfirmButton: false,
			});
		} catch (e) {
			Swal.fire("Error", e.message, "error");
		} finally {
			setLoading(false);
		}
	};

	const handleReject = async () => {
		if (!docId || !currentActorId || !selectedRejectTarget) {
			Swal.fire("แจ้งเตือน", "กรุณาเลือกผู้รับการตีกลับก่อน", "warning");
			return;
		}
		setLoading(true);
		try {
			const res = await testWorkflowApi.reject(
				docId,
				Number(currentActorId),
				Number(selectedRejectTarget),
				comments,
			);
			if (!res.success) throw new Error(res.message);
			const targetName =
				allUsers.find((u) => u.a_id === Number(selectedRejectTarget))?.a_name ||
				"?";
			setComments("");
			setSelectedRejectTarget("");
			setSelectedTarget("");
			setActionMode("forward");
			await refreshStatus(docId);

			if (docStatus?.in_is_parallel) {
				setCurrentActorId("");
			} else {
				setCurrentActorId(Number(selectedRejectTarget));
			}

			Swal.fire({
				icon: "info",
				title: "ตีกลับสำเร็จ",
				text: `↩ ${targetName}`,
				timer: 1500,
				showConfirmButton: false,
			});
		} catch (e) {
			Swal.fire("Error", e.message, "error");
		} finally {
			setLoading(false);
		}
	};

	const handleClose = async () => {
		if (!docId || !currentActorId) return;
		const result = await Swal.fire({
			title: "ปิดงาน (COMPLETED)?",
			text: "การดำเนินการนี้จะเปลี่ยนสถานะหนังสือเป็น COMPLETED",
			icon: "question",
			showCancelButton: true,
			confirmButtonText: "ยืนยัน",
			cancelButtonText: "ยกเลิก",
		});
		if (!result.isConfirmed) return;
		setLoading(true);
		try {
			const res = await testWorkflowApi.close(
				docId,
				Number(currentActorId),
				comments,
			);
			if (!res.success) throw new Error(res.message);
			await refreshStatus(docId);
			setTesterState("DONE");
			setComments("");
		} catch (e) {
			Swal.fire("Error", e.message, "error");
		} finally {
			setLoading(false);
		}
	};

	const handleCleanup = async () => {
		if (!docId) return;
		const result = await Swal.fire({
			title: "ลบข้อมูลทดสอบ?",
			html: `จะลบหนังสือ #<b>${docId}</b> และประวัติ workflow ทั้งหมดออกจากฐานข้อมูล<br/><span style="font-size:12px;color:#94a3b8">ปลอดภัย: เฉพาะเอกสาร [E2E-TEST] เท่านั้น</span>`,
			icon: "warning",
			showCancelButton: true,
			confirmButtonText: "ลบ",
			confirmButtonColor: "#ef4444",
			cancelButtonText: "ยกเลิก",
		});
		if (!result.isConfirmed) return;
		setLoading(true);
		try {
			const res = await testWorkflowApi.cleanup(docId);
			if (!res.success) throw new Error(res.message);
			Swal.fire("สำเร็จ", res.message, "success");
			setTesterState("IDLE");
			setDocId(null);
			setDocStatus(null);
			setCurrentActorId("");
			setSelectedCoordinator("");
			setSelectedAgencies([]);
			setNextAssignees([]);
			setRejectAssignees([]);
			setComments("");
			setActionMode("forward");
		} catch (e) {
			Swal.fire("Error", e.message, "error");
		} finally {
			setLoading(false);
		}
	};

	const coordinators = allUsers.filter((u) => u.a_role === "COORDINATOR");
	const currentActor = allUsers.find((u) => u.a_id === Number(currentActorId));
	const isCompleted = docStatus?.in_workflow_status === "COMPLETED";
	const isPendingClose = docStatus?.in_workflow_status === "PENDING_CLOSE";

	if (testerState === "IDLE") {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-3 mb-2">
					<div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow">
						<i className="bx bx-test-tube text-2xl text-white" />
					</div>
					<div>
						<h2 className="text-xl font-bold text-slate-800">
							Interactive E2E Workflow Tester
						</h2>
						<p className="text-xs text-slate-500">
							ทดสอบ Workflow จริงแบบ End-to-End ผ่าน UI — ไม่มี Mock ใดๆ
						</p>
					</div>
				</div>

				<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-3">
					<i className="bx bx-info-circle text-xl shrink-0 mt-0.5" />
					<div>
						<p className="font-semibold mb-1">เกี่ยวกับเครื่องมือนี้</p>
						<p>
							ระบบนี้จะสร้างหนังสือทดสอบจริงในฐานข้อมูล และขับเคลื่อน Workflow ผ่าน API
							Production โดยตรง ทุกการกระทำจะเปลี่ยนแปลงฐานข้อมูลจริง
							และมีปุ่มล้างข้อมูลทดสอบหลังเสร็จสิ้น
						</p>
					</div>
				</div>

				<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
					<h3 className="font-semibold text-slate-700 flex items-center gap-2">
						<i className="bx bx-play-circle text-violet-500 text-xl" />
						ตั้งค่าเริ่มต้น
					</h3>

					<div>
						<span className="block text-sm font-medium text-slate-600 mb-1.5">
							เลือก Coordinator ผู้เริ่มต้น Workflow
						</span>
						{loadingUsers ? (
							<div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
						) : (
							<select
								value={selectedCoordinator}
								onChange={(e) =>
									setSelectedCoordinator(
										e.target.value ? Number(e.target.value) : "",
									)
								}
								className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
							>
								<option value="">— เลือก Coordinator —</option>
								{coordinators.map((u) => (
									<option key={u.a_id} value={u.a_id}>
										{u.a_name} ({u.agency_name || u.a_position || "ไม่ระบุหน่วย"})
									</option>
								))}
							</select>
						)}
						{coordinators.length === 0 && !loadingUsers && (
							<p className="mt-1.5 text-xs text-red-500">
								ไม่พบ Coordinator ในระบบ
							</p>
						)}
					</div>

					<div className="border-t border-slate-100 pt-4">
						<span className="block text-sm font-medium text-slate-600 mb-2">
							เลือกหน่วยงานปลายทาง (สำหรับทดสอบ Parallel Workflow)
						</span>
						<p className="text-xs text-slate-400 mb-3">
							เลือก 2 หน่วยงานขึ้นไปเพื่อเข้าสู่ Flow พิจารณาแบบคู่ขนาน (หากไม่เลือก จะเป็น
							Flow ปกติ)
						</p>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border border-slate-200 rounded-xl bg-slate-50">
							{agencies.map((ag) => {
								const isChecked = selectedAgencies.includes(ag.ag_id);
								return (
									<label
										key={ag.ag_id}
										className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer p-1 rounded hover:bg-white transition"
									>
										<input
											type="checkbox"
											checked={isChecked}
											onChange={() => {
												setSelectedAgencies((prev) =>
													isChecked
														? prev.filter((id) => id !== ag.ag_id)
														: [...prev, ag.ag_id],
												);
											}}
											className="rounded border-slate-300 text-violet-600 focus:ring-violet-400 w-4 h-4"
										/>
										<span className="truncate">{ag.ag_name}</span>
									</label>
								);
							})}
						</div>
					</div>

					<button
						type="button"
						onClick={handleInit}
						disabled={loading || !selectedCoordinator}
						className="w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? (
							<>
								<i className="bx bx-loader-alt animate-spin" />{" "}
								กำลังสร้างเอกสาร...
							</>
						) : (
							<>
								<i className="bx bx-rocket" /> เริ่มทดสอบ Workflow
							</>
						)}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow">
						<i className="bx bx-test-tube text-2xl text-white" />
					</div>
					<div>
						<h2 className="text-xl font-bold text-slate-800">
							Interactive E2E Workflow Tester
						</h2>
						<p className="text-xs text-slate-500">
							หนังสือทดสอบ #{docId}&nbsp;—&nbsp;สถานะ:&nbsp;
							<span
								className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[docStatus?.in_workflow_status || ""] || "bg-slate-100 text-slate-700"}`}
							>
								{docStatus?.in_workflow_status || "…"}
							</span>
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={handleCleanup}
					disabled={loading}
					className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
				>
					<i className="bx bx-trash" /> ล้างข้อมูลทดสอบ
				</button>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
				<div className="space-y-4">
					<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
						<h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
							<i className="bx bx-info-circle text-slate-400" />{" "}
							สถานะเอกสารปัจจุบัน
						</h3>
						<div className="grid grid-cols-2 gap-3 text-sm">
							<div className="bg-slate-50 rounded-xl p-3">
								<p className="text-xs text-slate-400 mb-1">Workflow Status</p>
								<span
									className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[docStatus?.in_workflow_status || ""] || "bg-slate-100 text-slate-700"}`}
								>
									{docStatus?.in_workflow_status || "—"}
								</span>
							</div>
							<div className="bg-slate-50 rounded-xl p-3">
								<p className="text-xs text-slate-400 mb-1">Flow State</p>
								<span className="font-mono text-xs font-semibold text-slate-700">
									{docStatus?.in_flow_state || "—"}
								</span>
							</div>
							<div className="bg-slate-50 rounded-xl p-3 col-span-2">
								<p className="text-xs text-slate-400 mb-1">
									Current Owner (จาก DB)
								</p>
								<p className="font-semibold text-slate-800 text-sm">
									{docStatus?.in_is_parallel
										? "NULL (อยู่ระหว่างการพิจารณาแบบคู่ขนาน)"
										: docStatus?.current_owner_name || "—"}
									{!docStatus?.in_is_parallel &&
										docStatus?.current_owner_role && (
											<span
												className={`ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLORS[docStatus.current_owner_role] || "bg-slate-100"}`}
											>
												{ROLE_LABELS[docStatus.current_owner_role] ||
													docStatus.current_owner_role}
											</span>
										)}
								</p>
							</div>
						</div>
					</div>

					{docStatus?.parallelTracks && docStatus.parallelTracks.length > 0 && (
						<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
							<h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
								<i className="bx bx-shuffle text-violet-500" /> Parallel Tracks
								(แทร็กคู่ขนานย่อย)
							</h3>
							<div className="space-y-3">
								{docStatus.parallelTracks.map((t) => (
									<div
										key={t.pa_id}
										className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs"
									>
										<div>
											<p className="font-semibold text-slate-800">
												{t.ag_name}
											</p>
											<p className="text-[10px] text-slate-400 mt-0.5">
												ผู้พิจารณาขณะนี้:{" "}
												<span className="font-medium text-slate-600">
													{t.owner_name || "—"}
												</span>
												{t.owner_role && (
													<span
														className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${ROLE_COLORS[t.owner_role] || "bg-slate-100"}`}
													>
														{ROLE_LABELS[t.owner_role] || t.owner_role}
													</span>
												)}
											</p>
										</div>
										<span
											className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
												t.pa_status === "COMPLETED"
													? "bg-green-100 text-green-800"
													: t.pa_status === "REJECTED"
														? "bg-red-100 text-red-800"
														: t.pa_status === "IN_PROGRESS"
															? "bg-sky-100 text-sky-800"
															: "bg-slate-100 text-slate-600"
											}`}
										>
											{t.pa_status}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{testerState === "ACTIVE" && !isCompleted && (
						<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
							<h3 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
								<i className="bx bx-joystick text-violet-400" /> ควบคุม Workflow
							</h3>

							<div>
								<span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
									1. ผู้ดำเนินการ (แสดงเป็นใคร)
								</span>
								<select
									value={currentActorId}
									onChange={(e) =>
										setCurrentActorId(
											e.target.value ? Number(e.target.value) : "",
										)
									}
									className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
								>
									<option value="">— เลือกผู้ดำเนินการ —</option>
									{allUsers.map((u) => {
										const isTrackOwner = docStatus?.parallelTracks?.some(
											(t) =>
												t.current_owner_id === u.a_id &&
												["PENDING", "IN_PROGRESS"].includes(t.pa_status),
										);
										return (
											<option key={u.a_id} value={u.a_id}>
												[{ROLE_LABELS[u.a_role] || u.a_role}] {u.a_name}{" "}
												{isTrackOwner ? "⭐️ (เจ้าของแทร็กคู่ขนาน)" : ""}
											</option>
										);
									})}
								</select>
								{currentActor && (
									<p className="mt-1 text-xs text-slate-400">
										สังกัด:{" "}
										{currentActor.agency_name || currentActor.a_position || "—"}
									</p>
								)}
							</div>

							{currentActorId && (
								<div>
									<div className="flex rounded-xl border border-slate-200 overflow-hidden mb-3">
										<button
											type="button"
											className={`flex-1 py-2 text-xs font-semibold transition ${actionMode === "forward" ? "bg-violet-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
											onClick={() => setActionMode("forward")}
										>
											<i className="bx bx-send mr-1" />
											ส่งต่อ (Forward)
										</button>
										<button
											type="button"
											className={`flex-1 py-2 text-xs font-semibold transition ${actionMode === "reject" ? "bg-rose-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
											onClick={() => setActionMode("reject")}
										>
											<i className="bx bx-undo mr-1" />
											ตีกลับ (Reject)
										</button>
									</div>

									<span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
										2. ผู้รับ{actionMode === "forward" ? "ต่อ" : "การตีกลับ"} (จาก
										Routing Engine จริง)
									</span>

									{loadingAssignees ? (
										<div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
									) : useParallelAssign && actionMode === "forward" ? (
										<div className="space-y-3">
											<div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-700">
												<p className="font-semibold flex items-center gap-1.5 mb-1">
													<i className="bx bx-shuffle text-base" />{" "}
													จะทำการส่งพิจารณาแบบคู่ขนาน (Parallel Assign)
												</p>
												<p>
													ระบบจะสร้างแทร็กคู่ขนานเพื่อส่งไปยังผู้อำนวยการส่วนของกองงานปลายทางเหล่านี้โดยอัตโนมัติ:
												</p>
											</div>
											<div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 text-xs">
												{docStatus?.assignedAgencies?.map((ag) => (
													<div
														key={ag.ag_id}
														className="flex items-center gap-1.5 font-medium text-slate-700"
													>
														<i className="bx bx-subdirectory-right text-slate-400" />
														{ag.ag_name}
													</div>
												))}
											</div>

											<div className="mt-3">
												<span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
													3. ความเห็น (ไม่บังคับ)
												</span>
												<textarea
													value={comments}
													onChange={(e) => setComments(e.target.value)}
													rows={2}
													placeholder="เพิ่มความเห็นสำหรับการกระจายงาน..."
													className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
												/>
											</div>

											<button
												type="button"
												onClick={handleParallelAssign}
												disabled={loading}
												className="w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 active:scale-95 transition disabled:opacity-50"
											>
												{loading ? (
													<>
														<i className="bx bx-loader-alt animate-spin" />{" "}
														กำลังส่ง...
													</>
												) : (
													<>
														<i className="bx bx-shuffle" /> กระจายงานพิจารณาคู่ขนาน
													</>
												)}
											</button>
										</div>
									) : actionMode === "forward" ? (
										nextAssignees.length === 0 ? (
											<p className="text-xs text-slate-400 italic py-2">
												ไม่พบผู้รับต่องานจาก Routing Engine (ตรวจสอบ Flow State)
											</p>
										) : (
											<>
												<select
													value={selectedTarget}
													onChange={(e) =>
														setSelectedTarget(
															e.target.value ? Number(e.target.value) : "",
														)
													}
													className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
												>
													<option value="">— เลือกผู้รับต่อ —</option>
													{nextAssignees.map((u: AdminUser) => (
														<option key={u.a_id} value={u.a_id}>
															[{ROLE_LABELS[u.a_role] || u.a_role}] {u.a_name}
															{u.is_acting ? " (รักษาการ)" : ""}
														</option>
													))}
												</select>

												<div className="mt-3">
													<span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
														3. ความเห็น (ไม่บังคับ)
													</span>
													<textarea
														value={comments}
														onChange={(e) => setComments(e.target.value)}
														rows={2}
														placeholder="เพิ่มความเห็น..."
														className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
													/>
												</div>

												<div className="flex gap-2 mt-3">
													<button
														type="button"
														onClick={handleForward}
														disabled={loading || !selectedTarget}
														className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
													>
														{loading ? (
															<>
																<i className="bx bx-loader-alt animate-spin" />{" "}
																กำลังส่ง...
															</>
														) : (
															<>
																<i className="bx bx-send" /> Forward
															</>
														)}
													</button>

													{isPendingClose && (
														<button
															type="button"
															onClick={handleClose}
															disabled={loading || !currentActorId}
															className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-600 to-green-600 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
														>
															{loading ? (
																<>
																	<i className="bx bx-loader-alt animate-spin" />{" "}
																	กำลังปิด...
																</>
															) : (
																<>
																	<i className="bx bx-check-circle" /> Close
																	Workflow
																</>
															)}
														</button>
													)}
												</div>
											</>
										)
									) : rejectAssignees.length === 0 ? (
										<p className="text-xs text-slate-400 italic py-2">
											ไม่พบผู้รับการตีกลับจาก Routing Engine
										</p>
									) : (
										<>
											<select
												value={selectedRejectTarget}
												onChange={(e) =>
													setSelectedRejectTarget(
														e.target.value ? Number(e.target.value) : "",
													)
												}
												className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
											>
												<option value="">— เลือกผู้รับการตีกลับ —</option>
												{rejectAssignees.map((u: AdminUser) => (
													<option key={u.a_id} value={u.a_id}>
														[{ROLE_LABELS[u.a_role] || u.a_role}] {u.a_name}
													</option>
												))}
											</select>

											<div className="mt-3">
												<span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
													3. ความเห็น (ไม่บังคับ)
												</span>
												<textarea
													value={comments}
													onChange={(e) => setComments(e.target.value)}
													rows={2}
													placeholder="เพิ่มความเห็น..."
													className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
												/>
											</div>

											<div className="mt-3">
												<button
													type="button"
													onClick={handleReject}
													disabled={loading || !selectedRejectTarget}
													className="w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-rose-600 to-red-600 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
												>
													{loading ? (
														<>
															<i className="bx bx-loader-alt animate-spin" />{" "}
															กำลังตีกลับ...
														</>
													) : (
														<>
															<i className="bx bx-undo" /> Reject
														</>
													)}
												</button>
											</div>
										</>
									)}
								</div>
							)}
						</div>
					)}

					{testerState === "DONE" && (
						<div className="bg-linear-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
							<p className="text-4xl">🎉</p>
							<h3 className="text-lg font-bold text-emerald-700">
								Workflow สำเร็จ!
							</h3>
							<p className="text-sm text-emerald-600">
								หนังสือ #{docId} มีสถานะ COMPLETED แล้ว
							</p>
							<button
								type="button"
								onClick={handleCleanup}
								disabled={loading}
								className="mt-2 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
							>
								<i className="bx bx-trash" /> ล้างข้อมูลทดสอบ
							</button>
						</div>
					)}
				</div>

				<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col">
					<h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
						<i className="bx bx-history text-slate-400" /> Workflow History
						(Live จาก DB)
					</h3>
					<div className="flex-1 overflow-y-auto max-h-96 space-y-2 pr-1 custom-scrollbar">
						{!docStatus?.history || docStatus.history.length === 0 ? (
							<p className="text-sm text-slate-400 italic text-center py-8">
								ยังไม่มีประวัติ
							</p>
						) : (
							docStatus.history.map((h, idx) => (
								<div
									key={h.id ?? idx}
									className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white transition"
								>
									<div className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-base shadow-sm">
										{ACTION_ICONS[h.action] || "•"}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-2 flex-wrap">
											<span className="text-xs font-bold text-slate-700">
												{h.action}
											</span>
											<span className="text-[10px] text-slate-400 whitespace-nowrap">
												{new Date(h.created_at).toLocaleTimeString("th-TH")}
											</span>
										</div>
										<p className="text-xs text-slate-600 mt-0.5">
											<span className="font-medium">{h.from_user_name}</span>
											{h.to_user_name && (
												<>
													{" "}
													→{" "}
													<span className="font-medium">{h.to_user_name}</span>
												</>
											)}
										</p>
										{h.comments && (
											<p className="text-[11px] text-slate-400 mt-0.5 italic truncate">
												"{h.comments}"
											</p>
										)}
									</div>
								</div>
							))
						)}
						<div ref={logEndRef} />
					</div>
					<div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
						<p className="text-xs text-slate-400">
							{docStatus?.history?.length || 0} รายการ
						</p>
						<button
							type="button"
							onClick={() => docId && refreshStatus(docId)}
							disabled={loading}
							className="text-xs text-violet-600 hover:underline flex items-center gap-1"
						>
							<i className="bx bx-refresh" /> รีเฟรช
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

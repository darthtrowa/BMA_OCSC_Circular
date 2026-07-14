import moment from "moment/min/moment-with-locales";
import { useEffect, useState } from "react";
import Select from "react-select";
import Swal from "sweetalert2";
import ResultCards, {
	type CircularItem,
} from "../components/public/ResultCards";
import StatsCards from "../components/public/StatsCards";

moment.locale("th");

import { LOGO_URL, publicApi } from "../api/apiService";

interface SelectOption {
	value: string | number;
	label: string;
}

interface YearItem {
	year_id: number;
	year_value: string;
}

interface AgencyItem {
	ag_id: number;
	ag_name: string;
	parent_ag_id?: number | null;
}

interface CategoryItem {
	cat_id: number;
	cat_name: string;
}

interface ResultItem {
	results_id: number;
	results_detail: string;
}

interface MatiWorkItem {
	mw_id: number;
	mw_name: string;
	mw_date: string;
	[key: string]: unknown;
}

interface MatiKkItem {
	mkk_id: number;
	mkk_name: string;
	mkk_date: string;
	[key: string]: unknown;
}

interface FiltersData {
	year: YearItem[];
	agency: AgencyItem[];
	categories: CategoryItem[];
	results: ResultItem[];
	mati_work: MatiWorkItem[];
	mati_kk: MatiKkItem[];
}

interface CardInfo {
	id: string;
	resultId: number | null;
}

export default function PublicPage() {
	const [filters, setFilters] = useState<FiltersData | null>(null);
	const [results, setResults] = useState<CircularItem[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [statsData, setStatsData] = useState<Record<string, number> | null>(
		null,
	);
	const [searchDone, setSearchDone] = useState(false);
	const [activeCard, setActiveCard] = useState<CardInfo | null>(null); // card ที่กดอยู่
	const [searchForm, setSearchForm] = useState<{
		in_year_id: SelectOption[];
		ag_id: SelectOption[];
		cat_id: SelectOption[];
		in_mkk_id: SelectOption[];
		in_results_id: SelectOption[];
		in_mw_id: SelectOption[];
		in_status_id: SelectOption[];
		in_num_date: string;
		in_detail: string;
	}>({
		in_year_id: [],
		ag_id: [],
		cat_id: [],
		in_mkk_id: [],
		in_results_id: [],
		in_mw_id: [],
		in_status_id: [],
		in_num_date: "",
		in_detail: "",
	});

	// โหลด filter dropdowns และสถิติ
	useEffect(() => {
		publicApi
			.getFilters()
			.then((data) => {
				if (data) {
					const lastItems = ["ไม่ระบุ", "*ไม่พิจารณา", "ไม่พิจารณา"];
					const sortList = (list, key) => {
						if (!list) return [];
						const top = list.filter(
							(i) => !lastItems.some((last) => (i[key] || "").includes(last)),
						);
						const bottom = list.filter((i) =>
							lastItems.some((last) => (i[key] || "").includes(last)),
						);
						return [...top, ...bottom];
					};

					data.results = sortList(data.results, "results_detail");
					data.mati_kk = sortList(data.mati_kk, "mkk_name");
					data.mati_work = sortList(data.mati_work, "mw_name");
				}
				setFilters(data);
			})
			.catch(() =>
				Swal.fire({ icon: "error", text: "ไม่สามารถโหลดข้อมูลตัวกรอง" }),
			);

		publicApi
			.getStats()
			.then((data) => setStatsData(data))
			.catch(() => {});
	}, []);

	const makeOptions = <T,>(
		arr: T[] | undefined | null,
		idKey: keyof T,
		labelFn: (item: T) => string | number | null,
	): SelectOption[] =>
		(arr || []).map((item) => ({
			value: item[idKey] as unknown as string | number,
			label: String(labelFn(item) || ""),
		}));

	const formatMati = (
		item: Record<string, unknown> | null | undefined,
		nameKey: string,
		dateKey: string,
	) => {
		if (!item) return null;
		const name = (item[nameKey] as string) || "";
		const d = item[dateKey] as string | undefined;
		const isDummyDate = d && moment(d).format("YYYY-MM-DD") === "2222-01-01";

		if (!d || isDummyDate || name.includes("รอเข้า")) {
			return name && name !== "ไม่ระบุ" ? name : null;
		}
		return `ครั้งที่ ${name} วันที่ ${moment(d).locale("th").add(543, "year").format("DD MMM YYYY")}`;
	};

	const handleSearch = async (e) => {
		e.preventDefault();
		const hasFilter = Object.entries(searchForm).some(([, v]) =>
			Array.isArray(v) ? v.length > 0 : v.trim() !== "",
		);
		if (!hasFilter)
			return Swal.fire({ icon: "info", text: "โปรดระบุข้อมูลเพื่อค้นหา..." });

		setLoading(true);
		setActiveCard(null);
		try {
			const payload = {
				in_year_id: searchForm.in_year_id.map((o) => o.value),
				ag_id: searchForm.ag_id.map((o) => o.value),
				cat_id: searchForm.cat_id.map((o) => o.value),
				in_mkk_id: searchForm.in_mkk_id.map((o) => o.value),
				in_results_id: searchForm.in_results_id.map((o) => o.value),
				in_mw_id: searchForm.in_mw_id.map((o) => o.value),
				in_status_id: searchForm.in_status_id.map((o) => o.value),
				in_num_date: searchForm.in_num_date,
				in_detail: searchForm.in_detail,
			};
			const data = await publicApi.search(payload);
			setResults(data);
			setSearchDone(true);
		} catch (err) {
			Swal.fire({
				icon: "error",
				text: err.response?.data?.message || "เกิดข้อผิดพลาด",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleClear = () => {
		setSearchForm({
			in_year_id: [],
			ag_id: [],
			cat_id: [],
			in_mkk_id: [],
			in_results_id: [],
			in_mw_id: [],
			in_status_id: [],
			in_num_date: "",
			in_detail: "",
		});
		setResults(null);
		setSearchDone(false);
		setActiveCard(null);
	};

	// กด Stats Card: toggle filter หรือสั่งค้นหาทันทีหากยังไม่มีข้อมูล
	const handleCardClick = async (card: CardInfo) => {
		// กรณีมีข้อมูลอยู่แล้ว ให้ทำ local filter ปกติ
		if (results) {
			if (activeCard?.id === card.id) {
				setActiveCard(null);
			} else {
				setActiveCard(card);
			}
			return;
		}

		// กรณีที่ยังไม่ได้ค้นหา (results เป็น null) ให้สั่ง Auto-Search ตามเงื่อนไขของ card นั้น
		setLoading(true);
		setActiveCard(card);
		try {
			const payload = {
				in_year_id: [],
				ag_id: [],
				cat_id: [],
				in_mkk_id: [],
				in_results_id: [], // ดึงทั้งหมดเสมอ เพื่อรักษายอดรวมใน StatCard
				in_mw_id: [],
				in_status_id: [],
				in_num_date: "",
				in_detail: "",
			};
			const data = await publicApi.search(payload);
			setResults(data);
			setSearchDone(true);
		} catch (err) {
			console.error("Auto-search error:", err);
			Swal.fire({ icon: "error", text: "ไม่สามารถโหลดข้อมูลได้ในขณะนี้" });
		} finally {
			setLoading(false);
		}
	};

	// ข้อมูลที่ใช้แสดงใน ResultTable (กรองตาม card ที่เลือก)
	const displayData = (() => {
		if (!results) return [];
		const filtered =
			activeCard && activeCard.id !== "all"
				? results.filter(
						(item) => item.results?.results_id === activeCard.resultId,
					)
				: results;

		const extractWNumber = (text: string) => {
			if (!text) return 0;
			const match = text.match(/\/ว\s*(\d+)/i);
			return match?.[1] ? parseInt(match[1], 10) : 0;
		};

		return [...filtered].sort((a, b) => {
			const yearDiff =
				(Number(b.year?.year_value) || 0) - (Number(a.year?.year_value) || 0);
			if (yearDiff !== 0) return yearDiff;
			const numA = extractWNumber(a.in_num_date);
			const numB = extractWNumber(b.in_num_date);
			const numDiff = numB - numA;
			if (numDiff !== 0) return numDiff;
			return (Number(b.in_id) || 0) - (Number(a.in_id) || 0);
		});
	})();

	const selectStyle = {
		control: (b) => ({
			...b,
			minHeight: "40px",
			borderColor: "#e2e8f0",
			borderRadius: "0.75rem",
			padding: "2px 8px",
			boxShadow: "none",
			background: "#f8fafc",
			"&:hover": { borderColor: "#065f46", background: "#fff" },
		}),
		valueContainer: (b) => ({ ...b, padding: "0 6px" }),
		input: (b) => ({ ...b, margin: "0" }),
		menu: (b) => ({ ...b, zIndex: 9999, borderRadius: "0.75rem" }),
	};

	return (
		<div className="min-h-screen bg-linear-to-br from-[#eef7f2] to-[#dcfce7] font-saochingcha text-slate-800 pb-12">
			{/* Header */}
			<header className="py-4 px-4 bg-white/50 backdrop-blur-md shadow-sm sticky top-0 z-40">
				<div className="container mx-auto">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<div className="mr-4 w-12 h-12 bg-white rounded-full overflow-hidden shadow-md relative">
								<img
									src={LOGO_URL}
									alt="Logo"
									className="absolute inset-0 w-full h-full object-contain p-1"
									onError={(e) => {
										(e.target as HTMLImageElement).style.display = "none";
										(
											(e.target as HTMLImageElement).nextSibling as HTMLElement
										).style.display = "block";
									}}
								/>
								<i className="bx bx-spreadsheet text-3xl text-white hidden"></i>
							</div>
							<div>
								<h1 className="text-xl m-0 font-bold text-emerald-800 leading-tight">
									ระบบสืบค้นผลการพิจารณาหนังสือเวียนของสำนักงาน ก.พ.
								</h1>
								<small className="text-gray-500 text-sm">
									สำนักงานคณะกรรมการข้าราชการกรุงเทพมหานคร
								</small>
							</div>
						</div>

						<div className="flex gap-2">
							<a
								href="/bma_ocsc_circular/admin/login"
								className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-md"
							>
								<i className="bx bx-user mr-2 text-lg"></i>สำหรับเจ้าหน้าที่
							</a>
							<a
								href="https://docs.google.com/forms/d/e/1FAIpQLSdkqK5KxLxvG-nenSYNhbq2m2fctMmvQNG_i5B1m4Z-vC08Kg/viewform"
								target="_blank"
								rel="noreferrer"
								className="flex items-center px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm bg-white"
							>
								<i className="bx bx-edit mr-2 text-lg"></i>แบบประเมินความพึงพอใจ
							</a>
						</div>
					</div>
				</div>
			</header>

			<div className="container mx-auto px-4 mt-8">
				{/* Stats Cards */}
				<StatsCards
					data={statsData}
					resultsData={searchDone && results ? results : null}
					activeCardId={activeCard?.id || null}
					onCardClick={handleCardClick}
				/>

				{/* Search Form */}
				<div className="bg-white/80 backdrop-blur shadow-lg border border-white rounded-2xl overflow-hidden mt-8 mb-10">
					<div className="p-6 md:p-8">
						<h5 className="font-bold text-emerald-800 mb-4 text-xl flex items-center">
							<i className="bx bx-search mr-3 text-2xl"></i>
							ค้นหาหนังสือเวียนของสำนักงาน ก.พ.
						</h5>
						<hr className="mb-6 border-emerald-100" />
						<form onSubmit={handleSearch}>
							<div className="grid grid-cols-1 md:grid-cols-12 gap-5">
								{/* แถวที่ 1: ปี, เลขที่, ชื่อเรื่อง */}
								<div className="md:col-span-2">
									<label
										htmlFor="in_year_id"
										className="block text-sm font-semibold text-slate-700 mb-1"
									>
										ปี พ.ศ.
									</label>
									<Select
										inputId="in_year_id"
										isMulti
										placeholder="ปี"
										styles={selectStyle}
										menuPortalTarget={document.body}
										options={makeOptions(
											filters?.year,
											"year_id",
											(i: YearItem) => i.year_value,
										)}
										value={searchForm.in_year_id}
										onChange={(v) =>
											setSearchForm({
												...searchForm,
												in_year_id: v as SelectOption[],
											})
										}
									/>
								</div>

								<div className="md:col-span-4">
									<label
										htmlFor="in_num_date"
										className="block text-sm font-semibold text-slate-700 mb-1"
									>
										เลขที่หนังสือ/ลงวันที่
									</label>
									<input
										id="in_num_date"
										type="text"
										className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
										placeholder="ระบุเลขที่..."
										value={searchForm.in_num_date}
										onChange={(e) =>
											setSearchForm({
												...searchForm,
												in_num_date: e.target.value,
											})
										}
									/>
								</div>

								<div className="md:col-span-6">
									<label
										htmlFor="in_detail"
										className="block text-sm font-semibold text-slate-700 mb-1"
									>
										ชื่อเรื่อง
									</label>
									<input
										id="in_detail"
										type="text"
										className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
										placeholder="ระบุชื่อเรื่อง..."
										value={searchForm.in_detail}
										onChange={(e) =>
											setSearchForm({
												...searchForm,
												in_detail: e.target.value,
											})
										}
									/>
								</div>

								{/* แถวที่ 2: ผู้รับผิดชอบ, หมวดหมู่, ผลการพิจารณา */}
								<div className="md:col-span-4">
									<label
										htmlFor="ag_id"
										className="block text-sm font-semibold text-slate-700 mb-1"
									>
										ผู้รับผิดชอบ
									</label>
									<Select
										inputId="ag_id"
										isMulti
										placeholder="เลือกผู้รับผิดชอบ"
										styles={selectStyle}
										menuPortalTarget={document.body}
										options={makeOptions(
											filters?.agency?.filter(
												(a: AgencyItem) => !a.parent_ag_id,
											),
											"ag_id",
											(i: AgencyItem) => i.ag_name,
										)}
										value={searchForm.ag_id}
										onChange={(v) =>
											setSearchForm({
												...searchForm,
												ag_id: v as SelectOption[],
											})
										}
									/>
								</div>

								<div className="md:col-span-4">
									<label
										htmlFor="cat_id"
										className="block text-sm font-semibold text-slate-700 mb-1"
									>
										หมวดหมู่
									</label>
									<Select
										inputId="cat_id"
										isMulti
										placeholder="เลือกหมวดหมู่"
										styles={selectStyle}
										menuPortalTarget={document.body}
										options={makeOptions(
											filters?.categories,
											"cat_id",
											(i: CategoryItem) => i.cat_name,
										)}
										value={searchForm.cat_id}
										onChange={(v) =>
											setSearchForm({
												...searchForm,
												cat_id: v as SelectOption[],
											})
										}
									/>
								</div>

								<div className="md:col-span-4">
									<label
										htmlFor="in_results_id"
										className="block text-sm font-semibold text-slate-700 mb-1"
									>
										ผลการพิจารณา
									</label>
									<Select
										inputId="in_results_id"
										isMulti
										placeholder="เลือกผลการพิจารณา"
										styles={selectStyle}
										menuPortalTarget={document.body}
										options={makeOptions(
											filters?.results,
											"results_id",
											(i: ResultItem) => i.results_detail,
										)}
										value={searchForm.in_results_id}
										onChange={(v) =>
											setSearchForm({
												...searchForm,
												in_results_id: v as SelectOption[],
											})
										}
									/>
								</div>

								{/* แถวที่ 3: มติคณะทำงาน, มติ ก.ก. */}
								<div className="md:col-span-4">
									<label
										htmlFor="in_mw_id"
										className="block text-sm font-semibold text-slate-700 mb-1"
									>
										มติคณะทำงาน
									</label>
									<Select
										inputId="in_mw_id"
										isMulti
										placeholder="ระบุมติคณะทำงาน"
										styles={selectStyle}
										menuPortalTarget={document.body}
										options={makeOptions(
											filters?.mati_work,
											"mw_id",
											(i: MatiWorkItem) => formatMati(i, "mw_name", "mw_date"),
										)}
										value={searchForm.in_mw_id}
										onChange={(v) =>
											setSearchForm({
												...searchForm,
												in_mw_id: v as SelectOption[],
											})
										}
									/>
								</div>

								<div className="md:col-span-8">
									<label
										htmlFor="in_mkk_id"
										className="block text-sm font-semibold text-slate-700 mb-1"
									>
										มติ ก.ก.
									</label>
									<Select
										inputId="in_mkk_id"
										isMulti
										placeholder="ระบุมติ ก.ก."
										styles={selectStyle}
										menuPortalTarget={document.body}
										options={makeOptions(
											filters?.mati_kk,
											"mkk_id",
											(i: MatiKkItem) => formatMati(i, "mkk_name", "mkk_date"),
										)}
										value={searchForm.in_mkk_id}
										onChange={(v) =>
											setSearchForm({
												...searchForm,
												in_mkk_id: v as SelectOption[],
											})
										}
									/>
								</div>
							</div>

							<div className="flex justify-end mt-8">
								<button
									type="button"
									className="flex items-center px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl mr-3 hover:bg-slate-100 transition shadow-sm bg-white font-semibold"
									onClick={handleClear}
								>
									<i className="bx bx-reset mr-2 text-lg"></i>ล้างค่า
								</button>
								<button
									type="submit"
									className="flex items-center px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-md font-semibold"
									disabled={loading}
								>
									{loading ? (
										<>
											<i className="bx bx-loader-alt animate-spin mr-2 text-xl"></i>
											กำลังค้นหา...
										</>
									) : (
										<>
											<i className="bx bx-search mr-2 text-xl"></i>ค้นหาข้อมูล
										</>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>

				{/* Results */}
				{!searchDone && !loading && (
					<div className="text-center py-16 text-slate-400 bg-white/50 backdrop-blur rounded-2xl border border-white shadow-sm">
						<i className="bx bx-search-alt text-6xl opacity-30 mb-4"></i>
						<p className="mt-2 text-lg">
							กรุณาระบุเงื่อนไขและกดปุ่ม{" "}
							<strong className="text-emerald-700">ค้นหาข้อมูล</strong>
						</p>
					</div>
				)}

				{searchDone && results !== null && <ResultCards data={displayData} />}
			</div>
		</div>
	);
}

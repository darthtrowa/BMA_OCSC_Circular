import puppeteer, { type Browser } from "puppeteer";
import pool from "../config/database.js";

const OCSC_CIRCULAR_URL =
	"https://www.ocsc.go.th/laws/laws-order/circulating-letters/";

export interface BotPayload {
	doc_num: string;
	year: string;
	title: string;
	extracted_date: string;
	original_pdf: string;
	full_text: string;
}

export interface BotFinding {
	title: string;
	href: string;
	payload: BotPayload;
}

/**
 * Scrapes the OCSC website using a headless browser to bypass Cloudflare
 * and saves new circulars to c_bot_findings queue.
 */
export const syncOCSC = async () => {
	console.log(
		`[BOT] [${new Date().toISOString()}] Starting OCSC Circular Sync with Puppeteer...`,
	);
	console.log(`[BOT] Target URL: ${OCSC_CIRCULAR_URL}`);

	let browser: Browser | undefined;
	try {
		console.log("[BOT] Launching browser...");
		browser = await puppeteer.launch({
			headless: true,
			timeout: 60000,
			args: [
				"--disable-dev-shm-usage",
				"--disable-blink-features=AutomationControlled",
				"--no-sandbox",
				"--disable-setuid-sandbox",
			],
		});

		console.log("[BOT] Browser launched. Opening new page...");
		const page = await browser.newPage();
		// Spoof user agent to appear as a normal browser
		await page.setUserAgent(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		);

		// Hide webdriver to bypass automated browser detection
		await page.evaluateOnNewDocument(() => {
			Object.defineProperty(navigator, "webdriver", {
				get: () => undefined,
			});
		});

		console.log("[BOT] Navigating to OCSC with cache-buster...");
		const cacheBusterUrl = `${OCSC_CIRCULAR_URL}?t=${Date.now()}`;
		await page.goto(cacheBusterUrl, {
			waitUntil: "networkidle2",
			timeout: 45000,
		});

		console.log("[BOT] Waiting for initial page load...");
		await new Promise((r) => setTimeout(r, 5000));

		console.log("[BOT] Reloading page to trigger AJAX...");
		await page.reload({ waitUntil: "networkidle2" });

		console.log("[BOT] Waiting for AJAX result cards to render...");
		await new Promise((r) => setTimeout(r, 10000));

		console.log("[BOT] Extracting links...");
		const links = (await page.evaluate(() => {
			interface BotPayload {
				doc_num: string;
				year: string;
				title: string;
				extracted_date: string;
				original_pdf: string;
				full_text: string;
			}
			const results: { title: string; href: string; payload: BotPayload }[] =
				[];
			document.querySelectorAll("a.search-result-card.laws").forEach((el) => {
				const href = el.getAttribute("href") || "";
				const codeText = el.querySelector("div > p")?.textContent?.trim() || ""; // "ว 9/2569"
				const titleText = el.querySelector("div > div > p")?.textContent?.trim() || ""; // Title
				const docNumText = el.querySelector("div > div > div > span")?.textContent?.trim() || ""; // "เลขที่หนังสือ: นร 1008/ว 9"

				let docNum = docNumText.replace("เลขที่หนังสือ:", "").trim();
				if (!docNum) {
					const docNumMatch = titleText.match(/(นร\s*\d+(?:\.\d+)?\s*\/\s*ว\s*\d+)/);
					if (docNumMatch) docNum = docNumMatch[1].replace(/\s+/g, " ");
				}

				let year = "";
				const yearMatch = codeText.match(/ว\s*\d+\/(\d{4})/);
				if (yearMatch) {
					year = yearMatch[1];
				} else {
					const fallbackYear = titleText.match(/ว\s*\d+\/(\d{4})/);
					if (fallbackYear) year = fallbackYear[1];
				}

				let extractedDate = "";
				const dateMatch = titleText.match(/ลงวันที่\s+([0-9]+\s+[ก-ฮa-zA-Z]+\s+[0-9]{4})/);
				if (dateMatch) extractedDate = dateMatch[1];

				results.push({
					title: titleText.substring(0, 250),
					href,
					payload: {
						doc_num: docNum,
						year: year,
						title: titleText,
						extracted_date: extractedDate,
						original_pdf: href,
						full_text: `${codeText} ${titleText} ${docNumText}`,
					},
				});
			});
			return results;
		})) as BotFinding[];

		let newItemsCount = 0;

		// Deduplicate array based on URL before inserting to save DB trips
		// STAB-04: Cap at 100 links to prevent resource exhaustion from malformed pages
		const uniqueLinks = Array.from(
			new Map(links.map((item) => [item.href, item])).values(),
		).slice(0, 100);

		for (const link of uniqueLinks) {
			// Dedup: check if this circular already exists in c_information by doc_num + year
			const payload = link.payload || {};
			if (payload.doc_num && payload.year) {
				const { rows: existing } = await pool.query(
					`
          SELECT c_information.in_id FROM c_information
          LEFT JOIN c_year ON c_information.in_year_id = c_year.year_id
          WHERE c_information.in_num_date ILIKE $1 AND c_year.year_value ILIKE $2
          LIMIT 1
        `,
					[`%${payload.doc_num}%`, `%${payload.year}%`],
				);
				if (existing.length > 0) {
					console.log(
						`[BOT] Skipping (already in system): ${payload.doc_num} / ${payload.year}`,
					);
					continue;
				}
			}

			try {
				const res = await pool.query(
					`
          INSERT INTO c_bot_findings (bot_title, bot_url, bot_date, bot_status, bot_payload)
          VALUES ($1, $2, CURRENT_DATE, 'PENDING', $3)
          ON CONFLICT (bot_url) DO UPDATE SET bot_payload = EXCLUDED.bot_payload WHERE c_bot_findings.bot_status = 'PENDING'
        `,
					[link.title, link.href, link.payload],
				);
				if (res.rowCount && res.rowCount > 0) {
					console.log(`[BOT] Found new circular: ${link.title}`);
					newItemsCount++;
				}
			} catch (err) {
				const error = err as Error;
				console.error(
					`[BOT] DB Insert Error for "${link.title}":`,
					error.message,
				);
			}
		}

		// STAB-05: Removed unused dbPromises array (was dead code)
		console.log(
			`[BOT] Sync finished. Added ${newItemsCount} new circular(s) to the staging queue.`,
		);

		return { success: true, count: newItemsCount };
	} catch (error) {
		const err = error as Error;
		console.error(`[BOT] Error syncing OCSC: ${err.message}`);
		return { success: false, error: err.message };
	} finally {
		if (browser) {
			await browser.close().catch(console.error);
		}
	}
};

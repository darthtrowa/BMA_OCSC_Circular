import puppeteer from 'puppeteer';
import pool from '../config/database.js';

const OCSC_CIRCULAR_URL = 'https://www.ocsc.go.th/laws/laws-order/circulating-letters/';

/**
 * Scrapes the OCSC website using a headless browser to bypass Cloudflare
 * and saves new circulars to c_bot_findings queue.
 */
export const syncOCSC = async () => {
  console.log(`[BOT] [${new Date().toISOString()}] Starting OCSC Circular Sync with Puppeteer...`);
  console.log(`[BOT] Target URL: ${OCSC_CIRCULAR_URL}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true, // Use headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    // Spoof user agent to appear as a normal browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('[BOT] Navigating to OCSC...');
    // waitUntil networkidle2 ensures page is fully loaded, including CF challenges
    await page.goto(OCSC_CIRCULAR_URL, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait an additional 3 seconds just to let any slow-rendering JS complete
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('[BOT] Extracting links...');
    const links = await page.evaluate(() => {
      const results: { title: string, href: string, payload: any }[] = [];
      document.querySelectorAll('a').forEach(el => {
        const title = el.textContent?.trim() || '';
        let href = el.getAttribute('href') || '';
        const cleanTitle = title.replace(/\s+/g, ' ');

        // Requirement: Skip if does not contain "/ว"
        if (!cleanTitle.includes('/ว')) return;

        if (href.startsWith('/')) {
          href = `https://www.ocsc.go.th${href}`;
        }
        if (!href.startsWith('http')) return;

        // Try to extract Date (ลงวันที่)
        let extractedDate = '';
        const dateMatch = cleanTitle.match(/ลงวันที่\s+([0-9]+\s+[ก-ฮa-zA-Z]+\s+[0-9]{4})/);
        if (dateMatch) extractedDate = dateMatch[1];

        // Try to extract Document Number (เลขที่หนังสือ)
        let docNum = '';
        const docNumMatch = cleanTitle.match(/(นร\s*\d+(?:\.\d+)?\s*\/\s*ว\s*\d+)/);
        if (docNumMatch) docNum = docNumMatch[1].replace(/\s+/g, ' '); // Clean up internal spaces
        else {
           // Fallback in case "นร" is not there but "ว" is there, e.g. "ว 5/2569"
           const fallbackDoc = cleanTitle.match(/(ว\s*\d+\/\d{4})/);
           if (fallbackDoc) docNum = fallbackDoc[1];
        }

        // Try to extract Year (ปี)
        let year = '';
        const yearMatch = cleanTitle.match(/ว\s*\d+\/(\d{4})/);
        if (yearMatch) year = yearMatch[1];

        // Clean up the main title to not be 500 chars long
        let shortTitle = cleanTitle;
        const titleMatch = cleanTitle.match(/ว\s*\d+\/\d{4}\s+(.*?)\s+เลขที่หนังสือ:/);
        if (titleMatch) shortTitle = titleMatch[1];

        results.push({ 
          title: shortTitle.substring(0, 250), 
          href,
          payload: {
            doc_num: docNum,
            year: year,
            title: shortTitle,
            extracted_date: extractedDate,
            original_pdf: href,
            full_text: cleanTitle
          }
        });
      });
      return results;
    });

    let newItemsCount = 0;
    const dbPromises: Promise<void>[] = [];

    // Deduplicate array based on URL before inserting to save DB trips
    const uniqueLinks = Array.from(new Map(links.map(item => [item.href, item])).values());

    for (const link of uniqueLinks) {
      // Dedup: check if this circular already exists in c_information by doc_num + year
      const payload = link.payload || {};
      if (payload.doc_num && payload.year) {
        const { rows: existing } = await pool.query(`
          SELECT c_information.in_id FROM c_information
          LEFT JOIN c_year ON c_information.in_year_id = c_year.year_id
          WHERE c_information.in_num_date ILIKE $1 AND c_year.year_value ILIKE $2
          LIMIT 1
        `, [`%${payload.doc_num}%`, `%${payload.year}%`]);
        if (existing.length > 0) {
          console.log(`[BOT] Skipping (already in system): ${payload.doc_num} / ${payload.year}`);
          continue;
        }
      }

      try {
        const res = await pool.query(`
          INSERT INTO c_bot_findings (bot_title, bot_url, bot_date, bot_status, bot_payload)
          VALUES ($1, $2, CURRENT_DATE, 'PENDING', $3)
          ON CONFLICT (bot_url) DO UPDATE SET bot_payload = EXCLUDED.bot_payload WHERE c_bot_findings.bot_status = 'PENDING'
        `, [link.title, link.href, link.payload]);
        if (res.rowCount && res.rowCount > 0) {
          console.log(`[BOT] Found new circular: ${link.title}`);
          newItemsCount++;
        }
      } catch (err: any) {
        console.error(`[BOT] DB Insert Error for "${link.title}":`, err.message);
      }
    }

    await Promise.all(dbPromises);
    console.log(`[BOT] Sync finished. Added ${newItemsCount} new circular(s) to the staging queue.`);
    
    return { success: true, count: newItemsCount };
  } catch (error: any) {
    console.error(`[BOT] Error syncing OCSC: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close().catch(console.error);
    }
  }
};

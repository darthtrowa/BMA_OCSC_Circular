import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSRF protection: validate hostname is not internal
function isInternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '169.254.169.254') return true;
  if (h === '::1' || h === '[::1]' || h === '[::]') return true;
  if (h.startsWith('10.') || h.startsWith('192.168.')) return true;
  if (h.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return true;
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true; // IPv6 private
  if (h.match(/^0x/i) || h.match(/^\d+$/) || h.match(/^0\d/)) return true; // Octal/Decimal IP notation
  return false;
}

// Get API Key from environment
if (!process.env.GEMINI_API_KEY) {
  console.warn('[AI Service] ⚠️ GEMINI_API_KEY is not set. AI summarization will be unavailable.');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function extractTextFromPdf(pdfPath: string): Promise<string> {
  let dataBuffer: Buffer;

  if (pdfPath.startsWith('http')) {
    const parsedUrl = new URL(pdfPath);
    if (isInternalHost(parsedUrl.hostname)) {
      throw new Error('ไม่อนุญาตให้ดึงข้อมูลจากเครือข่ายภายใน');
    }
    try {
      // BP-04: Add timeout to external requests
      const response = await axios.get(pdfPath, { responseType: 'arraybuffer', maxRedirects: 0, timeout: 15000 });
      dataBuffer = Buffer.from(response.data);
    } catch (err: any) {
      if (err.response && err.response.status >= 300 && err.response.status < 400) {
        throw new Error('ไม่อนุญาตให้ Redirect ไปยังแหล่งข้อมูลภายนอก');
      }
      throw err;
    }
  } else {
    const absoluteUploads = path.resolve(__dirname, '../../../uploads');
    const fullPath = path.resolve(absoluteUploads, pdfPath);
    if (!fullPath.startsWith(absoluteUploads)) {
      throw new Error('Invalid file path');
    }
    // STAB-07: Use async file read to avoid blocking event loop
    try {
      dataBuffer = await fsp.readFile(fullPath);
    } catch (e: any) {
      if (e.code === 'ENOENT') throw new Error(`ไม่พบไฟล์ PDF ในระบบ: ${pdfPath}`);
      throw e;
    }
  }

  const parser = new PDFParse({ data: dataBuffer });
  const data = await parser.getText();
  await parser.destroy();
  return data.text || '';
}

async function getPdfBuffer(pdfPath: string): Promise<Buffer> {
  if (pdfPath.startsWith('http')) {
    const parsedUrl = new URL(pdfPath);
    if (isInternalHost(parsedUrl.hostname)) {
      throw new Error('ไม่อนุญาตให้ดึงข้อมูลจากเครือข่ายภายใน');
    }
    try {
      // BP-04: Add timeout to external requests
      const response = await axios.get(pdfPath, { responseType: 'arraybuffer', maxRedirects: 0, timeout: 15000 });
      return Buffer.from(response.data);
    } catch (err: any) {
      if (err.response && err.response.status >= 300 && err.response.status < 400) {
        throw new Error('ไม่อนุญาตให้ Redirect ไปยังแหล่งข้อมูลภายนอก');
      }
      throw err;
    }
  } else {
    const absoluteUploads = path.resolve(__dirname, '../../../uploads');
    const fullPath = path.resolve(absoluteUploads, pdfPath);
    if (!fullPath.startsWith(absoluteUploads)) {
      throw new Error('Invalid file path');
    }
    // STAB-07: Use async file read to avoid blocking event loop
    try {
      return await fsp.readFile(fullPath);
    } catch (e: any) {
      if (e.code === 'ENOENT') throw new Error(`ไม่พบไฟล์ PDF ในระบบ: ${pdfPath}`);
      throw e;
    }
  }
}

export async function summarizePdf(payload: { mainPdf?: string, attachments?: string[] }): Promise<{ summary: string, docDate: string, references: any[], qrLink: string }> {
  try {
    let pdfPart: any = null;
    let promptParts = [];

    // 1. อ่านไฟล์หลัก
    if (payload.mainPdf) {
      try {
        const pdfBuffer = await getPdfBuffer(payload.mainPdf);
        pdfPart = {
          inlineData: {
            data: pdfBuffer.toString('base64'),
            mimeType: 'application/pdf'
          }
        };
      } catch (err) {
        console.warn(`[AI Service] Cannot read visual PDF for ${payload.mainPdf}, falling back to text:`, err);
      }

      const mainText = await extractTextFromPdf(payload.mainPdf);
      if (mainText.trim().length >= 10) {
        promptParts.push(`--- ส่วนที่ 1: เนื้อหาหนังสือเวียนหลัก ---\n${mainText.substring(0, 30000)}`);
      }
    }

    // 2. อ่านไฟล์สิ่งที่ส่งมาด้วย
    if (payload.attachments && payload.attachments.length > 0) {
      let attachmentText = '';
      for (let i = 0; i < payload.attachments.length; i++) {
        try {
          const text = await extractTextFromPdf(payload.attachments[i]);
          if (text.trim().length >= 10) {
            attachmentText += `\n[สิ่งที่ส่งมาด้วยไฟล์ที่ ${i + 1}: ${payload.attachments[i]}]\n${text.substring(0, 15000)}\n`;
          }
        } catch (err) {
          console.warn(`ข้ามไฟล์สิ่งที่ส่งมาด้วย ${payload.attachments[i]} เนื่องจากอ่านข้อความไม่ได้`);
        }
      }
      if (attachmentText) {
        promptParts.push(`--- ส่วนที่ 2: สิ่งที่ส่งมาด้วย ---\n${attachmentText}`);
      }
    }

    if (promptParts.length === 0) {
      throw new Error('ไม่สามารถดึงข้อความจากไฟล์ PDF ได้ หรือไฟล์ไม่มีข้อความ');
    }

    // Summarize using Gemini with structured JSON output
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const prompt = `
      คุณคือผู้ช่วยวิเคราะห์และสรุปหนังสือเวียนของสำนักงาน ก.พ. และกรุงเทพมหานคร
      กรุณาวิเคราะห์เอกสาร PDF และข้อความด้านล่างนี้ และให้ผลลัพธ์เป็น JSON Object ตามโครงสร้างนี้เท่านั้น:
      {
        "summary": "สรุปเนื้อหาสำคัญของหนังสือหลัก โดยเน้นวัตถุประสงค์หลัก ข้อกำหนดที่สำคัญ ผู้ที่ต้องถือปฏิบัติ และผลกระทบกับการบริหารงานบุคคลของกรุงเทพมหานคร และหากมีข้อมูลใน 'ส่วนที่ 2: สิ่งที่ส่งมาด้วย' ให้เพิ่มหัวข้อ 'สิ่งที่ส่งมาด้วย' แยกต่างหากด้านล่างพร้อมสรุปใจความสำคัญของสิ่งส่งมาด้วยเหล่านั้นเป็นภาษาไทยที่เป็นทางการและอ่านง่าย (ข้อสำคัญ: 1. ให้ใช้เลขอารบิคเท่านั้น 2. ห้ามใส่เครื่องหมายดอกจัน * หรือ ** ในเนื้อหานี้สำหรับการเน้นคำ การจัดวรรคตอน หรือหัวข้อย่อยเด็ดขาด ให้ใช้ข้อความธรรมดา การเว้นวรรค และการขึ้นบรรทัดใหม่แทน)",
        "docDate": "วันที่ของหนังสือเวียน/ลงวันที่ เช่น '10 ตุลาคม 2568' หรือ '2 มกราคม 2567' (ให้กรอกเฉพาะข้อความวันที่ที่ระบุในเอกสารจริงๆ เท่านั้น หรือหากไม่พบให้ใส่เป็นค่าว่าง \"\")",
        "references": [
          {
            "number": "เลขที่หนังสือเวียน/เลขที่หนังสืออ้างอิงทั้งหมดที่เกี่ยวข้องที่พบในเอกสาร เช่น 'ว 36', 'นร 1008/ว 14' (หากไม่มีให้ใส่เป็นอาเรย์ว่าง [])",
            "date": "วันที่ของหนังสือเวียนอ้างอิงนั้น เช่น '10 ตุลาคม 2568' หรือ '2 มกราคม 2567' (ระบุเฉพาะกรณีที่มีการระบุวันที่ในเอกสารอ้างอิงนั้นจริงๆ เท่านั้น หากไม่มีการระบุให้ใส่ค่าว่าง \"\")"
          }
        ],
        "qrLink": "ลิงก์ URL ที่ถอดรหัสได้จากรูปภาพ QR Code ที่ปรากฏในหน้าเอกสาร PDF (เช่น ลิงก์ไปยังหน้าเว็บรายละเอียดของสำนักงาน ก.พ. มักขึ้นต้นด้วย http หรือ https) หากหาไม่พบ หรือไม่มี QR Code หรือสแกนลิงก์ไม่ได้ ให้ตอบเป็นค่าว่าง \"\" เท่านั้น"
      }

      ข้อมูลประกอบ/ส่วนที่ส่งมาด้วย:
      ${promptParts.join('\n\n')}
    `;

    let attempt = 0;
    const maxRetries = 4;
    let delayMs = 1500;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          console.log(`[AI Service] Retrying Gemini summarization, attempt ${attempt}/${maxRetries} after ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff: 1.5s -> 3s -> 6s -> 12s
        }

        const contentParams: any[] = [prompt];
        if (pdfPart) {
          contentParams.push(pdfPart);
        }

        const result = await model.generateContent(contentParams);
        const response = await result.response;
        const textOutput = response.text();

        try {
          const parsed = JSON.parse(textOutput);
          let summary = parsed.summary || '';
          if (summary) {
            summary = summary.replace(/\*/g, ''); // Programmatically strip asterisks
          }
          return {
            summary: summary,
            docDate: parsed.docDate || '',
            references: Array.isArray(parsed.references) ? parsed.references : [],
            qrLink: parsed.qrLink || ''
          };
        } catch (jsonErr) {
          console.warn('[AI Service] Failed to parse JSON response from Gemini:', jsonErr);
          let summary = textOutput || '';
          if (summary) {
            summary = summary.replace(/\*/g, ''); // Programmatically strip asterisks
          }
          return {
            summary: summary,
            docDate: '',
            references: [],
            qrLink: ''
          };
        }
      } catch (error: any) {
        lastError = error;
        attempt++;

        const status = error?.status || error?.statusCode || error?.response?.status;
        const msg = (error?.message || '').toLowerCase();
        const isTransient = (status === 503 || status === 429 || status === 408 || status === 500 || status === 502 || status === 504) ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('service unavailable') ||
          msg.includes('busy') ||
          msg.includes('overloaded') ||
          msg.includes('temporary') ||
          msg.includes('demand') ||
          msg.includes('resource exhausted') ||
          msg.includes('rate limit') ||
          msg.includes('timeout');

        if (!isTransient || attempt > maxRetries) {
          break;
        }
        console.warn(`[AI Service] Attempt ${attempt} failed with transient error: "${error.message}".`);
      }
    }

    throw lastError || new Error('ไม่สามารถเชื่อมต่อบริการ AI ได้');

  } catch (error: any) {
    console.error('AI Summarization Error:', error.message);
    throw new Error('เกิดข้อผิดพลาดในการสรุปผลด้วย AI');
  }
}

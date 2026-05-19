import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get API Key from environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function summarizePdf(pdfPath: string): Promise<string> {
  try {
    let dataBuffer: Buffer;

    if (pdfPath.startsWith('http')) {
      // Download from URL
      const response = await axios.get(pdfPath, { responseType: 'arraybuffer' });
      dataBuffer = Buffer.from(response.data);
    } else {
      // Read from local file
      const fullPath = path.join(__dirname, '../../../uploads', pdfPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error('ไม่พบไฟล์ PDF ในระบบ');
      }
      dataBuffer = fs.readFileSync(fullPath);
    }

    // Extract text from PDF using PDFParse class
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    const text = data.text;
    await parser.destroy();

    if (!text || text.trim().length < 10) {
      throw new Error('ไม่สามารถดึงข้อความจากไฟล์ PDF ได้ หรือไฟล์ไม่มีข้อความ');
    }

    // Summarize using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
      คุณคือผู้ช่วยสรุปหนังสือเวียนของสำนักงาน ก.พ. และกรุงเทพมหานคร 
      กรุณาสรุปเนื้อหาสำคัญจากข้อความในหนังสือเวียนนี้ให้กระชับ ได้ใจความ 
      โดยเน้นที่: 
      1. วัตถุประสงค์หลัก 
      2. ข้อกำหนดหรือแนวทางปฏิบัติที่สำคัญ 
      3. ผู้ที่เกี่ยวข้องหรือผู้ที่ต้องถือปฏิบัติ
      
      สรุปเป็นภาษาไทยที่อ่านง่ายและเป็นทางการ
      
      ข้อความจาก PDF:
      ${text.substring(0, 30000)} // Limit text length for safety
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error: any) {
    console.error('AI Summarization Error:', error.message);
    throw new Error('เกิดข้อผิดพลาดในการสรุปผลด้วย AI: ' + error.message);
  }
}

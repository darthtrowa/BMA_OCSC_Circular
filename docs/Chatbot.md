# 🤖 CSC Circular System - แนวทางการประยุกต์ใช้ Cline Free Model Chat

เอกสารนี้ระบุแนวทางและวิธีการนำโปรเจกต์ [Cline Free Model Web Chat](file:///e:/BMA_OCSC_Circular/scratch/Cline_Free_Model_Chat) มาประยุกต์ใช้กับระบบ **CSC Circular System** (ระบบสืบค้นหนังสือเวียน ก.พ.) เพื่อให้ระบบสามารถใช้งาน AI ที่รวดเร็ว ปลอดภัย และมีค่าใช้จ่ายที่เป็นมิตร (หรือฟรี) ผ่าน Cline SDK

---

## 🌟 1. ภาพรวมการทำงานของ Cline Free Model Chat
โปรเจกต์ [Cline Free Model Web Chat](file:///e:/BMA_OCSC_Circular/scratch/Cline_Free_Model_Chat) มีคุณสมบัติเด่นดังนี้:
* ใช้ `@cline/sdk` ในการเชื่อมต่อกับ Cline Provider (`https://api.cline.bot`)
* รองรับโมเดลฟรีชั้นนำ เช่น `deepseek/deepseek-v4-flash`
* มีระบบจัดการ Session ผ่าน OAuth (`.session.json`) ทำให้ผู้ใช้ล็อกอินผ่านเว็บบราวเซอร์เพียงครั้งเดียวและระบบจะทำการรีเฟรชสิทธิ์ให้อัตโนมัติ หรือใช้คีย์ตรงผ่าน `CLINE_API_KEY`
* รองรับการตอบกลับแบบ Real-time Streaming ผ่านระบบ Server-Sent Events (SSE)

---

## 🛠️ 2. แนวทางการประยุกต์ใช้ในระบบ CSC Circular System

### 2.1 ใช้เป็น AI Engine หลัก/สำรอง ในการสรุปหนังสือเวียน (Alternative Summarization Engine)
ปัจจุบันในระบบ บริการหลักในการอ่านและสรุปข้อมูล PDF ของหนังสือเวียนทำงานอยู่ที่ไฟล์ [aiService.ts](file:///e:/BMA_OCSC_Circular/server/src/services/aiService.ts) โดยพึ่งพาโมเดล `gemini-2.5-flash` และจำเป็นต้องมี `GEMINI_API_KEY` 

เราสามารถนำ `@cline/sdk` มาเป็นระบบสรุปผลสำรอง (หรือทดแทนในกรณีที่ต้องการใช้โมเดลฟรีอย่าง DeepSeek) ได้ด้วยวิธีต่อไปนี้:

1. **ติดตั้งโมดูล `@cline/sdk` ในฝั่ง Server:**
   ```bash
   cd server
   npm install @cline/sdk
   ```

2. **กำหนด Configuration ใน `.env` ของ Server:**
   ```env
   CLINE_API_KEY=your_cline_api_key_here
   CLINE_MODEL_ID=deepseek/deepseek-v4-flash
   ```

3. **สร้างฟังก์ชันการเรียกใช้งานใน** [aiService.ts](file:///e:/BMA_OCSC_Circular/server/src/services/aiService.ts):
   ```typescript
   import * as sdk from '@cline/sdk';
   import { extractTextFromPdf } from './aiService.js'; // ดึงฟังก์ชันเดิมมาใช้

   export async function summarizeWithCline(payload: { mainPdf?: string, attachments?: string[] }): Promise<any> {
     try {
       const apiKey = process.env.CLINE_API_KEY;
       const modelId = process.env.CLINE_MODEL_ID || "deepseek/deepseek-v4-flash";
       
       if (!apiKey) {
         throw new Error("CLINE_API_KEY is not set in environment variables.");
       }

       // 1. ดึงข้อความดิบจากไฟล์ PDF
       const mainText = await extractTextFromPdf(payload.mainPdf);
       
       // 2. เริ่มทำงานกับ Cline Agent
       const agent = new sdk.Agent({
         providerId: "cline",
         modelId: modelId,
         apiKey: apiKey,
         systemPrompt: "คุณคือ AI ผู้ช่วยสรุปหนังสือเวียน ตอบกลับข้อมูลเป็นโครงสร้าง JSON เสมอ...",
         tools: []
       });

       const prompt = `กรุณาสรุปเนื้อหาของหนังสือเวียนดังต่อไปนี้:\n${mainText.substring(0, 30000)}`;
       
       // 3. เรียกใช้งาน
       const result = await agent.run(prompt);
       
       // 4. คืนค่าผลลัพธ์ที่ได้กลับไปประมวลผลต่อ
       return JSON.parse(result.outputText);
     } catch (error) {
       console.error("Cline Summarize Error:", error);
       throw error;
     }
   }
   ```

---

### 2.2 สร้างระบบ RAG Chatbot ประมวลผลคำตอบเกี่ยวกับหนังสือเวียน
เนื่องจากฐานข้อมูลมีข้อมูลหนังสือเวียนและรายละเอียดมติเก็บอยู่ในตาราง `c_information` และ `c_results` เราสามารถประยุกต์ใช้เพื่อสร้างห้องสนทนาถาม-ตอบได้:

* **การสืบค้นข้อมูลเชิงความหมาย (Semantic Search):**
  เมื่อผู้ใช้พิมพ์คำถามมายังระบบ API -> ระบบจะใช้ Vector Search (`pgvector`) ค้นหาเอกสารที่เกี่ยวข้อง
* **การส่งบริบท (Context Feeding):**
  นำเนื้อหาหนังสือเวียนที่ค้นพบมาประกบรวมใน System Prompt แล้วส่งต่อให้ Cline SDK
* **การทำ Streaming คำตอบ:**
  นำโครงสร้างระบบ Server-Sent Events (SSE) จากตัวอย่างใน [server.js](file:///e:/BMA_OCSC_Circular/scratch/Cline_Free_Model_Chat/src/server.js) ของโปรเจกต์ต้นแบบมาเขียนเป็น Route ใน Express เพื่อทยอยส่งคำตอบกลับสู่หน้ากาก UI ช่วยลดระยะเวลาที่ผู้ใช้รู้สึกว่าระบบกำลังทำงานช้าลง

---

### 2.3 เครื่องมือช่วยเหลือนักพัฒนาในการเขียนโค้ด (Developer AI Assistant Tools)
คุณสามารถนำโปรเจกต์ [Cline Free Model Web Chat](file:///e:/BMA_OCSC_Circular/scratch/Cline_Free_Model_Chat) รันควบคู่กันไปแบบ Local เพื่อประหยัดค่าใช้จ่ายด้านโมเดลในการพัฒนาโปรเจกต์หลัก

**วิธีการเปิดใช้งานระบบทดสอบ:**
```bash
# 1. ย้ายเข้าไปที่โฟลเดอร์โครงการทดสอบ
cd scratch/Cline_Free_Model_Chat

# 2. ทำการติดตั้ง Dependencies
npm install

# 3. เริ่มต้นรันเซิร์ฟเวอร์
npm start
```
จากนั้นเปิดบราวเซอร์ไปที่ `http://127.0.0.1:3000` เพื่อสนทนากับ AI Agent สำหรับช่วยพัฒนาแอปพลิเคชันหลักต่อได้ทันที

# คู่มือการติดตั้งระบบ Knowledge Management (RAG System)
## สำหรับระบบสืบค้นผลการพิจารณาหนังสือเวียน (CSC Circular)

เอกสารนี้รวบรวมขั้นตอนการติดตั้งระบบบริหารจัดการความรู้ (KM) โดยใช้เทคโนโลยีแบบ Open Source (ฟรี) เพื่อช่วยในการอ่านไฟล์ต้นฉบับ (.docx, .pdf) และใช้ AI สรุปความหรือตอบคำถามจากฐานความรู้

---

### 1. โครงสร้างระบบ (Architecture)
*   **Database**: PostgreSQL + `pgvector` (เก็บเนื้อหาและ Vector)
*   **AI Engine**: [Ollama](https://ollama.com/) (รัน AI ในเครื่องตัวเองฟรี)
*   **Orchestrator**: LangChain.js (เชื่อมต่อระบบเข้าด้วยกัน)
*   **Document Reader**: Mammoth.js (Word) และ PDF-Parse (PDF)

---

### 2. การเตรียมฐานข้อมูล (PostgreSQL + pgvector)
หากคุณใช้ PostgreSQL อยู่แล้ว ให้ทำการเปิดใช้งาน Extension สำหรับเก็บข้อมูลเชิงความหมาย:

```sql
-- รันคำสั่งนี้ใน Database ที่ใช้งานอยู่
CREATE EXTENSION IF NOT EXISTS vector;
```

---

### 3. การติดตั้ง AI Engine (Ollama)
Ollama จะทำหน้าที่เป็น "สมอง" ของระบบที่รันอยู่ในเครื่อง Server ของเราเอง

1.  **ดาวน์โหลด**: ไปที่ [ollama.com/download](https://ollama.com/download) และติดตั้งบน Windows หรือรันผ่าน Docker:
    ```bash
    docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
    ```
2.  **ดาวน์โหลด AI Model**: เปิด Terminal แล้วรันคำสั่งเพื่อโหลด Model ที่รองรับภาษาไทยได้ดี:
    ```bash
    # โหลด Model สำหรับสรุปความและตอบคำถาม
    ollama pull llama3
    
    # โหลด Model สำหรับการค้นหาเชิงความหมาย (Embedding)
    ollama pull nomic-embed-text
    ```

---

### 4. การติดตั้ง Libraries ในโปรเจกต์ (Backend)
รันคำสั่งนี้ในโฟลเดอร์ `server`:

```bash
npm install @langchain/community @langchain/ollama @langchain/core mammoth pdf-parse
```

---

### 5. แนวทางการเขียนโค้ด (Workflow Concept)

#### A. การย่อยเอกสาร (Document Processing)
เมื่อ Admin อัปโหลดไฟล์ ให้ทำการย่อยเป็นชิ้นส่วนเล็กๆ (Chunks):

```javascript
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import mammoth from "mammoth";

async function processDocx(buffer) {
  const { value: text } = await mammoth.extractRawText({ buffer });
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await splitter.splitText(text);
  return chunks;
}
```

#### B. การเก็บข้อมูลความหมาย (Vector Store)
นำชิ้นส่วนที่ได้ไปเก็บใน PostgreSQL:

```javascript
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { OllamaEmbeddings } from "@langchain/ollama";

const embeddings = new OllamaEmbeddings({ model: "nomic-embed-text" });
const vectorStore = await PGVectorStore.initialize(embeddings, {
  postgresConnectionOptions: { connectionString: process.env.DATABASE_URL },
  tableName: "knowledge_chunks",
});

// บันทึก Chunks ลง DB
await vectorStore.addDocuments(chunks.map(text => ({ pageContent: text })));
```

---

### 6. การใช้งาน KM (Retrieval & QA)
เมื่อผู้ใช้ถามคำถาม ระบบจะไปดึงเนื้อหาที่เกี่ยวข้องที่สุดมาตอบ:

```javascript
import { Ollama } from "@langchain/ollama";

async function askQuestion(question) {
  // 1. ค้นหาเนื้อหาที่เกี่ยวข้องที่สุดจาก DB
  const relevantDocs = await vectorStore.similaritySearch(question, 3);
  const context = relevantDocs.map(d => d.pageContent).join("\n");

  // 2. ส่งให้ AI สรุปคำตอบ
  const model = new Ollama({ model: "llama3" });
  const response = await model.invoke(`
    ใช้เนื้อหาต่อไปนี้เพื่อตอบคำถาม: ${context}
    คำถาม: ${question}
    ตอบเป็นภาษาไทยอย่างเป็นทางการ:
  `);
  
  return response;
}
```

---

### 7. แผนการพัฒนา (Roadmap)
1.  **Phase 1**: ติดตั้ง `pgvector` และ `Ollama` ในเครื่อง Server
2.  **Phase 2**: ปรับปรุงหน้า Admin ให้รองรับปุ่ม "วิเคราะห์เอกสาร (Summarize)" หลังอัปโหลดไฟล์
3.  **Phase 3**: เพิ่มหน้า "Knowledge Assistant" ให้เจ้าหน้าที่แชทสอบถามข้อมูลจากฐานความรู้ทั้งหมดได้

---
> **หมายเหตุ**: การรัน Ollama ในเครื่องตนเอง ข้อมูลจะถูกเก็บเป็นความลับภายในหน่วยงาน 100% ไม่มีการส่งข้อมูลออกไปยัง Cloud ภายนอก

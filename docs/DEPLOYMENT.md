# คู่มือการติดตั้งและใช้งานระบบ BMA Circular บน Windows Server

คู่มือนี้จะอธิบายขั้นตอนการติดตั้งระบบทั้งส่วนของ **Backend (API)** และ **Frontend (React)** เพื่อใช้งานจริงบน Windows Server

---

## 1. สิ่งที่ต้องติดตั้ง (Prerequisites)

ก่อนเริ่มการติดตั้ง กรุณาติดตั้งซอฟต์แวร์ดังต่อไปนี้:
1. **Node.js** (แนะนำเวอร์ชัน 18 LTS ขึ้นไป)
2. **PostgreSQL** (แนะนำเวอร์ชัน 14 ขึ้นไป)
3. **PM2** (Process Manager สำหรับ Node.js เพื่อให้รันเบื้องหลังได้ตลอดเวลา)
   - ติดตั้งผ่าน Terminal: `npm install pm2 -g`

---

## 2. ขั้นตอนการติดตั้ง

### 2.1 เตรียมฐานข้อมูล (Database Setup)
1. เปิด **pgAdmin** หรือเครื่องมือจัดการ PostgreSQL
2. สร้าง Database ชื่อ `circular`
3. Import ข้อมูลจากไฟล์ SQL สำรอง (ถ้ามี) หรือสร้าง Table ตามโครงสร้างเดิม

### 2.2 ตั้งค่า Backend (API Server)
1. เข้าไปที่โฟลเดอร์ `server`:
   ```powershell
   cd <พาธโปรเจกต์>\server
   ```
2. ติดตั้ง Dependencies:
   ```powershell
   npm install
   ```
3. ตรวจสอบไฟล์ `.env` ในโฟลเดอร์ `server` ว่าข้อมูลฐานข้อมูลถูกต้อง:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=circular
   JWT_SECRET=L^opNlkilogmL
   ```

### 2.3 ตั้งค่า Frontend (React Client)
1. เข้าไปที่โฟลเดอร์ `client`:
   ```powershell
   cd <พาธโปรเจกต์>\client
   ```
2. ติดตั้ง Dependencies:
   ```powershell
   npm install
   ```
3. ตรวจสอบไฟล์ `.env` ในโฟลเดอร์ `client`:
   ```env
   VITE_API_MODE=real
   VITE_API_BASE_URL=http://localhost:3000
   ```

---

## 3. วิธีการรันระบบ (Execution)

เพื่อให้ระบบทำงานได้ตลอดเวลาบน Windows Server แนะนำให้ใช้ **PM2**

### 3.1 รัน Backend (API)
เปิด Terminal (Admin) และพิมพ์คำสั่ง:
```powershell
cd <พาธโปรเจกต์>\server
pm2 start index.js --name "circular-api"
```

### 3.2 รัน Frontend (React)
มี 2 วิธี:

**วิธีที่ 1: รันแบบ Development (สำหรับทดสอบ)**
```powershell
cd <พาธโปรเจกต์>\client
pm2 start "npm run dev" --name "circular-frontend"
```

**วิธีที่ 2: รันแบบ Production (แนะนำ)**
1. Build โปรเจกต์:
   ```powershell
   cd <พาธโปรเจกต์>\client
   npm run build
   ```
2. ผลลัพธ์จะได้โฟลเดอร์ `dist` นำไฟล์ข้างในไปวางใน **IIS** หรือใช้เครื่องมืออย่าง `serve` เพื่อรัน:
   ```powershell
   npm install -g serve
   pm2 start "serve -s dist -l 5173" --name "circular-frontend"
   ```

---

## 4. คำสั่งจัดการระบบเบื้องต้น (PM2 Commands)

| คำสั่ง | คำอธิบาย |
|--------|----------|
| `pm2 status` | ดูสถานะว่าระบบยังรันอยู่ไหม |
| `pm2 restart all` | เริ่มการทำงานของทุกระบบใหม่ |
| `pm2 logs` | ดู error หรือ log การทำงาน |
| `pm2 stop all` | หยุดการทำงานทั้งหมด |
| `pm2 save` | บันทึกสถานะเพื่อให้เปิดโปรแกรมอัตโนมัติเมื่อ Restart Windows |

---

## 5. การเปิด Port บน Firewall
อย่าลืมเปิด Port ใน Windows Firewall:
- **Port 3000**: สำหรับ API
- **Port 5173**: สำหรับ Frontend (หรือ Port อื่นที่กำหนด)

---
> **หมายเหตุ:** โฟลเดอร์ `Old/` คือโค้ดดั้งเดิม ไม่จำเป็นต้องรันในขั้นตอนนี้ เก็บไว้เพื่ออ้างอิงเท่านั้น

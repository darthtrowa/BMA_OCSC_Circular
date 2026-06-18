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
ระบบได้เตรียม Node.js Script ในการรันไฟล์ Static Build (Production) ไว้แล้ว ซึ่งมีประสิทธิภาพและความเสถียรมากกว่าการรันด้วย Vite Dev Server หรือเครื่องมือ `serve` ทั่วไปบน Windows:

**วิธีที่ 1: รันทุกบริการพร้อมกันผ่าน Ecosystem Config (แนะนำที่สุด)**
เมื่อรันคำสั่งนี้ ระบบจะรัน Backend API (3000), Public Frontend (5173) และ Admin Frontend (5175) พร้อมกันใน Production Mode:
```powershell
# อยู่ที่ Root ของโปรเจกต์
pm2 start ecosystem.config.js
```

**วิธีที่ 2: รันแยกเป็นรายบริการ (Production Mode)**
1. **Build โค้ด Frontend:**
   ```powershell
   # สำหรับหน้าเว็บหลัก (Public)
   cd <พาธโปรเจกต์>\client
   npm install
   npm run build

   # สำหรับหน้าแอดมิน (Admin)
   cd <พาธโปรเจกต์>\client-admin
   npm install
   npm run build
   ```

2. **สั่งรันด้วย PM2 (ในโฟลเดอร์ของแต่ละระบบ):**
   - **รัน Public Frontend (Port 5173):**
     ```powershell
     cd <พาธโปรเจกต์>\client
     pm2 start serve.js --name "ocsc-circular-frontend"
     ```
   - **รัน Admin Frontend (Port 5175):**
     ```powershell
     cd <พาธโปรเจกต์>\client-admin
     pm2 start server.mjs --name "ocsc-circular-admin" --env PORT=5175
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

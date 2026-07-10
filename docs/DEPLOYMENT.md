# 🏛️ คู่มือการติดตั้งและเริ่มทำงานระบบ BMA OCSC Circular (Production)

คู่มือนี้รวบรวมขั้นตอนการติดตั้ง ตั้งค่า และเริ่มทำงานระบบทั้งหมด ทั้งส่วนของ **Backend (API)**, **Public Frontend**, และ **Admin Frontend** บน Windows Server โดยใช้ PM2 เป็นตัวจัดการบริการ (Process Manager)

---

## 🛠️ 1. สิ่งที่ต้องติดตั้งก่อนเริ่ม (Prerequisites)

กรุณาตรวจสอบว่าเซิร์ฟเวอร์ได้รับการติดตั้งซอฟต์แวร์เหล่านี้เรียบร้อยแล้ว:
1. **Node.js** (แนะนำเวอร์ชัน 18 ขึ้นไป หรือ LTS ล่าสุด)
2. **PostgreSQL** (แนะนำเวอร์ชัน 14 ขึ้นไป)
3. **PM2 (Process Manager)** ติดตั้งทั่วทั้งระบบ (Global) ผ่าน Command Line (รันในสิทธิ์ Administrator):
   ```powershell
   npm install pm2 -g
   ```

---

## ⚙️ 2. การตั้งค่าสภาพแวดล้อม (Environment Config)

ระบบมีการทำงานแยกเป็น 3 ส่วนหลัก ซึ่งต้องการการตั้งค่าไฟล์ `.env` ที่ถูกต้องดังนี้:

### 2.1 Backend Server (`/server/.env`)
สร้างหรือแก้ไขไฟล์ `.env` ในโฟลเดอร์ `server` เพื่อระบุการเชื่อมต่อ PostgreSQL และข้อมูลความปลอดภัย:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=รหัสผ่านฐานข้อมูลของคุณ
DB_NAME=ocsc_circular
JWT_SECRET=รหัสลับความปลอดภัยสำหรับสร้างโทเค็น
```

### 2.2 Frontends (`.env.production`)
ตรวจสอบไฟล์ `.env.production` ของส่วนหน้าบ้านทั้ง 3 ส่วนว่าชี้เส้นทาง API ไปที่ Subdirectory ที่ถูกต้อง (ปกติใช้ `/bma_ocsc_circular` เพื่อทำ URL Rewrite ผ่าน IIS):
* **Public Client:** `client/.env.production` -> `VITE_API_BASE_URL="/bma_ocsc_circular"`
* **Admin Client:** `client-admin/.env.production` -> `VITE_API_BASE_URL="/bma_ocsc_circular"`
* **Public Search Client:** `client-public/.env.production` -> `VITE_API_BASE_URL="/bma_ocsc_circular"`

---

## 📦 3. ขั้นตอนการติดตั้ง Dependencies และ Build ระบบ

เนื่องจากระบบใช้ภาษา TypeScript ใน Backend และใช้ Vite สำหรับ Frontend จึงจำเป็นต้องดาวน์โหลดแพ็กเกจและคอมไพล์โค้ดก่อนเริ่มรันระบบเสมอ โดยรันคำสั่งเหล่านี้ตามลำดับ:

```powershell
# 1. ติดตั้งและคอมไพล์โค้ดส่วนหลังบ้าน (Backend Server)
cd server
npm install
npm run build
cd ..

# 2. ติดตั้งและคอมไพล์โค้ดส่วนหน้าเว็บทั่วไป (Public Client)
cd client
npm install
npm run build
cd ..

# 3. ติดตั้งและคอมไพล์โค้ดส่วนควบคุมดูแล (Admin Client)
cd client-admin
npm install
npm run build
cd ..
```

---

## 💾 4. การเตรียมและทดสอบฐานข้อมูล (Database Setup & Diagnostic)

ระบบมีระบบ **Auto-Migrations** อยู่ในตัว (เมื่อสั่งรันเซิร์ฟเวอร์หลังบ้าน จะตรวจเช็คและสร้างตารางที่จำเป็นให้โดยอัตโนมัติ) 

แต่แนะนำให้ตรวจสอบความพร้อมของการเชื่อมต่อก่อนโดยทำตามขั้นตอนดังนี้:
1. เข้าไปที่โฟลเดอร์ `server`
2. รันสคริปต์วินิจฉัยฐานข้อมูล:
   ```powershell
   node diagnose_db.js
   ```
   *สคริปต์นี้จะพยายามเชื่อมต่อและสร้างฐานข้อมูล `ocsc_circular` ให้ทันทีหากระบบตรวจไม่พบ*
3. หากมีไฟล์ข้อมูลสำรองล่าสุด (เช่น `docs/circular_docker_export.sql`) ให้สั่ง Import ข้อมูลเข้า PostgreSQL ก่อนรันเซิร์ฟเวอร์จริง

---

## 🚀 5. วิธีเริ่มทำงานระบบและการเคลียร์โปรเซสเก่า (PM2 Execution)

บริการใหม่ทั้งหมดจะถูกรันผ่านการตั้งค่าในไฟล์ `ecosystem.config.js` ที่อยู่บริเวณ Root Folder โดยจะแสดงผลลัพธ์เป็น 3 บริการหลัก ได้แก่:
1. **bma-ocsc-circular-api** (Port 3000)
2. **bma-ocsc-circular-frontend** (Port 5173)
3. **bma-ocsc-circular-admin** (Port 5175)

### ⚠️ กรณีตรวจพบปัญหาพอร์ตชนกัน (Port Conflict กับชื่อระบบเก่า)
หากเคยรันระบบชื่อเก่า (`ocsc-circular-api`, `ocsc-circular-frontend`, `ocsc-circular-admin`) ค้างไว้ใน PM2 พอร์ตเดิมจะโดนบล็อกและทำให้ชื่อใหม่ไม่สามารถเริ่มทำงานได้ (สถานะจะเป็น `stopped`) ให้แก้ปัญหาโดย:

1. **ลบโปรเซสระบบเก่าออกทั้งหมด:**
   ```powershell
   pm2 delete ocsc-circular-api ocsc-circular-frontend ocsc-circular-admin
   ```
   *(หรือสั่งระบุตาม ID จากตาราง pm2 เช่น: `pm2 delete 0 1 2`)*

2. **สั่งเริ่มบริการระบบชื่อใหม่ที่หยุดอยู่:**
   ```powershell
   pm2 start bma-ocsc-circular-admin bma-ocsc-circular-frontend
   ```

### 🎬 วิธีเริ่มทำงานระบบทั้งหมดตั้งแต่ต้น (โหมดใช้งานจริง)
อยู่ที่ Root Folder ของโปรเจกต์ (เปิด PowerShell ด้วยสิทธิ์ Administrator) และใช้คำสั่งดังนี้:

**วิธีรันผ่านสคริปต์สำเร็จรูป (แนะนำ):**
```powershell
.\start-production.ps1
```
*(สคริปต์นี้จะทำการเปิดบริการ IIS Web Server, รันโปรเซสทั้งหมดผ่าน `ecosystem.config.js` และทำคำสั่ง `pm2 save` ให้อัตโนมัติ)*

**วิธีรันด้วยคำสั่ง PM2 ตรงๆ:**
```powershell
pm2 start ecosystem.config.js
pm2 save
```

---

## 📊 6. คำสั่งจัดการระบบทั่วไป (PM2 Useful Commands)

| คำสั่ง | คำอธิบาย |
| :--- | :--- |
| `pm2 status` หรือ `pm2 list` | ดูสถานะและพอร์ตของทุกบริการที่กำลังทำงานอยู่ |
| `pm2 logs` | เรียกดูประวัติการทำงานและข้อผิดพลาด (Error Logs) ของทุกบริการแบบสดๆ |
| `pm2 restart all` | เริ่มต้นการทำงานของทุกบริการใหม่ทั้งหมด (ใช้หลังดึงโค้ดอัปเดตและ build เสร็จ) |
| `pm2 stop all` | สั่งหยุดการทำงานของทุกบริการชั่วคราว |
| `pm2 save` | บันทึกรายการระบบล่าสุด เพื่อให้ระบบเริ่มบริการใหม่อัตโนมัติเมื่อรีสตาร์ท Windows Server |

# 🐳 คู่มือการติดตั้งระบบ CSC Circular ด้วย Docker

คู่มือนี้สรุปขั้นตอนการติดตั้งและรันระบบผ่าน Docker บนเครื่อง Windows Server หรือเครื่องคอมพิวเตอร์ทั่วไป

---

## 📋 สิ่งที่ต้องเตรียม (Prerequisites)
1. **Docker Desktop**: ติดตั้งให้เรียบร้อย (รองรับ WSL2 หรือ Hyper-V)
2. **Git**: สำหรับดาวน์โหลดโค้ดจาก Repository

---

## 🚀 ขั้นตอนการติดตั้ง (Step-by-Step)

### 1. ดาวน์โหลดโปรเจกต์
ดาวน์โหลดโค้ดจาก GitHub ลงมาที่เครื่อง Server:
```powershell
git clone <URL_REPOSITORY>
cd BMA_OCSC_Circular
```

### 2. ตั้งค่าสภาพแวดล้อม (.env)
สร้างไฟล์ชื่อ **`.env`** ไว้ที่โฟลเดอร์หลักของโปรเจกต์ (Root) และคัดลอกค่าต่อไปนี้ไปวาง:

```env
# --- Database Configuration ---
POSTGRES_USER=admin
POSTGRES_PASSWORD=1956wine
POSTGRES_DB=circular_db

# --- Backend Configuration ---
DATABASE_URL=postgresql://admin:1956wine@db:5432/circular_db
JWT_SECRET=L^opNlkilogmL
NODE_ENV=production

# --- Frontend Configuration ---
VITE_API_BASE_URL=http://localhost:3000
```

### 3. เริ่มการทำงานของระบบ
ใช้คำสั่ง Docker Compose เพื่อสร้างและรันคอนเทนเนอร์ทั้งหมด:
```powershell
docker compose up -d --build
```
*ระบบจะสร้าง Container ทั้งหมด 3 ตัว: Database (PostgreSQL), Backend (Node.js) และ Frontend (Nginx)*

---

## 💾 การนำเข้าข้อมูลฐานข้อมูล (Database Restore)
เมื่อรันครั้งแรก ฐานข้อมูลจะยังว่างเปล่า ให้ใช้ไฟล์สำรองในโฟลเดอร์ `docs/` เพื่อนำเข้าข้อมูลดังนี้:

**คำสั่งสำหรับ Restore:**
```powershell
docker exec -i bma_ocsc_circular-db-1 psql -U admin circular_db < docs/circular_db_backup.sql
```

---

## 💻 การพัฒนาโปรเจกต์ (Development Mode)
หากต้องการแก้ไขโค้ดและเห็นผลทันที (Hot-Reload) โดยไม่ผ่าน Docker ให้ใช้แนวทาง **Local Dev + Port Proxy** ดังนี้:

1. **รันระบบผ่าน PowerShell:**
   ```powershell
   .\start-circular.ps1
   ```
2. **ตั้งค่าพอร์ต 80 (ทำครั้งเดียว):**
   หากต้องการเข้าผ่าน `http://localhost` โดยไม่ต้องพิมพ์พอร์ต `:5173` ให้รันคำสั่งนี้ใน **Admin PowerShell**:
   ```powershell
   netsh interface portproxy add v4tov4 listenport=80 listenaddress=127.0.0.1 connectport=5173 connectaddress=127.0.0.1
   ```

---

## 🌐 การเข้าใช้งานระบบ
เมื่อติดตั้งเสร็จแล้ว สามารถเข้าใช้งานได้ผ่านเบราว์เซอร์:
- **หน้าเว็บหลัก (Frontend)**: [http://localhost](http://localhost) (ใช้ได้ทั้งโหมด Docker และ Local Dev ที่แมปพอร์ตแล้ว)
- **ระบบหลังบ้าน (API Dashboard)**: [http://localhost:3000](http://localhost:3000)

---

## 🛠️ คำสั่งที่ใช้บ่อย (Common Commands)

### กรณีใช้ Docker (Production)
- **เริ่มทำงาน**: `docker compose up -d --build`
- **หยุดการทำงาน**: `docker compose down`

### กรณีใช้ PM2 (Development)
- **เริ่มทำงาน**: `.\start-circular.ps1`
- **ดู Log**: `pm2 logs`
- **หยุดการทำงาน**: `pm2 stop all`

---
> **หมายเหตุ**: หากมีการเปลี่ยนพอร์ตหรือ IP ของเครื่อง Server ให้ตรวจสอบค่า `VITE_API_BASE_URL` ในไฟล์ `.env` และ Build ใหม่ด้วยคำสั่ง `docker compose up -d --build`


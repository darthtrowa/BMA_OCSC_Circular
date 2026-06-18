# 🏛️ CSC Circular System (ระบบสืบค้นการพิจารณาหนังสือเวียน ก.พ.)

ระบบบริหารจัดการและสืบค้นผลการพิจารณาหนังสือเวียนสำนักงาน ก.พ. พัฒนาขึ้นเพื่อใช้งานในสำนักงานคณะกรรมการข้าราชการกรุงเทพมหานคร (สำนักงาน ก.ก.) โดยใช้เทคโนโลยีสมัยใหม่แบบ Full-stack
---

## 🌟 คุณสมบัติเด่น (Features)
- **Public Search Portal**: ระบบสืบค้นข้อมูลสำหรับบุคคลทั่วไป พร้อมตัวกรองที่ละเอียด (ปี พ.ศ., เลขที่หนังสือ, หมวดหมู่, ผลการพิจารณา ฯลฯ)
- **Admin Dashboard**: ระบบจัดการข้อมูลสำหรับเจ้าหน้าที่ (CRUD)
- **Stats Dashboard**: สรุปสถิติการพิจารณาในรูปแบบการ์ดที่สวยงามและตอบสนองได้ทันที
- **Premium UI**: ดีไซน์ทันสมัย ใช้ฟอนต์ "SaoChingcha" และ "Anuphan" เพื่อความสวยงามและอ่านง่าย

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

### Frontend
- **React 18** + **TypeScript**
- **Vite** (Build Tool)
- **Tailwind CSS** (Styling)
- **React Router DOM** (Navigation)
- **SweetAlert2** (Interactive Dialogs)

### Backend
- **Node.js** (Express)
- **Prisma ORM** (Database Management)
- **PostgreSQL** (Database) + **pgvector** (รองรับการค้นหาเชิงลึกในอนาคต)

### Deployment & DevOps
- **Nginx** (Serving Frontend)
- **PM2** (Process Manager)

---

## 🚀 วิธีการติดตั้งและใช้งาน (Quick Start)

### 💻 การติดตั้งและการพัฒนา (Local Development)

#### 1. Backend
```bash
cd server
npm install
npm run dev
```

#### 2. Frontend
```bash
cd client
npm install
npm run dev
```
เปิดเบราว์เซอร์ที่ `http://localhost:5173`

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
BMA_OCSC_Circular/
├── client/              # React Frontend (Vite + TS)
├── server/              # Node.js Express Backend
│   ├── src/             # Source code (TypeScript)
│   └── prisma/          # Database Schema & Migrations
├── docs/                # เอกสารประกอบและไฟล์ Backup ฐานข้อมูล
├── fonts/               # ฟอนต์ที่ใช้ในระบบ (SaoChingcha)
├── uploads/             # ไฟล์เอกสารที่อัปโหลดเข้าสู่ระบบ
└── pgdata/              # (Ignored) โฟลเดอร์เก็บข้อมูลดิบของ PostgreSQL
```

---

## ⚙️ การตั้งค่าคอนฟิก (.env)

| ตัวแปร | คำอธิบาย |
|--------|----------|
| `VITE_API_BASE_URL` | URL ของ Backend API (ปกติคือ http://localhost:3000) |
| `DATABASE_URL` | Connection String สำหรับเชื่อมต่อฐานข้อมูล PostgreSQL |
| `JWT_SECRET` | คีย์สำหรับเข้ารหัส Token (Admin Login) |

---

## 💾 การสำรองข้อมูล (Backup)
คุณสามารถตรวจสอบไฟล์ SQL สำรองล่าสุดได้ที่โฟลเดอร์ `docs/` ซึ่งจะมีการ Export ข้อมูลออกมาสม่ำเสมอเพื่อความปลอดภัย

---

## 🤝 ทีมพัฒนา
สำนักงานคณะกรรมการข้าราชการกรุงเทพมหานคร (สำนักงาน ก.ก.)

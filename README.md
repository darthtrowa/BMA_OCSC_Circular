# BMA Circular — React Frontend

ระบบสืบค้นหนังสือเวียน ก.พ. (React + Vite) — **Standalone Mode**

## 🚀 วิธีรัน

```bash
cd client
npm install
npm run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:5173`

---

## 📁 โครงสร้างโปรเจกต์

```
CSC_Circular/
├── client/              ← React App (Vite)
│   ├── src/
│   │   ├── api/
│   │   │   ├── apiService.js   ← API layer (mock/real switch)
│   │   │   ├── mockData.js     ← ข้อมูลจำลอง
│   │   │   └── apiClient.js    ← (legacy, ไม่ได้ใช้แล้ว)
│   │   ├── components/
│   │   │   ├── admin/          ← Admin components
│   │   │   └── public/         ← Public components
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   └── pages/
│   │       ├── PublicPage.jsx
│   │       ├── LoginPage.jsx
│   │       ├── DashboardPage.jsx
│   │       └── ChatPage.jsx
│   ├── .env             ← ตั้งค่า API mode
│   └── vite.config.js
└── Old/                 ← โค้ด legacy (Node.js/EJS เดิม)
```

---

## ⚙️ การตั้งค่า (`client/.env`)

| ตัวแปร | ค่า | คำอธิบาย |
|--------|-----|----------|
| `VITE_API_MODE` | `mock` | ใช้ข้อมูลจำลอง (ไม่ต้อง backend) |
| `VITE_API_MODE` | `real` | เชื่อมต่อ REST API จริง |
| `VITE_API_BASE_URL` | `http://localhost:3000` | URL ของ backend (ใช้เมื่อ mode=real) |

---

## 🔐 Demo Login (Mock Mode)

| Username | Password |
|----------|----------|
| `admin`  | `admin`  |

---

## 🔄 เชื่อมต่อ Backend จริง

1. แก้ไข `client/.env`:
   ```env
   VITE_API_MODE=real
   VITE_API_BASE_URL=http://your-api-server.com
   ```
2. รัน `npm run dev` ใหม่

---

## 📦 Dependencies

- React 18 + Vite 5
- React Router DOM 6
- Bootstrap 5
- Axios
- SweetAlert2
- React-Select
- Moment.js

---

> **Old/** — เก็บโค้ด legacy (Node.js + EJS + Express) ไว้สำหรับอ้างอิง

iner# คู่มือการติดตั้งและแก้ปัญหา Docker บน Windows Server (Windows Containers)

เอกสารนี้ถูกสรุปจากบทสนทนาการแก้ปัญหาการนำระบบ BMA OCSC Circular ขึ้น Windows Server 2019 โดยใช้ Docker แบบ Windows Containers

## 1. คำสั่งพื้นฐานที่ใช้ในการ Deploy

- **ดึงโค้ดล่าสุดจาก Git:**
  ```powershell
  git pull origin main
  ```
- **คำสั่ง Build ระบบ (สร้าง Image ใหม่):**
  ```powershell
  docker-compose -f docker-compose.windows.yml build
  ```
  _(ใช้ `--no-cache` ต่อท้ายเฉพาะเมื่อต้องการล้าง Cache และบังคับโหลดไฟล์ใหม่ทั้งหมด)_
- **คำสั่งเปิดระบบ (Run Container):**
  ```powershell
  docker-compose -f docker-compose.windows.yml up -d
  ```

## 2. ปัญหาที่พบบ่อยและวิธีแก้ไข (Troubleshooting)

### ปัญหาที่ 1: `docker-compose` is not recognized

**สาเหตุ:** ไม่ได้ติดตั้ง Docker Compose Plugin ไว้ใน Windows Server (ปกติจะมีแค่ Docker Engine)
**วิธีแก้:** ดาวน์โหลดและติดตั้ง docker-compose แบบ standalone

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest "https://github.com/docker/compose/releases/latest/download/docker-compose-windows-x86_64.exe" -UseBasicParsing -OutFile C:\Windows\System32\docker-compose.exe
```

### ปัญหาที่ 2: หน้าจอ Terminal ค้าง นิ่งไปนานมาก

**สาเหตุ:**

1. **QuickEdit Mode:** เผลอคลิกเมาส์โดนหน้าจอ Terminal ทำให้เกิดแถบไฮไลท์สีขาว ซึ่งฟีเจอร์ของ Windows จะสั่ง "Pause" การทำงานของระบบทั้งหมดไว้
   - **วิธีแก้:** กดปุ่ม `Esc` หรือ `Enter` เพื่อปลดล็อกหน้าจอ ระบบจะรันต่อไปเอง
2. **ระบบ Build ค้าง (Hung):** รันคำสั่งค้างไว้แล้ว Container หายไป แต่ Terminal ไม่ยอมไปทำบรรทัดถัดไป
   - **วิธีแก้:** กดปุ่ม `Ctrl + C` ค้างไว้เพื่อหยุดการทำงาน (Abort) จากนั้นรันคำสั่ง `build` ใหม่อีกครั้ง ระบบจะดึง Cache เดิมมาใช้ทำให้เร็วขึ้น

### ปัญหาที่ 3: `npm error` Missing: yaml@2.9.0 from lock file (Strict Lockfile Error)

**สาเหตุ:**
คำสั่ง `npm ci` มีความเข้มงวดสูงมาก หากเวอร์ชันของ npm ระหว่างเครื่องโฮสต์และคอนเทนเนอร์ไม่ตรงกัน หรือโครงสร้าง `package-lock.json` เพี้ยนไปเล็กน้อย ระบบจะพังและแจ้ง Error ทันที (เจอในฝั่งหน้าบ้าน `client-admin` และ `client-public`)

**วิธีแก้ (แก้ไขถาวรในโค้ดแล้ว):**
ทำการเปลี่ยนคำสั่งใน `Dockerfile.windows` จาก `RUN npm ci` เป็น `RUN npm install` ธรรมดาแทน เพื่อให้ระบบมีความยืดหยุ่นในการจัดการเวอร์ชันย่อยและไม่ต้องมานั่งตรวจสอบไฟล์ Lock อย่างเข้มงวด

### ปัญหาที่ 4: `exited - code 0` ใน Portainer คือพังหรือเปล่า?

**สาเหตุ/ความหมาย:**
ไม่พังครับ ถือเป็นข่าวดี การขึ้น `exited - code 0` ระหว่างที่กำลังรัน `build` แปลว่า Container ชั่วคราวนั้นทำงานใน Step นั้น "สำเร็จ 100%" และปิดตัวเองลงเพื่อส่งไม้ต่อให้ Step ถัดไป (ถ้าพังจะขึ้นว่า `code 1` หรือรหัสอื่นๆ)

---

_หมายเหตุ: สถาปัตยกรรม Windows Container มีขนาดใหญ่มาก (ใช้ Windows Server Core ขนาด 3-5 GB) ทำให้การ Build ครั้งแรกจะใช้เวลาดาวน์โหลดและ Extract นานกว่า Linux Container มาก (มักกินเวลาหลัก 15-30 นาที ขึ้นอยู่กับความเร็วอินเทอร์เน็ตของ Server)_

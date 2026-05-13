# คู่มือการติดตั้งระบบบน IIS (Windows Server)

คู่มือนี้สำหรับติดตั้ง **BMA Circular** ให้ทำงานผ่าน IIS โดยใช้แนวทาง **Static Site (Frontend)** + **Reverse Proxy (Backend)**

---

## 1. สิ่งที่ต้องติดตั้งเพิ่ม (Prerequisites)
ก่อนเริ่มใน IIS กรุณาติดตั้ง Module เหล่านี้ (ถ้ายังไม่มี):
1. [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite) (จำเป็นสำหรับการทำ Reverse Proxy และ React Router)
2. [Application Request Routing (ARR) 3.0](https://www.iis.net/downloads/microsoft/application-request-routing) (จำเป็นสำหรับ Reverse Proxy)

---

## 2. ขั้นตอนเตรียมไฟล์
รัน Script ที่เตรียมไว้เพื่อ Build ระบบ:
```powershell
powershell -ExecutionPolicy Bypass -File ".\deploy-iis.ps1"
```

---

## 3. ตั้งค่า IIS สำหรับ Frontend
1. เปิด **IIS Manager**
2. คลิกขวาที่ **Sites** > **Add Website**
3. ตั้งค่า:
   - **Site name**: `BMA-Circular`
   - **Physical path**: `[โฟลเดอร์โปรเจกต์]\client\dist` (โฟลเดอร์ที่ได้จากการ Build)
   - **Port**: `80` (หรือ Port ที่ต้องการ)
4. **แก้ปัญหา React Router (กด Refresh แล้ว 404)**:
   - ตรวจสอบว่ามีไฟล์ `[โฟลเดอร์โปรเจกต์]\client\dist\web.config` หรือยัง? (ถ้ายังไม่มี ให้สร้างไฟล์นี้และใส่โค้ดด้านล่าง)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/(api)" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

---

## 4. ตั้งค่า Reverse Proxy สำหรับ Backend (API)
เพื่อให้เรียก API ผ่านทาง Port เดียวกับ Frontend (เช่น `/api/v1/...`):

1. ใน IIS Manager เลือก Site `BMA-Circular`
2. ดับเบิลคลิกที่ **URL Rewrite**
3. คลิก **Add Rule(s)...** > **Reverse Proxy**
4. หากระบบถามให้เปิดใช้งาน ARR ให้ตอบ **OK/Yes**
5. ในช่อง "Enter the server name or IP..." ให้ใส่: `localhost:3000`
6. คลิก **OK**
7. **สำคัญ**: แก้ไข Rule ที่สร้างขึ้น (Inbound Rules) เพื่อให้รองรับ Path `/api`:
   - Match URL: `^api/(.*)`
   - Action URL: `http://localhost:3000/api/{R:1}`

---

## 5. การตั้งค่าสิทธิ์ (Permissions)
อย่าลืมให้สิทธิ์ User `IIS_IUSRS` เข้าถึงโฟลเดอร์ได้:
1. คลิกขวาที่โฟลเดอร์ `[โฟลเดอร์โปรเจกต์]` > **Properties**
2. ไปที่แท็บ **Security** > **Edit** > **Add**
3. พิมพ์ `IIS_IUSRS` แล้วกด OK
4. ให้สิทธิ์ **Read & execute** และกด OK

---
> **Tip**: หาก Server รีสตาร์ท อย่าลืมรัน `pm2 save` เพื่อให้ Backend รันอัตโนมัติครับ

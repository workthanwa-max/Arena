# Categorized Script Management

## 🐳 Docker Compose Full Stack (แนะนำสำหรับรันครบ 3 Services)
- **บิลด์และสตาร์ต PostgreSQL (:5435) + Go Backend (:7777) + Nginx Frontend (:5555)**
  - คำสั่ง: `docker compose up -d --build`
  - หน้าที่: รัน Database PostgreSQL 16, เซิร์ฟเวอร์เกม Go และ Frontend Nginx พร้อม Reverse Proxy `/api/` + `/ws` และ Gzip
  - ข้อควรระวัง: หากเคยรัน `vite` (`5555`) หรือ `go run` (`7777`) ค้างไว้ในเทอร์มินัล ให้กด `Ctrl+C` หยุดก่อนเพื่อไม่ให้พอร์ตชน
- **ดูสถานะและ Log ของแต่ละ Service**
  - คำสั่ง: `docker compose ps && docker compose logs -f --tail=50`
  - หน้าที่: ตรวจสอบ Healthcheck (`healthy`) และ Log JSON ของ PostgreSQL / Backend / Nginx
- **หยุด Service ทั้งหมด (ยังคงข้อมูล Volume PostgreSQL ไว้)**
  - คำสั่ง: `docker compose down`
  - หน้าที่: ปิดคอนเทนเนอร์ทั้งหมดโดยไม่ลบข้อมูลใน Volume `pulsearena_pgdata`

## 🟢 Development (รันแยกขณะพัฒนา)
- **สตาร์ตเฉพาะ PostgreSQL ใน Docker**
  - คำสั่ง: `docker compose up -d postgres`
  - หน้าที่: เปิด PostgreSQL 16 พร้อม Migration ให้อัตโนมัติที่ `127.0.0.1:5435`
- **รัน Go Backend Server (Port `7777`)**
  - คำสั่ง: `cd go-backend && go run ./cmd/server`
  - หน้าที่: สตาร์ท HTTP + WebSocket Server เชื่อมต่อ `DATABASE_URL` (Postgres)
- **รัน React Dev Server (Port `5555`)**
  - คำสั่ง: `cd Example-Game && npm run dev`
  - หน้าที่: สตาร์ท Vite HMR พร้อม Proxy `/api` และ `/ws` ไปพอร์ต `7777`

## 🔵 Testing & Build
- **รัน Go Unit & Postgres Integration Tests**
  - คำสั่ง: `cd go-backend && TEST_DATABASE_URL="postgres://pulsearena:pulsearena@127.0.0.1:5435/pulsearena?sslmode=disable" go test -race -count=1 -v ./...`
  - หน้าที่: ทดสอบฟิสิกส์การเดิน, ขอบเขต Map (Shibuya & Konoha), ระบบสมาชิก Auth + Admin Seed + Session ถาวร/Logout, รหัสห้อง 6 หลัก, โหมด 3v3 (รอ 6/6, No Friendly Fire, 50 Kills Win), โหมดฝึกซ้อม Dummy (`practice`), คูลดาวน์เกิดใหม่ 7 วิ, สกิลทั้ง 11 ตัว (รวม หลวงพี่ศร/ไซตามะ และ เสี่ยม่อน/โกะโจ), การซิงค์คูลดาวน์ไม่ค้าง `0.1s`, และ PostgreSQL Persistence จริง
- **Build Go Binary**
  - คำสั่ง: `cd go-backend && go build -o bin/game-server ./cmd/server`
  - หน้าที่: คอมไพล์ Binary สำหรับ Production
- **Build & Lint Example-Game**
  - คำสั่ง: `cd Example-Game && npm run lint && npm run build`
  - หน้าที่: ตรวจสอบ oxlint, TypeScript (`tsc -b`) และ Bundle Production (`vite build`)

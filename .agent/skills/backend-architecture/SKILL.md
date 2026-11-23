---
type: skill
name: backend-architecture
description: สถาปัตยกรรมหลังบ้าน Resilient & Domain-Driven Backend Architecture
---

# สถาปัตยกรรมหลังบ้าน: Resilient & Domain-Driven Backend Architecture

## การตั้งค่าเริ่มต้น (Default Configuration Template)

เพื่อให้ระบบหลังบ้าน (Backend Architecture) ทำงานได้อย่างเสถียร ทนทาน และพร้อมขยายตัวตามหลักสถาปัตยกรรม 5 ข้อ หากไม่มีการระบุสเปกเป็นอย่างอื่น ให้ AI ยึดพารามิเตอร์ระดับโครงสร้างพื้นฐานดังต่อไปนี้อย่างเด็ดขาด:
พัฒนา Backend ในโฟลเดอร์ `/Server` ด้วย [Go 1.22+ (Standard Library `net/http` ServeMux ที่รองรับ Method + Path Parameters โดยไม่ต้องพึ่ง HTTP Web Framework ภายนอก)] ภายใต้สถาปัตยกรรม [Domain-Driven Modular Monolith] โดยแยกโครงสร้างโค้ดตาม Business Domain (`auth`, `user`, `crop`, `inventory`, `economy`, `level`, `quest`, `production`, `building`, `time`, `reward`, `media`) อย่างหมดจด และห้ามให้ Module ข้ามไป Query ตาราง Database ของ Module อื่นโดยตรง (Enforced Boundary — ต้องเรียกผ่าน Service/Interface ของ Module นั้น)
รันแอปพลิเคชันที่พอร์ต [`5001`] ผ่านไฟล์เริ่มต้น [`cmd/server/main.go`] และรันด้วย [`go run ./cmd/server` หรือเครื่องมือ Live-Reloading เช่น `air`] ระหว่างพัฒนา (ผู้ใช้รันแยกบน Host นอก Docker)
เชื่อมต่อฐานข้อมูลเชิงสัมพันธ์ระดับ Enterprise [Standalone PostgreSQL (โฟลเดอร์ `/database` แยกเป็นอิสระอยู่นอก `/Server` และรันผ่าน Docker Compose พอร์ต `5433` หรือตาม `.env`)] ผ่าน [GORM (`gorm.io/gorm` + `gorm.io/driver/postgres`)] พร้อมตั้งค่า Connection Pooling (`sql.DB` pool tuning) และ Atomic Transaction Management (`db.Transaction` + `clause.Locking{Strength: "UPDATE"}`) สำหรับธุรกรรมเศรษฐกิจและแลกของรางวัลจริง
จัดการไฟล์รูปภาพและสื่อ (Assets สำหรับพืช ไอเทม อาคาร และของรางวัลชีวิตจริง) ผ่าน [SeaweedFS Object Storage (รันผ่าน Docker Compose)] โดยให้ Backend โมดูล `media` ทำหน้าที่ CRUD ร่วมกับ SeaweedFS (S3/Filer API) และบันทึก File Metadata ลงใน PostgreSQL แบบ Atomic
จัดการ Security และ Network Layer: เปิดการเชื่อมต่อ [Strict CORS ที่ระบุ Origin ฝั่ง Frontend (`http://localhost:5002`) ชัดเจน (ห้ามใช้ `*` ใน Production)] และสร้าง API พื้นฐานสำหรับการทำ Monitoring คือ `GET /health` (พร้อมรีเทิร์นสถานะ PostgreSQL และ SeaweedFS) เพื่อให้พร้อมเชื่อมต่อกับระบบ AIOps หรือ Load Balancer เสมอ
ข้อบังคับสูงสุดด้าน Resilience: ห้าม Hardcode ข้อมูล Configuration เด็ดขาด ต้องจัดการผ่าน [Environment Variables (`.env`) ควบคู่กับการทำ Config Validation ตอน Startup] และเตรียม [Multi-stage Build Dockerfile (Alpine/Distroless)] ที่ฝังกลไก Graceful Shutdown (`signal.NotifyContext` + `http.Server.Shutdown`) เพื่อไม่ให้ Request สูญหายขณะ Container ถูกปิดหรือ Deploy ใหม่
(ทั้งนี้ หากผู้ใช้ระดับ Root Access ต้องการปรับ Stack สามารถแก้ไขข้อความภายในกรอบวงเล็บ [] ได้ทันที)

"A coder builds features. An architect builds resilience."
(คนเขียนโค้ดสร้างฟีเจอร์ แต่สถาปนิกสร้างความอยู่รอดของระบบ)

**🔑 คีย์เวิร์ดสำคัญ:** Modular Monolith, Domain-Driven, Atomic Transactions, Zero-Trust Dependencies

---

## 1. Domain-Driven Modular Monolith (สถาปัตยกรรมหลักอิงตามโดเมนธุรกิจ)
**Core Concept:** ออกแบบโครงสร้างระบบโดยแบ่งแยก Module ตาม Business Services (เช่น Order, Inventory, Payment) ไม่ใช่แบ่งตามบทบาทของผู้ใช้งาน (Roles)
**Impact:** สร้าง Single Source of Truth ป้องกันการเขียนโค้ดซ้ำซ้อน (Duplicate Code) และกำจัด Technical Debt เมื่อมีการสเกลระบบหรือเปลี่ยน Business Logic ทำให้ง่ายต่อการแยกเป็น Microservices ในอนาคตเมื่อถึงจุดที่จำเป็น

## 2. Enterprise-Grade Resilience & Self-Healing (ความทนทานและการฟื้นฟูตัวเอง)
**Core Concept:** ออกแบบระบบภายใต้ปรัชญา "Zero-Trust Dependencies" ไม่ไว้ใจระบบภายนอกหรือฮาร์ดแวร์ที่ไม่สามารถควบคุมได้
**Impact:** มีการวางกลไก Fallback, Circuit Breaker และการชดเชยข้อผิดพลาด (Fault Tolerance) หาก API ภายนอกหรือระบบย่อยล่ม Core System ต้องยังทำงานต่อได้ และมุ่งหน้าสู่การใช้ AIOps เพื่อให้ระบบตรวจสอบและซ่อมแซมตัวเองได้อัตโนมัติ (Self-healing Infrastructure)

## 3. Atomic Transactions & Data Integrity (ความสมบูรณ์ขั้นเด็ดขาดของข้อมูล)
**Core Concept:** จัดการฐานข้อมูลและธุรกรรมด้วยกฎ "All-or-Nothing" (100% หรือ 0% เท่านั้น) โดยเฉพาะระบบที่เชื่อมต่อกับฮาร์ดแวร์หรือการเงิน
**Impact:** หากเกิดข้อผิดพลาดหรือ Network ล่มกลางคัน ระบบมีกลไก Seamless Rollback เพื่อดึงสถานะกลับไปยังจุดเริ่มต้นอย่างสมบูรณ์ ป้องกันปัญหาข้อมูลแหว่งหรือ State ค้างครึ่งๆ กลางๆ (No Partial States)

## 4. Decoupled Authorization & Security (การแยกชั้นความปลอดภัย)
**Core Concept:** ถอดตรรกะการเช็กสิทธิ์ (Role-Based Access Control) ออกจาก Core Business Logic อย่างเด็ดขาด
**Impact:** ใช้ Middleware / Guard layer เป็นด่านหน้าในการคัดกรอง Request จาก Frontend ทำให้ Service ต่างๆ หลังบ้านทำงานบนตรรกะของธุรกิจล้วนๆ โค้ดสะอาดขึ้น และปิดช่องโหว่ด้านความปลอดภัยจากการปะปนโค้ด

## 5. Low-Level Mastery & Performance Optimization (การรีดประสิทธิภาพระดับลึก)
**Core Concept:** รันระบบบนสภาพแวดล้อม Linux-native เพื่อการควบคุมที่เข้าถึงแก่นของทรัพยากรเครื่อง
**Impact:** สามารถรีดประสิทธิภาพการทำ Concurrency (การทำงานพร้อมกันปริมาณมาก) และ Memory Management ได้สูงสุด พร้อมสำหรับการทำ CI/CD Pipeline เพื่อ Automation เต็มรูปแบบ

---

📂 โครงสร้างโฟลเดอร์ (`Server/` — Go Standard Library Modular Monolith + Standalone `/database` & Infra)
เพื่อให้สอดคล้องกับหลักการ "Separation of Concerns", การแยก Database/Object Storage ออกมาเป็น Standalone, และรองรับโมดูลเกมปลูกผักครบทุกโดเมน โครงสร้างทั้งระบบต้องจัดวางดังนี้:

```text
Game-Farm/
├── docker-compose.yml            # รัน PostgreSQL (:5433) และ SeaweedFS (:9333/:8888/:8334)
├── database/                     # 🗄️ Standalone Database Workspace (อยู่นอก /Server)
│   ├── migrations/               # SQL Schema Migrations สำหรับ Postgres
│   └── seeds/                    # ข้อมูลตั้งต้น (พืช, ไอเทม, เควสต์, ของรางวัล)
├── infra/
│   └── seaweedfs/                # ไฟล์คอนฟิก SeaweedFS (s3.json)
│
└── Server/                       # ⚙️ Go Standard Library Backend (Port 5001, รันแยกบน Host)
    ├── go.mod
    ├── .env.example
    ├── cmd/
    │   └── server/
    │       └── main.go           # Entry point + Graceful Shutdown (signal.NotifyContext)
    ├── internal/
    │   ├── api/                  # 🌐 Perimeter Layer (net/http ServeMux, Server, /health)
    │   ├── modules/              # 📦 Domain-Driven Modules (ห้าม Query ข้ามตาราง Domain อื่นตรงๆ)
    │   │   ├── auth/             # ยืนยันตัวตน & Dual-Token JWT
    │   │   ├── user/             # โปรไฟล์ผู้เล่น & สิทธิ์ (RBAC)
    │   │   ├── crop/             # Crop System: ปลูกและเก็บเกี่ยว
    │   │   ├── inventory/        # Inventory System: จัดการสิ่งของ
    │   │   ├── economy/          # Economy System: เงินและการซื้อขาย
    │   │   ├── level/            # Level System: EXP และ Level
    │   │   ├── quest/            # Quest System: ภารกิจ
    │   │   ├── production/       # Production System: การผลิตสินค้า
    │   │   ├── building/         # Building System: การจัดการอาคาร
    │   │   ├── time/             # Time System: คำนวณเวลาในเกม (Server-Authoritative)
    │   │   ├── reward/           # Reward System: แค็ตตาล็อก & แลกของรางวัลชีวิตจริง
    │   │   └── media/            # Media CRUD: จัดการรูปภาพร่วมกับ SeaweedFS + Postgres Metadata
    │   │       ├── handler/      # HTTP Handlers (net/http)
    │   │       ├── service/      # Business Logic แท้ๆ
    │   │       ├── repository/   # Data Access Layer (ผ่าน GORM เท่านั้น)
    │   │       ├── dto/          # Request/Response Structs & Validation
    │   │       ├── entity/       # Domain Models / GORM Entities
    │   │       └── routes.go     # Route registration ของ Domain นี้
    │   │
    │   ├── infrastructure/       # 🏗️ External Adapters
    │   │   ├── database/         # GORM PostgreSQL Connection Pool & Tx Manager
    │   │   ├── storage/          # SeaweedFS HTTP/S3 Client Adapter
    │   │   └── logger/           # Go slog Structured JSON Logger + PII Redaction
    │   │
    │   └── shared/               # 🤝 Common Logic
    │       ├── errors/           # Standard Error Codes & HTTP Mapper
    │       ├── middleware/       # Global Middlewares (AuthGuard, RBAC, CORS :5002, SecurityHeaders, RateLimit)
    │       └── utils/            # Crypto, Time & Validation Helpers
    │
    ├── tests/                    # 🧪 Unit & E2E Tests
    └── Dockerfile                # Multi-stage Alpine/Distroless build (Production)
```



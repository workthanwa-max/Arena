# 🧠 Core Architecture & Skills Index (ศูนย์กลางบัญชาการระบบ)

เอกสารฉบับนี้คือ **"แหล่งความจริงสูงสุด (Single Source of Truth)"** ของโปรเจกต์ ทำหน้าที่เป็นสารบัญรวบรวมสถาปัตยกรรม กฎการเขียนโค้ด และระเบียบปฏิบัติ (Protocols) ทั้งหมด 

เป้าหมายของไฟล์นี้คือการล็อกสเปกให้ AI และผู้พัฒนาทุกคนทำงานภายใต้ **มาตรฐานระดับองค์กร (Enterprise-Grade Standard)** อย่างเคร่งครัด โดยปราศจากการคาดเดา เพื่อประหยัด Token และมุ่งตรงสู่การแก้ปัญหาทางธุรกิจ

## 📋 ทะเบียนสถาปัตยกรรม (Architecture & Skills Registry)

> **Project Stack Baseline (Game-Farm — Web Farming Game with Real-World Rewards):**
> - **Frontend (`/Web`, Port `5002`):** React 19 + Vite 8 + TypeScript 7 (`erasableSyntaxOnly`) + HeroUI v3 + Tailwind CSS v4 + Phaser + GSAP + Zustand + Browser SQLite (`sql.js` Read-Cache Only) + Axios
> - **Backend (`/Server`, Port `5001`):** Go (`net/http` Standard Library) Modular Monolith + GORM (`gorm.io/gorm` + `driver/postgres`) + `slog`
> - **Infrastructure & Data (Docker Compose + Standalone `/database`):** PostgreSQL (`5433`) + SeaweedFS Object Storage (`9333`/`8888`/`8334`)

| โมดูลสกิล (Skill Module) | เลเยอร์ (Layer) | ข้อบังคับและคำอธิบาย (Directives) |
|-------------------------|----------------|----------------------------------|
| [frontend-design](./frontend-design/SKILL.md) | Frontend / UI Design | กฎเหล็ก 6 ข้อ (8-Point Grid, 60-30-10, Hick-Hyman, Modular Scale, WCAG AA, Motion) พร้อม **HeroUI v3 + Tailwind CSS v4 + GSAP + Phaser Tweens** เพื่อความสม่ำเสมอทั้ง DOM Overlay และ Game Canvas |
| [backend-architecture](./backend-architecture/SKILL.md) | Backend Architecture | กฎหมายสูงสุดของระบบหลังบ้าน **Go Standard Library (`net/http`) + GORM** ภายใต้สถาปัตยกรรม **Domain-Driven Modular Monolith** พอร์ต `5001` เชื่อม Standalone PostgreSQL (`/database`) และ SeaweedFS |
| [frontend-architecture](./frontend-architecture/SKILL.md) | Frontend Architecture | โครงสร้างหน้าบ้านแบบ **Role-Isolated Client** พอร์ต `5002` ผสาน **React + HeroUI + Phaser + GSAP + Zustand + SQLite (Cache Only) + Axios** และการแยก Game UI ออกจาก Game Engine อย่างเด็ดขาด |
| [security](./security/SKILL.md) | Security & DevSecOps | ระเบียบปฏิบัติด้านความปลอดภัยระดับ Enterprise (Zero-Trust, Assume Breach, Go `slog` PII Masking) พร้อมระบบป้องกันการโกง (**Server-Authoritative Economy/Time & Atomic Reward Redemption**) |
| [continuous-documentation](./continuous-documentation/SKILL.md) | Documentation & Sync | โปรโตคอลรักษาความถูกต้องของเอกสาร (Auto-Sync) บังคับอัปเดต `README.md`, `project-map.md`, `architecture.md`, `scripts.md` ครอบคลุม `Web` (`npm`), `Server` (`go`), `Docker`, และ `database` |

---

## ⚠️ SYSTEM DIRECTIVE สำหรับ AI (AI Execution Protocol)

**หากคุณเป็น AI ที่กำลังอ่านไฟล์นี้ โปรดปฏิบัติตามคำสั่งต่อไปนี้อย่างเคร่งครัด:**
1. **Context Initialization:** ห้ามเริ่มต้นเขียนหรือแก้ไขโค้ดใดๆ จนกว่าจะตรวจสอบตาราง `Architecture & Skills Registry` ด้านบน 
2. **On-Demand Loading:** เพื่อเป็นการประหยัด Context Window ให้คุณประเมินความต้องการของ Task ปัจจุบัน และดึงเฉพาะไฟล์ `.md` ที่เกี่ยวข้องในตารางด้านบนไปวิเคราะห์เชิงลึกเท่านั้น (เช่น หากต้องทำ API ให้โหลดเฉพาะ `backend-architecture` และ `security`)
3. **Zero Deviation:** ห้ามละเมิด Default Configuration ที่ระบุไว้ในไฟล์สกิลเหล่านั้นเด็ดขาด เว้นแต่ผู้ใช้งาน (User) จะมีคำสั่ง Overwrite อย่างชัดเจน 

**"Read the law. Understand the boundary. Execute with precision."**
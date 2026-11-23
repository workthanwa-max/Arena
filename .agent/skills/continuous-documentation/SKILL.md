---
type: skill
name: continuous-documentation
description: กฎการซิงค์เอกสารอัตโนมัติ (Auto-Sync Protocol)
---

# การจัดการเอกสาร: Continuous Documentation & Auto-Sync Protocol

## การตั้งค่าเริ่มต้น (Default Configuration Template)

เพื่อให้มั่นใจว่าเอกสารของโปรเจกต์ (Documentation) จะถูกต้องและเป็นปัจจุบันเสมอ หากไม่มีการสั่งงานเป็นอย่างอื่น ให้ AI ยึดแนวทางตามค่าเริ่มต้นต่อไปนี้: **[ทุกครั้งที่มีการแก้ไขโค้ด โครงสร้างโฟลเดอร์ หรือเพิ่มฟีเจอร์ใหม่ AI จะต้องตรวจสอบและอัปเดตไฟล์ .md ที่เกี่ยวข้องทันที]** โดยไฟล์หลักที่ต้องคอยอัปเดตประกอบด้วย **[README.md, project-map.md, architecture.md, และ scripts.md]** โดยเฉพาะไฟล์รวบรวมคำสั่ง (Scripts) จะต้องจัดหมวดหมู่คำสั่งที่รันผ่าน **[Multi-Workspace Runners: `npm` (ใน `/Web` พอร์ต `5002`), `go` / `Makefile` (ใน `/Server` พอร์ต `5001`), `docker compose` (สำหรับ PostgreSQL & SeaweedFS), และ SQL Migrations (ใน `/database`)]** และมีคำอธิบายอรรถประโยชน์ที่ชัดเจนเสมอ 

> *"Code tells you how, documentation tells you why. Both must evolve together."*
> (โค้ดบอกว่าทำงานอย่างไร เอกสารบอกว่าทำไปทำไม ทั้งสองอย่างต้องเติบโตไปพร้อมกัน)

**🔑 คีย์เวิร์ดสำคัญ:** Auto-Sync, Living Document, Documentation-Driven, Script Management

---

## 1. Auto-Sync Protocol (กฎการอัปเดตเอกสารอัตโนมัติ)
**Core Concept:** เอกสารในโปรเจกต์คือ "Living Document" ทุกครั้งที่มีการแก้ไขลอจิก, เพิ่มฟีเจอร์, หรือแก้บั๊กใหญ่ AI มีหน้าที่ต้อง "สะท้อน" การเปลี่ยนแปลงนั้นลงในไฟล์เอกสารที่เกี่ยวข้องโดยอัตโนมัติ 
**Impact:** ป้องกันปัญหา "โค้ดไปทาง เอกสารไปทาง" (Documentation Drift) ช่วยให้ผู้พัฒนาหรือ AI ตัวอื่นที่มาสานต่อ มีคู่มือที่ถูกต้อง 100% เสมอ

## 2. โครงสร้างไฟล์เอกสารหลัก (Core Documentation Ecosystem)
ระบบเอกสารควรถูกแยกส่วนตามจุดประสงค์เพื่อให้อ่านง่าย โดย AI ต้องคอยดูแลรักษาไฟล์เหล่านี้:
- **`README.md`:** หน้าต่างบานแรกของโปรเจกต์ อัปเดตเมื่อมีการเปลี่ยนวิธีการติดตั้ง (Setup), Environment Variables, หรือเป้าหมายหลัก
- **`project-map.md`:** แผนที่นำทาง อัปเดตเมื่อมีการสร้าง ลบ หรือย้ายโฟลเดอร์/ไฟล์สำคัญ 
- **`architecture.md` (หรือสกิลเฉพาะ):** อัปเดตเมื่อมีการเปลี่ยน Tech Stack, Flow ข้อมูล, หรือปรับสถาปัตยกรรมระดับลึก

## 3. สคริปต์และคู่มือคำสั่ง (Categorized Script Management)
**Core Concept:** ต้องมีการรวบรวมคำสั่ง (Commands) ที่ใช้ในโปรเจกต์ทั้งหมด (เช่น Command รันเซิร์ฟเวอร์, Build, Docker, Database Migration) ไว้ในไฟล์ `scripts.md` หรือส่วนที่กำหนด
**Rule of Execution:** 
- **หมวดหมู่ชัดเจน:** ต้องแยกคำสั่งตามประเภท เช่น 🟢 Development, 🔵 Production/Build, 🔴 Database, 🟠 DevOps
- **มีคำอธิบายกำกับ:** ทุกคำสั่งต้องบอกว่า "คำสั่งนี้ทำอะไร", "รันเมื่อไหร่", และ "ข้อควรระวังคืออะไร"
**Impact:** ลดข้อผิดพลาด (Human Error) จากการพิมพ์คำสั่งผิด และช่วยลดระยะเวลา Onboarding สำหรับการทำงานในโปรเจกต์

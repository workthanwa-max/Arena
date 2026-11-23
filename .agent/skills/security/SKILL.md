---
type: skill
name: security
description: สถาปัตยกรรมความปลอดภัยระดับองค์กร Zero-Trust, Threat Modeling, Immutable Logging
---

# สถาปัตยกรรมความปลอดภัย: Enterprise-Grade Security & Threat Modeling

## การตั้งค่าเริ่มต้น (Default Configuration)

**แนวทางการรักษาความปลอดภัยระดับองค์กร (Enterprise-Grade Security Guideline)**
เพื่อรับประกันว่าระบบมีภูมิคุ้มกันระดับสูงตามหลัก Zero-Trust Architecture (ไม่ไว้วางใจสิ่งใดแม้แต่อยู่ในเครือข่ายเดียวกัน) และ Assume Breach (ตั้งสมมติฐานว่าระบบถูกบุกรุกอยู่เสมอ) การเขียนโค้ดและออกแบบระบบทั้งหมดต้องยึดแนวทางมาตรฐานตามกรอบวงเล็บ `[...]` ต่อไปนี้:

> *"A beginner builds a wall. A master builds a system where the enemy kills themselves trying to get in."*
> (มือสมัครเล่นสร้างกำแพง แต่นักล่าสร้างระบบที่ศัตรูต้องทำลายตัวเองหากคิดจะบุกรุก)

### 1. Authentication & Identity Management (การยืนยันตัวตนและจัดการสิทธิ์)
- **Token Architecture:** ใช้ระบบ **[JWT แบบ Dual-Token Pattern (Short-lived Access Token อายุ 15 นาที ผ่าน `golang-jwt/jwt/v5` ส่งใน Authorization Bearer Header + Long-lived Refresh Token จัดเก็บใน HTTPOnly, Secure, SameSite=Strict Cookie)]**
- **Password Security:** แฮชรหัสผ่านด้วย **[Argon2id (`golang.org/x/crypto/argon2`) หรือ bcrypt (Cost Factor >= 12)]** ห้ามจัดเก็บ Plaintext หรือใช้อัลกอริทึมที่ล้าสมัย (เช่น MD5, SHA1) เด็ดขาด
- **Token Revocation:** ต้องมีกลไกยกเลิก Token (Refresh Token Rotation & Revocation Hash Table ใน PostgreSQL / In-Memory Store) เมื่อผู้ใช้สั่ง Logout หรือเกิดเหตุการณ์ความเสี่ยงสูง

### 2. Perimeter & Network Defense (การป้องกันด่านหน้าและ API Endpoint)
- **Security Headers:** บังคับใช้ **[Go `net/http` Security Headers Middleware เพื่อตั้งค่า HSTS (`Strict-Transport-Security`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, และ Strict Content Security Policy (CSP)]**
- **Access Control:** กำหนด **[CORS Policy อย่างเข้มงวด โดยอนุญาตเฉพาะ Whitelisted Origins ที่ระบุใน `.env` (เช่น `http://localhost:5002`) เท่านั้น (ห้ามใช้ wildcard `*` ใน Production เด็ดขาด)]**
- **Traffic Control:** ติดตั้ง **[Rate Limiting Middleware (เช่น Token Bucket / Sliding Window 100 requests / 15 minutes per IP และ Strict Limit สำหรับ Auth / Reward Redemption)]** เพื่อป้องกันการโจมตีแบบ Brute Force, Bot Farming และ Denial of Service (DoS)

### 3. Application Security & OWASP Top 10 Defense (การป้องกันระดับโค้ด)
- **Injection Defense:** ป้องกัน SQL Injection โดยการบังคับใช้ **[GORM Parameterized Queries (`?` / struct conditions) เท่านั้น]** ห้ามต่อ String SQL ลงใน `db.Raw()` / `db.Where()` หรือประมวลผลคำสั่ง Dynamic เด็ดขาด
- **XSS & Data Validation:** ตรวจสอบและทำความสะอาดข้อมูลรับเข้า (Input Sanitization) ผ่าน **[Go Strict DTO Struct Validation + `encoding/json` DisallowUnknownFields()]** และสำหรับการอัปโหลดรูปภาพเข้า SeaweedFS ต้องตรวจ **[Magic Bytes (`http.DetectContentType`), MIME Allowlist (`image/png`, `image/jpeg`, `image/webp`), ขนาดไฟล์สูงสุด, และตั้งชื่อ Object Key ใหม่ด้วย UUID]**
- **Least Privilege:** แอปพลิเคชันและ Database User ต้องรันด้วยสิทธิ์ต่ำที่สุดที่จำเป็นต่อการทำงาน (Non-Root User)

### 4. Auditing, Logging & Observability (การบันทึกเพื่อการตรวจสอบ)
- **Logging Standard:** จัดเก็บ Log การทำงานและการเกิด Error ด้วย **[Go Standard Library `log/slog` ในรูปแบบ Structured JSON เพื่อรองรับการวิเคราะห์โดย AIOps / SIEM]**
- **PII Redaction:** บังคับ Mask/Redact ข้อมูลลับเฉพาะ (เช่น Passwords, JWT Tokens, Cookies, ที่อยู่จัดส่งของรางวัลชีวิตจริง, เบอร์โทรศัพท์) ออกจาก Log ก่อนเขียนลง Output โดยเด็ดขาด
- **Log Integrity:** ไฟล์ Log และตาราง Audit Log ของระบบเศรษฐกิจ/แลกของรางวัลต้องบันทึกแบบ **[Append-Only / Immutable Audit Trail]** เพื่อป้องกันการปลอมแปลงประวัติ

### 5. Game & Real-World Reward Anti-Cheat (ความปลอดภัยเฉพาะสำหรับเกมแลกของรางวัลจริง)
- **Server-Authoritative State & Time:** เวลาการเจริญเติบโตของพืช (`Time System`), ผลผลิต, เงิน, EXP, เควสต์ และสต็อกของรางวัลต้องคำนวณและยืนยันที่ Go Server + PostgreSQL เท่านั้น ห้ามเชื่อค่า Timestamp หรือยอดเงินที่ส่งมาจาก Client
- **Client SQLite Untrusted Rule:** Local Database SQLite บน Web Browser ใช้เก็บ **Read Cache และ UI Preferences เท่านั้น** ห้ามนำข้อมูลจาก SQLite ฝั่ง Client มาใช้ตัดสินสิทธิ์ทางเศรษฐกิจหรือแลกของรางวัลโดยเด็ดขาด
- **Atomic Reward Redemption & Anti-Race Condition:** การซื้อขายและการแลกของรางวัลชีวิตจริงต้องทำงานภายใต้ PostgreSQL Atomic Transaction (`db.Transaction`) ร่วมกับ Pessimistic Row-Level Locking (`clause.Locking{Strength: "UPDATE"}`) และ Idempotency Key เพื่อป้องกัน Double-Spend หรือ Concurrent Request Exploit

**🔑 คีย์เวิร์ดควบคุม AI:** Zero-Trust, Assume Breach, Blast Radius Containment, DevSecOps, PII Masking

---

## 1. Continuous Threat Modeling (การวิเคราะห์ภัยคุกคามเชิงกลยุทธ์)

**Core Concept:** ผสมผสาน Base Practice ระดับสากลเข้ากับการทำ Threat Modeling ทุกครั้งก่อนเริ่มเขียนโค้ด ภายใต้แนวคิด "Assume Breach" (สมมติไว้ก่อนเลยว่าระบบโดนเจาะแน่ๆ)
**Impact:** มองสถาปัตยกรรมผ่านเลนส์ของแฮ็กเกอร์ เพื่อหาจุดอ่อน (Vulnerabilities) ตั้งแต่ระดับโครงสร้าง Database ไปจนถึง API Endpoint ทำให้สามารถอุดรอยรั่วตั้งแต่กระบวนการออกแบบ (Design Phase) ก่อนที่จะเสียต้นทุนในการเขียนโค้ดแม้แต่บรรทัดเดียว

## 2. Immovable Defense (สถาปัตยกรรมตั้งรับแบบเบ็ดเสร็จ)

**Zero-Trust Architecture & Blast Radius Containment:**

- **กลไก:** ไม่ไว้ใจใครทั้งสิ้น (Zero-Trust) แม้กระทั่ง Service ที่คุยกันเองหลังบ้าน ทุก Request ต้องถูก Verify สิทธิ์ (เช่น JWT, OAuth) อย่างเด็ดขาด และออกแบบระบบเพื่อ "จำกัดรัศมีวงกว้างของความเสียหาย" (Blast Radius Containment)
- **ผลลัพธ์:** หากมี Component หนึ่งถูกเจาะ แฮ็กเกอร์จะติดอยู่ใน Sandbox หรือข้อจำกัดของ Role นั้นๆ โดยไม่มีสิทธิ์ลุกลาม (Lateral Movement) ไปยัง Core Business Logic ส่วนอื่น

**Data Immutability & Secure Logging:**

- **กลไก:** จัดเก็บ Log การทำธุรกรรมที่ละเอียดอ่อนในรูปแบบที่ "แก้ไขไม่ได้" (Immutable)
- **ผลลัพธ์:** แม้แฮ็กเกอร์จะเจาะระบบหน้าบ้านได้ แต่จะไม่มีใครสามารถลบร่องรอย (Log Tampering) ของตัวเองออกจากระบบหลังบ้านได้ ทำให้สามารถแกะรอยและระบุตัวผู้กระทำผิดได้ 100%

## 3. Proactive & Offensive Defense (การป้องกันเชิงรุกระดับนักล่า)

**Shift-Left Security & DevSecOps (การโจมตีก่อนถูกโจมตี):**

- **กลไก:** ฝังเครื่องมือสแกนหาช่องโหว่ (Automated Vulnerability Scanning) และทดสอบเจาะระบบ (Penetration Testing) เข้าไปใน CI/CD Pipeline ทันที
- **ผลลัพธ์:** โค้ดที่มีช่องโหว่ หรือไลบรารีที่หมดอายุ จะถูกระเบิดทิ้งและปฏิเสธการ Deploy (Build Fail) อัตโนมัติตั้งแต่ตอน Push Code นี่คือการใช้กระบวนการอัตโนมัติ (Automation) เป็นหน่วยลาดตระเวนเชิงรุกที่ไม่รู้จักเหนื่อย

**Chaos Engineering & Anomaly Detection (การทดสอบความตายและดักจับความผิดปกติ):**

- **กลไก:** ไม่รอให้ระบบล่มในวันจริง แต่ใช้แนวคิด Chaos Engineering โจมตีและดับเซิร์ฟเวอร์ตัวเองจำลองในสภาพแวดล้อมเสมือน เพื่อดูว่าระบบสามารถ Self-Heal ได้ตามที่เขียนไว้หรือไม่ ควบคู่กับการมอนิเตอร์ทราฟฟิก (AIOps) เพื่อดักจับพฤติกรรมแปลกประหลาดก่อนที่แฮ็กเกอร์จะรัน Script โจมตีสำเร็จ
- **ผลลัพธ์:** เปลี่ยนสถานะจาก "เหยื่อที่รอการตั้งรับ" ไปเป็น "ผู้คุมกฎ" ที่สามารถแบน IP หรือสกัดกั้นภัยคุกคามล่วงหน้าก่อนที่ระบบจะเกิด Downtime

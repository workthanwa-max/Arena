---
type: skill
name: frontend-architecture
description: สถาปัตยกรรมหน้าบ้าน Role-Driven & Dynamic Client Architecture
---

# สถาปัตยกรรมหน้าบ้าน: Role-Driven & Dynamic Client Architecture

## การตั้งค่าเริ่มต้น (Default Configuration Template)

เพื่อให้สถาปัตยกรรมหน้าบ้าน (Frontend Architecture) ทำงานได้อย่างทรงพลัง เสถียร และปราศจากช่องโหว่ตามกฎ 5 ข้อ หากไม่มีการกำหนดสเปกเป็นอย่างอื่น ให้ AI ยึดพารามิเตอร์ระดับโครงสร้างพื้นฐานดังต่อไปนี้อย่างเด็ดขาด:
พัฒนาด้วยเทคโนโลยี [React 19 + Vite 8 ควบคู่กับ TypeScript 7 (Strict Mode 100%, `erasableSyntaxOnly: true` — ห้ามใช้ TS `enum`, ให้ใช้ `as const` + union types) รันบนพอร์ต `5002`] ภายใต้สถาปัตยกรรมแบบ [Role-Isolated Client] ที่แยกส่วนฝั่งผู้เล่น (`player`) ออกจากฝั่งผู้ดูแลระบบจัดการของรางวัล (`admin`) อย่างหมดจด เพื่อรีดประสิทธิภาพ Bundle Size และปิดกั้นโค้ดฝั่ง Admin ไม่ให้หลุดไปถึงฝั่ง User ทั่วไป
ผสาน [Phaser Game Engine (สำหรับ Farm World, Crop System, Character, Object Interaction, Particle Effects)] เข้ากับ [Game UI Overlay (Resource HUD, Inventory, Shop, Quest, Dialog)] และขับเคลื่อนแอนิเมชันทั้งระบบผ่าน [Animation System แบบทวิภาคี: GSAP สำหรับ DOM/HeroUI Overlays และ Phaser Tweens สำหรับ Canvas World Objects]
บังคับการแยก State และ UI ออกจากกันอย่างเด็ดขาด (Decoupled State & View) โดยจัดการข้อมูลผ่าน [Zustand สำหรับ Client/Game UI State และ Browser Local Database SQLite WASM (`sql.js` + IndexedDB) สำหรับ Local Read-Cache เท่านั้น] — **ห้ามเก็บ Authoritative State (เงิน, ไอเทม, เวลาโตของพืช, สิทธิ์แลกของรางวัลจริง) ใน SQLite ฝั่ง Client เด็ดขาด** เพื่อป้องกันการโกง
เชื่อมต่อ API อย่างรัดกุมผ่านโฟลเดอร์ [Centralized API Repository Layer] ที่ใช้ [Axios] ซึ่งฝังกลไก Interceptor สำหรับการจัดการ Error แบบรวมศูนย์ และการแนบ Authorization Bearer Token + `withCredentials` (HTTPOnly Refresh Cookie) โดยอัตโนมัติ (Zero-Hardcoding API Calls) เชื่อมต่อไปยัง Go Backend พอร์ต `5001`
ควบคุมการเรนเดอร์ UI ทั้งหมดแบบ Data-Driven ด้วย [HeroUI v3 (`@heroui/react` + `@heroui/styles`) + Tailwind CSS v4] โดยสืบทอดสไตล์หลักและ Motion Tokens ของระบบผ่าน [Design System Token (`src/theme/`)] ที่ล็อกสเปกตามกฎการออกแบบ 6 ข้อ (อ้างอิงจาก [../frontend-design/SKILL.md](../frontend-design/SKILL.md)) เพื่อให้ UI ของเกมไปในทิศทางเดียวกันอย่างสม่ำเสมอ
และข้อบังคับสุดท้าย สำหรับ Production Build ให้เตรียม [Multi-stage Build Dockerfile แบบ Nginx Alpine] ที่ปรับแต่ง Security Headers เรียบร้อยแล้ว เพื่อให้พร้อมสำหรับการ Deploy บน Production Environment อย่างปลอดภัยเสมอ
(ทั้งนี้ หากผู้ใช้ระดับ Root Access ต้องการเปลี่ยน Stack หรือพารามิเตอร์สำหรับโปรเจกต์เฉพาะเจาะจง สามารถแก้ไขข้อความภายในกรอบวงเล็บ [] ได้ทันที)
"A great frontend doesn't just look good. It is systematically engineered to be secure, scalable, and completely adaptable to the truth delivered by the backend."
(ระบบหน้าบ้านที่ยอดเยี่ยมไม่ได้แค่ดูสวย แต่มันถูกวิศวกรรมมาอย่างเป็นระบบเพื่อให้ปลอดภัย สเกลได้ และพร้อมปรับตัวตามความจริงที่หลังบ้านส่งมาให้เสมอ)

**🔑 คีย์เวิร์ดสำคัญ:** Role-Isolated, React+Phaser Bridge, HeroUI Consistency, SQLite Read-Cache Only, Zero-Hardcoding, Decoupled State

---

## 1. Role-Isolated Client Architecture (สถาปัตยกรรมแยกส่วนตามบทบาทผู้ใช้)
**Core Concept:** แบ่งโครงสร้างโปรเจกต์และแอปพลิเคชัน (Build Targets) ตาม Role ของผู้ใช้งานอย่างเด็ดขาด (เช่น Admin Portal แยกขาดจาก End-User App) แทนการแบ่งโมดูลตามฟังก์ชันแบบหลังบ้าน
**Impact:** รีดประสิทธิภาพขนาดไฟล์ (Bundle Size Optimization) ให้เล็กที่สุด พร้อมสร้าง Security by Isolation ป้องกันไม่ให้โค้ดหรือ API Endpoint ของฝั่งผู้ดูแลระบบ หลุดไปฝังอยู่ในเบราว์เซอร์ของผู้ใช้ทั่วไป ซึ่งเป็นการปิดช่องโหว่จากการแฮ็กผ่าน Client-side อย่างสิ้นเชิง

## 2. Data-Driven UI & Dynamic Rendering (สถาปัตยกรรมโครงสร้างยืดหยุ่น ไร้การ Hardcode)
**Core Concept:** ออกแบบหน้าบ้านให้ทำงานแบบ Data-Driven โดยเรนเดอร์โครงสร้าง UI (เมนู, ฟอร์ม, หรือเลย์เอาต์) จาก JSON Schema หรือ API Response แทนการฝังลอจิกตายตัวลงในโค้ด (Zero-Hardcoding)
**Impact:** สร้างระบบที่ "ขยายตัวได้เอง" (Highly Extensible) หากฝั่ง Business ต้องการเพิ่มฟีเจอร์ เปลี่ยนแปลงสิทธิ์ หรือปรับเงื่อนไข ระบบหน้าบ้านจะปรับโครงสร้างและแสดงผลตาม Data ที่วิ่งเข้ามาอัตโนมัติ โดยแทบไม่ต้องแก้โค้ดหรือรันการ Deploy ใหม่

## 3. Predictable Design System & Standardization (ระบบดีไซน์มาตรฐานและการควบคุมแบบรวมศูนย์)
**Core Concept:** บังคับใช้ Design System ที่มีพารามิเตอร์ตายตัวระดับแกนกลาง (เช่น สัดส่วนเรขาคณิต, กริดซิสเต็ม, และโทนสีหลักระดับองค์กรอย่าง ขาว-น้ำเงิน-ทอง) เพื่อเป็นรากฐาน (Base Framework) ในการสร้างคอมโพเนนต์ทั้งหมด
**Impact:** การล็อกสเปกโครงสร้างที่สะอาดและเป็นมาตรฐานนี้ ไม่เพียงแต่ทำให้การสเกลโปรเจกต์เป็นเรื่องง่าย แต่ยังสร้างสถาปัตยกรรมหน้าบ้านที่ "AI-Ready" เปิดทางให้สามารถใช้ AI สร้างโค้ด UI ในอนาคตได้อย่างแม่นยำ 100% โดยที่สถาปนิกยังคงควบคุมความถูกต้องของ Layout ได้อย่างเบ็ดเสร็จ

## 4. Decoupled State & View Management (การจัดการสถานะที่แยกขาดจากการแสดงผล)
**Core Concept:** แยกกระบวนการจัดการข้อมูลของแอปพลิเคชัน (State Management) ออกจากส่วนที่ใช้แสดงผล UI (View Components) อย่างชัดเจน
**Impact:** กำจัดปัญหา "โค้ดพาสต้า" (Spaghetti Code) ทำให้สามารถแก้ไข UI หน้าบ้านได้โดยไม่กระทบกับ Business Logic ที่ดึงมาจาก API ส่งผลให้โค้ดสะอาด ทดสอบง่าย (Testable) และดูแลรักษาง่ายในระยะยาว

## 5. React ↔ Phaser Bridge & Local SQLite Read-Cache Policy
**Core Concept:** แยก Game Loop (Phaser Canvas 60fps) ออกจาก React DOM Tree โดยสื่อสารผ่าน `EventBus` และ `Zustand` (`getState()` / selective `subscribe()`) เฉพาะตอนเกิด Domain Event (ปลูก, รดน้ำ, เก็บเกี่ยว, เปิดร้านค้า/เควสต์) เพื่อไม่ให้เกิด React Re-render ทุกเฟรม พร้อมใช้ Browser SQLite (`sql.js`) สำหรับเก็บ **Read-Cache และ UI Preferences เท่านั้น**
**Impact:** รักษาเฟรมเรตเกมให้ลื่นไหล ลดภาระหน่วยความจำ และป้องกันการโกงผ่าน DevTools ในระบบแลกของรางวัลจริง (Server-Authoritative 100%)

---

## 📂 โครงสร้างโฟลเดอร์ (`Web/` — React + HeroUI + Phaser + GSAP + Zustand + SQLite + Axios)
ผสานโครงสร้างมาตรฐาน Role-Isolated Client เข้ากับ Game Architecture 5 ส่วนหลักอย่างเป็นระบบ:

```text
Web/
├── vite.config.ts               # รัน Dev Server ที่พอร์ต 5002 + Proxy API ไปยัง :5001
├── src/
│   ├── assets/                  # Sprites, Tilesets, Icons, Audio, Fonts
│   ├── components/
│   │   ├── common/              # HeroUI-wrapped Reusable Primitives
│   │   └── game-ui/             # 1. Game UI (HeroUI v3 + GSAP Overlays)
│   │       ├── ResourceHUD.tsx  #    - Resource HUD (เหรียญ, พลังงาน, EXP/Level, เวลา)
│   │       ├── InventoryPanel.tsx#   - Inventory (กระเป๋าเมล็ดพันธุ์/ผลผลิต/อุปกรณ์)
│   │       ├── ShopModal.tsx    #    - Shop (ร้านค้าเมล็ด/ขายผลผลิต/แค็ตตาล็อกของรางวัล)
│   │       ├── QuestPanel.tsx   #    - Quest (ภารกิจและรางวัล)
│   │       └── DialogBox.tsx    #    - Dialog (บทสนทนา NPC / ยืนยันการกระทำ)
│   ├── game/                    # 2. Game Engine (Phaser)
│   │   ├── core/                #    - Game config, React bridge, Typed EventBus
│   │   ├── world/               #    - Farm World (แผนที่ฟาร์ม, แปลงปลูก, กล้อง)
│   │   ├── crops/               #    - Crop System (ขั้นตอนเติบโต, สถานะรดน้ำ/เก็บเกี่ยว)
│   │   ├── character/           #    - Character (ตัวละครชาวนา, การเดิน/แอนิเมชัน)
│   │   ├── interaction/         #    - Object Interaction (คลิกแปลง, บ่อน้ำ, ป้ายร้าน/เควสต์)
│   │   └── particles/           #    - Particle Effects (ละอองน้ำ, ประกายเก็บเกี่ยว)
│   ├── animations/              # 3. Animation System (Unified Motion Tokens)
│   │   ├── gsap/                #    - GSAP presets & hooks สำหรับ HeroUI / DOM
│   │   └── phaser-tweens/       #    - Phaser Tweens helpers สำหรับ Canvas objects
│   ├── store/                   # 4. State Management (Zustand)
│   ├── local-db/                # Local Database (Browser SQLite WASM — Cache Only!)
│   ├── services/                # 5. API Client (Axios + Interceptors, Zero-Hardcoding)
│   │   ├── http/                #    - Axios instance, JWT Bearer + Cookie interceptors
│   │   ├── player/              #    - API Services สำหรับฝั่งผู้เล่น (Farm, Crop, Shop, Reward)
│   │   └── admin/               #    - API Services สำหรับฝั่ง Admin (Reward Approval, SeaweedFS Media)
│   ├── layouts/                 # โครงสร้าง Layout หลัก (GameViewportLayout, AdminLayout)
│   ├── pages/                   # หน้าจอหลัก (FarmPage.tsx เป็นหน้าทำฟาร์มแรก + admin/)
│   ├── modals/                  # Global Modals (Auth, Real-World Reward Redemption)
│   ├── theme/                   # Design Tokens & HeroUI Theme Variables (60-30-10, 8-pt Grid)
│   ├── App.tsx
│   └── main.tsx
└── Dockerfile                   # Multi-stage Nginx Alpine build (Production)
```
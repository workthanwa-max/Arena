# Project Map

```text
Game/
├── README.md                              # ภาพรวมสถาปัตยกรรมและการเริ่มต้นใช้งาน
├── architecture.md                        # สถาปัตยกรรมระบบ, Performance Tuning และ WebSocket Protocol
├── project-map.md                         # แผนที่ไฟล์ในโปรเจกต์
├── scripts.md                             # คู่มือคำสั่งรัน Docker, Backend, Frontend และ Database
├── docker-compose.yml                     # Docker Compose 3 Services (postgres:5435, backend:7777 + 8443/udp+tcp, frontend:5555)
│
├── database/                              # Standalone PostgreSQL Schema & Migrations
│   └── migrations/
│       ├── 001_init.sql                   # Core Postgres DDL (rooms, room_players, game_records JSONB)
│       ├── 002_auth_modes_maps.sql        # Member Auth (users, user_characters, user_sessions), Modes & Maps
│       └── 003_admin_heroes.sql           # Role Column (users.role) สำหรับ Admin Exclusive Heroes
│
├── go-backend/                            # Go Server + pgx PostgreSQL (Port 7777 + HTTP/3 WebTransport 8443)
│   ├── go.mod
│   ├── .env / .env.example
│   ├── Dockerfile                         # Multi-stage Alpine Go Binary (Non-root, /health check)
│   ├── .dockerignore
│   ├── cmd/server/main.go                 # Entry point + GOMAXPROCS(NumCPU) + HTTP/3 WebTransport + Graceful Shutdown
│   ├── internal/
│   │   ├── api/router.go                  # HTTP ServeMux (Auth, Characters, 6-Digit Rooms, /api/transport/info, /ws, /wt)
│   │   ├── infrastructure/
│   │   │   ├── config/config.go           # Env config + DATABASE_URL + WT_PORT / WT_CERT validation
│   │   │   ├── logger/logger.go           # log/slog JSON logger
│   │   │   └── database/postgres.go       # pgx/v5 sql.DB Pool Tuning (32 MaxOpen) + Retry & Auto-Migrate
│   │   ├── modules/
│   │   │   ├── auth/auth.go               # Argon2id Register/Login, Unlimited Session Cookie/Bearer, Hero Ownership
│   │   │   ├── room/room.go               # Room Actor Loop (6-Digit Codes, NetID Assign, 3v3 Lobby, Practice Dummies, 7s Respawn)
│   │   │   ├── player/player.go           # Player Manager (UUID, 6-Digit Room Code Gen, Input clamp)
│   │   │   ├── session/session.go         # Session Manager (RealtimeConn, Coalesced Datagram Queue + Reliable Pump)
│   │   │   ├── engine/engine.go           # Game Engine (Team No-FF, Lock-On, Saitama 1-Punch Target-Pick, Gojo Red+Blue->Hollow Purple & Infinite Void)
│   │   │   ├── state/
│   │   │   │   ├── characters.go          # 20 Characters (19 Public incl. Jinwoo, Naruto, Sanji, Luffy, Ben10, Diablo + 1 Admin Saitama), 5 Archetypes
│   │   │   │   └── state.go               # Shibuya, Konoha, Sisaket Island & Circular SCP Site-19 MapConfig, RoomState, Medkit Respawn Timers
│   │   │   ├── sync/
│   │   │   │   ├── sync.go                # sync.Pool Marshaling + Dual-Channel Binary/Reliable Synchronizer
│   │   │   │   └── binary.go              # bin1 Binary Frame Codec (S_STATE_BINARY 0x10, S_PONG 0x11, C_INPUT..C_PING)
│   │   │   └── persistence/persistence.go # PostgreSQL Batched Transaction Async Worker (Up to 32/tx)
│   │   └── shared/
│   │       ├── errors/errors.go           # Standard error codes (Auth, MatchState, Room, RateLimit)
│   │       ├── middleware/middleware.go   # CORS (Credentials + Auth), Security Headers, Rate Limiter
│   │       ├── ws/ws.go                   # Pure Go RFC 6455 WebSocket (Text + opBinary Frames + TCP_NODELAY)
│   │       └── wt/wt.go                   # HTTP/3 QUIC WebTransport Server & Conn Adapter (Datagrams + Framed Control Stream)
│   └── tests/server_test.go               # Unit, Auth/Unlimited-Session, 3v3 Flow, Binary Protocol & Postgres/WS Tests
│
└── Example-Game/                          # React + Phaser + Zustand + GSAP + Nginx Docker (Port 5555)
    ├── vite.config.ts                     # Port 5555, Manual Rolldown Vendor/Phaser Splitting, /api /ws proxy
    ├── Dockerfile                         # Multi-stage Node 24 Build -> Nginx 1.27 Alpine
    ├── .dockerignore
    ├── nginx.conf                         # Multi-core Gzip, Immutable & /maps Asset Cache, /api & /ws Proxy
    ├── index.html                         # Inline Dark Orbital Boot Splash (Zero White Flash)
    ├── public/
    │   ├── app-icon.png                   # PulseArena PWA App Icon & Default Portrait
    │   ├── favicon.svg                    # PulseArena Vector Favicon
    │   ├── manifest.json                  # Add to Home Screen Manifest
    │   ├── sql-wasm.wasm                  # Browser SQLite WASM binary
    │   ├── characters/                    # Local Anime Portraits (.png)
    │   ├── fx/
    │   │   ├── auth_gojo_sukuna_bg.jpg    # Mobile-Game Auth Key-Art Wallpaper (Gojo vs Sukuna)
    │   │   ├── home_lobby_gojo_sukuna_bg.jpg # Full-Screen MLBB-Style Celestial Sanctuary Gojo vs Sukuna Home Wallpaper
    │   │   ├── logo_gojo_sukuna.jpg       # Gojo vs Sukuna Metallic Gold & Navy MOBA Game Emblem & Favicon
    │   │   ├── saitama_dead.jpg           # Saitama Crimson Serious Fist Overlay Image
    │   │   └── iconic_domain_clash.jpg    # Gojo vs Sukuna 16:9 Domain Clash Splash Art
    │   ├── maps/
    │   │   ├── shibuya_bg.png / .webp     # Shibuya Skyline Backdrop (19KB WebP สำหรับ Preload WAN)
    │   │   └── konoha_bg.png / .webp      # Hidden Leaf Hokage Cliff Backdrop (300KB WebP)
    │   ├── skills/                        # Illustrated Ability Artwork Icons + iconic_rct.png (.png)
    │   └── voices/                        # Japanese Anime Neural Character Voice Lines (.mp3) + EN Default
    └── src/
        ├── types/game.ts                  # Shared TypeScript interfaces (Auth, Modes, Maps, 3v3 State)
        ├── services/
        │   ├── apiClient.ts               # Centralized Authenticated REST API Repository (credentials: include)
        │   ├── assetPreloader.ts          # Match-Scoped Preloader + Browser Cache API (pulsearena-match-assets-v1) & Memory Release
        │   ├── realtimeProtocol.ts        # Compact bin1 Little-Endian Binary Encoder/Decoder + EffectKinds Table
        │   └── realtimeTransport.ts       # Dual-Channel HTTP/3 WebTransport QUIC Client + <1.15s Binary WS Fallback
        ├── local-db/sqliteCache.ts        # Browser SQLite (sql.js + IndexedDB, Cache Only, cache_v11)
        ├── store/useGameStore.ts          # Zustand Store (Auth, Pages & goBack() History, Match Preload State, 3v3 Lobby, Arena HUD, Voice Chat)
        ├── audio/
        │   ├── soundEngine.ts             # Origin Character Voices (JP/EN MP3 + Preload Bytes), Arena BGM & Web Audio SFX
        │   └── voiceChatEngine.ts         # P2P WebRTC Room Voice Chat Engine (Mic/Speaker Toggle, VAD Speaking Indicator & ICE Signaling)
        ├── animations/gsapPresets.ts      # GSAP Motion Tokens & Showroom Carousel Swap
        ├── pages/
        │   ├── AuthPage.tsx               # Mobile-Game Auth Screen (Gojo vs Sukuna Wallpaper & Bottom-Right Beta Pill)
        │   ├── HomePage.tsx               # Step 1 Main Journey Hub (4-Step Map, Create vs Join 6-Digit Split, My Owned Roster Strip)
        │   ├── BattleSetupPage.tsx        # Step 2 Dedicated Full-Page Battlefield Setup Wizard (Mode + Map + Next-Step Guide)
        │   ├── JoinHeroSelectPage.tsx     # Pre-Join Hero Selection Screen (Enter 6-Digit Room ID -> Join -> Pick Hero -> Enter Game)
        │   ├── HeroesPage.tsx             # My Owned Characters Gallery & Full Detail/Skill Inspector (No Pre-Match Equip Gate)
        │   └── RoomLobbyPage.tsx          # Step 3 2-Column Waiting Room (Team Roster + In-Room Hero Spotlight & Draft Picker)
        ├── components/
        │   ├── ArenaHudPanels.tsx         # RoV/MLBB Dark-Metallic Top Scoreboard HUD & Proportional Skill Dock (incl. 5-Stone Snap Dock + Mic/Speaker)
        │   ├── Hero3dPreview.tsx          # Interactive Three.js 3D Hero Preview Turntable (360° Drag-to-Spin + Live Idle/Companion Animations)
        │   ├── HeroAimWheel.tsx           # Per-Hero Custom SVG Drag-to-Aim Wheel & Unique Crosshair Pip Overlay (14 Heroes)
        │   ├── IconicBgmPlayer.tsx        # Official YouTube IFrame Player (44pt8w67S8I) for ICONIC Mode + Offline Synth Fallback
        │   ├── MobaSkillButton.tsx        # Memoized MOBA Drag/Hover Aim Skill Wheel Button (incl. Stone Lock Badge & Custom Wheel)
        │   ├── CreateRoomModal.tsx        # Mode (ICONIC, 1v1, 3v3, Practice, FFA) & Map (Shibuya vs Konoha) Selector Modal
        │   └── BattleResultModal.tsx      # 1v1/ICONIC (5-Kill) & 3v3 (50-Kill / Thanos Snap) Victory/Defeat Post-Match Summary
        ├── constants/
        │   └── heroClasses.ts             # 5-Archetype Filter Metadata & Map Display Labels (Shibuya, Konoha, Sisaket Island, SCP Site)
        ├── game/
        │   ├── adminAutoAi.ts             # Admin-Only Grandmaster Autonomous Combat AI (Dodge, Water-Avoid, SCP Medkit Seek, 20-Hero Combos)
        │   ├── core/eventBus.ts           # Typed React <-> 3D Scene EventBus (Init/Sync/Died/DomainClash/InfinitySnap)
        │   ├── heroAimThemes.ts           # Per-Hero Unique 32x32 Custom Cursor & Corridors/Palettes Table (20 Heroes)
        │   ├── map3dBuilder.ts            # Three.js 3D Maps (Shibuya, Konoha, Sisaket Ko Klang Nam, Circular SCP Site-19 + Cryo Pillars)
        │   ├── hero3dBuilder.ts           # Three.js Articulated 3D Hero Rigs (20 Heroes incl. Naruto Kurama 9-Tail Transformation Rig + Dummy)
        │   ├── magicCircleBuilder.ts      # Procedural 512px Arcane Magic Circle & Rune Corridor Generator (20 Per-Hero Aim Sigils + Cancel)
        │   ├── pixelShaderPass.ts         # Single-Pass Client GPU 3D Pixel Art Shader (NearestFilter Target + Depth Outlines + Bayer 4x4 Dither)
        │   ├── vfx3dManager.ts            # Three.js Pooled 3D Slashes, Lightning, Afterimages, Smooth Projectiles, Material Pool & Magic Circle Aim
        │   ├── Mlbb3dArenaView.tsx        # Three.js MLBB Isometric 3D Arena + Client Pixel/HD Switch + RTT Prediction + Cached Minimap
        │   ├── ArenaScene.ts              # Legacy Phaser 2.5D Battlefield Reference
        │   ├── IconicArenaView.tsx        # Over-The-Shoulder 3D Perspective Shibuya Renderer (Gojo vs Sukuna)
        │   └── PhaserArenaView.tsx        # Mode-Aware Arena View Switcher (3D MLBB vs Iconic 3D OTS)
        ├── theme/tokens.css               # Design System Tokens (Bright Orbital 60-30-10, 8pt Grid)
        ├── styles/base.css                # Luminous Aero-Titanium Backing + Lobby Gradient Backdrop
        ├── styles/arena.css               # Auth/Home/Lobby + RoV HUD + Mobile Portrait & Landscape CSS
        ├── styles/mlbb-theme.css          # INFINITY CLASH Dark Royal-Blue AAA MOBA Theme (MLBB Home, VS Banner Lobby, 3D Hero Turntable)
        └── App.tsx                        # Multi-Page Router, Dynamic Joystick Math & Fullscreen Landscape Helper
```

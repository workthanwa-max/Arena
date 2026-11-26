package state

import "encoding/json"

// SkillDef describes one active ability exposed to the UI and enforced by the server.
type SkillDef struct {
	Slot        int     `json:"slot"`
	KeyHint     string  `json:"keyHint"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	CooldownSec float64 `json:"cooldownSec"`
	CastRange   float64 `json:"castRange"`
	AoeRadius   float64 `json:"aoeRadius"`
	AimType     string  `json:"aimType"` // "line" | "cone" | "ground" | "self" | "lockon" | "target_pick"
	AccentColor string  `json:"accentColor"`
	IconURL     string  `json:"iconUrl"`
}

// CharacterDef defines a playable character template (default + anime-inspired heroes).
type CharacterDef struct {
	ID              string     `json:"id"`
	AnilistID       int        `json:"anilistId"`
	ImageURL        string     `json:"imageUrl,omitempty"`
	DisplayName     string     `json:"displayName"`
	AnimeTitle      string     `json:"animeTitle"`
	AnimeRef        string     `json:"animeRef"`
	RoleTag         string     `json:"roleTag"`
	HeroClass       string     `json:"heroClass"`       // "sovereign" | "chronos" | "deadeye" | "vanguard" | "cataclysm"
	ClassName       string     `json:"className"`       // Unique Thai archetype title
	ClassIcon       string     `json:"classIcon"`       // Emblem icon
	ClassColor      string     `json:"classColor"`      // Archetype accent color
	ClassTraitLabel string     `json:"classTraitLabel"` // Distinguishing mechanical rule
	ClassStatKey    string     `json:"classStatKey"`    // Engine variable key
	ClassStatValue  float64    `json:"classStatValue"`  // Numeric distinguishing variable enforced by Go engine
	VoiceLine       string     `json:"voiceLine,omitempty"`
	Color           string     `json:"color"`
	AccentColor     string     `json:"accentColor"`
	MaxHP           int        `json:"maxHp"`
	MoveSpeed       float64    `json:"moveSpeed"`
	AdminOnly       bool       `json:"adminOnly,omitempty"`
	Skills          []SkillDef `json:"skills"`
}

const (
	ClassSovereign = "sovereign"
	ClassChronos   = "chronos"
	ClassDeadeye   = "deadeye"
	ClassVanguard  = "vanguard"
	ClassCataclysm = "cataclysm"
)

type classMeta struct {
	id         string
	name       string
	icon       string
	color      string
	traitLabel string
	statKey    string
	statValue  float64
}

var heroClassTable = map[string]classMeta{
	ClassSovereign: {
		id:         ClassSovereign,
		name:       "ราชันย์อาณาเขต",
		icon:       "👑",
		color:      "#A855F7",
		traitLabel: "ขยายรัศมีโซน/อาณาเขต +15%",
		statKey:    "zoneRadiusScale",
		statValue:  1.15,
	},
	ClassChronos: {
		id:         ClassChronos,
		name:       "ผู้แหวกมิติเวลา",
		icon:       "⚡",
		color:      "#FACC15",
		traitLabel: "Dash คูลดาวน์ -28% & พุ่งไกลขึ้น +18%",
		statKey:    "dashCooldownScale",
		statValue:  0.72,
	},
	ClassDeadeye: {
		id:         ClassDeadeye,
		name:       "เพชฌฆาตเส้นเล็ง",
		icon:       "🎯",
		color:      "#38BDF8",
		traitLabel: "ความเร็ววิถีกระสุน/สกิลพุ่ง +20%",
		statKey:    "projectileSpeedScale",
		statValue:  1.20,
	},
	ClassVanguard: {
		id:         ClassVanguard,
		name:       "ผู้ทลายขีดจำกัด",
		icon:       "🔥",
		color:      "#10B981",
		traitLabel: "HP < 45% โจมตีและสกิลแรงขึ้น +25%",
		statKey:    "lowHpDamageBonus",
		statValue:  1.25,
	},
	ClassCataclysm: {
		id:         ClassCataclysm,
		name:       "ผู้กุมชะตาโลก",
		icon:       "💎",
		color:      "#F43F5E",
		traitLabel: "ปิดฉากศัตรู HP < 12% ทันที + ต้าน Slow 30%",
		statKey:    "executionThreshold",
		statValue:  0.12,
	},
}

var heroClassAssignment = map[string]string{
	"sia_mon":       ClassSovereign,
	"ajarn_boy":     ClassSovereign,
	"pa":            ClassSovereign,
	"kaem":          ClassSovereign,
	"jinwoo":        ClassSovereign,
	"ko":            ClassChronos,
	"ajarn_au":      ClassChronos,
	"frame":         ClassChronos,
	"sanji":         ClassChronos,
	"simo":          ClassDeadeye,
	"ole":           ClassDeadeye,
	"ben10":         ClassDeadeye,
	"thanwa":        ClassVanguard,
	"boy":           ClassVanguard,
	"default":       ClassVanguard,
	"naruto":        ClassVanguard,
	"luffy":         ClassVanguard,
	"noone":         ClassCataclysm,
	"diablo":        ClassCataclysm,
	"luangphi_sorn": ClassCataclysm,
	"aizen":         ClassSovereign,
	"toriko":        ClassVanguard,
	"frieren":       ClassDeadeye,
}

var characterCatalog = []CharacterDef{
	{
		ID:          "default",
		AnilistID:   0,
		ImageURL:    "/app-icon.png?v=20261120v2",
		DisplayName: "Default",
		AnimeTitle:  "ผู้ท้าทายทั่วไป",
		AnimeRef:    "Classic Challenger",
		RoleTag:     "Combat Initiate",
		VoiceLine:   "Combat systems online! Challenger ready for battle!",
		Color:       "#64748B",
		AccentColor: "#CBD5E1",
		MaxHP:       240,
		MoveSpeed:   260,
		Skills:      []SkillDef{},
	},
	{
		ID:          "pa",
		AnilistID:   2514,
		ImageURL:    "/characters/pa.png",
		DisplayName: "กิลกาเมซ (Gilgamesh)",
		AnimeTitle:  "กิลกาเมซ (Gilgamesh)",
		AnimeRef:    "Fate Series",
		RoleTag:     "King of Heroes • Siege Zoner",
		VoiceLine:   "王の財宝、ゲート・オブ・バビロン！雑種、我の前にひざまずけ！",
		Color:       "#EAB308",
		AccentColor: "#FEF08A",
		MaxHP:       225,
		MoveSpeed:   250,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Gate of Babylon", Description: "เปิดมิติยิงศาสตราทองคำ 5 เล่มกวาดเป็นพัด (13 dmg/เล่ม)", CooldownSec: 1.0, CastRange: 620, AoeRadius: 48, AimType: "cone", AccentColor: "#FACC15", IconURL: "/skills/pa_1.png"},
			{Slot: 2, KeyHint: "E", Name: "King's Treasury (คลังสมบัติราชันย์)", Description: "เปิดประตู Gate ด้านหลังเรืองแสงทอง 7 วิ — โจมตีปกติเร็วขึ้นและยิงต่อเนื่องได้แบบไม่มี Cooldown!", CooldownSec: 10.0, CastRange: 200, AoeRadius: 135, AimType: "self", AccentColor: "#FACC15", IconURL: "/skills/pa_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Enuma Elish (Ea)", Description: "ปลดปล่อยศาสตรา EA ยิงลำแสงสีแดง-ทองผ่ามิติยาวทั้งแมพและขยายใหญ่ขึ้นเรื่อยๆ นาน 5 วิ (18 dmg/ฮิต + ผลักกระเด็น)", CooldownSec: 20.0, CastRange: 3400, AoeRadius: 96, AimType: "line", AccentColor: "#EF4444", IconURL: "/skills/pa_3.png"},
		},
	},
	{
		ID:          "boy",
		AnilistID:   246,
		ImageURL:    "/characters/boy.png",
		DisplayName: "ซง โกคู (Goku)",
		AnimeTitle:  "ซง โกคู (Goku)",
		AnimeRef:    "Dragon Ball",
		RoleTag:     "Saiyan Brawler",
		VoiceLine:   "オッス！おめえ、なかなかやるな！全力のかめはめ波、いくぞっ！",
		Color:       "#F97316",
		AccentColor: "#38BDF8",
		MaxHP:       250,
		MoveSpeed:   265,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Rapid Ki Barrage", Description: "ยิงลูกคิแฝด 2 นัดไว + ซัดกระเด็น (14 dmg/นัด)", CooldownSec: 0.65, CastRange: 540, AoeRadius: 34, AimType: "line", AccentColor: "#38BDF8", IconURL: "/skills/boy_1.png"},
			{Slot: 2, KeyHint: "E", Name: "หมัดทะลวงมังกร", Description: "พุ่งต่อยสตั้นวงเล็ก 105px (0.95 วิ, 30 dmg) — ถ้าต่อยโดนตีไวขึ้น 2 วิ!", CooldownSec: 4.2, CastRange: 380, AoeRadius: 105, AimType: "line", AccentColor: "#60A5FA", IconURL: "/skills/boy_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Kamehameha", Description: "ลำแสงคลื่นเต่า 920px เจาะทะลุทั้งแนว + ซัดปลิว (72 dmg)", CooldownSec: 7.8, CastRange: 920, AoeRadius: 62, AimType: "line", AccentColor: "#0EA5E9", IconURL: "/skills/boy_3.png"},
		},
	},
	{
		ID:          "ole",
		AnilistID:   14,
		ImageURL:    "/characters/ole.png",
		DisplayName: "อุจิวะ อิทาจิ (Itachi)",
		AnimeTitle:  "อุจิวะ อิทาจิ (Itachi)",
		AnimeRef:    "Naruto",
		RoleTag:     "Sharingan Trickster",
		VoiceLine:   "許せ…お前はすでに、俺の月読の中だ。",
		Color:       "#DC2626",
		AccentColor: "#A855F7",
		MaxHP:       225,
		MoveSpeed:   254,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Crow Boomerang", Description: "ปาดาวกระจายอีกา 3 แฉก วนคืนกลับมาฟันซ้ำ 2 รอบ (13 dmg/ฮิต)", CooldownSec: 1.0, CastRange: 440, AoeRadius: 40, AimType: "line", AccentColor: "#EF4444", IconURL: "/skills/ole_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Tsukuyomi (อ่านจันทรา)", Description: "วางวงลวงตาจันทราแดงในระยะ 460px Stun 1.5 วิ (26 dmg)", CooldownSec: 5.2, CastRange: 460, AoeRadius: 145, AimType: "ground", AccentColor: "#A855F7", IconURL: "/skills/ole_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Amaterasu (เทวีสุริยา)", Description: "จุดแนวไฟดำเคลื่อนที่ในจุดที่วาง เผาต่อเนื่อง 3.8 วิ (11 dmg/ฮิต)", CooldownSec: 8.0, CastRange: 420, AoeRadius: 120, AimType: "ground", AccentColor: "#EF4444", IconURL: "/skills/ole_3.png"},
		},
	},
	{
		ID:          "thanwa",
		AnilistID:   62,
		ImageURL:    "/characters/thanwa.png",
		DisplayName: "โรโรโนอา โซโล (Zoro)",
		AnimeTitle:  "โรโรโนอา โซโล (Zoro)",
		AnimeRef:    "One Piece",
		RoleTag:     "Three-Sword Vanguard",
		VoiceLine:   "三刀流！俺の剣に、斬れねえものなど何一つねえ！",
		Color:       "#10B981",
		AccentColor: "#6EE7B7",
		MaxHP:       255,
		MoveSpeed:   255,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "108 Pound Ho", Description: "คลื่นดาบเสี้ยวกว้างเจาะทะลุศัตรูทุกตัวในแนว 580px (28 dmg)", CooldownSec: 0.9, CastRange: 580, AoeRadius: 52, AimType: "line", AccentColor: "#34D399", IconURL: "/skills/thanwa_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Shishi Sonson", Description: "เลือกจุดพุ่งฟันอิไอจัตสึในวง 310px ทะลุเป้าหมาย (42 dmg)", CooldownSec: 3.8, CastRange: 310, AoeRadius: 50, AimType: "ground", AccentColor: "#10B981", IconURL: "/skills/thanwa_2.png"},
			{Slot: 3, KeyHint: "R", Name: "สามพันโลก (Sanzen Sekai)", Description: "พายุสามดาบดูดศัตรูรอบตัว 195px แล้วฟันระเบิด (74 dmg)", CooldownSec: 7.5, CastRange: 195, AoeRadius: 195, AimType: "self", AccentColor: "#059669", IconURL: "/skills/thanwa_3.png"},
		},
	},
	{
		ID:          "ajarn_au",
		AnilistID:   27,
		ImageURL:    "/characters/ajarn_au.png",
		DisplayName: "คิรัวร์ โซลดิ๊ก (Killua)",
		AnimeTitle:  "คิรัวร์ โซลดิ๊ก (Killua)",
		AnimeRef:    "Hunter x Hunter",
		RoleTag:     "Godspeed Chainer",
		VoiceLine:   "神速、カンムル！俺の雷撃に、ついてこられるかよ！",
		Color:       "#06B6D4",
		AccentColor: "#A5F3FC",
		MaxHP:       225,
		MoveSpeed:   270,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Solo Lightning Blitz", Description: "ฟันสายฟ้าประชิดรอบตัว 175px พร้อมอมตะ i-frame 0.5 วิ (28 dmg + Stun)", CooldownSec: 2.2, CastRange: 175, AoeRadius: 175, AimType: "self", AccentColor: "#22D3EE", IconURL: "/skills/ajarn_au_1.png?v=leap2"},
			{Slot: 2, KeyHint: "E", Name: "Godspeed (พุ่งชนสตั้น)", Description: "ความเร็วเทพ 1.85 เท่า 3.5 วิ พุ่งชนศัตรูเพื่อช็อตและ Stun ทันที 1.2 วิ", CooldownSec: 5.6, CastRange: 85, AoeRadius: 85, AimType: "self", AccentColor: "#67E8F9", IconURL: "/skills/ajarn_au_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Narukami (อัสนีพิฆาต 2 สเต็ป)", Description: "สเต็ป 1 ฟาดฟ้าผ่าแรงในวง 500px (54 dmg + Stun 1.4 วิ) แล้วสเต็ป 2 แตกสายฟ้า 6 แฉก (16 dmg/แฉก)", CooldownSec: 8.2, CastRange: 500, AoeRadius: 165, AimType: "ground", AccentColor: "#0284C7", IconURL: "/skills/ajarn_au_3.png"},
		},
	},
	{
		ID:          "ajarn_boy",
		AnilistID:   133701,
		ImageURL:    "/characters/ajarn_boy.png",
		DisplayName: "เรียวเมน สุคุนะ (Sukuna)",
		AnimeTitle:  "เรียวเมน สุคุนะ (Sukuna)",
		AnimeRef:    "Jujutsu Kaisen",
		RoleTag:     "King of Curses",
		VoiceLine:   "身の程を知れ、痴れ者が！領域展開、伏魔御厨子！",
		Color:       "#991B1B",
		AccentColor: "#FB7185",
		MaxHP:       245,
		MoveSpeed:   252,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Dismantle X-Cut", Description: "คมมีดตัดมิติไขว้กากบาทเจาะทะลุ 2 สายระยะ 640px (16 dmg/สาย)", CooldownSec: 0.75, CastRange: 640, AoeRadius: 44, AimType: "line", AccentColor: "#F43F5E", IconURL: "/skills/ajarn_boy_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Fuga (ศรเพลิงคำสาป)", Description: "ศรไฟระยะ 660px ระเบิด 140px + ทิ้งบ่อลาวาเผาต่อเนื่อง", CooldownSec: 4.5, CastRange: 660, AoeRadius: 140, AimType: "line", AccentColor: "#FB923C", IconURL: "/skills/ajarn_boy_2.png"},
			{Slot: 3, KeyHint: "R", Name: "อาณาเขตสังหาร (Malevolent Shrine)", Description: "นั่งบัลลังก์กลางอาณาเขตอยู่กับที่ 270px ฟันแรง + Slow + อมตะเมื่อศัตรูโดนสกิล!", CooldownSec: 9.0, CastRange: 270, AoeRadius: 270, AimType: "self", AccentColor: "#BE123C", IconURL: "/skills/ajarn_boy_3.png"},
		},
	},
	{
		ID:          "kaem",
		AnilistID:   101280,
		ImageURL:    "/characters/kaem.png",
		DisplayName: "ริมุรุ เทมเพสต์ (Rimuru)",
		AnimeTitle:  "ริมุรุ เทมเพสต์ (Rimuru)",
		AnimeRef:    "Tensura Slime",
		RoleTag:     "Demon Lord • Tempest Sage",
		VoiceLine:   "真なる魔王の力、見せてやるよ！喰らい尽くせ、ベルゼビュート！",
		Color:       "#38BDF8",
		AccentColor: "#FACC15",
		MaxHP:       235,
		MoveSpeed:   262,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Black Lightning (สายฟ้าดำ)", Description: "วางจุดฟาดสายฟ้าดำทมิฬในวง 560px รอ 0.22 วิ Stun 0.7 วิ (30 dmg)", CooldownSec: 2.0, CastRange: 560, AoeRadius: 110, AimType: "ground", AccentColor: "#38BDF8", IconURL: "/skills/kaem_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Black Flame (เคียวเพลิงนิล)", Description: "ปล่อยคลื่นเปลวเพลิงนิลทมิฬ 3 สายทะลุเป้าหมายระยะ 540px (16 dmg/สาย)", CooldownSec: 4.2, CastRange: 540, AoeRadius: 56, AimType: "line", AccentColor: "#A855F7", IconURL: "/skills/kaem_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Beelzebuth (ราชันแห่งความตะกละ)", Description: "เปิดหลุมดำกลืนกินระยะ 440px ดูดศัตรูเข้ากลาง 180px + ฟื้นฟู +20 HP (18 dmg/ฮิต)", CooldownSec: 8.5, CastRange: 440, AoeRadius: 180, AimType: "ground", AccentColor: "#FACC15", IconURL: "/skills/kaem_3.png"},
		},
	},
	{
		ID:          "frame",
		AnilistID:   2040,
		ImageURL:    "/characters/frame.png",
		DisplayName: "โจสตาร์ (Joestar)",
		AnimeTitle:  "โจสตาร์ & แสตนไออ้วน (Joestar)",
		AnimeRef:    "JoJo's Bizarre Adventure",
		RoleTag:     "Stand Master • Lock-On CC",
		VoiceLine:   "やれやれだぜ…出てこい、デブ猫スタンド！オラオラオラァ！",
		Color:       "#A855F7",
		AccentColor: "#FACC15",
		MaxHP:       250,
		MoveSpeed:   256,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "ไออ้วน ล็อกเป้าขย้ำ (Lock Pounce)", Description: "ล็อกเป้าศัตรูระยะ 560px ส่งแสตนไออ้วนพุ่งติดตามขย้ำ (24 dmg + Stun 1.25 วิ)", CooldownSec: 3.4, CastRange: 560, AoeRadius: 120, AimType: "lockon", AccentColor: "#C084FC", IconURL: "/skills/frame_1.png"},
			{Slot: 2, KeyHint: "E", Name: "ORA! เมี้ยว รัวหมัด (Ora Barrage)", Description: "แสตนไออ้วนรัวหมัดอุ้งเท้าดูดเข้ากลาง 320px Stun ต่อเนื่อง 4 ฮิต (8 dmg/ฮิต)", CooldownSec: 4.8, CastRange: 320, AoeRadius: 140, AimType: "line", AccentColor: "#FACC15", IconURL: "/skills/frame_2.png"},
			{Slot: 3, KeyHint: "R", Name: "ไออ้วน: The World (หยุดเวลาล็อกเป้า)", Description: "ล็อกเป้ากางโดเมนหยุดเวลาระยะ 500px รอ 0.28 วิ แช่แข็ง Stun 2.0 วิ + ดูดรวม (58 dmg รวม)", CooldownSec: 9.0, CastRange: 500, AoeRadius: 210, AimType: "lockon", AccentColor: "#FDE047", IconURL: "/skills/frame_3.png"},
		},
	},
	{
		ID:          "luangphi_sorn",
		AnilistID:   3010,
		ImageURL:    "/characters/luangphi_sorn.png",
		DisplayName: "ไซตามะ (Saitama)",
		AnimeTitle:  "ไซตามะ (One-Punch Man)",
		AnimeRef:    "One-Punch Man • Admin Exclusive",
		RoleTag:     "Admin • One-Punch Annihilator",
		VoiceLine:   "マジ殴り一発で十分だ。南無阿弥陀仏、安らかに眠れ。",
		Color:       "#F59E0B",
		AccentColor: "#DC2626",
		MaxHP:       320,
		MoveSpeed:   285,
		AdminOnly:   true,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "หมัดเอาจริงปิดฉาก (Serious Death Punch)", Description: "เลือกตัวละครศัตรูที่จะต่อยได้เลย แบบล็อกเป้าตาย 100% (ยกเว้นเป้าหมายที่มีสกิลอมตะป้องกัน)", CooldownSec: 20.0, CastRange: 3600, AoeRadius: 160, AimType: "target_pick", AccentColor: "#DC2626", IconURL: "/skills/luangphi_sorn_1.png"},
		},
	},
	{
		ID:          "sia_mon",
		AnilistID:   4044,
		ImageURL:    "/characters/sia_mon.png",
		DisplayName: "โกะโจ ซาโตรุ (Gojo)",
		AnimeTitle:  "โกะโจ ซาโตรุ (Gojo Satoru)",
		AnimeRef:    "Jujutsu Kaisen",
		RoleTag:     "Honored One • Infinity & Void",
		VoiceLine:   "天上天下、唯我独尊！領域展開、無量空処！",
		Color:       "#38BDF8",
		AccentColor: "#A855F7",
		MaxHP:       255,
		MoveSpeed:   262,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "อาคมหมุนทวน: อาคะ (Red)", Description: "ยิงลูกบอลสีแดงไปทิศที่เลือกช้าๆ (22 dmg) หากยิงสีครามตามมาชนกันจะระเบิดเป็น Hollow Purple!", CooldownSec: 3.8, CastRange: 880, AoeRadius: 95, AimType: "line", AccentColor: "#EF4444", IconURL: "/skills/sia_mon_1.png"},
			{Slot: 2, KeyHint: "E", Name: "อาคมหมุนตาม: อาโอะ (Blue)", Description: "ยิงลูกบอลสีครามอย่างรวดเร็ว (18 dmg + ดึง) ชนลูกบอลสีแดงกลางอากาศเพื่อผสานพลังระเบิดวงกว้าง", CooldownSec: 4.5, CastRange: 920, AoeRadius: 110, AimType: "line", AccentColor: "#38BDF8", IconURL: "/skills/sia_mon_2.png"},
			{Slot: 3, KeyHint: "R", Name: "กางอาณาเขต: พรมแดนไร้ขีดจำกัด (Infinite Void)", Description: "กางอาณาเขตปิดพาศัตรูในเขตเข้าสู่อีกโลกหนึ่ง หยุดเดิน/ขยับไม่ได้ 5 วิ โดยโกะโจโจมตีได้อิสระ!", CooldownSec: 12.0, CastRange: 265, AoeRadius: 265, AimType: "self", AccentColor: "#C084FC", IconURL: "/skills/sia_mon_3.png"},
		},
	},
	{
		ID:          "ko",
		AnilistID:   129131,
		ImageURL:    "/characters/ko.png",
		DisplayName: "เซ็นอิซึ (Zenitsu)",
		AnimeTitle:  "อากาซึมะ เซ็นอิซึ (Zenitsu)",
		AnimeRef:    "Demon Slayer",
		RoleTag:     "Thunder Breath • Flash Dash",
		VoiceLine:   "雷の呼吸、壱ノ型、霹靂一閃！俺が必ず、守り抜く！",
		Color:       "#F59E0B",
		AccentColor: "#FEF08A",
		MaxHP:       235,
		MoveSpeed:   272,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Hekireki Issen (สายฟ้าพุ่งทะยาน)", Description: "ปราณอัสนีกระบวนท่าที่ 1 พุ่ง Dash ความเร็วสายฟ้า 420px ทะลุฟันทุกเป้าหมายในเส้นทาง (28 dmg)", CooldownSec: 1.8, CastRange: 420, AoeRadius: 56, AimType: "line", AccentColor: "#FACC15", IconURL: "/skills/ko_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Sixfold Blitz (อัสนีพุ่งซิกแซก 6 สาย)", Description: "พุ่ง Dash ระยะไกล 540px ทะลุฟัน 22 dmg + ระเบิดไฟฟ้าวง 95px Stun 0.7 วิ (+วิ่งไว 1.8 วิ!)", CooldownSec: 4.0, CastRange: 540, AoeRadius: 95, AimType: "ground", AccentColor: "#FEF08A", IconURL: "/skills/ko_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Dimensional Star (อัสนีปาดดาว 5 แฉก)", Description: "แยกเงาสับปาดเป็นรูปดาว 5 แฉกตามลำดับ 1→5 (18 dmg/เส้น + อมตะระหว่างร่ายเหมือนมูราด!)", CooldownSec: 7.5, CastRange: 245, AoeRadius: 245, AimType: "self", AccentColor: "#F59E0B", IconURL: "/skills/ko_3.png"},
		},
	},
	{
		ID:          "noone",
		AnilistID:   0,
		ImageURL:    "/characters/noone.png?v=mcu1",
		DisplayName: "ธานอส (Thanos)",
		AnimeTitle:  "Marvel Infinity War (Thanos)",
		AnimeRef:    "Thanos • Mad Titan",
		RoleTag:     "Infinity Collector",
		VoiceLine:   "I am inevitable. One snap seals your fate.",
		Color:       "#9333EA",
		AccentColor: "#FACC15",
		MaxHP:       265,
		MoveSpeed:   244,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "1", Name: "Power Stone (ระเบิดอุกกาบาตพลังทำลาย)", Description: "มณีแห่งพลังสีม่วง: ทุบระเบิดคลื่นพลาสมา 38 dmg + ผลักศัตรูกระเด็น + Stun 0.45 วิ", CooldownSec: 3.2, CastRange: 420, AoeRadius: 115, AimType: "ground", AccentColor: "#A855F7", IconURL: "/skills/noone_1.png"},
			{Slot: 2, KeyHint: "2", Name: "Space Stone (วาร์ปหลุมดำดึงศัตรู)", Description: "มณีแห่งอวกาศสีน้ำเงิน: วาร์ปทะลุมิติไปยังจุดเป้าหมาย ดึงรวบศัตรู + 26 dmg + Stun 0.65 วิ", CooldownSec: 4.5, CastRange: 500, AoeRadius: 140, AimType: "ground", AccentColor: "#3B82F6", IconURL: "/skills/noone_2.png"},
			{Slot: 3, KeyHint: "3", Name: "Reality Stone (คลื่นผลึกมิติสีแดง)", Description: "มณีแห่งความจริงสีแดง: ยิงผลึกอีเธอร์ 5 สายกวาดเป็นพัด 16 dmg/สาย + Slow 2.0 วิ", CooldownSec: 3.8, CastRange: 440, AoeRadius: 105, AimType: "cone", AccentColor: "#EF4444", IconURL: "/skills/noone_3.png"},
			{Slot: 4, KeyHint: "4", Name: "Time Stone (มณฑลเวลาฟื้นฟู)", Description: "มณีแห่งเวลาสีเขียว: ตรึงเวลาหยุดศัตรูรอบตัว Stun 1.25 วิ + ฟื้นพลังชีวิตตนเอง 55 HP", CooldownSec: 6.5, CastRange: 230, AoeRadius: 230, AimType: "self", AccentColor: "#10B981", IconURL: "/skills/noone_4.png"},
			{Slot: 5, KeyHint: "5", Name: "Mind Stone (ลำแสงจิตจักรพรรดิ)", Description: "มณีแห่งจิตสีทอง: ยิงลำแสงจิตเจาะทะลุเส้นตรงระยะไกล 42 dmg + Stun 0.75 วิ", CooldownSec: 5.0, CastRange: 640, AoeRadius: 56, AimType: "line", AccentColor: "#F59E0B", IconURL: "/skills/noone_5.png"},
		},
	},
	{
		ID:          "simo",
		AnilistID:   146028,
		ImageURL:    "/characters/simo.png",
		DisplayName: "ซีโม่ แฮวแฮ (Simo)",
		AnimeTitle:  "ซีโม่ แฮวแฮ (Simo Häyhä)",
		AnimeRef:    "มหาศึกคนชนเทพ (Record of Ragnarok)",
		RoleTag:     "White Death • Elsu Sniper",
		VoiceLine:   "白い死神からは逃げられない…照準完了、一撃必殺！",
		Color:       "#38BDF8",
		AccentColor: "#F8FAFC",
		MaxHP:       220,
		MoveSpeed:   264,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Sentinel Recon (เรดาร์หิมะสอดแนม)", Description: "วางทุ่นเรดาร์หิมะสอดแนมแบบเอลสุ 5 วิ ปล่อยคลื่นสแกนน้ำแข็งทำดาเมจ 10 dmg/ระลอก + Slow ศัตรู 1.4 วิ", CooldownSec: 4.0, CastRange: 460, AoeRadius: 145, AimType: "ground", AccentColor: "#38BDF8", IconURL: "/skills/simo_1.png"},
			{Slot: 2, KeyHint: "E", Name: "White Death Snipe (ชาร์จซุ่มยิง 50% HP)", Description: "ยืนนิ่งตั้งป้อมและขยายหน้าจอเต็มแมพ กดค้างบีบเส้นเล็งแบบเอลสุ: ชาร์จไม่เสร็จกระสุนจะเบี้ยวออกข้าง ชาร์จเต็ม 100% ยิงทะลุแมพทำดาเมจ 50% ของ HP ศัตรู!", CooldownSec: 4.2, CastRange: 2800, AoeRadius: 44, AimType: "line", AccentColor: "#EF4444", IconURL: "/skills/simo_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Tactical Backflip (ดีดตัวถอยหลังยิงสกัด)", Description: "ตีลังกากระโดดถอยหลัง 240px (อมตะ 0.4 วิ + วิ่งไว 1.8 วิ) พร้อมยิงกระสุนสไนเปอร์น้ำแข็งสกัดไปข้างหน้า 44 dmg + Slow 1.8 วิ", CooldownSec: 6.5, CastRange: 560, AoeRadius: 68, AimType: "line", AccentColor: "#E0F2FE", IconURL: "/skills/simo_3.png"},
		},
	},
	{
		ID:          "jinwoo",
		AnilistID:   151807,
		ImageURL:    "/characters/jinwoo.png?v=sjw2",
		DisplayName: "ซองจินอู",
		AnimeTitle:  "Sung Jin-Woo (Shadow Monarch)",
		AnimeRef:    "Solo Leveling",
		RoleTag:     "Shadow Monarch • Igris Summoner",
		VoiceLine:   "起きろ…影の君主の軍勢よ、全てを喰らい尽くせ！",
		Color:       "#7C3AED",
		AccentColor: "#38BDF8",
		MaxHP:       235,
		MoveSpeed:   265,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Dagger Rush (ระบำมีดสั้นจักรพรรดิเงา)", Description: "พุ่งประชิดระยะใกล้ระบำมีดสั้นคู่ Kasaka & Knight Killer ฟันกระหน่ำ 36 dmg + Slow 0.9 วิ", CooldownSec: 3.2, CastRange: 250, AoeRadius: 72, AimType: "line", AccentColor: "#8B5CF6", IconURL: "/skills/jinwoo_1.png?v=sjw2"},
			{Slot: 2, KeyHint: "E", Name: "Ruler's Authority (หัตถ์จักรพรรดิ)", Description: "ใช้พลังจิตหัตถ์จักรพรรดิบดขยี้พื้นที่ ดึงรวบศัตรูเข้าศูนย์กลางแรงโน้มถ่วง + Stun 0.85 วิ + 30 dmg", CooldownSec: 5.2, CastRange: 460, AoeRadius: 150, AimType: "ground", AccentColor: "#38BDF8", IconURL: "/skills/jinwoo_2.png?v=sjw2"},
			{Slot: 3, KeyHint: "R", Name: "ARISE: Igris (อัญเชิญอัศวินโลหิตอิกริส)", Description: "อัญเชิญบอทอัศวินเงาโลหิต 'อิกริส' ออกมาช่วยสู้ 15 วินาที (CD 30 วิ) มีสกิลแยก: กระโดดฟันดาบใหญ่ & ยิงคลื่นเพลิงโลหิต!", CooldownSec: 30.0, CastRange: 420, AoeRadius: 165, AimType: "ground", AccentColor: "#DC2626", IconURL: "/skills/jinwoo_3.png?v=sjw2"},
		},
	},
	{
		ID:          "naruto",
		AnilistID:   20,
		ImageURL:    "/characters/naruto.png?v=nrt2",
		DisplayName: "นารูโตะ",
		AnimeTitle:  "Uzumaki Naruto (Kurama Sage)",
		AnimeRef:    "Naruto Shippuden",
		RoleTag:     "Nine-Tails • Kurama Bijuudama",
		VoiceLine:   "俺は絶対に諦めねえ！九尾チャクラモード、いくってばよ！",
		Color:       "#F97316",
		AccentColor: "#FACC15",
		MaxHP:       245,
		MoveSpeed:   260,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Rasengan (ชาร์จกระสุนวงจักรประชิดระเบิด)", Description: "ชาร์จถือกระสุนวงจักรไว้ในมือพร้อมพุ่งเข้าหาเป้าหมาย (วิ่งไวขึ้น 3.5 วิ) เมื่อประชิดตัวศัตรูจะอัดระเบิดทันที 38 dmg + Stun 0.65 วิ (ร่างคุรามะ: 52 dmg)!", CooldownSec: 3.6, CastRange: 300, AoeRadius: 110, AimType: "line", AccentColor: "#38BDF8", IconURL: "/skills/naruto_1.png?v=nrt2"},
			{Slot: 2, KeyHint: "E", Name: "Shadow Clone Rasengan (แยกเงา 2 ร่างกระสุนวงจักร)", Description: "แยกเงาพันร่างเรียก 2 ร่างแยกถือกระสุนวงจักรวิ่งพุ่งเข้าโจมตีศัตรูแล้วระเบิด (23 dmg + Stun 0.4 วิ ต่อร่าง รวม 46 dmg)!", CooldownSec: 5.8, CastRange: 480, AoeRadius: 115, AimType: "ground", AccentColor: "#7DD3FC", IconURL: "/skills/naruto_2.png?v=nrt2"},
			{Slot: 3, KeyHint: "R", Name: "Kurama Mode ➔ กระสุนสัตว์หาง (Bijuudama)", Description: "ขั้น 1: แปลงร่างเป็นคุรามะตัวใหญ่เรืองแสง 9 วิ (+35 HP + วิ่งไว + ตีไว) และปลดล็อกกดซ้ำ! ขั้น 2: ยิงกระสุนสัตว์หาง (Bijuudama) ระเบิดโดมยักษ์ 64 dmg + Stun 1.15 วิ!", CooldownSec: 14.0, CastRange: 680, AoeRadius: 235, AimType: "line", AccentColor: "#F97316", IconURL: "/skills/naruto_3.png?v=nrt2"},
		},
	},
	{
		ID:          "sanji",
		AnilistID:   305,
		ImageURL:    "/characters/sanji.png",
		DisplayName: "ซันจิ",
		AnimeTitle:  "Vinsmoke Sanji (Black Leg)",
		AnimeRef:    "One Piece",
		RoleTag:     "Ifrit Jambe • Kick Assassin",
		VoiceLine:   "悪魔風脚！黒足のサンジ、熱々の一撃をお見舞いしてやるぜ！",
		Color:       "#F59E0B",
		AccentColor: "#38BDF8",
		MaxHP:       235,
		MoveSpeed:   272,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Sky Walk Kick (เดินชมจันทร์เตะพุ่ง)", Description: "พุ่งลูกเตะไฟเร็วสูง + อมตะ 0.25 วิ + 30 dmg + ผลักกระเด็น", CooldownSec: 3.0, CastRange: 380, AoeRadius: 85, AimType: "line", AccentColor: "#F97316", IconURL: "/skills/sanji_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Diable Jambe (ขาปีศาจเพลิงผลาญ)", Description: "หมุนเตะพายุเพลิงรอบตัว 36 dmg + พื้นไฟเผาต่อเนื่อง + วิ่งไว 1.5 วิ", CooldownSec: 5.0, CastRange: 155, AoeRadius: 155, AimType: "self", AccentColor: "#EF4444", IconURL: "/skills/sanji_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Ifrit Jambe (อิฟรีท เพลิงสายฟ้าคราม)", Description: "พุ่งลูกเตะเพลิงสีฟ้าความร้อนสูงทะลุเป้าหมาย 58 dmg + Stun 1.0 วิ + กระเด็นแรง!", CooldownSec: 9.8, CastRange: 440, AoeRadius: 125, AimType: "line", AccentColor: "#38BDF8", IconURL: "/skills/sanji_3.png"},
		},
	},
	{
		ID:          "luffy",
		AnilistID:   40,
		ImageURL:    "/characters/luffy.png",
		DisplayName: "ลูฟี่",
		AnimeTitle:  "Monkey D. Luffy (Gear 5)",
		AnimeRef:    "One Piece",
		RoleTag:     "Sun God Nika • Rubber Brawler",
		VoiceLine:   "海賊王に、俺はなる！ゴムゴムの全力バトルだっ！",
		Color:       "#EF4444",
		AccentColor: "#FACC15",
		MaxHP:       255,
		MoveSpeed:   258,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Gomu Gomu Pistol (หมัดยางยืด)", Description: "ยืดแขนต่อยระยะไกลทะลุเป้าหมาย 30 dmg + ผลักศัตรูกระเด็น", CooldownSec: 2.8, CastRange: 560, AoeRadius: 56, AimType: "line", AccentColor: "#EF4444", IconURL: "/skills/luffy_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Gomu Gomu Gatling (หมัดปืนกลฮาคิ)", Description: "รัวหมัดเคลือบฮาคิสีดำ-แดงด้านหน้า 4 ระลอก (12 dmg/ครั้ง + Slow 0.8 วิ)", CooldownSec: 4.8, CastRange: 340, AoeRadius: 120, AimType: "cone", AccentColor: "#DC2626", IconURL: "/skills/luffy_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Gear 5: Bajrang Gun (หมัดยักษ์เทพนิกะ)", Description: "ชาร์จหมัดยักษ์เมฆขาวทุบพื้น 185px ทำดาเมจ 62 dmg + Stun 1.15 วิ + อมตะ 0.5 วิ!", CooldownSec: 10.5, CastRange: 460, AoeRadius: 185, AimType: "ground", AccentColor: "#F8FAFC", IconURL: "/skills/luffy_3.png"},
		},
	},
	{
		ID:          "ben10",
		AnilistID:   0,
		ImageURL:    "/characters/ben10.png",
		DisplayName: "Ben 10",
		AnimeTitle:  "Ben Tennyson (Omnitrix)",
		AnimeRef:    "Ben 10: Alien Force",
		RoleTag:     "Omnitrix • Alien Tech Marksman",
		VoiceLine:   "It's hero time! Omnitrix locked and loaded!",
		Color:       "#22C55E",
		AccentColor: "#A3E635",
		MaxHP:       240,
		MoveSpeed:   260,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Heatblast Fireball (บอลไฟฮีทบลาสต์)", Description: "ยิงลูกไฟพลาสมาความเร็วสูง (+20% Deadeye) ระเบิด 95px ทำดาเมจ 34 dmg + เผาพื้น", CooldownSec: 3.2, CastRange: 640, AoeRadius: 95, AimType: "line", AccentColor: "#F97316", IconURL: "/skills/ben10_1.png"},
			{Slot: 2, KeyHint: "E", Name: "XLR8 Hyper Blitz (พุ่งความเร็วแสง)", Description: "แปลง Omnitrix พุ่งตัดผ่านศัตรู 460px ทำดาเมจ 28 dmg + Slow 1.0 วิ + วิ่งไว 1.8 วิ!", CooldownSec: 4.8, CastRange: 460, AoeRadius: 90, AimType: "line", AccentColor: "#38BDF8", IconURL: "/skills/ben10_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Way Big Cosmic Ray (ลำแสงคอสมิก)", Description: "ยิงลำแสงพลังงาน Omnitrix เส้นตรงไกล 860px ทำดาเมจ 60 dmg + Stun 0.75 วิ + กระเด็น!", CooldownSec: 10.0, CastRange: 860, AoeRadius: 72, AimType: "line", AccentColor: "#22C55E", IconURL: "/skills/ben10_3.png"},
		},
	},
	{
		ID:          "diablo",
		AnilistID:   108511,
		ImageURL:    "/characters/diablo.png",
		DisplayName: "ดิอาโบล (Diablo)",
		AnimeTitle:  "Diablo (Primordial Noir)",
		AnimeRef:    "Tensura (เกิดใหม่ทั้งทีก็เป็นสไลม์)",
		RoleTag:     "Primordial Demon • Executioner",
		VoiceLine:   "クフフフ…原初の黒、ディアブロがお相手いたしましょう。",
		Color:       "#DC2626",
		AccentColor: "#FACC15",
		MaxHP:       235,
		MoveSpeed:   262,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Despair Time (คมกรงเล็บปีศาจดำ)", Description: "ปล่อยคลื่นกรงเล็บปีศาจสีดำ-แดง 3 แฉก 22 dmg/สาย + Slow 0.9 วิ", CooldownSec: 3.2, CastRange: 540, AoeRadius: 95, AimType: "cone", AccentColor: "#DC2626", IconURL: "/skills/diablo_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Temptation World (โลกกิเลสลวงตา)", Description: "เปิดมิติลวงตาดึงศัตรูเข้าจุดศูนย์กลาง + Stun 1.1 วิ + 32 dmg", CooldownSec: 5.6, CastRange: 460, AoeRadius: 150, AimType: "ground", AccentColor: "#F59E0B", IconURL: "/skills/diablo_2.png"},
			{Slot: 3, KeyHint: "R", Name: "End of World (จุดจบแห่งสรรพสิ่ง)", Description: "ระเบิดสุริยุปราคาดำ-แดง 205px ทำดาเมจ 60 dmg (ปิดชีพทันทีเมื่อเลือดศัตรู ≤ 12%!)", CooldownSec: 11.0, CastRange: 480, AoeRadius: 205, AimType: "ground", AccentColor: "#991B1B", IconURL: "/skills/diablo_3.png"},
		},
	},
	{
		ID:          "aizen",
		AnilistID:   1086,
		ImageURL:    "/characters/aizen.png",
		DisplayName: "ไอเซ็น โซสึเกะ",
		AnimeTitle:  "Sosuke Aizen (Hogyoku Fusion)",
		AnimeRef:    "Bleach (เทพมรณะ)",
		RoleTag:     "Mage / Control • Complete Hypnosis",
		VoiceLine:   "いつから鏡花水月を使っていないと錯覚していた？",
		Color:       "#9333EA",
		AccentColor: "#E9D5FF",
		MaxHP:       210,
		MoveSpeed:   226,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Black Coffin (Hado #90 · โลงศพแรงโน้มถ่วง)", Description: "สร้างโลงศพแรงโน้มถ่วงสีดำดึงดูดและบดขยี้ศัตรูในพื้นที่ 150px ทำดาเมจ 34 dmg + Stun 0.85 วิ + Passive ภาพลวงตา", CooldownSec: 5.0, CastRange: 500, AoeRadius: 150, AimType: "ground", AccentColor: "#7C3AED", IconURL: "/skills/aizen_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Kyoka Suigetsu (กระจกบุปผาวารี)", Description: "สลายร่างเป็นเศษกระจกอมตะ 0.85 วิ หลบการโจมตีพร้อมพุ่งย้ายจุดและทิ้งร่างแยกภาพลวงตาระเบิด 24 dmg + Slow", CooldownSec: 6.2, CastRange: 340, AoeRadius: 135, AimType: "line", AccentColor: "#A855F7", IconURL: "/skills/aizen_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Hogyoku Evolution (วิวัฒนาการโฮเงียคุ)", Description: "ปลดปล่อยพลังโฮเงียคุเปลี่ยนร่างปีกเทวะ 6.5 วิ ปล่อยคลื่นแรงดันวิญญาณ 42 dmg + ออร่าความเร็วและฟื้นฟูรอบตัว", CooldownSec: 12.5, CastRange: 300, AoeRadius: 270, AimType: "self", AccentColor: "#C084FC", IconURL: "/skills/aizen_3.png"},
		},
	},
	{
		ID:          "toriko",
		AnilistID:   14677,
		ImageURL:    "/characters/toriko.png",
		DisplayName: "โทริโกะ",
		AnimeTitle:  "Toriko (Gourmet Hunter)",
		AnimeRef:    "Toriko (โทริโกะ ยอดนักล่าอาหาร)",
		RoleTag:     "Fighter / Bruiser • Gourmet Cells",
		VoiceLine:   "この世の全ての食材に感謝を込めて、いただきます！",
		Color:       "#EF4444",
		AccentColor: "#F97316",
		MaxHP:       245,
		MoveSpeed:   230,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Knife & Fork (มีดและส้อมพลังงาน)", Description: "แทงส้อมพลังงานตรึงศัตรูและฟันมีดคมกริบต่อเนื่อง 4 จังหวะ ทำดาเมจรวม 44 dmg พร้อมสะสมเซลล์กูร์เมต์", CooldownSec: 4.0, CastRange: 250, AoeRadius: 145, AimType: "cone", AccentColor: "#EF4444", IconURL: "/skills/toriko_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Leg Knife (ลูกเตะคมมีดมหาศาล)", Description: "พุ่งทะยานแล้วฟาดลูกเตะคลื่นมีดสีแดง 34 dmg + Stun 0.75 วิ + กระแทกศัตรูกระเด็นไกล", CooldownSec: 5.5, CastRange: 340, AoeRadius: 125, AimType: "line", AccentColor: "#F97316", IconURL: "/skills/toriko_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Ultimate Routine (หมัดเทพนักล่าอาหาร)", Description: "ปลุกพลังเซลล์กูร์เมต์เต็ม 5 สแต็ก ฟื้นฟู +22 HP และทุ่มหมัดสีแดงขนาดยักษ์ 52 dmg + Stun 1.1 วิ + กระเด็น!", CooldownSec: 11.5, CastRange: 440, AoeRadius: 225, AimType: "ground", AccentColor: "#DC2626", IconURL: "/skills/toriko_3.png"},
		},
	},
	{
		ID:          "frieren",
		AnilistID:   176754,
		ImageURL:    "/characters/frieren.png",
		DisplayName: "ฟรีเรน",
		AnimeTitle:  "Frieren (The Slayer)",
		AnimeRef:    "Sousou no Frieren (คำอธิษฐานในวันที่จากลา)",
		RoleTag:     "Mage / Burst • Ancient Magic",
		VoiceLine:   "魔王を倒した魔法使い、フリーレンだ。",
		Color:       "#38BDF8",
		AccentColor: "#2563EB",
		MaxHP:       205,
		MoveSpeed:   224,
		Skills: []SkillDef{
			{Slot: 1, KeyHint: "Q", Name: "Zoltraak (โซลทรัค · เวทสังหารมาร)", Description: "ยิงลำแสงเวทมนตร์โบราณสีฟ้าขาวความเร็วสูงเจาะทะลุศัตรูทุกตัว 36 dmg (+Ancient Magic สูงสุด +32%)", CooldownSec: 3.6, CastRange: 720, AoeRadius: 68, AimType: "line", AccentColor: "#38BDF8", IconURL: "/skills/frieren_1.png"},
			{Slot: 2, KeyHint: "E", Name: "Mana Barrier (โล่เวทมนตร์หกเหลี่ยม)", Description: "กางโล่เวทมนตร์หกเหลี่ยมป้องกันความเสียหายทั้งหมด 1.35 วิ ฟื้นฟู +16 HP และผลักศัตรูรอบข้าง", CooldownSec: 6.0, CastRange: 220, AoeRadius: 150, AimType: "self", AccentColor: "#60A5FA", IconURL: "/skills/frieren_2.png"},
			{Slot: 3, KeyHint: "R", Name: "Supreme Spell (วงเวทพิพากษาบรรพกาล)", Description: "เรียกวงเวทโบราณขนาดยักษ์ 230px ยิงลำแสงเวทมนตร์ถล่มพื้นที่ 56 dmg + Stun 1.1 วิ + Slow 1.8 วิ!", CooldownSec: 11.8, CastRange: 560, AoeRadius: 230, AimType: "ground", AccentColor: "#2563EB", IconURL: "/skills/frieren_3.png"},
		},
	},
}

var (
	allCharactersJSON    []byte
	publicCharactersJSON []byte
)

func init() {
	for k, v := range roster28ClassAssignment {
		heroClassAssignment[k] = v
	}
	characterCatalog = append(characterCatalog, roster28Characters...)
	for i := range characterCatalog {
		cid := characterCatalog[i].ID
		clsID := heroClassAssignment[cid]
		meta, ok := heroClassTable[clsID]
		if !ok {
			meta = heroClassTable[ClassVanguard]
		}
		characterCatalog[i].HeroClass = meta.id
		characterCatalog[i].ClassName = meta.name
		characterCatalog[i].ClassIcon = meta.icon
		characterCatalog[i].ClassColor = meta.color
		characterCatalog[i].ClassTraitLabel = meta.traitLabel
		characterCatalog[i].ClassStatKey = meta.statKey
		characterCatalog[i].ClassStatValue = meta.statValue
	}

	bAll, _ := json.Marshal(struct {
		Characters []CharacterDef `json:"characters"`
	}{
		Characters: characterCatalog,
	})
	allCharactersJSON = bAll

	pub := CharactersForRole("player")
	bPub, _ := json.Marshal(struct {
		Characters []CharacterDef `json:"characters"`
	}{
		Characters: pub,
	})
	publicCharactersJSON = bPub
}

// AllCharacters returns a copy of all selectable character definitions (including admin heroes).
func AllCharacters() []CharacterDef {
	out := make([]CharacterDef, len(characterCatalog))
	copy(out, characterCatalog)
	return out
}

// CharactersForRole returns only the heroes accessible to the given user role ("admin" sees all).
func CharactersForRole(role string) []CharacterDef {
	if role == "admin" {
		return AllCharacters()
	}
	out := make([]CharacterDef, 0, len(characterCatalog))
	for _, c := range characterCatalog {
		if !c.AdminOnly {
			out = append(out, c)
		}
	}
	return out
}

// AllCharactersJSON returns the full character catalog JSON.
func AllCharactersJSON() []byte {
	return allCharactersJSON
}

// PublicCharactersJSON returns the non-admin character catalog JSON for GET /api/characters.
func PublicCharactersJSON() []byte {
	return publicCharactersJSON
}

// GetCharacter resolves a character ID safely, falling back to "default".
func GetCharacter(id string) CharacterDef {
	for _, c := range characterCatalog {
		if c.ID == id {
			return c
		}
	}
	return characterCatalog[0]
}

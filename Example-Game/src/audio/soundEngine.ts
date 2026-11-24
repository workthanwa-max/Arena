/**
 * Client Audio, Thai Character Voice & Ambient Arena BGM Synthesizer.
 * Plays bundled genuine Thai voice MP3 files via Web Audio (works offline & across Linux/Windows/macOS/iPad Safari)
 * alongside procedural soft MOBA battlefield background music and distinct per-skill SFX.
 */

export interface CharacterVoiceConfig {
  quote: string
  lang: string
  audioUrl: string
  playbackRate: number
  filterType?: BiquadFilterType
  filterFreq?: number
  filterGainDb?: number
  pitch: number
  rate: number
}

export const CHARACTER_VOICES: Record<string, CharacterVoiceConfig> = {
  default: {
    quote: 'Combat systems online! Challenger ready for battle!',
    lang: 'en-US',
    audioUrl: '/voices/default.mp3?v=en2',
    playbackRate: 1.0,
    pitch: 1.0,
    rate: 1.02,
  },
  pa: {
    quote: '王の財宝、ゲート・オブ・バビロン！雑種、我の前にひざまずけ！',
    lang: 'ja-JP',
    audioUrl: '/voices/pa.mp3?v=jp1',
    playbackRate: 0.98,
    pitch: 0.92,
    rate: 0.98,
  },
  boy: {
    quote: 'オッス！おめえ、なかなかやるな！全力のかめはめ波、いくぞっ！',
    lang: 'ja-JP',
    audioUrl: '/voices/boy.mp3?v=jp1',
    playbackRate: 1.03,
    pitch: 1.08,
    rate: 1.04,
  },
  ole: {
    quote: '許せ…お前はすでに、俺の月読の中だ。',
    lang: 'ja-JP',
    audioUrl: '/voices/ole.mp3?v=jp1',
    playbackRate: 0.96,
    pitch: 0.88,
    rate: 0.94,
  },
  thanwa: {
    quote: '三刀流！俺の剣に、斬れねえものなど何一つねえ！',
    lang: 'ja-JP',
    audioUrl: '/voices/thanwa.mp3?v=jp1',
    playbackRate: 0.98,
    pitch: 0.9,
    rate: 0.98,
  },
  ajarn_au: {
    quote: '神速、カンムル！俺の雷撃に、ついてこられるかよ！',
    lang: 'ja-JP',
    audioUrl: '/voices/ajarn_au.mp3?v=jp1',
    playbackRate: 1.04,
    pitch: 1.12,
    rate: 1.06,
  },
  ajarn_boy: {
    quote: '身の程を知れ、痴れ者が！領域展開、伏魔御厨子！',
    lang: 'ja-JP',
    audioUrl: '/voices/ajarn_boy.mp3?v=jp1',
    playbackRate: 0.95,
    pitch: 0.84,
    rate: 0.92,
  },
  kaem: {
    quote: '真なる魔王の力、見せてやるよ！喰らい尽くせ、ベルゼビュート！',
    lang: 'ja-JP',
    audioUrl: '/voices/kaem.mp3?v=jp1',
    playbackRate: 1.0,
    pitch: 1.06,
    rate: 1.0,
  },
  frame: {
    quote: 'やれやれだぜ…出てこい、デブ猫スタンド！オラオラオラァ！',
    lang: 'ja-JP',
    audioUrl: '/voices/frame.mp3?v=jp1',
    playbackRate: 0.98,
    pitch: 0.9,
    rate: 0.98,
  },
  luangphi_sorn: {
    quote: 'マジ殴り一発で十分だ。南無阿弥陀仏、安らかに眠れ。',
    lang: 'ja-JP',
    audioUrl: '/voices/luangphi_sorn.mp3?v=jp1',
    playbackRate: 0.97,
    pitch: 0.88,
    rate: 0.96,
  },
  sia_mon: {
    quote: '天上天下、唯我独尊！領域展開、無量空処！',
    lang: 'ja-JP',
    audioUrl: '/voices/sia_mon.mp3?v=jp1',
    playbackRate: 1.0,
    pitch: 1.02,
    rate: 1.0,
  },
  ko: {
    quote: '雷の呼吸、壱ノ型、霹靂一閃！俺が必ず、守り抜く！',
    lang: 'ja-JP',
    audioUrl: '/voices/ko.mp3?v=jp1',
    playbackRate: 1.02,
    pitch: 1.06,
    rate: 1.04,
  },
  noone: {
    quote: 'I am inevitable. One snap seals your fate.',
    lang: 'en-US',
    audioUrl: '/voices/noone.mp3?v=en1',
    playbackRate: 0.96,
    pitch: 0.84,
    rate: 0.94,
  },
  simo: {
    quote: '白い死神からは逃げられない…照準完了、一撃必殺！',
    lang: 'ja-JP',
    audioUrl: '/voices/simo.mp3?v=jp1',
    playbackRate: 0.98,
    pitch: 0.92,
    rate: 0.96,
  },
  jinwoo: {
    quote: '起きろ…影の君主の命令だ。我が軍団よ、敵を殲滅せよ！',
    lang: 'ja-JP',
    audioUrl: '/voices/jinwoo.mp3?v=jp1',
    playbackRate: 0.97,
    pitch: 0.88,
    rate: 0.96,
  },
  naruto: {
    quote: '俺は火影になる男だ！いくぜ九喇嘛、螺旋手裏剣だってばよ！',
    lang: 'ja-JP',
    audioUrl: '/voices/naruto.mp3?v=jp1',
    playbackRate: 1.03,
    pitch: 1.08,
    rate: 1.04,
  },
  sanji: {
    quote: 'レディには指一本触れさせねえ…魔神風脚、焼き尽くしてやる！',
    lang: 'ja-JP',
    audioUrl: '/voices/sanji.mp3?v=jp1',
    playbackRate: 1.0,
    pitch: 0.96,
    rate: 1.0,
  },
  luffy: {
    quote: '海賊王に、俺はなる！ギア５、ゴムゴムの猿神銃だぁっ！',
    lang: 'ja-JP',
    audioUrl: '/voices/luffy.mp3?v=jp1',
    playbackRate: 1.04,
    pitch: 1.1,
    rate: 1.05,
  },
  ben10: {
    quote: 'It is Hero Time! Omnitrix locked on and ready to go!',
    lang: 'en-US',
    audioUrl: '/voices/ben10.mp3?v=jp1',
    playbackRate: 1.02,
    pitch: 1.05,
    rate: 1.02,
  },
  diablo: {
    quote: 'クフフフ…原初の黒ディアブロ、絶望の世界へご案内いたします。',
    lang: 'ja-JP',
    audioUrl: '/voices/diablo.mp3?v=jp1',
    playbackRate: 0.96,
    pitch: 0.88,
    rate: 0.95,
  },
}

export interface SkillVoiceClip {
  url: string
  text: string
  lang: string
  playbackRate: number
}

/** Authentic per-hero, per-skill voice callouts played immediately when heroes unleash their abilities. */
export const SKILL_VOICE_MAP: Record<string, SkillVoiceClip> = {
  pa_1: { url: '/voices/skills/pa_1.mp3?v=sk1', text: 'ゲート・オブ・バビロン！', lang: 'ja-JP', playbackRate: 1.02 },
  pa_2: { url: '/voices/skills/pa_2.mp3?v=sk1', text: '天の鎖、エルキドゥ！', lang: 'ja-JP', playbackRate: 1.0 },
  pa_3: { url: '/voices/skills/pa_3.mp3?v=sk1', text: 'エヌマ・エリシュ！', lang: 'ja-JP', playbackRate: 0.98 },
  boy_1: { url: '/voices/skills/boy_1.mp3?v=sk1', text: '気弾連射！', lang: 'ja-JP', playbackRate: 1.04 },
  boy_2: { url: '/voices/skills/boy_2.mp3?v=sk1', text: '龍拳爆発！', lang: 'ja-JP', playbackRate: 1.03 },
  boy_3: { url: '/voices/skills/boy_3.mp3?v=sk1', text: 'かめはめ波ぁっ！', lang: 'ja-JP', playbackRate: 1.02 },
  ole_1: { url: '/voices/skills/ole_1.mp3?v=sk1', text: '烏分身、手裏剣！', lang: 'ja-JP', playbackRate: 1.0 },
  ole_2: { url: '/voices/skills/ole_2.mp3?v=sk1', text: '月読！', lang: 'ja-JP', playbackRate: 0.96 },
  ole_3: { url: '/voices/skills/ole_3.mp3?v=sk1', text: '天照！', lang: 'ja-JP', playbackRate: 0.96 },
  thanwa_1: { url: '/voices/skills/thanwa_1.mp3?v=sk1', text: '百八煩悩鳳！', lang: 'ja-JP', playbackRate: 1.0 },
  thanwa_2: { url: '/voices/skills/thanwa_2.mp3?v=sk1', text: '一刀流、獅子歌歌！', lang: 'ja-JP', playbackRate: 1.02 },
  thanwa_3: { url: '/voices/skills/thanwa_3.mp3?v=sk1', text: '三刀流奥義、三千世界！', lang: 'ja-JP', playbackRate: 0.98 },
  ajarn_au_1: { url: '/voices/skills/ajarn_au_1.mp3?v=sk1', text: '雷掌！', lang: 'ja-JP', playbackRate: 1.05 },
  ajarn_au_2: { url: '/voices/skills/ajarn_au_2.mp3?v=sk1', text: '神速、カンムル！', lang: 'ja-JP', playbackRate: 1.04 },
  ajarn_au_3: { url: '/voices/skills/ajarn_au_3.mp3?v=sk1', text: '落雷、ナルカミ！', lang: 'ja-JP', playbackRate: 1.02 },
  ajarn_boy_1: { url: '/voices/skills/ajarn_boy_1.mp3?v=sk1', text: '解！', lang: 'ja-JP', playbackRate: 0.98 },
  ajarn_boy_2: { url: '/voices/skills/ajarn_boy_2.mp3?v=sk1', text: 'フーガ、開！', lang: 'ja-JP', playbackRate: 0.96 },
  ajarn_boy_3: { url: '/voices/skills/ajarn_boy_3.mp3?v=sk1', text: '領域展開、伏魔御厨子！', lang: 'ja-JP', playbackRate: 0.95 },
  ajarn_boy_rct: { url: '/voices/skills/ajarn_boy_rct.mp3?v=sk1', text: '反転術式！', lang: 'ja-JP', playbackRate: 0.97 },
  kaem_1: { url: '/voices/skills/kaem_1.mp3?v=sk1', text: '黒稲妻！', lang: 'ja-JP', playbackRate: 1.02 },
  kaem_2: { url: '/voices/skills/kaem_2.mp3?v=sk1', text: '黒炎！', lang: 'ja-JP', playbackRate: 1.02 },
  kaem_3: { url: '/voices/skills/kaem_3.mp3?v=sk1', text: '暴食之王、ベルゼビュート！', lang: 'ja-JP', playbackRate: 1.0 },
  frame_1: { url: '/voices/skills/frame_1.mp3?v=sk1', text: '行け、アイウアン！', lang: 'ja-JP', playbackRate: 1.02 },
  frame_2: { url: '/voices/skills/frame_2.mp3?v=sk1', text: 'オラオラオラオラァ！', lang: 'ja-JP', playbackRate: 1.05 },
  frame_3: { url: '/voices/skills/frame_3.mp3?v=sk1', text: 'ザ・ワールド！時よ止まれ！', lang: 'ja-JP', playbackRate: 0.97 },
  sia_mon_1: { url: '/voices/skills/sia_mon_1.mp3?v=sk1', text: '術式反転、赫！', lang: 'ja-JP', playbackRate: 1.02 },
  sia_mon_2: { url: '/voices/skills/sia_mon_2.mp3?v=sk1', text: '術式順転、蒼！', lang: 'ja-JP', playbackRate: 1.02 },
  sia_mon_3: { url: '/voices/skills/sia_mon_3.mp3?v=sk1', text: '領域展開、無量空処！', lang: 'ja-JP', playbackRate: 1.0 },
  sia_mon_rct: { url: '/voices/skills/sia_mon_rct.mp3?v=sk1', text: '反転術式！', lang: 'ja-JP', playbackRate: 1.0 },
  sia_mon_purple: { url: '/voices/skills/sia_mon_purple.mp3?v=sk1', text: '虚式、茈！', lang: 'ja-JP', playbackRate: 1.0 },
  ko_1: { url: '/voices/skills/ko_1.mp3?v=sk1', text: '雷の呼吸、壱ノ型、霹靂一閃！', lang: 'ja-JP', playbackRate: 1.05 },
  ko_2: { url: '/voices/skills/ko_2.mp3?v=sk1', text: '霹靂一閃、六連！', lang: 'ja-JP', playbackRate: 1.06 },
  ko_3: { url: '/voices/skills/ko_3.mp3?v=sk1', text: '火雷神！', lang: 'ja-JP', playbackRate: 1.02 },
  noone_1: { url: '/voices/skills/noone_1.mp3?v=sk1', text: 'Power Stone!', lang: 'en-US', playbackRate: 0.98 },
  noone_2: { url: '/voices/skills/noone_2.mp3?v=sk1', text: 'Space Stone!', lang: 'en-US', playbackRate: 0.98 },
  noone_3: { url: '/voices/skills/noone_3.mp3?v=sk1', text: 'Reality Stone!', lang: 'en-US', playbackRate: 0.98 },
  noone_4: { url: '/voices/skills/noone_4.mp3?v=sk1', text: 'Time Stone!', lang: 'en-US', playbackRate: 0.98 },
  noone_5: { url: '/voices/skills/noone_5.mp3?v=sk1', text: 'Mind Stone!', lang: 'en-US', playbackRate: 0.98 },
  noone_snap: { url: '/voices/skills/noone_snap.mp3?v=sk1', text: 'I am inevitable!', lang: 'en-US', playbackRate: 0.95 },
  simo_1: { url: '/voices/skills/simo_1.mp3?v=sk1', text: '雪原レーダー展開！', lang: 'ja-JP', playbackRate: 1.0 },
  simo_2: { url: '/voices/skills/simo_2.mp3?v=sk1', text: '白い死神、一撃必殺！', lang: 'ja-JP', playbackRate: 0.98 },
  simo_3: { url: '/voices/skills/simo_3.mp3?v=sk1', text: '戦術後方射撃！', lang: 'ja-JP', playbackRate: 1.02 },
  luangphi_sorn_1: { url: '/voices/skills/luangphi_sorn_1.mp3?v=sk1', text: '必殺マジシリーズ、マジ殴り！', lang: 'ja-JP', playbackRate: 0.98 },
  jinwoo_1: { url: '/voices/skills/jinwoo_1.mp3?v=sk1', text: '影の短剣乱舞！', lang: 'ja-JP', playbackRate: 1.02 },
  jinwoo_2: { url: '/voices/skills/jinwoo_2.mp3?v=sk1', text: '支配者の手！', lang: 'ja-JP', playbackRate: 0.98 },
  jinwoo_3: { url: '/voices/skills/jinwoo_3.mp3?v=sk1', text: '起きろ！影の軍団！', lang: 'ja-JP', playbackRate: 0.96 },
  naruto_1: { url: '/voices/skills/naruto_1.mp3?v=sk1', text: '螺旋丸！', lang: 'ja-JP', playbackRate: 1.04 },
  naruto_2: { url: '/voices/skills/naruto_2.mp3?v=sk1', text: '風遁・螺旋手裏剣！', lang: 'ja-JP', playbackRate: 1.02 },
  naruto_3: { url: '/voices/skills/naruto_3.mp3?v=sk1', text: '九喇嘛モード、いくぜっ！', lang: 'ja-JP', playbackRate: 1.03 },
  sanji_1: { url: '/voices/skills/sanji_1.mp3?v=sk1', text: 'スカイウォーク・キック！', lang: 'ja-JP', playbackRate: 1.03 },
  sanji_2: { url: '/voices/skills/sanji_2.mp3?v=sk1', text: '悪魔風脚！', lang: 'ja-JP', playbackRate: 1.02 },
  sanji_3: { url: '/voices/skills/sanji_3.mp3?v=sk1', text: '魔神風脚・牛肉バースト！', lang: 'ja-JP', playbackRate: 1.0 },
  luffy_1: { url: '/voices/skills/luffy_1.mp3?v=sk1', text: 'ゴムゴムのピストル！', lang: 'ja-JP', playbackRate: 1.04 },
  luffy_2: { url: '/voices/skills/luffy_2.mp3?v=sk1', text: 'ゴムゴムのガトリング！', lang: 'ja-JP', playbackRate: 1.05 },
  luffy_3: { url: '/voices/skills/luffy_3.mp3?v=sk1', text: 'ギア５、猿神銃！', lang: 'ja-JP', playbackRate: 1.02 },
  ben10_1: { url: '/voices/skills/ben10_1.mp3?v=sk1', text: 'Heatblast Fireball!', lang: 'en-US', playbackRate: 1.03 },
  ben10_2: { url: '/voices/skills/ben10_2.mp3?v=sk1', text: 'XLR8 Hyper Blitz!', lang: 'en-US', playbackRate: 1.04 },
  ben10_3: { url: '/voices/skills/ben10_3.mp3?v=sk1', text: 'Way Big Cosmic Ray!', lang: 'en-US', playbackRate: 1.0 },
  diablo_1: { url: '/voices/skills/diablo_1.mp3?v=sk1', text: '絶望の時間！', lang: 'ja-JP', playbackRate: 0.98 },
  diablo_2: { url: '/voices/skills/diablo_2.mp3?v=sk1', text: '誘惑世界！', lang: 'ja-JP', playbackRate: 0.96 },
  diablo_3: { url: '/voices/skills/diablo_3.mp3?v=sk1', text: 'エンド・オブ・ワールド！', lang: 'ja-JP', playbackRate: 0.95 },
}

interface BgmChordBar {
  bassHz: number
  padHz: readonly number[]
  arpHz: readonly number[]
}

// High-Octane Dark Gothic Electro-Rock Progression (131 BPM ~ 16th = 0.1145s, Iconic Gojo vs Sukuna Boss Theme)
const ICONIC_BGM_STEP_SEC = 0.1145
const ICONIC_BGM_BARS: readonly { bass: number; chord: number[]; lead: number[] }[] = [
  {
    bass: 69.3, // C#2
    chord: [277.18, 329.63, 415.3], // C#m
    lead: [554.37, 0, 554.37, 659.25, 0, 622.25, 0, 554.37, 493.88, 0, 554.37, 0, 659.25, 0, 622.25, 554.37],
  },
  {
    bass: 55.0, // A1
    chord: [220.0, 277.18, 329.63], // A
    lead: [440.0, 0, 554.37, 659.25, 0, 554.37, 0, 493.88, 440.0, 0, 493.88, 554.37, 659.25, 0, 554.37, 493.88],
  },
  {
    bass: 82.41, // E2
    chord: [329.63, 415.3, 493.88], // E
    lead: [659.25, 0, 659.25, 739.99, 0, 830.61, 0, 739.99, 659.25, 0, 622.25, 0, 554.37, 0, 493.88, 0],
  },
  {
    bass: 61.74, // B1 -> G# dramatic turnaround
    chord: [246.94, 311.13, 369.99], // B
    lead: [622.25, 0, 659.25, 0, 739.99, 0, 830.61, 659.25, 622.25, 0, 554.37, 493.88, 415.3, 493.88, 554.37, 622.25],
  },
]

// Soft D-Dorian / Minor Holo-Arena ambient progression (92 BPM, 8th note = 0.326s)
const ARENA_BGM_STEP_SEC = 0.326
const ARENA_BGM_BARS: readonly BgmChordBar[] = [
  {
    bassHz: 146.83, // D3
    padHz: [220.0, 261.63, 329.63], // A3, C4, E4
    arpHz: [293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 329.63, 293.66],
  },
  {
    bassHz: 116.54, // Bb2
    padHz: [174.61, 220.0, 293.66], // F3, A3, D4
    arpHz: [293.66, 349.23, 440.0, 587.33, 440.0, 349.23, 293.66, 220.0],
  },
  {
    bassHz: 130.81, // C3
    padHz: [196.0, 261.63, 293.66], // G3, C4, D4
    arpHz: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 261.63],
  },
  {
    bassHz: 110.0, // A2
    padHz: [164.81, 196.0, 261.63], // E3, G3, C4
    arpHz: [220.0, 261.63, 329.63, 392.0, 329.63, 261.63, 220.0, 196.0],
  },
]

const BGM_NOMINAL_GAIN = 0.15
const BGM_DUCKED_GAIN = 0.055

class SoundEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private voiceGain: GainNode | null = null
  private bgmGain: GainNode | null = null
  private bgmLowpass: BiquadFilterNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private muted = false
  private bgmMuted = false
  private lastKindPlayedAt = new Map<string, number>()

  // Voice caching & overlap prevention
  private voiceBuffers = new Map<string, AudioBuffer>()
  private voiceFetches = new Map<string, Promise<AudioBuffer | null>>()
  private pendingVoiceBytes = new Map<string, ArrayBuffer>()
  private voicePlaySeq = 0
  private activeVoiceSrc: AudioBufferSourceNode | null = null
  private activeVoiceAudio: HTMLAudioElement | null = null
  private activeSkillVoiceSrc: AudioBufferSourceNode | null = null
  private activeSkillVoiceAudio: HTMLAudioElement | null = null
  private preloadStarted = false
  private autoUnlockInstalled = false

  // Arena BGM lookahead scheduler state
  private bgmPlaying = false
  private bgmVariant: 'arena' | 'iconic' = 'arena'
  private bgmTimerId: number | null = null
  private bgmNextNoteTime = 0
  private bgmStep = 0
  private bgmDuckUntil = 0
  private bgmDuckTimerId: number | null = null

  constructor() {
    this.installAutoUnlockListeners()
  }

  /**
   * Fixes intermittent "no sound" bug caused by browsers suspending AudioContext after
   * 1-year auto-login (no auth click), background tab switches, or mobile Safari audio interrupts.
   */
  private installAutoUnlockListeners(): void {
    if (this.autoUnlockInstalled || typeof window === 'undefined') return
    this.autoUnlockInstalled = true
    const wakeAudio = () => {
      if (this.muted) return
      const ctx = this.unlock()
      if (ctx && ctx.state !== 'running') {
        void ctx
          .resume()
          .then(() => {
            if (this.ctx) {
              this.bgmNextNoteTime = this.ctx.currentTime + 0.06
            }
            this.updateGainTargets()
            this.flushPendingVoiceBytes()
          })
          .catch(() => undefined)
      } else if (ctx) {
        this.flushPendingVoiceBytes()
      }
    }
    window.addEventListener('pointerdown', wakeAudio, { capture: true, passive: true })
    window.addEventListener('touchstart', wakeAudio, { capture: true, passive: true })
    window.addEventListener('keydown', wakeAudio, { capture: true, passive: true })
    window.addEventListener('click', wakeAudio, { capture: true, passive: true })
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !this.muted && this.ctx && this.ctx.state !== 'running') {
          void this.ctx
            .resume()
            .then(() => {
              if (this.ctx) {
                this.bgmNextNoteTime = this.ctx.currentTime + 0.06
              }
              this.updateGainTargets()
            })
            .catch(() => undefined)
        }
      })
    }
  }

  private flushPendingVoiceBytes(): void {
    if (!this.ctx || this.pendingVoiceBytes.size === 0) return
    const entries = Array.from(this.pendingVoiceBytes.entries())
    this.pendingVoiceBytes.clear()
    for (const [charId, bytes] of entries) {
      void this.primeVoiceFromBytes(charId, bytes)
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  setMuted(next: boolean): void {
    this.muted = next
    if (next) {
      this.stopActiveVoice()
    }
    this.updateGainTargets()
  }

  isBgmMuted(): boolean {
    return this.bgmMuted
  }

  setBgmMuted(next: boolean): void {
    this.bgmMuted = next
    this.updateGainTargets()
  }

  private targetBgmGain(): number {
    if (this.muted || this.bgmMuted || !this.bgmPlaying) return 0
    if (performance.now() < this.bgmDuckUntil) return BGM_DUCKED_GAIN
    return BGM_NOMINAL_GAIN
  }

  private updateGainTargets(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.45, now, 0.03)
    }
    if (this.bgmGain) {
      this.bgmGain.gain.setTargetAtTime(this.targetBgmGain(), now, 0.12)
    }
  }

  unlock(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      try {
        const ctx = new Ctor()
        const comp = ctx.createDynamicsCompressor()
        const master = ctx.createGain()
        master.gain.value = this.muted ? 0 : 0.45

        const voiceGain = ctx.createGain()
        voiceGain.gain.value = 1.15
        voiceGain.connect(master)

        const bgmLowpass = ctx.createBiquadFilter()
        bgmLowpass.type = 'lowpass'
        bgmLowpass.frequency.value = 1050
        bgmLowpass.Q.value = 0.6

        const bgmGain = ctx.createGain()
        bgmGain.gain.value = 0
        bgmLowpass.connect(bgmGain)
        bgmGain.connect(master)

        master.connect(comp)
        comp.connect(ctx.destination)

        this.ctx = ctx
        this.masterGain = master
        this.voiceGain = voiceGain
        this.bgmGain = bgmGain
        this.bgmLowpass = bgmLowpass
        this.noiseBuffer = this.buildNoiseBuffer(ctx)
        ctx.onstatechange = () => {
          if (ctx.state === 'running') {
            this.bgmNextNoteTime = Math.max(this.bgmNextNoteTime, ctx.currentTime + 0.05)
            this.updateGainTargets()
            this.flushPendingVoiceBytes()
          }
        }
      } catch {
        return null
      }
    }
    if (this.ctx.state !== 'running') {
      void this.ctx
        .resume()
        .then(() => {
          if (this.ctx) {
            this.bgmNextNoteTime = Math.max(this.bgmNextNoteTime, this.ctx.currentTime + 0.05)
          }
          this.updateGainTargets()
          this.flushPendingVoiceBytes()
        })
        .catch(() => undefined)
    } else {
      this.updateGainTargets()
      this.flushPendingVoiceBytes()
    }
    if (!this.preloadStarted) {
      this.preloadStarted = true
      const def = CHARACTER_VOICES.default
      if (def) void this.loadVoiceBuffer('default', def.audioUrl)
    }
    return this.ctx
  }

  /** Pre-decodes already-fetched voice bytes into WebAudio buffers with an LRU cap for short-term memory efficiency. */
  async primeVoiceFromBytes(charId: string, bytes: ArrayBuffer): Promise<void> {
    if (this.voiceBuffers.has(charId)) return
    const ctx = this.ctx
    if (!ctx) {
      if (this.pendingVoiceBytes.size < 40) {
        this.pendingVoiceBytes.set(charId, bytes.slice(0))
      }
      return
    }
    try {
      const decoded = await ctx.decodeAudioData(bytes.slice(0))
      if (this.voiceBuffers.size >= 48) {
        const oldest = this.voiceBuffers.keys().next().value
        if (oldest) this.voiceBuffers.delete(oldest)
      }
      this.voiceBuffers.set(charId, decoded)
    } catch {
      // Fall back cleanly to on-demand HTMLAudio/decode when ctx unlocks
    }
  }

  private async loadVoiceBuffer(charId: string, url: string): Promise<AudioBuffer | null> {
    const cached = this.voiceBuffers.get(charId)
    if (cached) return cached
    const inflight = this.voiceFetches.get(charId)
    if (inflight) return inflight

    const task = (async () => {
      try {
        const ctx = this.unlock()
        if (!ctx) return null
        const res = await fetch(url)
        if (!res.ok) return null
        const raw = await res.arrayBuffer()
        const decoded = await ctx.decodeAudioData(raw)
        this.voiceBuffers.set(charId, decoded)
        return decoded
      } catch {
        return null
      } finally {
        this.voiceFetches.delete(charId)
      }
    })()

    this.voiceFetches.set(charId, task)
    return task
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.8)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      ch[i] = Math.random() * 2 - 1
    }
    return buf
  }

  private shouldThrottle(key: string, minGapMs: number): boolean {
    const now = performance.now()
    const prev = this.lastKindPlayedAt.get(key) ?? 0
    if (now - prev < minGapMs) return true
    this.lastKindPlayedAt.set(key, now)
    return false
  }

  private stopActiveVoice(): void {
    if (this.activeVoiceSrc) {
      try {
        this.activeVoiceSrc.stop()
      } catch {
        // Ignore already-stopped source
      }
      this.activeVoiceSrc.disconnect()
      this.activeVoiceSrc = null
    }
    if (this.activeVoiceAudio) {
      try {
        this.activeVoiceAudio.pause()
        this.activeVoiceAudio.currentTime = 0
      } catch {
        // Ignore HTMLAudio cleanup errors
      }
      this.activeVoiceAudio = null
    }
    this.stopActiveSkillVoice()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // Ignore speech API errors
      }
    }
  }

  private duckBgm(ms: number): void {
    this.bgmDuckUntil = performance.now() + ms
    this.updateGainTargets()
    if (this.bgmDuckTimerId !== null) {
      window.clearTimeout(this.bgmDuckTimerId)
    }
    this.bgmDuckTimerId = window.setTimeout(() => {
      this.bgmDuckTimerId = null
      if (performance.now() >= this.bgmDuckUntil - 30) {
        this.updateGainTargets()
      }
    }, ms + 20)
  }

  private stopActiveSkillVoice(): void {
    if (this.activeSkillVoiceSrc) {
      try {
        this.activeSkillVoiceSrc.stop()
      } catch {
        // Ignore already-stopped source
      }
      this.activeSkillVoiceSrc.disconnect()
      this.activeSkillVoiceSrc = null
    }
    if (this.activeSkillVoiceAudio) {
      try {
        this.activeSkillVoiceAudio.pause()
        this.activeSkillVoiceAudio.currentTime = 0
      } catch {
        // Ignore HTMLAudio cleanup errors
      }
      this.activeSkillVoiceAudio = null
    }
  }

  /** Plays each hero's signature skill-name voice callout immediately when casting a skill. */
  speakSkillCallout(charId: string, slotOrTag: number | string, fallbackLabel?: string): void {
    if (this.muted || !charId) return
    const key = `${charId}_${slotOrTag}`
    if (this.shouldThrottle(`skill_vo:${key}`, 420)) return

    const clip = SKILL_VOICE_MAP[key]
    const ctx = this.unlock()
    this.stopActiveSkillVoice()
    this.duckBgm(1100)

    if (!clip) {
      if (fallbackLabel) {
        const base = CHARACTER_VOICES[charId] ?? CHARACTER_VOICES.default
        this.speakBrowserFallback(base, fallbackLabel)
      }
      return
    }

    const bufKey = `skill:${key}`
    if (ctx && this.voiceGain) {
      void this.loadVoiceBuffer(bufKey, clip.url).then((buffer) => {
        if (this.muted) return
        if (buffer && this.ctx && this.voiceGain) {
          if (this.ctx.state === 'suspended') {
            void this.ctx.resume().catch(() => undefined)
          }
          this.stopActiveSkillVoice()
          const src = this.ctx.createBufferSource()
          src.buffer = buffer
          src.playbackRate.value = clip.playbackRate
          src.connect(this.voiceGain)
          src.onended = () => {
            if (this.activeSkillVoiceSrc === src) {
              this.activeSkillVoiceSrc = null
            }
            src.disconnect()
          }
          this.activeSkillVoiceSrc = src
          src.start(0)
          return
        }
        if (typeof Audio !== 'undefined') {
          try {
            const audio = new Audio(clip.url)
            audio.volume = 0.9
            audio.playbackRate = clip.playbackRate
            this.activeSkillVoiceAudio = audio
            void audio.play().catch(() => undefined)
          } catch {
            // Ignore audio fallback failure
          }
        }
      })
    }
  }

  /** Plays a signature hero chime + authentic Thai voice line when selecting a character. */
  speakCharacterQuote(charId: string, customQuote?: string): void {
    if (this.muted) return
    const ctx = this.unlock()
    this.stopActiveVoice()
    const seq = ++this.voicePlaySeq

    this.playSelectSignature(charId)
    this.duckBgm(2600)

    const profile = CHARACTER_VOICES[charId] ?? CHARACTER_VOICES.default
    const text = customQuote || profile.quote

    if (ctx && this.voiceGain) {
      void this.loadVoiceBuffer(charId, profile.audioUrl).then((buffer) => {
        if (seq !== this.voicePlaySeq || this.muted) return
        if (buffer && this.ctx && this.voiceGain) {
          this.playDecodedVoice(buffer, profile)
          return
        }
        this.playHtmlAudioOrSpeechFallback(profile, text, seq)
      })
      return
    }

    this.playHtmlAudioOrSpeechFallback(profile, text, seq)
  }

  private playDecodedVoice(buffer: AudioBuffer, profile: CharacterVoiceConfig): void {
    const ctx = this.ctx
    if (!ctx || !this.voiceGain || this.muted) return
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined)
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = profile.playbackRate

    let eq: BiquadFilterNode | null = null
    if (profile.filterType && profile.filterFreq) {
      eq = ctx.createBiquadFilter()
      eq.type = profile.filterType
      eq.frequency.value = profile.filterFreq
      eq.gain.value = profile.filterGainDb ?? 3
      src.connect(eq)
      eq.connect(this.voiceGain)
    } else {
      src.connect(this.voiceGain)
    }

    src.onended = () => {
      if (this.activeVoiceSrc === src) {
        this.activeVoiceSrc = null
      }
      src.disconnect()
      eq?.disconnect()
    }
    this.activeVoiceSrc = src
    src.start(0)
  }

  private playHtmlAudioOrSpeechFallback(
    profile: CharacterVoiceConfig,
    text: string,
    seq: number,
  ): void {
    if (typeof window === 'undefined' || seq !== this.voicePlaySeq || this.muted) return

    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(profile.audioUrl)
        audio.volume = 0.88
        audio.playbackRate = profile.playbackRate
        this.activeVoiceAudio = audio
        void audio.play().catch(() => {
          if (seq === this.voicePlaySeq && !this.muted) {
            this.speakBrowserFallback(profile, text)
          }
        })
        return
      } catch {
        // Fall through to speechSynthesis
      }
    }

    this.speakBrowserFallback(profile, text)
  }

  private speakBrowserFallback(profile: CharacterVoiceConfig, text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return
    try {
      window.speechSynthesis.cancel()
      const utt = new SpeechSynthesisUtterance(text)
      utt.lang = profile.lang
      utt.pitch = profile.pitch
      utt.rate = profile.rate
      utt.volume = 0.92
      const voices = window.speechSynthesis.getVoices()
      const langPrefix = profile.lang.slice(0, 2).toLowerCase()
      const preferredVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix))
      if (preferredVoice) {
        utt.voice = preferredVoice
      }
      window.speechSynthesis.speak(utt)
    } catch {
      // Speech synthesis may be unavailable on headless platforms
    }
  }

  /** Starts atmospheric MOBA BGM (or high-octane Gothic Electro-Rock anthem in Iconic Gojo vs Sukuna mode). */
  startBattleBgm(mode?: string): void {
    const nextVariant: 'arena' | 'iconic' = mode === 'iconic' ? 'iconic' : 'arena'
    const ctx = this.unlock()
    if (this.bgmPlaying && this.bgmVariant === nextVariant) {
      this.updateGainTargets()
      return
    }
    this.bgmVariant = nextVariant
    this.bgmPlaying = true
    this.bgmStep = 0
    this.bgmNextNoteTime = ctx ? ctx.currentTime + 0.08 : 0
    if (this.bgmLowpass) {
      this.bgmLowpass.frequency.value = nextVariant === 'iconic' ? 5200 : 1050
    }
    this.updateGainTargets()

    if (typeof window !== 'undefined' && this.bgmTimerId === null) {
      this.bgmTimerId = window.setInterval(() => {
        this.tickBattleBgm()
      }, 90)
    }
  }

  /** Stops the arena background music smoothly when returning to the lobby. */
  stopBattleBgm(): void {
    this.bgmPlaying = false
    if (this.bgmTimerId !== null) {
      window.clearInterval(this.bgmTimerId)
      this.bgmTimerId = null
    }
    this.updateGainTargets()
  }

  private tickBattleBgm(): void {
    if (!this.bgmPlaying) return
    const ctx = this.ctx
    if (!ctx || !this.bgmLowpass || ctx.state !== 'running') return
    if (this.muted || this.bgmMuted) {
      this.bgmNextNoteTime = ctx.currentTime + 0.08
      return
    }

    if (this.bgmNextNoteTime < ctx.currentTime - 0.5) {
      this.bgmNextNoteTime = ctx.currentTime + 0.05
    }

    const lookAheadUntil = ctx.currentTime + 0.35
    let steps = 0
    if (this.bgmVariant === 'iconic') {
      while (this.bgmNextNoteTime < lookAheadUntil && steps < 6) {
        this.scheduleIconicStep(this.bgmStep, this.bgmNextNoteTime)
        this.bgmNextNoteTime += ICONIC_BGM_STEP_SEC
        this.bgmStep = (this.bgmStep + 1) % 64
        steps++
      }
      return
    }
    while (this.bgmNextNoteTime < lookAheadUntil && steps < 4) {
      this.scheduleBgmStep(this.bgmStep, this.bgmNextNoteTime)
      this.bgmNextNoteTime += ARENA_BGM_STEP_SEC
      this.bgmStep = (this.bgmStep + 1) % 32
      steps++
    }
  }

  private scheduleIconicStep(step: number, when: number): void {
    const barIdx = Math.floor(step / 16)
    const s = step % 16
    const bar = ICONIC_BGM_BARS[barIdx]
    if (!bar) return

    // 1. 4-on-the-floor pounding dark electro kick
    if (s % 4 === 0) {
      this.scheduleBgmPulse(when, 0.42)
    }

    // 2. Crisp industrial snare/clap on beats 2 & 4
    if ((s === 4 || s === 12) && this.noiseBuffer && this.ctx && this.bgmLowpass) {
      const src = this.ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      const bp = this.ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(1650, when)
      bp.Q.value = 1.1
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, when)
      g.gain.linearRampToValueAtTime(0.24, when + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14)
      src.connect(bp)
      bp.connect(g)
      g.connect(this.bgmLowpass)
      src.onended = () => {
        src.disconnect()
        bp.disconnect()
        g.disconnect()
      }
      src.start(when)
      src.stop(when + 0.16)
      this.scheduleBgmVoice(185, 'triangle', when, 0.09, 0.22, 0.004)
    }

    // 3. Sharp driving offbeat electro hats
    if (s % 2 === 1 && this.noiseBuffer && this.ctx && this.bgmLowpass) {
      const src = this.ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      const hp = this.ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.setValueAtTime(6200, when)
      const g = this.ctx.createGain()
      const accent = s % 4 === 2 ? 0.11 : 0.075
      g.gain.setValueAtTime(0.0001, when)
      g.gain.linearRampToValueAtTime(accent, when + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
      src.connect(hp)
      hp.connect(g)
      g.connect(this.bgmLowpass)
      src.onended = () => {
        src.disconnect()
        hp.disconnect()
        g.disconnect()
      }
      src.start(when)
      src.stop(when + 0.065)
    }

    // 4. Driving gritty octave electro-bass pump on every 8th note
    if (s % 2 === 0) {
      const bassNote = s % 4 === 0 ? bar.bass : bar.bass * 2
      this.scheduleBgmVoice(bassNote, 'sawtooth', when, 0.19, 0.23, 0.006)
    }

    // 5. Dramatic Gothic Organ/Choir stabs at downbeat & syncopation
    if (s === 0 || s === 6 || s === 10) {
      const dur = s === 0 ? 0.65 : 0.36
      for (const ch of bar.chord) {
        this.scheduleBgmVoice(ch, 'sawtooth', when, dur, 0.075, 0.018)
      }
    }

    // 6. Stinging dark-pop detuned supersaw chorus melody lead
    const leadHz = bar.lead[s]
    if (leadHz > 0) {
      this.scheduleBgmVoice(leadHz, 'sawtooth', when, 0.21, 0.12, 0.01)
      this.scheduleBgmVoice(leadHz * 1.006, 'square', when, 0.21, 0.055, 0.01)
    }
  }

  private scheduleBgmStep(step: number, when: number): void {
    const barIdx = Math.floor(step / 8)
    const barStep = step % 8
    const bar = ARENA_BGM_BARS[barIdx]
    if (!bar) return

    // 1. Warm lush synth pad chord at start of every bar
    if (barStep === 0) {
      const chordDur = ARENA_BGM_STEP_SEC * 8 - 0.08
      for (const freq of bar.padHz) {
        this.scheduleBgmVoice(freq, 'sine', when, chordDur, 0.14, 0.42)
      }
      this.scheduleBgmVoice(bar.bassHz * 0.5, 'sine', when, chordDur * 0.9, 0.16, 0.25)
    }

    // 2. Gentle cinematic pulse & warm bass pluck on beats 1 and 3
    if (barStep === 0 || barStep === 4) {
      this.scheduleBgmVoice(bar.bassHz, 'triangle', when, 0.48, 0.2, 0.02)
      this.scheduleBgmPulse(when, 0.22)
    }

    // 3. Delicate melodic celesta-like arpeggio with breathing space
    if (barStep === 0 || barStep === 2 || barStep === 3 || barStep === 5 || barStep === 6) {
      const note = bar.arpHz[barStep]
      if (note) {
        this.scheduleBgmVoice(note, 'triangle', when, 0.42, 0.15, 0.015)
      }
    }

    // 4. Ultra-subtle brushed air shaker on off-beats
    if (barStep % 2 === 1 && this.noiseBuffer && this.ctx && this.bgmLowpass) {
      const src = this.ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(2800, when)
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, when)
      g.gain.linearRampToValueAtTime(0.045, when + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.045)
      src.connect(filter)
      filter.connect(g)
      g.connect(this.bgmLowpass)
      src.onended = () => {
        src.disconnect()
        filter.disconnect()
        g.disconnect()
      }
      src.start(when)
      src.stop(when + 0.06)
    }
  }

  private scheduleBgmVoice(
    freq: number,
    type: OscillatorType,
    when: number,
    durSec: number,
    peakGain: number,
    attackSec: number,
  ): void {
    const ctx = this.ctx
    if (!ctx || !this.bgmLowpass) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, when)

    g.gain.setValueAtTime(0.0001, when)
    g.gain.linearRampToValueAtTime(peakGain, when + Math.min(attackSec, durSec * 0.45))
    g.gain.exponentialRampToValueAtTime(0.0001, when + durSec)

    osc.connect(g)
    g.connect(this.bgmLowpass)
    osc.onended = () => {
      osc.disconnect()
      g.disconnect()
    }
    osc.start(when)
    osc.stop(when + durSec + 0.03)
  }

  private scheduleBgmPulse(when: number, peakGain: number): void {
    const ctx = this.ctx
    if (!ctx || !this.bgmLowpass) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(98, when)
    osc.frequency.exponentialRampToValueAtTime(44, when + 0.16)

    g.gain.setValueAtTime(0.0001, when)
    g.gain.linearRampToValueAtTime(peakGain, when + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18)

    osc.connect(g)
    g.connect(this.bgmLowpass)
    osc.onended = () => {
      osc.disconnect()
      g.disconnect()
    }
    osc.start(when)
    osc.stop(when + 0.2)
  }

  private playSelectSignature(charId: string): void {
    switch (charId) {
      case 'pa':
        this.playTone(880, 1320, 0.22, 'triangle', 0.24)
        this.playTone(1320, 1760, 0.28, 'sine', 0.18, 0.06)
        break
      case 'boy':
        this.playTone(220, 660, 0.24, 'sawtooth', 0.14)
        this.playTone(523, 784, 0.2, 'triangle', 0.2, 0.08)
        break
      case 'ole':
        this.playTone(310, 210, 0.35, 'sine', 0.22)
        this.playTone(620, 465, 0.28, 'triangle', 0.12, 0.04)
        break
      case 'thanwa':
        this.playNoise(0.14, 2400, 'highpass', 0.2)
        this.playTone(1480, 920, 0.18, 'triangle', 0.2)
        break
      case 'ajarn_au':
        this.playNoise(0.12, 3200, 'bandpass', 0.22)
        this.playTone(980, 1960, 0.15, 'sawtooth', 0.14)
        break
      case 'ajarn_boy':
        this.playTone(130, 68, 0.38, 'sawtooth', 0.22)
        this.playTone(195, 92, 0.32, 'triangle', 0.18, 0.04)
        break
      case 'kaem':
        this.playTone(392, 784, 0.22, 'sine', 0.22)
        this.playTone(1046, 1568, 0.26, 'triangle', 0.16, 0.05)
        break
      case 'frame':
        this.playTone(110, 58, 0.34, 'sawtooth', 0.22)
        this.playTone(660, 990, 0.18, 'triangle', 0.18, 0.05)
        break
      case 'luangphi_sorn':
        this.playTone(76, 32, 0.45, 'sawtooth', 0.28)
        this.playNoise(0.28, 820, 'lowpass', 0.24)
        break
      case 'sia_mon':
        this.playTone(520, 1280, 0.26, 'sine', 0.24)
        this.playTone(260, 140, 0.34, 'triangle', 0.2, 0.04)
        break
      case 'ko':
        this.playNoise(0.14, 3400, 'highpass', 0.22)
        this.playTone(1180, 2240, 0.16, 'triangle', 0.22)
        this.playTone(1760, 920, 0.22, 'sine', 0.18, 0.05)
        break
      case 'noone':
        this.playTone(110, 48, 0.36, 'sawtooth', 0.26)
        this.playTone(580, 1160, 0.2, 'sine', 0.2, 0.05)
        break
      default:
        this.playTone(520, 780, 0.14, 'sine', 0.18)
        this.playTone(780, 1040, 0.16, 'sine', 0.14, 0.06)
        break
    }
  }

  /** Plays distinct procedural Web Audio sound effects matching every hero skill & attack. */
  playEffectSound(kind: string): void {
    if (this.muted || this.shouldThrottle(kind, 55)) return

    switch (kind) {
      case 'atk_default_pulse':
        this.playTone(680, 320, 0.12, 'triangle', 0.22)
        break
      case 'atk_gilga_sword':
      case 'gate_sword':
        this.playTone(1360, 2100, 0.1, 'triangle', 0.2)
        this.playNoise(0.08, 2800, 'highpass', 0.16)
        break
      case 'atk_gilga_flash':
        this.playTone(980, 1520, 0.15, 'sine', 0.2)
        break
      case 'enkidu_chain':
      case 'enkidu_tether':
        this.playTone(740, 420, 0.18, 'square', 0.15)
        this.playNoise(0.16, 1900, 'bandpass', 0.24)
        break
      case 'enuma_elish':
        this.playTone(110, 260, 0.52, 'sawtooth', 0.3)
        this.playTone(62, 48, 0.56, 'sine', 0.34)
        this.playNoise(0.48, 1200, 'bandpass', 0.26)
        break
      case 'atk_goku_fist':
        this.playTone(170, 52, 0.16, 'sine', 0.34)
        this.playNoise(0.11, 900, 'bandpass', 0.24)
        break
      case 'ki_blast':
        this.playTone(780, 260, 0.15, 'sawtooth', 0.18)
        break
      case 'instant_transmission':
        this.playTone(2200, 620, 0.09, 'sine', 0.26)
        this.playTone(180, 60, 0.18, 'triangle', 0.25, 0.05)
        break
      case 'kamehameha':
        this.playTone(145, 340, 0.58, 'sawtooth', 0.28)
        this.playTone(440, 290, 0.52, 'triangle', 0.24)
        this.playNoise(0.55, 1600, 'bandpass', 0.3)
        break
      case 'atk_itachi_kunai':
      case 'crow_shuriken':
        this.playNoise(0.13, 3000, 'highpass', 0.2)
        this.playTone(1120, 740, 0.12, 'triangle', 0.18)
        break
      case 'tsukuyomi':
        this.playTone(260, 195, 0.52, 'sine', 0.3)
        this.playTone(520, 385, 0.48, 'triangle', 0.18, 0.04)
        break
      case 'amaterasu':
        this.playNoise(0.45, 750, 'bandpass', 0.3)
        this.playTone(140, 82, 0.42, 'sawtooth', 0.2)
        break
      case 'atk_zoro_sweep':
        this.playNoise(0.15, 2900, 'highpass', 0.24)
        this.playTone(1820, 920, 0.14, 'triangle', 0.2)
        break
      case 'pound_ho':
        this.playNoise(0.24, 2400, 'bandpass', 0.28)
        this.playTone(1520, 640, 0.22, 'triangle', 0.24)
        this.playTone(960, 1440, 0.14, 'sine', 0.14, 0.04)
        break
      case 'shishi_sonson':
        this.playNoise(0.22, 3200, 'highpass', 0.32)
        this.playTone(2640, 1320, 0.19, 'sine', 0.26)
        this.playTone(240, 72, 0.22, 'triangle', 0.28, 0.04)
        break
      case 'sanzen_sekai_windup':
        this.playNoise(0.26, 2200, 'bandpass', 0.22)
        this.playTone(320, 880, 0.26, 'triangle', 0.18)
        break
      case 'sanzen_sekai':
        this.playNoise(0.45, 2500, 'highpass', 0.34)
        this.playTone(145, 42, 0.42, 'sine', 0.38)
        this.playTone(1320, 660, 0.22, 'triangle', 0.24)
        this.playTone(1760, 880, 0.22, 'sine', 0.2, 0.045)
        this.playTone(2240, 1120, 0.24, 'sine', 0.18, 0.09)
        break
      case 'atk_zenitsu_slash':
        this.playNoise(0.12, 3300, 'highpass', 0.24)
        this.playTone(1680, 860, 0.13, 'triangle', 0.22)
        break
      case 'zenitsu_hekireki':
        this.playNoise(0.24, 3400, 'highpass', 0.34)
        this.playTone(2800, 1120, 0.16, 'sine', 0.28)
        this.playTone(190, 48, 0.28, 'sine', 0.34, 0.03)
        break
      case 'zenitsu_rokuren':
        this.playNoise(0.28, 3000, 'bandpass', 0.32)
        this.playTone(1320, 2120, 0.14, 'sawtooth', 0.18)
        this.playTone(220, 56, 0.28, 'sine', 0.32, 0.05)
        break
      case 'zenitsu_honoo_windup':
        this.playNoise(0.14, 2600, 'bandpass', 0.22)
        this.playTone(440, 1220, 0.14, 'triangle', 0.2)
        break
      case 'zenitsu_murad_slash':
        this.playNoise(0.11, 3600, 'highpass', 0.28)
        this.playTone(2180, 960, 0.12, 'triangle', 0.26)
        this.playTone(320, 92, 0.1, 'sine', 0.22)
        break
      case 'zenitsu_honoo_no_kami':
        this.playNoise(0.32, 2800, 'highpass', 0.34)
        this.playTone(160, 46, 0.34, 'sine', 0.36)
        this.playTone(1560, 720, 0.2, 'sawtooth', 0.22)
        break
      case 'atk_thanos_gauntlet':
        this.playTone(185, 68, 0.14, 'sawtooth', 0.24)
        this.playNoise(0.08, 1200, 'lowpass', 0.18)
        break
      case 'thanos_power_blast':
        this.playTone(140, 38, 0.38, 'sawtooth', 0.36)
        this.playNoise(0.3, 620, 'lowpass', 0.34)
        break
      case 'thanos_space_warp':
      case 'thanos_space_vortex':
        this.playTone(260, 780, 0.26, 'sine', 0.24)
        this.playTone(520, 140, 0.3, 'triangle', 0.2, 0.04)
        break
      case 'thanos_reality_shard':
      case 'thanos_reality_rift':
        this.playNoise(0.16, 2600, 'bandpass', 0.24)
        this.playTone(880, 320, 0.18, 'sawtooth', 0.2)
        break
      case 'thanos_time_mandala':
        this.playTone(528, 1056, 0.28, 'sine', 0.24)
        this.playTone(1056, 792, 0.34, 'triangle', 0.18, 0.06)
        break
      case 'thanos_mind_beam':
        this.playTone(440, 1320, 0.28, 'sawtooth', 0.26)
        this.playTone(880, 1760, 0.24, 'sine', 0.22, 0.03)
        break
      case 'thanos_infinity_snap':
      case 'infinity_snap':
        this.playNoise(0.12, 4200, 'highpass', 0.38)
        this.playTone(120, 28, 0.65, 'sawtooth', 0.4)
        this.playTone(880, 220, 0.45, 'sine', 0.28, 0.04)
        break
      case 'atk_killua_spark':
      case 'godspeed_aura':
        this.playNoise(0.14, 3400, 'bandpass', 0.26)
        this.playTone(1400, 680, 0.12, 'sawtooth', 0.16)
        break
      case 'killua_leap_arc':
        this.playTone(320, 920, 0.16, 'sine', 0.22)
        this.playNoise(0.15, 2200, 'bandpass', 0.2)
        break
      case 'thunder_slam_burst':
      case 'narukami_strike':
        this.playNoise(kind === 'narukami_strike' ? 0.42 : 0.26, 2600, 'bandpass', 0.36)
        this.playTone(kind === 'narukami_strike' ? 160 : 195, 42, 0.32, 'sine', 0.36)
        this.playTone(1850, 420, 0.18, 'sawtooth', 0.16)
        break
      case 'atk_sukuna_cleave':
      case 'dismantle':
        this.playNoise(0.12, 3200, 'highpass', 0.3)
        this.playTone(460, 140, 0.14, 'sawtooth', 0.22)
        break
      case 'fuga_arrow':
        this.playNoise(0.22, 1800, 'bandpass', 0.26)
        this.playTone(540, 980, 0.18, 'triangle', 0.22)
        break
      case 'fuga_explosion':
        this.playTone(125, 36, 0.46, 'sine', 0.4)
        this.playNoise(0.45, 520, 'lowpass', 0.38)
        break
      case 'malevolent_shrine':
        this.playTone(185, 78, 0.55, 'sawtooth', 0.28)
        this.playNoise(0.32, 2900, 'highpass', 0.24, 0.08)
        break
      case 'atk_rimuru_water':
        this.playNoise(0.11, 2400, 'bandpass', 0.18)
        this.playTone(1120, 620, 0.1, 'sine', 0.2)
        break
      case 'black_lightning':
        this.playTone(180, 520, 0.16, 'sawtooth', 0.14)
        break
      case 'black_lightning_strike':
        this.playTone(120, 42, 0.24, 'sawtooth', 0.28)
        this.playNoise(0.28, 1900, 'highpass', 0.3)
        this.playTone(1950, 740, 0.18, 'triangle', 0.18, 0.02)
        break
      case 'black_flame_wave':
        this.playNoise(0.24, 1300, 'bandpass', 0.24)
        this.playTone(620, 210, 0.22, 'sawtooth', 0.18)
        break
      case 'beelzebuth_windup':
        this.playTone(145, 72, 0.34, 'sine', 0.26)
        this.playTone(880, 1320, 0.22, 'triangle', 0.14, 0.04)
        break
      case 'beelzebuth':
        this.playTone(95, 32, 0.56, 'sawtooth', 0.36)
        this.playNoise(0.48, 480, 'lowpass', 0.34)
        break
      case 'atk_aiouan_paw':
        this.playNoise(0.09, 2600, 'highpass', 0.2)
        this.playTone(320, 140, 0.11, 'triangle', 0.22)
        break
      case 'aiouan_lock_beam':
        this.playTone(880, 1480, 0.14, 'sine', 0.2)
        this.playTone(1480, 1760, 0.1, 'triangle', 0.16, 0.05)
        break
      case 'aiouan_pounce':
        this.playTone(440, 210, 0.18, 'sawtooth', 0.2)
        this.playNoise(0.14, 1500, 'bandpass', 0.2)
        break
      case 'aiouan_pounce_seal':
        this.playTone(135, 48, 0.24, 'sine', 0.32)
        this.playTone(720, 1080, 0.14, 'triangle', 0.14)
        break
      case 'aiouan_ora_rush':
      case 'ora_meow_barrage':
        this.playTone(180, 95, 0.12, 'sawtooth', 0.22)
        this.playTone(210, 105, 0.12, 'sawtooth', 0.22, 0.09)
        this.playTone(240, 115, 0.12, 'sawtooth', 0.22, 0.18)
        this.playNoise(0.26, 1700, 'bandpass', 0.22)
        break
      case 'aiouan_timestop_windup':
        this.playTone(420, 48, 0.36, 'sawtooth', 0.34)
        this.playTone(840, 96, 0.32, 'sine', 0.22, 0.02)
        break
      case 'aiouan_timestop':
      case 'aiouan_timestop_burst':
        this.playTone(110, 34, 0.55, 'sawtooth', 0.36)
        this.playTone(1760, 880, 0.14, 'triangle', 0.18, 0.04)
        this.playNoise(0.35, 620, 'lowpass', 0.3)
        break
      case 'enkidu_field':
        this.playTone(620, 260, 0.32, 'triangle', 0.22)
        this.playNoise(0.2, 2200, 'bandpass', 0.18)
        break
      case 'gilga_sword_rain':
      case 'gilga_sky_sword':
        this.playTone(1450, 720, 0.14, 'triangle', 0.18)
        this.playNoise(0.14, 2900, 'highpass', 0.2, 0.02)
        break
      case 'goku_dragon_rush':
        this.playTone(240, 740, 0.24, 'sawtooth', 0.26)
        this.playNoise(0.22, 1600, 'bandpass', 0.26)
        break
      case 'killua_solo_ring':
      case 'killua_solo_flash':
        this.playNoise(0.22, 3200, 'highpass', 0.26)
        this.playTone(1180, 520, 0.2, 'sawtooth', 0.2)
        break
      case 'narukami_radial_beam':
      case 'narukami_bolt':
        this.playNoise(0.18, 3600, 'highpass', 0.24)
        this.playTone(1420, 620, 0.16, 'triangle', 0.2)
        break
      case 'godspeed_collide':
        this.playNoise(0.24, 3400, 'highpass', 0.3)
        this.playTone(960, 310, 0.18, 'square', 0.22)
        break
      case 'dash_afterimage':
        this.playNoise(0.15, 1600, 'bandpass', 0.24)
        this.playTone(420, 860, 0.12, 'sine', 0.16)
        break
      case 'atk_sorn_jab':
      case 'atk_gojo_punch':
        this.playTone(260, 88, 0.12, 'triangle', 0.24)
        this.playNoise(0.08, 1800, 'bandpass', 0.18)
        break
      case 'saitama_serious_punch':
      case 'saitama_crater':
        this.playTone(92, 24, 0.72, 'sawtooth', 0.42)
        this.playTone(420, 48, 0.48, 'sine', 0.34, 0.02)
        this.playNoise(0.58, 520, 'lowpass', 0.44)
        break
      case 'saitama_dodge':
        this.playTone(980, 1820, 0.24, 'triangle', 0.24)
        this.playNoise(0.16, 3200, 'highpass', 0.2)
        break
      case 'gojo_red':
      case 'gojo_cast_red':
        this.playTone(340, 160, 0.28, 'sine', 0.24)
        this.playTone(720, 480, 0.2, 'triangle', 0.18)
        break
      case 'gojo_blue':
      case 'gojo_cast_blue':
        this.playTone(620, 1520, 0.18, 'sine', 0.24)
        this.playNoise(0.14, 2900, 'highpass', 0.2)
        break
      case 'hollow_purple':
      case 'hollow_purple_blast':
        this.playTone(140, 42, 0.64, 'sawtooth', 0.36)
        this.playTone(1120, 320, 0.42, 'sine', 0.26, 0.03)
        this.playNoise(0.52, 920, 'bandpass', 0.38)
        break
      case 'infinite_void':
      case 'infinite_void_open':
        this.playTone(220, 660, 0.55, 'sine', 0.28)
        this.playTone(880, 220, 0.62, 'triangle', 0.22, 0.08)
        this.playNoise(0.45, 2200, 'bandpass', 0.22)
        break
      case 'iconic_rct':
      case 'rct_heal':
        this.playTone(523.25, 1046.5, 0.34, 'sine', 0.28)
        this.playTone(659.25, 1318.5, 0.38, 'triangle', 0.2, 0.04)
        this.playTone(783.99, 1567.98, 0.42, 'sine', 0.18, 0.08)
        break
      case 'domain_clash':
      case 'domain_clash_shock':
        this.playTone(76, 26, 0.85, 'sawtooth', 0.44)
        this.playTone(920, 180, 0.65, 'sawtooth', 0.3, 0.02)
        this.playNoise(0.7, 1450, 'bandpass', 0.42)
        break
      case 'ko':
        this.playTone(190, 52, 0.38, 'triangle', 0.32)
        this.playTone(540, 270, 0.24, 'sine', 0.22, 0.06)
        break
      case 'atk_simo_rifle':
      case 'simo_snipe_off':
        this.playNoise(0.14, 2400, 'bandpass', 0.28)
        this.playTone(420, 95, 0.16, 'sawtooth', 0.24)
        break
      case 'simo_snipe_max':
      case 'simo_backflip_shot':
        this.playNoise(0.28, 1950, 'bandpass', 0.42)
        this.playTone(880, 62, 0.36, 'sawtooth', 0.38)
        this.playTone(1640, 220, 0.22, 'triangle', 0.24, 0.02)
        break
      case 'simo_sentinel':
      case 'simo_blizzard_burst':
        this.playTone(620, 1240, 0.26, 'sine', 0.22)
        this.playNoise(0.22, 3200, 'highpass', 0.18)
        break
      case 'scp_medkit_heal':
      case 'aegis_core_burst':
        this.playTone(587.33, 880, 0.24, 'sine', 0.26)
        this.playTone(880, 1318.5, 0.28, 'triangle', 0.2, 0.06)
        break
      case 'kill_streak_fanfare':
        this.playTone(523.25, 783.99, 0.18, 'triangle', 0.28)
        this.playTone(659.25, 1046.5, 0.24, 'sine', 0.26, 0.07)
        this.playTone(783.99, 1318.5, 0.34, 'triangle', 0.24, 0.14)
        break
      case 'atk_jinwoo_dagger':
      case 'jinwoo_dagger_rush':
      case 'jinwoo_dagger_dash':
      case 'jinwoo_shadow_slash':
        this.playNoise(0.14, 3100, 'highpass', 0.24)
        this.playTone(1320, 560, 0.16, 'triangle', 0.22)
        break
      case 'jinwoo_rulers_hand':
      case 'jinwoo_arise':
        this.playTone(145, 52, 0.52, 'sawtooth', 0.34)
        this.playTone(420, 880, 0.36, 'sine', 0.22, 0.05)
        this.playNoise(0.38, 1200, 'bandpass', 0.26)
        break
      case 'atk_naruto_punch':
      case 'atk_naruto_rasen':
      case 'naruto_rasengan':
      case 'naruto_rasengan_burst':
        this.playNoise(0.24, 2100, 'bandpass', 0.28)
        this.playTone(320, 920, 0.22, 'sawtooth', 0.22)
        break
      case 'naruto_rasenshuriken':
      case 'naruto_rasen_blast':
      case 'naruto_shuriken_boom':
        this.playNoise(0.36, 2800, 'highpass', 0.34)
        this.playTone(980, 260, 0.34, 'sawtooth', 0.28)
        break
      case 'naruto_kurama_aura':
        this.playTone(120, 260, 0.45, 'sawtooth', 0.3)
        this.playTone(520, 1040, 0.32, 'triangle', 0.24, 0.06)
        break
      case 'atk_sanji_kick':
      case 'sanji_sky_kick':
      case 'sanji_skywalk':
      case 'sanji_diable_fire':
        this.playNoise(0.2, 1800, 'bandpass', 0.26)
        this.playTone(280, 110, 0.22, 'triangle', 0.28)
        break
      case 'sanji_ifrit_kick':
      case 'sanji_ifrit_rush':
      case 'sanji_ifrit_burst':
        this.playNoise(0.32, 3000, 'highpass', 0.34)
        this.playTone(1440, 320, 0.28, 'sawtooth', 0.28)
        this.playTone(165, 48, 0.34, 'sine', 0.34, 0.03)
        break
      case 'atk_luffy_punch':
      case 'luffy_pistol':
      case 'luffy_gatling':
      case 'luffy_gatling_fist':
        this.playTone(220, 68, 0.18, 'sine', 0.34)
        this.playNoise(0.14, 1100, 'bandpass', 0.26)
        break
      case 'luffy_bajrang_gun':
      case 'luffy_bajrang_smash':
        this.playTone(98, 28, 0.62, 'sawtooth', 0.4)
        this.playNoise(0.48, 560, 'lowpass', 0.38)
        break
      case 'atk_ben10_plasma':
      case 'atk_ben10_omni':
      case 'ben10_heatblast':
      case 'ben10_heat_boom':
      case 'ben10_heat_pool':
        this.playTone(760, 320, 0.18, 'sawtooth', 0.22)
        this.playNoise(0.18, 1400, 'bandpass', 0.24)
        break
      case 'ben10_xlr8_blitz':
        this.playTone(520, 1680, 0.16, 'sine', 0.26)
        this.playNoise(0.16, 2900, 'highpass', 0.22)
        break
      case 'ben10_cosmic_ray':
        this.playTone(220, 680, 0.52, 'sawtooth', 0.32)
        this.playTone(880, 1320, 0.42, 'sine', 0.24, 0.04)
        this.playNoise(0.45, 2200, 'bandpass', 0.28)
        break
      case 'atk_diablo_orb':
      case 'atk_diablo_claw':
      case 'diablo_despair_claw':
      case 'diablo_despair_wave':
        this.playNoise(0.14, 2800, 'highpass', 0.24)
        this.playTone(460, 180, 0.18, 'sawtooth', 0.24)
        break
      case 'diablo_temptation':
      case 'diablo_end_world':
      case 'diablo_eclipse_burst':
        this.playTone(130, 42, 0.58, 'sawtooth', 0.36)
        this.playTone(620, 210, 0.42, 'triangle', 0.24, 0.05)
        this.playNoise(0.42, 920, 'bandpass', 0.3)
        break
    }
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durSec: number,
    type: OscillatorType,
    vol: number,
    delaySec = 0,
  ): void {
    const ctx = this.unlock()
    if (!ctx || !this.masterGain || this.muted) return
    const now = ctx.currentTime + delaySec
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(20, freqStart), now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + durSec)

    g.gain.setValueAtTime(0.0001, now)
    g.gain.linearRampToValueAtTime(vol, now + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, now + durSec)

    osc.connect(g)
    g.connect(this.masterGain)
    osc.onended = () => {
      osc.disconnect()
      g.disconnect()
    }
    osc.start(now)
    osc.stop(now + durSec + 0.02)
  }

  private playNoise(
    durSec: number,
    filterHz: number,
    filterType: BiquadFilterType,
    vol: number,
    delaySec = 0,
  ): void {
    const ctx = this.unlock()
    if (!ctx || !this.masterGain || !this.noiseBuffer || this.muted) return
    const now = ctx.currentTime + delaySec
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer

    const filter = ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.setValueAtTime(filterHz, now)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.linearRampToValueAtTime(vol, now + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, now + durSec)

    src.connect(filter)
    filter.connect(g)
    g.connect(this.masterGain)
    src.onended = () => {
      src.disconnect()
      filter.disconnect()
      g.disconnect()
    }
    src.start(now)
    src.stop(now + durSec + 0.02)
  }
}

export const soundEngine = new SoundEngine()

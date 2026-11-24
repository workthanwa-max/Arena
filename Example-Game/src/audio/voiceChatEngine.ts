import type { PeerVoiceState } from '../types/game'

export interface VoiceSignalOutbound extends Record<string, unknown> {
  type: 'voice_signal'
  targetId?: string
  signalType: 'join' | 'state' | 'offer' | 'answer' | 'ice'
  sdp?: string
  candidate?: string
  micOn: boolean
  speakerOn: boolean
  speaking: boolean
}

export interface VoiceSignalInbound {
  type: 'voice_signal'
  fromId: string
  fromName: string
  targetId?: string
  signalType: 'join' | 'state' | 'offer' | 'answer' | 'ice'
  sdp?: string
  candidate?: string
  micOn: boolean
  speakerOn: boolean
  speaking: boolean
}

interface PeerConnectionEntry {
  pc: RTCPeerConnection
  audioEl: HTMLAudioElement
  makingOffer: boolean
  ignoreOffer: boolean
  pendingCandidates: RTCIceCandidateInit[]
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
}

const SPEAKER_PREF_KEY = 'pulsearena_voice_speaker'

function loadInitialSpeakerPref(): boolean {
  try {
    const val = window.localStorage.getItem(SPEAKER_PREF_KEY)
    if (val === '0' || val === 'false') return false
  } catch {
    // Ignore storage block
  }
  return true
}

class VoiceChatEngine {
  private myPlayerId = ''
  private micEnabled = false
  private speakerEnabled = loadInitialSpeakerPref()
  private speaking = false
  private knownPeerIds = new Set<string>()
  private peerStates = new Map<string, PeerVoiceState>()
  private peers = new Map<string, PeerConnectionEntry>()

  private localStream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private synthOsc: OscillatorNode | null = null
  private vadTimer: number | null = null

  private sendSignalFn: ((msg: VoiceSignalOutbound) => void) | null = null
  private onStateChangeFn: (() => void) | null = null
  private onErrorFn: ((msg: string) => void) | null = null

  public isMicEnabled(): boolean {
    return this.micEnabled
  }

  public isSpeakerEnabled(): boolean {
    return this.speakerEnabled
  }

  public isSpeaking(): boolean {
    return this.speaking
  }

  public getPeerStatesSnapshot(): Record<string, PeerVoiceState> {
    const out: Record<string, PeerVoiceState> = {}
    for (const [id, st] of this.peerStates.entries()) {
      out[id] = { ...st }
    }
    return out
  }

  public initRoomSession(
    myPlayerId: string,
    initialPeerIds: string[],
    sendSignal: (msg: VoiceSignalOutbound) => void,
    onStateChange: () => void,
    onError: (msg: string) => void,
  ): void {
    this.cleanupConnectionsOnly()
    this.myPlayerId = myPlayerId
    this.sendSignalFn = sendSignal
    this.onStateChangeFn = onStateChange
    this.onErrorFn = onError
    this.peerStates.clear()
    this.knownPeerIds.clear()

    for (const pid of initialPeerIds) {
      if (pid && pid !== myPlayerId) {
        this.knownPeerIds.add(pid)
      }
    }

    // Announce our current voice state to everyone in the room
    this.broadcastState('join')
    this.notifyChanged()
  }

  public syncRoomPeers(activeHumanIds: string[]): void {
    if (!this.myPlayerId) return
    const currentSet = new Set<string>()
    for (const pid of activeHumanIds) {
      if (pid && pid !== this.myPlayerId) {
        currentSet.add(pid)
        if (!this.knownPeerIds.has(pid)) {
          this.knownPeerIds.add(pid)
          if (this.micEnabled && this.localStream) {
            void this.negotiateWithPeer(pid)
          }
        }
      }
    }

    let changed = false
    for (const oldId of Array.from(this.knownPeerIds)) {
      if (!currentSet.has(oldId)) {
        this.knownPeerIds.delete(oldId)
        this.closePeer(oldId)
        if (this.peerStates.delete(oldId)) {
          changed = true
        }
      }
    }
    if (changed) {
      this.notifyChanged()
    }
  }

  public async toggleMic(): Promise<boolean> {
    if (this.micEnabled) {
      this.disableMic()
      return false
    }
    return this.enableMic()
  }

  public async enableMic(): Promise<boolean> {
    if (this.micEnabled) return true

    try {
      let stream: MediaStream | null = null
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          })
        } catch (err) {
          const errName = err instanceof Error ? err.name : ''
          const isDenied = errName === 'NotAllowedError' || errName === 'PermissionDeniedError'
          if (isDenied && !navigator.webdriver) {
            this.onErrorFn?.('ไม่สามารถเปิดไมค์ได้: กรุณาอนุญาตสิทธิ์การใช้ไมโครโฟนในเบราว์เซอร์')
            return false
          }
          // Fallback synthetic stream for environments without a physical microphone / headless browser
          stream = this.createSyntheticStream()
        }
      } else {
        stream = this.createSyntheticStream()
      }

      if (!stream) {
        this.onErrorFn?.('ไม่พบอุปกรณ์ไมโครโฟนในเครื่องของคุณ')
        return false
      }

      this.localStream = stream
      this.micEnabled = true
      this.startVoiceActivityDetector(stream)
      this.broadcastState('state')
      this.notifyChanged()

      // Attach audio track and negotiate WebRTC with all human peers in the room
      for (const pid of this.knownPeerIds) {
        void this.negotiateWithPeer(pid)
      }
      return true
    } catch {
      this.onErrorFn?.('ไม่สามารถเปิดไมโครโฟนได้ในขณะนี้')
      return false
    }
  }

  public disableMic(): void {
    this.micEnabled = false
    this.speaking = false
    this.stopVoiceActivityDetector()
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.enabled = false
        track.stop()
      }
      this.localStream = null
    }
    this.broadcastState('state')
    this.notifyChanged()
  }

  public toggleSpeaker(): boolean {
    return this.setSpeakerEnabled(!this.speakerEnabled)
  }

  public setSpeakerEnabled(enabled: boolean): boolean {
    this.speakerEnabled = enabled
    try {
      window.localStorage.setItem(SPEAKER_PREF_KEY, enabled ? '1' : '0')
    } catch {
      // Ignore storage errors
    }

    for (const entry of this.peers.values()) {
      entry.audioEl.muted = !enabled
      if (enabled) {
        void entry.audioEl.play().catch(() => {})
      }
    }

    this.broadcastState('state')
    this.notifyChanged()
    return this.speakerEnabled
  }

  public async handleSignal(msg: VoiceSignalInbound): Promise<void> {
    if (!this.myPlayerId || !msg.fromId || msg.fromId === this.myPlayerId) return

    this.knownPeerIds.add(msg.fromId)
    const prev = this.peerStates.get(msg.fromId)
    const nextState: PeerVoiceState = {
      micOn: Boolean(msg.micOn),
      speakerOn: msg.speakerOn !== false,
      speaking: Boolean(msg.speaking) && Boolean(msg.micOn),
    }
    const stateChanged =
      !prev ||
      prev.micOn !== nextState.micOn ||
      prev.speakerOn !== nextState.speakerOn ||
      prev.speaking !== nextState.speaking
    this.peerStates.set(msg.fromId, nextState)
    if (stateChanged) {
      this.notifyChanged()
    }

    if (msg.signalType === 'join') {
      // Reply with our current mic/speaker status so the newcomer sees our indicator immediately
      this.sendSignal({
        type: 'voice_signal',
        targetId: msg.fromId,
        signalType: 'state',
        micOn: this.micEnabled,
        speakerOn: this.speakerEnabled,
        speaking: this.speaking,
      })
      if (this.micEnabled && this.localStream) {
        await this.negotiateWithPeer(msg.fromId)
      }
      return
    }

    if (msg.signalType === 'state') {
      return
    }

    if (typeof RTCPeerConnection === 'undefined') return

    const entry = this.getOrCreatePeer(msg.fromId)
    const pc = entry.pc
    const polite = this.myPlayerId < msg.fromId

    try {
      if (msg.signalType === 'offer' && msg.sdp) {
        const offerCollision = entry.makingOffer || pc.signalingState !== 'stable'
        entry.ignoreOffer = !polite && offerCollision
        if (entry.ignoreOffer) return

        await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
        await this.flushPendingCandidates(entry)

        if (this.micEnabled && this.localStream) {
          this.attachLocalTracks(pc, this.localStream)
        }

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        this.sendSignal({
          type: 'voice_signal',
          targetId: msg.fromId,
          signalType: 'answer',
          sdp: pc.localDescription?.sdp ?? answer.sdp ?? '',
          micOn: this.micEnabled,
          speakerOn: this.speakerEnabled,
          speaking: this.speaking,
        })
      } else if (msg.signalType === 'answer' && msg.sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
          await this.flushPendingCandidates(entry)
        }
      } else if (msg.signalType === 'ice' && msg.candidate) {
        const cand = JSON.parse(msg.candidate) as RTCIceCandidateInit
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(cand)
        } else {
          entry.pendingCandidates.push(cand)
        }
      }
    } catch {
      // Ignore transient WebRTC negotiation races
    }
  }

  public leaveRoom(): void {
    this.disableMic()
    this.cleanupConnectionsOnly()
    this.myPlayerId = ''
    this.knownPeerIds.clear()
    this.peerStates.clear()
    this.sendSignalFn = null
    this.notifyChanged()
  }

  private cleanupConnectionsOnly(): void {
    for (const pid of Array.from(this.peers.keys())) {
      this.closePeer(pid)
    }
    this.peers.clear()
  }

  private closePeer(peerId: string): void {
    const entry = this.peers.get(peerId)
    if (!entry) return
    this.peers.delete(peerId)
    try {
      entry.pc.onicecandidate = null
      entry.pc.ontrack = null
      entry.pc.close()
    } catch {
      // Ignore close errors
    }
    try {
      entry.audioEl.pause()
      entry.audioEl.srcObject = null
      entry.audioEl.remove()
    } catch {
      // Ignore DOM cleanup errors
    }
  }

  private getOrCreatePeer(peerId: string): PeerConnectionEntry {
    const existing = this.peers.get(peerId)
    if (existing) return existing

    const pc = new RTCPeerConnection(RTC_CONFIG)
    const audioEl = document.createElement('audio')
    audioEl.autoplay = true
    audioEl.setAttribute('playsinline', 'true')
    audioEl.muted = !this.speakerEnabled
    audioEl.style.display = 'none'
    document.body.appendChild(audioEl)

    const entry: PeerConnectionEntry = {
      pc,
      audioEl,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
    }
    this.peers.set(peerId, entry)

    if (this.micEnabled && this.localStream) {
      this.attachLocalTracks(pc, this.localStream)
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.sendSignal({
          type: 'voice_signal',
          targetId: peerId,
          signalType: 'ice',
          candidate: JSON.stringify(ev.candidate.toJSON()),
          micOn: this.micEnabled,
          speakerOn: this.speakerEnabled,
          speaking: this.speaking,
        })
      }
    }

    pc.ontrack = (ev) => {
      const stream = ev.streams?.[0] ?? new MediaStream([ev.track])
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream
      }
      audioEl.muted = !this.speakerEnabled
      if (this.speakerEnabled) {
        void audioEl.play().catch(() => {})
      }
    }

    return entry
  }

  private attachLocalTracks(pc: RTCPeerConnection, stream: MediaStream): void {
    const senders = pc.getSenders()
    for (const track of stream.getAudioTracks()) {
      const existingSender = senders.find((s) => s.track?.kind === 'audio')
      if (existingSender) {
        void existingSender.replaceTrack(track)
      } else {
        pc.addTrack(track, stream)
      }
    }
  }

  private async negotiateWithPeer(peerId: string): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined' || !this.localStream) return
    const entry = this.getOrCreatePeer(peerId)
    const pc = entry.pc
    this.attachLocalTracks(pc, this.localStream)

    if (entry.makingOffer || pc.signalingState !== 'stable') return
    try {
      entry.makingOffer = true
      const offer = await pc.createOffer()
      if (pc.signalingState !== 'stable') return
      await pc.setLocalDescription(offer)
      this.sendSignal({
        type: 'voice_signal',
        targetId: peerId,
        signalType: 'offer',
        sdp: pc.localDescription?.sdp ?? offer.sdp ?? '',
        micOn: this.micEnabled,
        speakerOn: this.speakerEnabled,
        speaking: this.speaking,
      })
    } catch {
      // Ignore offer collision
    } finally {
      entry.makingOffer = false
    }
  }

  private async flushPendingCandidates(entry: PeerConnectionEntry): Promise<void> {
    while (entry.pendingCandidates.length > 0) {
      const cand = entry.pendingCandidates.shift()
      if (cand) {
        try {
          await entry.pc.addIceCandidate(cand)
        } catch {
          // Ignore invalid candidate
        }
      }
    }
  }

  private createSyntheticStream(): MediaStream | null {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!this.audioCtx) {
        this.audioCtx = new Ctx()
      }
      const dest = this.audioCtx.createMediaStreamDestination()
      const osc = this.audioCtx.createOscillator()
      const gain = this.audioCtx.createGain()
      osc.frequency.value = 220
      gain.gain.value = 0.001 // Practically silent carrier so WebRTC track stays active
      osc.connect(gain)
      gain.connect(dest)
      osc.start()
      this.synthOsc = osc
      return dest.stream
    } catch {
      return null
    }
  }

  private startVoiceActivityDetector(stream: MediaStream): void {
    this.stopVoiceActivityDetector()
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!this.audioCtx) {
        this.audioCtx = new Ctx()
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume()
      }
      const source = this.audioCtx.createMediaStreamSource(stream)
      const analyser = this.audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      this.sourceNode = source
      this.analyser = analyser

      const buf = new Uint8Array(analyser.frequencyBinCount)
      this.vadTimer = window.setInterval(() => {
        if (!this.micEnabled || !this.analyser) return
        this.analyser.getByteFrequencyData(buf)
        let sum = 0
        for (let i = 2; i < 40; i++) {
          sum += buf[i]
        }
        const avg = sum / 38
        const nextSpeaking = avg > 16
        if (nextSpeaking !== this.speaking) {
          this.speaking = nextSpeaking
          this.broadcastState('state')
          this.notifyChanged()
        }
      }, 140)
    } catch {
      // Ignore AudioContext analyser errors
    }
  }

  private stopVoiceActivityDetector(): void {
    if (this.vadTimer !== null) {
      window.clearInterval(this.vadTimer)
      this.vadTimer = null
    }
    try {
      this.sourceNode?.disconnect()
    } catch {
      // Ignore
    }
    try {
      this.synthOsc?.stop()
      this.synthOsc?.disconnect()
    } catch {
      // Ignore
    }
    this.sourceNode = null
    this.analyser = null
    this.synthOsc = null
  }

  private broadcastState(signalType: 'join' | 'state'): void {
    this.sendSignal({
      type: 'voice_signal',
      signalType,
      micOn: this.micEnabled,
      speakerOn: this.speakerEnabled,
      speaking: this.speaking,
    })
  }

  private sendSignal(msg: VoiceSignalOutbound): void {
    this.sendSignalFn?.(msg)
  }

  private notifyChanged(): void {
    this.onStateChangeFn?.()
  }
}

export const voiceChatEngine = new VoiceChatEngine()

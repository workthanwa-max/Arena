export type TransportKind = 'webtransport' | 'ws-binary' | 'ws-json'

interface TransportInfoResp {
  binaryWs: boolean
  webTransportUrl?: string
  certSha256?: string
}

export interface TransportHandlers {
  onOpen: (kind: TransportKind) => void
  onText: (jsonText: string) => void
  onBinary: (bytes: Uint8Array) => void
  onClose: () => void
  onError: (reason: string) => void
}

let cachedInfo: { fetchedAt: number; info: TransportInfoResp } | null = null
let inflightInfo: Promise<TransportInfoResp> | null = null

export async function prefetchTransportInfo(): Promise<TransportInfoResp> {
  if (cachedInfo && Date.now() - cachedInfo.fetchedAt < 60000) {
    return cachedInfo.info
  }
  if (inflightInfo) return inflightInfo
  inflightInfo = (async () => {
    try {
      const res = await fetch('/api/transport/info', { credentials: 'include' })
      if (res.ok) {
        const info = (await res.json()) as TransportInfoResp
        cachedInfo = { fetchedAt: Date.now(), info }
        return info
      }
      // Server 404 (e.g. older JSON-only backend behind CDN): safely fall back to JSON WS without forcing binary opcodes
      return { binaryWs: false }
    } catch {
      return { binaryWs: false }
    } finally {
      inflightInfo = null
    }
  })()
  return inflightInfo
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = window.atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

/**
 * Dual-Channel Real-Time Transport Adapter:
 *   1. Attempts HTTP/3 QUIC WebTransport (Unreliable Datagrams for 60Hz inputs & ticks + Reliable Control Stream)
 *      when supported by Browser & Backend endpoint.
 *   2. Automatically falls back in <1.2s to Compact Binary WebSocket (?proto=bin1) when behind HTTP/TCP or blocked UDP.
 */
export class RealtimeTransport {
  public kind: TransportKind = 'ws-binary'
  private closed = false
  private ws: WebSocket | null = null
  private wt: WebTransport | null = null
  private wtControlWriter: WritableStreamDefaultWriter<Uint8Array> | null = null
  private wtDgramWriter: WritableStreamDefaultWriter<Uint8Array> | null = null
  private handlers: TransportHandlers
  private textEnc = new TextEncoder()
  private textDec = new TextDecoder()

  constructor(handlers: TransportHandlers) {
    this.handlers = handlers
  }

  async connect(wsBaseUrlNoProto: string, wtQuerySuffix: string): Promise<void> {
    const info = await prefetchTransportInfo()
    if (this.closed) return

    if (!info.binaryWs) {
      this.connectWS(wsBaseUrlNoProto, 'ws-json')
      return
    }

    // Only attempt WebTransport when WebTransport API is present AND backend exposes a directly reachable UDP endpoint
    const wtAvailable = typeof window !== 'undefined' && typeof (window as unknown as { WebTransport?: typeof WebTransport }).WebTransport === 'function'
    if (wtAvailable && info.webTransportUrl) {
      let wtBase = info.webTransportUrl
      try {
        const u = new URL(wtBase)
        if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          u.hostname = window.location.hostname
          wtBase = u.toString()
        }
      } catch {
        // Ignore URL parsing errors
      }
      const wtOk = await this.tryConnectWebTransport(`${wtBase}?${wtQuerySuffix}`, info.certSha256)
      if (wtOk) {
        this.kind = 'webtransport'
        this.handlers.onOpen('webtransport')
        return
      }
      if (this.closed) return
    }

    // Automatic reliable fallback: Compact Binary WebSocket (?proto=bin1)
    this.connectWS(`${wsBaseUrlNoProto}&proto=bin1`, 'ws-binary')
  }

  supportsBinary(): boolean {
    return this.kind !== 'ws-json'
  }

  private async tryConnectWebTransport(url: string, certSha256?: string): Promise<boolean> {
    try {
      const opts: WebTransportOptions = {}
      if (certSha256) {
        opts.serverCertificateHashes = [{ algorithm: 'sha-256', value: base64ToArrayBuffer(certSha256) }]
      }
      const wt = new WebTransport(url, opts)
      const timeout = new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error('wt_timeout')), 550))
      await Promise.race([wt.ready, timeout])

      const bidi = await wt.createBidirectionalStream()
      if (this.closed) {
        wt.close()
        return false
      }

      this.wt = wt
      this.wtControlWriter = bidi.writable.getWriter()
      // Send a 4-byte zero-length preface immediately so QUIC delivers the STREAM frame to Go AcceptStream without waiting!
      await this.wtControlWriter.write(new Uint8Array(4))
      this.wtDgramWriter = wt.datagrams.writable.getWriter()
      this.pumpWebTransportStreams(wt, bidi.readable)
      void wt.closed
        .then(() => {
          if (!this.closed && this.wt === wt) {
            this.closed = true
            this.handlers.onClose()
          }
        })
        .catch(() => {
          if (!this.closed && this.wt === wt) {
            this.closed = true
            this.handlers.onClose()
          }
        })
      return true
    } catch {
      return false
    }
  }

  private pumpWebTransportStreams(wt: WebTransport, reliableReadable: ReadableStream<Uint8Array>): void {
    // 1. Reliable Ordered QUIC Stream Reader ([4B len][JSON payload])
    void (async () => {
      const reader = reliableReadable.getReader()
      let acc = new Uint8Array(0)
      try {
        while (!this.closed) {
          const { value, done } = await reader.read()
          if (done || !value) break
          const next = new Uint8Array(acc.length + value.length)
          next.set(acc, 0)
          next.set(value, acc.length)
          acc = next
          while (acc.length >= 4) {
            const len = new DataView(acc.buffer, acc.byteOffset, 4).getUint32(0, true)
            if (len === 0) {
              acc = acc.subarray(4)
              continue
            }
            if (acc.length < 4 + len) break
            const frame = acc.subarray(4, 4 + len)
            acc = acc.subarray(4 + len)
            if (frame[0] === 0x7b) {
              this.handlers.onText(this.textDec.decode(frame))
            } else {
              this.handlers.onBinary(frame)
            }
          }
        }
      } catch {
        // Handled by wt.closed
      } finally {
        reader.releaseLock()
      }
    })()

    // 2. Unreliable QUIC Datagram Reader (Zero Head-of-Line Blocking!)
    void (async () => {
      const reader = wt.datagrams.readable.getReader()
      try {
        while (!this.closed) {
          const { value, done } = await reader.read()
          if (done || !value) break
          this.handlers.onBinary(value)
        }
      } catch {
        // Handled by wt.closed
      } finally {
        reader.releaseLock()
      }
    })()
  }

  private connectWS(wsUrl: string, kind: 'ws-binary' | 'ws-json'): void {
    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    this.ws = ws
    this.kind = kind

    ws.onopen = () => {
      if (this.closed || this.ws !== ws) return
      this.handlers.onOpen(kind)
    }

    ws.onmessage = (ev) => {
      if (this.closed || this.ws !== ws) return
      if (ev.data instanceof ArrayBuffer) {
        this.handlers.onBinary(new Uint8Array(ev.data))
      } else if (typeof ev.data === 'string') {
        this.handlers.onText(ev.data)
      }
    }

    ws.onclose = () => {
      if (this.ws !== ws) return
      this.handlers.onClose()
    }

    ws.onerror = () => {
      if (this.ws !== ws) return
      this.handlers.onError('ไม่สามารถเชื่อมต่อ Real-Time Server ได้')
    }
  }

  isOpen(): boolean {
    if (this.closed) return false
    if (this.wt && this.wtControlWriter) return true
    return this.ws?.readyState === WebSocket.OPEN
  }

  /** Sends high-frequency movement inputs/pings via Unreliable QUIC Datagram (or Binary WS fallback). */
  sendUnreliableBinary(bytes: Uint8Array): void {
    if (this.closed) return
    if (this.wtDgramWriter) {
      void this.wtDgramWriter.write(bytes).catch(() => undefined)
      return
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(bytes as Uint8Array<ArrayBuffer>)
    }
  }

  /** Sends combat actions (skill/attack/dash/snap/rct) reliably in binary (or Binary WS). */
  sendReliableBinary(bytes: Uint8Array): void {
    if (this.closed) return
    if (this.wtControlWriter) {
      const framed = new Uint8Array(4 + bytes.length)
      new DataView(framed.buffer).setUint32(0, bytes.length, true)
      framed.set(bytes, 4)
      void this.wtControlWriter.write(framed).catch(() => undefined)
      return
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(bytes as Uint8Array<ArrayBuffer>)
    }
  }

  /** Sends ordered lobby/draft/config commands over Reliable Control Stream (or WS text). */
  sendReliableJson(payload: Record<string, unknown>): void {
    if (this.closed) return
    const text = JSON.stringify(payload)
    if (this.wtControlWriter) {
      const body = this.textEnc.encode(text)
      const framed = new Uint8Array(4 + body.length)
      new DataView(framed.buffer).setUint32(0, body.length, true)
      framed.set(body, 4)
      void this.wtControlWriter.write(framed).catch(() => undefined)
      return
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(text)
    }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.wt) {
      try {
        this.wtControlWriter?.releaseLock()
        this.wtDgramWriter?.releaseLock()
        this.wt.close()
      } catch {
        // Ignore close errors
      }
      this.wt = null
      this.wtControlWriter = null
      this.wtDgramWriter = null
    }
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }
  }
}

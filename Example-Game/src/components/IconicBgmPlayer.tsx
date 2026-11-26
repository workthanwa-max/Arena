import { memo, useEffect, useRef, useState } from 'react'
import { IconMusic, IconPlay } from './Icons'

const ICONIC_YT_VIDEO_ID = '44pt8w67S8I'

interface YTPlayerInstance {
  playVideo: () => void
  pauseVideo: () => void
  mute: () => void
  unMute: () => void
  isMuted?: () => boolean
  setVolume: (vol: number) => void
  getPlayerState?: () => number
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  destroy: () => void
}

interface YTGlobal {
  Player: new (
    el: HTMLElement | string,
    opts: {
      width?: string | number
      height?: string | number
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: () => void
        onStateChange?: (e: { data: number }) => void
        onError?: () => void
      }
    },
  ) => YTPlayerInstance
  PlayerState?: {
    UNSTARTED?: number
    ENDED?: number
    PLAYING?: number
    PAUSED?: number
    BUFFERING?: number
    CUED?: number
  }
}

declare global {
  interface Window {
    YT?: YTGlobal
    onYouTubeIframeAPIReady?: () => void
  }
}

let ytApiPromise: Promise<YTGlobal | null> | null = null

function loadYouTubeIframeApi(): Promise<YTGlobal | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise

  ytApiPromise = new Promise((resolve) => {
    let settled = false
    const finish = (yt: YTGlobal | null) => {
      if (settled) return
      settled = true
      resolve(yt)
    }

    const timeoutId = window.setTimeout(() => {
      finish(window.YT?.Player ? window.YT : null)
    }, 4500)

    const prevReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeoutId)
      try {
        prevReady?.()
      } catch {
        // Ignore chained listener failures
      }
      finish(window.YT?.Player ? window.YT : null)
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="youtube.com/iframe_api"]',
    )
    if (!existing) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      tag.onerror = () => {
        window.clearTimeout(timeoutId)
        finish(null)
      }
      document.head.appendChild(tag)
    }
  })

  return ytApiPromise
}

interface IconicBgmPlayerProps {
  muted: boolean
  onPlayingConfirmed: () => void
  onFallbackNeeded: () => void
}

/**
 * Official YouTube IFrame Player API integration for ICONIC Mode
 * Plays https://youtu.be/44pt8w67S8I?si=136UcBlQfKIVpzlH in a non-blocking audio/mini-preview dock,
 * handles mobile/iPad autoplay gesture unlocking cleanly, and falls back to synth BGM if offline.
 */
export const IconicBgmPlayer = memo(function IconicBgmPlayer({
  muted,
  onPlayingConfirmed,
  onFallbackNeeded,
}: IconicBgmPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YTPlayerInstance | null>(null)
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const [status, setStatus] = useState<'loading' | 'playing' | 'needs_tap' | 'fallback'>('loading')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let disposed = false
    let verifyTimer: number | null = null

    void loadYouTubeIframeApi().then((YT) => {
      if (disposed || !containerRef.current) return
      if (!YT?.Player) {
        setStatus('fallback')
        onFallbackNeeded()
        return
      }

      const mountEl = document.createElement('div')
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(mountEl)

      try {
        const player = new YT.Player(mountEl, {
          width: '220',
          height: '124',
          videoId: ICONIC_YT_VIDEO_ID,
          playerVars: {
            autoplay: 1,
            loop: 1,
            playlist: ICONIC_YT_VIDEO_ID,
            controls: 1,
            playsinline: 1,
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (disposed) return
              try {
                if (mutedRef.current) {
                  player.mute()
                } else {
                  player.unMute()
                  player.setVolume(76)
                  player.playVideo()
                }
              } catch {
                // Ignore browser autoplay rejection until user gesture
              }
              verifyTimer = window.setTimeout(() => {
                if (disposed) return
                const st = player.getPlayerState?.() ?? -1
                if (st === 1 || st === 3) {
                  setStatus('playing')
                  onPlayingConfirmed()
                } else if (!mutedRef.current) {
                  setStatus('needs_tap')
                }
              }, 900)
            },
            onStateChange: (ev) => {
              if (disposed) return
              if (ev.data === 0) {
                try {
                  player.seekTo(0, true)
                  player.playVideo()
                } catch {
                  // Ignore loop retry errors
                }
                return
              }
              if (ev.data === 1) {
                if (!mutedRef.current && player.isMuted?.()) {
                  setStatus('needs_tap')
                } else {
                  setStatus('playing')
                  onPlayingConfirmed()
                }
              } else if ((ev.data === 2 || ev.data === 5 || ev.data === -1) && !mutedRef.current) {
                setStatus('needs_tap')
              }
            },
            onError: () => {
              if (disposed) return
              setStatus('fallback')
              onFallbackNeeded()
            },
          },
        })
        playerRef.current = player
      } catch {
        setStatus('fallback')
        onFallbackNeeded()
      }
    })

    return () => {
      disposed = true
      if (verifyTimer !== null) {
        window.clearTimeout(verifyTimer)
      }
      const p = playerRef.current
      playerRef.current = null
      if (p) {
        try {
          p.destroy()
        } catch {
          // Ignore YouTube iframe teardown exceptions
        }
      }
    }
  }, [onFallbackNeeded, onPlayingConfirmed])

  // Sync HUD Mute / BGM toggle state with YouTube Player
  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    try {
      if (muted) {
        p.mute()
        p.pauseVideo()
      } else {
        p.unMute()
        p.setVolume(76)
        p.playVideo()
      }
    } catch {
      // Ignore WebKit gesture lock until tap
    }
  }, [muted])

  // Auto-unlock unmuted YouTube playback on the player's next arena tap or key press
  useEffect(() => {
    if (status !== 'needs_tap' || muted) return
    const unlockOnGesture = () => {
      const p = playerRef.current
      if (!p) return
      try {
        p.unMute()
        p.setVolume(76)
        p.playVideo()
        setStatus('playing')
        onPlayingConfirmed()
      } catch {
        // Wait for direct pill tap
      }
    }
    window.addEventListener('pointerdown', unlockOnGesture, { capture: true, passive: true })
    window.addEventListener('keydown', unlockOnGesture, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', unlockOnGesture, { capture: true })
      window.removeEventListener('keydown', unlockOnGesture, { capture: true })
    }
  }, [status, muted, onPlayingConfirmed])

  function handleTapUnlock() {
    const p = playerRef.current
    if (!p) return
    try {
      p.unMute()
      p.setVolume(76)
      p.playVideo()
      setStatus('playing')
      onPlayingConfirmed()
    } catch {
      setExpanded(true)
    }
  }

  return (
    <div
      className={`iconic-yt-dock ${expanded ? 'expanded' : 'collapsed'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="iconic-yt-controls">
        {status === 'needs_tap' && !muted ? (
          <button type="button" className="iconic-yt-pill pulse" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={handleTapUnlock}>
            <IconPlay size={11} /> <span>แตะเปิดเพลง Judas (YouTube)</span>
          </button>
        ) : status === 'fallback' ? (
          <span className="iconic-yt-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconMusic size={12} /> Iconic Synth BGM
          </span>
        ) : (
          <button
            type="button"
            className="iconic-yt-pill"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            onClick={() => setExpanded((v) => !v)}
            title="ซ่อน/แสดงจอวิดีโอ YouTube (Judas - Gojo vs Sukuna)"
          >
            <IconMusic size={12} /> <span>{muted ? 'เพลงปิดอยู่' : 'YouTube: Judas'}</span> <span>{expanded ? '▾' : '▸'}</span>
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className={`iconic-yt-frame-wrap ${expanded ? 'visible' : 'hidden-audio'}`}
        aria-hidden={!expanded}
      />
    </div>
  )
})

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import './App.css'

type AvatarConfig = {
  body: number
  face: number
  hair: number
  accessory: number
  background: number
}

type Route =
  | { name: 'manage' }
  | { name: 'display' }
  | { name: 'join' }
  | { name: 'guest'; singerId: Id<'singers'> }

const defaultAvatar: AvatarConfig = {
  body: 0,
  face: 0,
  hair: 0,
  accessory: 0,
  background: 0,
}

const emojiSet = ['🔥', '👏', '😂', '❤️', '🎤', '⭐']
const avatarLabels = {
  body: ['Tee', 'Band Tee', 'Denim', 'Turtleneck', 'Hoodie', 'Vest'],
  face: ['Joy', 'Cool', 'Star', 'Focus', 'Belt', 'Smirk'],
  hair: ['Shag', 'Mullet', 'Bob', 'Beanie', 'Buzz', 'Curls'],
  accessory: ['None', 'Shades', 'Mic', 'Cans', 'Scarf', 'Halo'],
  background: ['Pink', 'Amber', 'Yellow', 'Lime', 'Cyan', 'Magenta'],
}
const stripeColors = ['#f03070', '#f0a000', '#f0f000', '#30d060', '#30c0f0', '#c030f0']

const SKIN = '#f0d6b8'
const SKIN_SHADOW = '#c8966e'
const INK = '#1e1e5a'
const PAPER = '#f5f5f8'

type AvatarPalette = { bg: string; accent: string; body: string; hair: string; pop: string }

function avatarSlot(value: number, max: number) {
  return ((value % max) + max) % max
}

function paletteFor(bgIdx: number): AvatarPalette {
  const len = stripeColors.length
  const i = avatarSlot(bgIdx, len)
  return {
    bg: stripeColors[i],
    accent: stripeColors[(i + 3) % len],
    body: stripeColors[(i + 2) % len],
    hair: stripeColors[(i + 4) % len],
    pop: stripeColors[(i + 1) % len],
  }
}

function notificationPermission() {
  return typeof Notification === 'undefined' ? 'default' : Notification.permission
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string
          playerVars: Record<string, number | string>
          events: {
            onReady?: (event: { target: { getIframe: () => HTMLIFrameElement } }) => void
            onStateChange: (event: { data: number }) => void
            onError: (event: { data: number }) => void
          }
        },
      ) => { destroy: () => void; getIframe: () => HTMLIFrameElement }
      PlayerState: { ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

function parseRoute(): Route {
  const path = window.location.pathname
  if (path.startsWith('/guest/')) {
    return { name: 'guest', singerId: decodeURIComponent(path.replace('/guest/', '')) as Id<'singers'> }
  }
  if (path === '/display') return { name: 'display' }
  if (path === '/join') return { name: 'join' }
  return { name: 'manage' }
}

function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function useRoute() {
  const [route, setRoute] = useState(parseRoute)
  useEffect(() => {
    const onPop = () => setRoute(parseRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return route
}

function currentOrigin() {
  return `${window.location.protocol}//${window.location.host}`
}

function joinUrl(sessionId: Id<'sessions'>) {
  return `${currentOrigin()}/join?session=${encodeURIComponent(sessionId)}`
}

function youtubeWatch(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

function openAndFocusYouTube(watchUrl: string) {
  const youtubeWindow = window.open(watchUrl, 'karaoke_youtube_player')
  youtubeWindow?.focus()
  return Boolean(youtubeWindow)
}

function isEmbedDisabledError(code: number) {
  return code === 101 || code === 150
}

function singerName(
  entry: Pick<Doc<'queueEntries'>, 'singerId' | 'duetSingerId' | 'duetManualName'>,
  singers: Doc<'singers'>[],
) {
  const lead = singers.find((singer) => singer._id === entry.singerId)?.displayName ?? 'Guest'
  const duet = entry.duetSingerId
    ? singers.find((singer) => singer._id === entry.duetSingerId)?.displayName
    : entry.duetManualName
  return duet ? `${lead} + ${duet}` : lead
}

function singerAvatars(
  entry: Pick<Doc<'queueEntries'>, 'singerId' | 'duetSingerId'>,
  singers: Doc<'singers'>[],
) {
  return [entry.singerId, entry.duetSingerId]
    .filter(Boolean)
    .map((id) => singers.find((singer) => singer._id === id))
    .filter(Boolean) as Doc<'singers'>[]
}

function StripeBand({ footer = false }: { footer?: boolean }) {
  return (
    <div className={footer ? 'stripe-band stripe-band-footer' : 'stripe-band'}>
      {stripeColors.map((color) => (
        <span key={color} style={{ background: color }} />
      ))}
    </div>
  )
}

function renderBackground(idx: number, bg: string, accent: string) {
  const i = avatarSlot(idx, 6)
  return (
    <g>
      <rect width="128" height="128" fill={bg} />
      {i === 1 && (
        <g fill={accent} fillOpacity="0.45">
          {[16, 40, 64, 88, 112].flatMap((y) =>
            [16, 40, 64, 88, 112].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />),
          )}
        </g>
      )}
      {i === 2 && (
        <g fill={accent} fillOpacity="0.28">
          {[-44, -12, 20, 52, 84, 116].map((x) => (
            <polygon key={x} points={`${x},0 ${x + 12},0 ${x + 60},128 ${x + 48},128`} />
          ))}
        </g>
      )}
      {i === 3 && (
        <g fill="none" stroke={accent} strokeOpacity="0.4">
          {[58, 44, 30, 18].map((r) => <circle key={r} cx="64" cy="64" r={r} strokeWidth="2" />)}
        </g>
      )}
      {i === 4 && (
        <g fill={accent} fillOpacity="0.7">
          {[[22, 26], [102, 30], [24, 96], [104, 100], [60, 14], [68, 116]].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <rect x={x - 1} y={y - 5} width="2" height="10" />
              <rect x={x - 5} y={y - 1} width="10" height="2" />
            </g>
          ))}
        </g>
      )}
      {i === 5 && <rect x="0" y="64" width="128" height="64" fill={accent} fillOpacity="0.35" />}
    </g>
  )
}

function renderHalo(pop: string) {
  return (
    <g>
      <circle cx="64" cy="48" r="46" fill="#1a1a1a" />
      {[42, 38, 34, 28, 22].map((r) => (
        <circle key={r} cx="64" cy="48" r={r} fill="none" stroke="#444" strokeWidth="0.6" />
      ))}
      <circle cx="64" cy="48" r="14" fill={pop} />
      <circle cx="64" cy="48" r="3" fill="#1a1a1a" />
      <path d="M 30 32 Q 52 12 82 14" stroke="#fff" strokeWidth="2" fill="none" strokeOpacity="0.18" />
    </g>
  )
}

function renderBody(idx: number, color: string) {
  const i = avatarSlot(idx, 6)
  if (i === 0) {
    return (
      <g>
        <rect x="20" y="92" width="88" height="36" rx="6" fill={color} />
        <rect x="20" y="92" width="88" height="5" fill="#fff" fillOpacity="0.22" />
        <rect x="20" y="120" width="88" height="8" fill="#000" fillOpacity="0.2" />
        <path d="M 50 92 Q 64 102 78 92 Z" fill={SKIN} />
      </g>
    )
  }
  if (i === 1) {
    return (
      <g>
        <rect x="20" y="92" width="88" height="36" rx="6" fill={INK} />
        <rect x="20" y="92" width="88" height="5" fill="#fff" fillOpacity="0.12" />
        <rect x="20" y="120" width="88" height="8" fill="#000" fillOpacity="0.25" />
        <path d="M 50 92 Q 64 102 78 92 Z" fill={SKIN} />
        <polygon points="62,100 71,100 65,112 73,112 58,124 63,114 55,114" fill={color} />
      </g>
    )
  }
  if (i === 2) {
    return (
      <g>
        <rect x="18" y="92" width="92" height="36" rx="4" fill={color} />
        <rect x="18" y="92" width="92" height="5" fill="#fff" fillOpacity="0.22" />
        <rect x="18" y="120" width="92" height="8" fill="#000" fillOpacity="0.22" />
        <polygon points="40,92 60,92 64,108 56,98" fill={color} />
        <polygon points="88,92 68,92 64,108 72,98" fill={color} />
        <polygon points="56,98 72,98 64,116" fill={SKIN} />
        <line x1="64" y1="108" x2="64" y2="128" stroke="#000" strokeOpacity="0.25" strokeWidth="1" />
        <circle cx="60" cy="116" r="1.6" fill={INK} />
        <circle cx="68" cy="116" r="1.6" fill={INK} />
        <rect x="26" y="116" width="16" height="6" rx="1" fill="#000" fillOpacity="0.18" />
        <rect x="86" y="116" width="16" height="6" rx="1" fill="#000" fillOpacity="0.18" />
      </g>
    )
  }
  if (i === 3) {
    return (
      <g>
        <rect x="50" y="80" width="28" height="14" rx="5" fill={color} />
        <rect x="20" y="92" width="88" height="36" rx="6" fill={color} />
        <rect x="20" y="92" width="88" height="5" fill="#fff" fillOpacity="0.2" />
        <rect x="20" y="120" width="88" height="8" fill="#000" fillOpacity="0.2" />
        <rect x="50" y="88" width="28" height="3" fill="#000" fillOpacity="0.18" />
      </g>
    )
  }
  if (i === 4) {
    return (
      <g>
        <rect x="16" y="88" width="96" height="40" rx="10" fill={color} />
        <rect x="16" y="88" width="96" height="5" fill="#fff" fillOpacity="0.2" />
        <rect x="16" y="120" width="96" height="8" fill="#000" fillOpacity="0.25" />
        <rect x="48" y="88" width="32" height="8" rx="4" fill={SKIN} />
        <rect x="54" y="92" width="2" height="14" fill="#fff" fillOpacity="0.9" />
        <rect x="72" y="92" width="2" height="14" fill="#fff" fillOpacity="0.9" />
        <circle cx="55" cy="108" r="2" fill="#fff" />
        <circle cx="73" cy="108" r="2" fill="#fff" />
        <path d="M 36 110 Q 64 118 92 110 L 92 120 Q 64 124 36 120 Z" fill="#000" fillOpacity="0.18" />
      </g>
    )
  }
  return (
    <g>
      <rect x="20" y="92" width="88" height="36" rx="6" fill={PAPER} />
      <rect x="20" y="120" width="88" height="8" fill="#000" fillOpacity="0.1" />
      <polygon points="20,92 56,92 60,108 60,128 20,128" fill={color} />
      <polygon points="108,92 72,92 68,108 68,128 108,128" fill={color} />
      <rect x="20" y="92" width="40" height="4" fill="#fff" fillOpacity="0.22" />
      <rect x="68" y="92" width="40" height="4" fill="#fff" fillOpacity="0.22" />
      <rect x="20" y="122" width="40" height="6" fill="#000" fillOpacity="0.2" />
      <rect x="68" y="122" width="40" height="6" fill="#000" fillOpacity="0.2" />
      <path d="M 56 92 Q 64 100 72 92 Z" fill={SKIN} />
      <circle cx="56" cy="108" r="1.4" fill={INK} />
      <circle cx="72" cy="108" r="1.4" fill={INK} />
    </g>
  )
}

function renderHair(idx: number, color: string) {
  const i = avatarSlot(idx, 6)
  if (i === 0) {
    return (
      <g>
        <path d="M 30 38 L 36 22 L 52 20 L 50 60 L 38 62 Z" fill={color} />
        <path d="M 98 38 L 92 22 L 76 20 L 78 60 L 90 62 Z" fill={color} />
        <path d="M 34 24 Q 64 10 94 24 L 92 46 Q 64 38 36 46 Z" fill={color} />
        <rect x="36" y="22" width="56" height="4" fill="#fff" fillOpacity="0.22" />
        <path d="M 40 38 Q 64 32 88 38 L 86 44 Q 64 40 42 44 Z" fill="#000" fillOpacity="0.18" />
      </g>
    )
  }
  if (i === 1) {
    return (
      <g>
        <path d="M 30 50 Q 24 74 32 90 L 96 90 Q 104 74 98 50 Z" fill={color} fillOpacity="0.95" />
        <path d="M 32 28 Q 64 14 96 28 L 94 40 Q 64 32 34 40 Z" fill={color} />
        <rect x="32" y="28" width="64" height="3" fill="#fff" fillOpacity="0.22" />
        <rect x="32" y="86" width="64" height="4" fill="#000" fillOpacity="0.2" />
      </g>
    )
  }
  if (i === 2) {
    return (
      <g>
        <path d="M 28 32 Q 64 12 100 32 L 100 58 L 94 64 L 92 40 Q 64 34 36 40 L 34 64 L 28 58 Z" fill={color} />
        <rect x="34" y="22" width="60" height="4" fill="#fff" fillOpacity="0.25" />
        <path d="M 40 38 Q 64 34 88 38 L 86 44 Q 64 40 42 44 Z" fill="#000" fillOpacity="0.15" />
      </g>
    )
  }
  if (i === 3) {
    return (
      <g>
        <path d="M 26 26 Q 26 10 64 8 Q 102 10 102 26 L 102 40 L 26 40 Z" fill={color} />
        <rect x="24" y="38" width="80" height="12" rx="2" fill={color} />
        <rect x="24" y="38" width="80" height="2" fill="#000" fillOpacity="0.28" />
        {[36, 50, 64, 78, 92].map((x) => (
          <rect key={x} x={x} y="40" width="2" height="8" fill="#000" fillOpacity="0.2" />
        ))}
        <circle cx="64" cy="8" r="6" fill={color} />
        <circle cx="62" cy="6" r="2" fill="#fff" fillOpacity="0.45" />
      </g>
    )
  }
  if (i === 4) {
    return (
      <g>
        <path d="M 34 24 Q 64 18 94 24 L 94 36 L 34 36 Z" fill={color} fillOpacity="0.85" />
        {[[42, 28], [54, 30], [64, 28], [74, 30], [86, 28]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" fill="#000" fillOpacity="0.32" />
        ))}
        <rect x="36" y="22" width="56" height="3" fill="#fff" fillOpacity="0.2" />
      </g>
    )
  }
  return (
    <g>
      <path d="M 32 38 Q 64 24 96 38 L 96 44 L 32 44 Z" fill={color} />
      {[34, 46, 58, 70, 82].map((x) => (
        <circle key={x} cx={x + 6} cy="22" r="9" fill={color} />
      ))}
      {[34, 46, 58, 70, 82].map((x) => (
        <circle key={`h-${x}`} cx={x + 4} cy="19" r="2.5" fill="#fff" fillOpacity="0.35" />
      ))}
    </g>
  )
}

function renderFace(idx: number) {
  const i = avatarSlot(idx, 6)
  return (
    <g>
      {i === 0 && (
        <g stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M 42 42 Q 48 38 54 42" />
          <path d="M 74 42 Q 80 38 86 42" />
        </g>
      )}
      {i === 1 && (
        <g fill={INK}>
          <rect x="42" y="42" width="14" height="3" rx="1" />
          <rect x="72" y="42" width="14" height="3" rx="1" />
        </g>
      )}
      {i === 2 && (
        <g fill={INK}>
          <rect x="42" y="40" width="12" height="2" />
          <rect x="74" y="40" width="12" height="2" />
        </g>
      )}
      {i === 3 && (
        <g fill={INK}>
          <polygon points="42,46 56,40 56,43 42,49" />
          <polygon points="86,46 72,40 72,43 86,49" />
        </g>
      )}
      {i === 4 && (
        <g stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M 42 39 Q 48 34 54 39" />
          <path d="M 74 39 Q 80 34 86 39" />
        </g>
      )}
      {i === 5 && (
        <g stroke={INK} fill={INK} strokeLinecap="round">
          <rect x="42" y="42" width="14" height="3" rx="1" />
          <path d="M 72 41 Q 80 36 86 41" strokeWidth="2.5" fill="none" />
        </g>
      )}

      {i !== 1 && i !== 2 && i !== 4 && (
        <g>
          <rect x="44" y="48" width="9" height="9" rx="2" fill={INK} />
          <rect x="75" y="48" width="9" height="9" rx="2" fill={INK} />
          <rect x="49" y="49" width="2" height="2" fill="#fff" />
          <rect x="80" y="49" width="2" height="2" fill="#fff" />
        </g>
      )}
      {i === 1 && (
        <g fill={INK}>
          <rect x="44" y="52" width="9" height="3" rx="1.5" />
          <rect x="75" y="52" width="9" height="3" rx="1.5" />
        </g>
      )}
      {i === 2 && (
        <g fill={INK}>
          <polygon transform="translate(48,52)" points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" />
          <polygon transform="translate(80,52)" points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" />
        </g>
      )}
      {i === 4 && (
        <g stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M 42 53 Q 48 47 54 53" />
          <path d="M 74 53 Q 80 47 86 53" />
        </g>
      )}

      {i === 0 && (
        <path d="M 50 64 Q 64 76 78 64" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {i === 1 && (
        <path d="M 52 68 L 78 66" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {i === 2 && <ellipse cx="64" cy="68" rx="5" ry="4" fill={INK} />}
      {i === 3 && (
        <path d="M 54 70 Q 64 66 74 70" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {i === 4 && (
        <g>
          <ellipse cx="64" cy="68" rx="11" ry="9" fill={INK} />
          <ellipse cx="64" cy="72" rx="6" ry="3" fill="#d04060" />
          <rect x="60" y="61" width="8" height="2" fill="#fff" fillOpacity="0.4" />
        </g>
      )}
      {i === 5 && (
        <path d="M 50 68 Q 60 64 72 68 L 78 64" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
    </g>
  )
}

function renderAccessory(idx: number, pop: string) {
  const i = avatarSlot(idx, 6)
  if (i === 1) {
    return (
      <g>
        <rect x="38" y="44" width="22" height="16" rx="7" fill={INK} />
        <rect x="68" y="44" width="22" height="16" rx="7" fill={INK} />
        <rect x="58" y="50" width="12" height="3" fill={INK} />
        <rect x="42" y="46" width="5" height="3" rx="1" fill="#fff" fillOpacity="0.35" />
        <rect x="72" y="46" width="5" height="3" rx="1" fill="#fff" fillOpacity="0.35" />
      </g>
    )
  }
  if (i === 2) {
    return (
      <g>
        <rect x="92" y="80" width="6" height="34" rx="2" fill={INK} />
        <circle cx="95" cy="72" r="11" fill="#a8a8b8" />
        <circle cx="95" cy="72" r="11" fill={INK} fillOpacity="0.15" />
        <g stroke={INK} strokeWidth="1" opacity="0.55">
          <line x1="86" y1="68" x2="104" y2="68" />
          <line x1="86" y1="72" x2="104" y2="72" />
          <line x1="86" y1="76" x2="104" y2="76" />
        </g>
        <circle cx="91" cy="68" r="2" fill="#fff" fillOpacity="0.6" />
        <rect x="89" y="80" width="12" height="8" rx="3" fill={SKIN} />
        <rect x="89" y="80" width="12" height="2" fill={SKIN_SHADOW} fillOpacity="0.5" />
      </g>
    )
  }
  if (i === 3) {
    return (
      <g>
        <path d="M 30 38 Q 64 12 98 38" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M 30 38 Q 64 12 98 38" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeOpacity="0.3" />
        <rect x="22" y="38" width="14" height="20" rx="5" fill={INK} />
        <rect x="92" y="38" width="14" height="20" rx="5" fill={INK} />
        <rect x="24" y="40" width="4" height="16" rx="2" fill="#fff" fillOpacity="0.25" />
        <rect x="100" y="40" width="4" height="16" rx="2" fill="#fff" fillOpacity="0.25" />
        <rect x="22" y="46" width="14" height="3" fill={pop} />
        <rect x="92" y="46" width="14" height="3" fill={pop} />
      </g>
    )
  }
  if (i === 4) {
    return (
      <g>
        <rect x="22" y="80" width="84" height="14" rx="4" fill={pop} />
        <rect x="22" y="83" width="84" height="2" fill="#fff" fillOpacity="0.3" />
        <rect x="22" y="90" width="84" height="2" fill="#000" fillOpacity="0.25" />
        <rect x="80" y="92" width="14" height="26" fill={pop} />
        <rect x="80" y="92" width="14" height="3" fill="#000" fillOpacity="0.28" />
        <rect x="81" y="118" width="2" height="4" fill={pop} />
        <rect x="86" y="118" width="2" height="4" fill={pop} />
        <rect x="91" y="118" width="2" height="4" fill={pop} />
      </g>
    )
  }
  return null
}

function Avatar({ config = defaultAvatar, size = 'medium' }: { config?: AvatarConfig; size?: 'small' | 'medium' | 'large' }) {
  const palette = paletteFor(config.background)
  const accessoryIdx = avatarSlot(config.accessory, 6)
  return (
    <svg className={`avatar avatar-${size}`} viewBox="0 0 128 128" aria-hidden="true">
      {renderBackground(config.background, palette.bg, palette.accent)}
      {accessoryIdx === 5 && renderHalo(palette.pop)}
      <rect x="54" y="78" width="20" height="14" fill={SKIN} />
      <rect x="54" y="88" width="20" height="2" fill={INK} fillOpacity="0.18" />
      {renderBody(config.body, palette.body)}
      <rect x="34" y="24" width="60" height="58" rx="9" fill={SKIN} />
      <rect x="34" y="70" width="60" height="12" rx="6" fill={SKIN_SHADOW} fillOpacity="0.35" />
      <rect x="30" y="52" width="6" height="12" rx="2" fill={SKIN} />
      <rect x="92" y="52" width="6" height="12" rx="2" fill={SKIN} />
      <rect x="32" y="54" width="2" height="6" fill={SKIN_SHADOW} fillOpacity="0.5" />
      <rect x="94" y="54" width="2" height="6" fill={SKIN_SHADOW} fillOpacity="0.5" />
      {renderHair(config.hair, palette.hair)}
      {renderFace(config.face)}
      {accessoryIdx !== 5 && accessoryIdx !== 0 && renderAccessory(config.accessory, palette.pop)}
    </svg>
  )
}

function GuestQueueList({ queue, singers, singerId }: { queue: Doc<'queueEntries'>[]; singers: Doc<'singers'>[]; singerId: Id<'singers'> }) {
  const upcoming = queue.filter((entry) => entry.status !== 'singing')
  return (
    <section className="panel guest-queue-panel">
      <h2>QUEUE</h2>
      <div className="stripe-divider" />
      {upcoming.length === 0 ? (
        <p className="muted">No songs waiting yet.</p>
      ) : (
        <div className="guest-queue-list">
          {upcoming.map((entry, index) => {
            const isSelf = entry.singerId === singerId || entry.duetSingerId === singerId
            return (
              <article className={isSelf ? 'guest-queue-row self' : 'guest-queue-row'} key={entry._id}>
                <span className="queue-rank">{index + 1}</span>
                <div className="avatar-pair">
                  {singerAvatars(entry, singers).map((singer) => <Avatar key={singer._id} config={singer.avatar} size="small" />)}
                </div>
                <div>
                  <strong>{entry.songTitle}</strong>
                  <span>{singerName(entry, singers)}</span>
                </div>
                <span className="pill">{entry.status}</span>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function DisplaySidePanel({
  joinLink,
  queue,
  singers,
  currentEntry,
}: {
  joinLink: string
  queue: Doc<'queueEntries'>[]
  singers: Doc<'singers'>[]
  currentEntry: Doc<'queueEntries'> | null
}) {
  const upcoming = queue.filter((entry) => entry.status !== 'singing').slice(0, 4)
  return (
    <aside className="display-side-panel" aria-label="Display status">
      <section className="display-side-current">
        <span className="display-side-label">{currentEntry ? currentEntry.status : 'OPEN'}</span>
        {currentEntry ? (
          <>
            <div className="avatar-pair">
              {singerAvatars(currentEntry, singers).map((singer) => <Avatar key={singer._id} config={singer.avatar} size="small" />)}
            </div>
            <strong>{singerName(currentEntry, singers)}</strong>
            <span>{currentEntry.dedication ? `${currentEntry.songTitle} - dedicated to ${currentEntry.dedication}` : currentEntry.songTitle}</span>
          </>
        ) : (
          <span>No song playing</span>
        )}
      </section>
      <section className="display-side-queue">
        <span className="display-side-label">{upcoming.length === 0 ? 'QUEUE OPEN' : 'UP NEXT'}</span>
        <div>
          {upcoming.length === 0 ? (
            <p>Scan to add a song</p>
          ) : (
            upcoming.map((entry, index) => (
              <article className={index === 0 ? 'display-side-queue-row next' : 'display-side-queue-row'} key={entry._id}>
                <strong>{index + 1}</strong>
                <span>{singerName(entry, singers)}</span>
              </article>
            ))
          )}
        </div>
      </section>
      <section className="display-side-join">
        <img alt="Join QR code" src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(joinLink)}`} />
        <span>JOIN</span>
      </section>
    </aside>
  )
}

function LoadingScreen() {
  return (
    <main className="screen center-screen">
      <StripeBand />
      <div className="loading">LOADING PARTY DATA</div>
    </main>
  )
}

function EmptySession({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? 'panel empty-panel' : 'screen center-screen'}>
      <StripeBand />
      <h1>KARAOKE PALACE</h1>
      <p>No active session yet. Create one from the management view.</p>
      {!compact && <button className="primary" onClick={() => navigate('/manage')}>OPEN MANAGEMENT</button>}
    </section>
  )
}

function ManageView() {
  const data = useQuery(api.karaoke.managementView, {})
  const createSession = useMutation(api.karaoke.createSession)
  const startReadyEntry = useMutation(api.karaoke.startReadyEntry)
  const advanceCurrent = useMutation(api.karaoke.advanceCurrent)
  const markReady = useMutation(api.karaoke.markReadyToStart)
  const promoteEntry = useMutation(api.karaoke.promoteEntry)
  const removeEntry = useMutation(api.karaoke.removeEntry)
  const skipEntry = useMutation(api.karaoke.skipEntry)
  const reorderEntry = useMutation(api.karaoke.reorderEntry)
  const resetAutoSort = useMutation(api.karaoke.resetAutoSort)
  const toggleSource = useMutation(api.karaoke.toggleEntrySource)
  const setBreakMode = useMutation(api.karaoke.setBreakMode)
  const endSession = useMutation(api.karaoke.endSession)
  const removeSinger = useMutation(api.karaoke.removeSinger)
  const [sessionName, setSessionName] = useState('Saturday Night Karaoke')
  const [breakMessage, setBreakMessage] = useState('Back in 10 minutes')
  const [mobileTab, setMobileTab] = useState<'queue' | 'now' | 'singers'>('queue')
  const [draggingId, setDraggingId] = useState<Id<'queueEntries'> | null>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  if (data === undefined) return <LoadingScreen />

  if (data === null) {
    return (
      <main className="app-shell">
        <StripeBand />
        <section className="join-card">
          <h1>START PARTY</h1>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              await createSession({ name: sessionName, themeLabel: 'Karaoke Palace' })
            }}
          >
            <label>
              Session name
              <input value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
            </label>
            <button className="primary" type="submit">CREATE SESSION</button>
          </form>
        </section>
      </main>
    )
  }

  const { session, queue, singers, history, activeEntry, readyEntry } = data
  const singerMap = new Map(singers.map((singer) => [singer._id, singer]))
  const currentEntry = activeEntry ?? readyEntry ?? queue.find((entry) => entry.status === 'ready') ?? null
  const joinLink = joinUrl(session._id)

  const analytics = buildAnalytics(history, singers)

  const queuePanel = (
    <section className="panel queue-panel">
      <header className="panel-header">
        <h2>QUEUE</h2>
        <button className="ghost" onClick={() => resetAutoSort({ sessionId: session._id })}>AUTO SORT</button>
      </header>
      <div className="stripe-divider" />
      <div className="queue-list">
        {queue.length === 0 && <p className="muted">Waiting for song requests.</p>}
        {queue.map((entry, index) => (
          <article
            className={`queue-row ${entry.status}`}
            draggable={entry.status === 'waiting'}
            key={entry._id}
            onDragStart={() => setDraggingId(entry._id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggingId && draggingId !== entry._id) {
                reorderEntry({ entryId: draggingId, beforeEntryId: entry._id })
              }
              setDraggingId(null)
            }}
          >
            <button className="drag-handle" title="Drag to reorder">::</button>
            <div className="queue-rank">{index + 1}</div>
            <div className="avatar-pair">
              {singerAvatars(entry, singers).map((singer) => <Avatar key={singer._id} config={singer.avatar} size="small" />)}
            </div>
            <div className="queue-main">
              <strong>{entry.songTitle}</strong>
              <span>{singerName(entry, singers)}</span>
              {entry.dedication && <em>Dedicated to {entry.dedication}</em>}
            </div>
            <span className="pill">{entry.source}</span>
            <div className="row-actions">
              <button onClick={() => promoteEntry({ entryId: entry._id })}>TOP</button>
              <button onClick={() => toggleSource({ entryId: entry._id, source: entry.source === 'youtube' ? 'custom' : 'youtube' })}>{entry.source === 'youtube' ? 'CUSTOM' : 'YT'}</button>
              <button onClick={() => skipEntry({ entryId: entry._id })}>SKIP</button>
              <button onClick={() => removeEntry({ entryId: entry._id })}>REMOVE</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )

  const nowPanel = (
    <section className="panel now-panel">
      <header className="panel-header">
        <h2>NOW PLAYING</h2>
        <button className="ghost" onClick={() => navigate('/display')}>TV VIEW</button>
      </header>
      <div className="stripe-divider" />
      {currentEntry ? (
        <div className="now-card">
          <div className="avatar-pair large">
            {singerAvatars(currentEntry, singers).map((singer) => <Avatar key={singer._id} config={singer.avatar} size="large" />)}
          </div>
          <p className="eyebrow">{currentEntry.status === 'singing' ? 'LIVE' : 'READY'}</p>
          <h3>{singerName(currentEntry, singers)}</h3>
          <p>{currentEntry.songTitle}</p>
          <div className="control-grid">
            {currentEntry.status === 'ready' && currentEntry.source === 'custom' && (
              <button className="confirm" onClick={() => startReadyEntry({ sessionId: session._id })}>START CUSTOM VIDEO</button>
            )}
            {currentEntry.status === 'ready' && currentEntry.source === 'youtube' && (
              <button className="confirm" onClick={() => startReadyEntry({ sessionId: session._id })}>HOST START</button>
            )}
            {currentEntry.status === 'singing' && (
              <button className="confirm" onClick={() => advanceCurrent({ sessionId: session._id })}>SONG FINISHED</button>
            )}
            {session.stage === 'idle' && <button className="primary" onClick={() => markReady({ sessionId: session._id })}>READY NEXT</button>}
          </div>
        </div>
      ) : (
        <div className="now-card">
          <p className="eyebrow">IDLE</p>
          <h3>Open mic</h3>
          <p>The next request will appear here.</p>
          <button className="primary" onClick={() => markReady({ sessionId: session._id })}>READY NEXT</button>
        </div>
      )}
      <div className="host-tools">
        <label>
          Break message
          <input value={breakMessage} onChange={(event) => setBreakMessage(event.target.value)} />
        </label>
        <button className={session.status === 'break' ? 'confirm' : 'warn'} onClick={() => setBreakMode({ sessionId: session._id, enabled: session.status !== 'break', message: breakMessage })}>
          {session.status === 'break' ? 'END BREAK' : 'START BREAK'}
        </button>
        <button className="danger" onClick={() => endSession({ sessionId: session._id })}>END SESSION</button>
      </div>
      <div className="qr-box">
        <img alt="Join QR code" src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinLink)}`} />
        <div>
          <p className="eyebrow">JOIN URL</p>
          <a href={joinLink}>{joinLink}</a>
        </div>
      </div>
    </section>
  )

  const singersPanel = (
    <section className="panel singer-panel">
      <header className="panel-header">
        <h2>SINGERS</h2>
        <button className="ghost" onClick={() => setAnalyticsOpen((open) => !open)}>ANALYTICS</button>
      </header>
      <div className="stripe-divider" />
      {singers.map((singer) => (
        <article className="singer-row" key={singer._id}>
          <Avatar config={singer.avatar} size="small" />
          <div>
            <strong>{singer.displayName}</strong>
            <span>{singer.timesSung} sung</span>
          </div>
          <button onClick={() => removeSinger({ singerId: singer._id })}>REMOVE</button>
        </article>
      ))}
      {analyticsOpen && <AnalyticsPanel analytics={analytics} singerMap={singerMap} />}
    </section>
  )

  return (
    <main className="app-shell manage-shell">
      <StripeBand />
      <header className="app-header">
        <div>
          <p className="eyebrow">Karaoke Palace</p>
          <h1>{session.name}</h1>
        </div>
        <nav>
          <button onClick={() => navigate('/join?session=' + session._id)}>JOIN</button>
          <button onClick={() => navigate('/display')}>DISPLAY</button>
        </nav>
      </header>
      <div className="mobile-tabs">
        {(['queue', 'now', 'singers'] as const).map((tab) => (
          <button className={mobileTab === tab ? 'active' : ''} key={tab} onClick={() => setMobileTab(tab)}>{tab}</button>
        ))}
      </div>
      <div className="manage-grid">
        <div className={mobileTab === 'queue' ? 'mobile-visible' : 'mobile-hidden'}>{queuePanel}</div>
        <div className={mobileTab === 'now' ? 'mobile-visible' : 'mobile-hidden'}>{nowPanel}</div>
        <div className={mobileTab === 'singers' ? 'mobile-visible' : 'mobile-hidden'}>{singersPanel}</div>
      </div>
    </main>
  )
}

function buildAnalytics(history: Doc<'performanceHistory'>[], singers: Doc<'singers'>[]) {
  const totalReactions = history.reduce((sum, item) => sum + item.reactionSummary.reduce((inner, reaction) => inner + reaction.count, 0), 0)
  const mostReacted = [...history].sort((a, b) => {
    const aCount = a.reactionSummary.reduce((sum, reaction) => sum + reaction.count, 0)
    const bCount = b.reactionSummary.reduce((sum, reaction) => sum + reaction.count, 0)
    return bCount - aCount
  })[0]
  return {
    totalSongs: history.length,
    leaderboard: [...singers].sort((a, b) => b.timesSung - a.timesSung),
    mostReacted,
    averageReactions: history.length ? Math.round(totalReactions / history.length) : 0,
    youtubeCount: history.filter((item) => item.source === 'youtube').length,
    customCount: history.filter((item) => item.source === 'custom').length,
    timeline: [...history].sort((a, b) => b.completedAt - a.completedAt),
  }
}

function AnalyticsPanel({ analytics, singerMap }: { analytics: ReturnType<typeof buildAnalytics>; singerMap: Map<Id<'singers'>, Doc<'singers'>> }) {
  return (
    <div className="analytics">
      <div className="stat-grid">
        <span><strong>{analytics.totalSongs}</strong> songs</span>
        <span><strong>{analytics.averageReactions}</strong> avg reactions</span>
        <span><strong>{analytics.youtubeCount}</strong> YouTube</span>
        <span><strong>{analytics.customCount}</strong> custom</span>
      </div>
      {analytics.mostReacted && (
        <p>Most reacted: <strong>{analytics.mostReacted.songTitle}</strong> {analytics.mostReacted.reactionSummary.map((reaction) => `${reaction.emoji}x${reaction.count}`).join(' ')}</p>
      )}
      <h3>Leaderboard</h3>
      {analytics.leaderboard.map((singer) => <p key={singer._id}>{singer.displayName}: {singer.timesSung}</p>)}
      <h3>Timeline</h3>
      {analytics.timeline.slice(0, 8).map((item) => <p key={item._id}>{singerMap.get(item.singerId)?.displayName ?? 'Guest'} - {item.songTitle}</p>)}
    </div>
  )
}

function JoinView() {
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get('session') as Id<'sessions'> | null
  const session = useQuery(api.karaoke.sessionView, sessionId ? { sessionId } : 'skip')
  const joinSession = useMutation(api.karaoke.joinSession)
  const [name, setName] = useState('')
  const [step, setStep] = useState<'name' | 'avatar'>('name')
  const [avatar, setAvatar] = useState<AvatarConfig>(defaultAvatar)
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)

  if (!sessionId) return <EmptySession />
  if (session === undefined) return <LoadingScreen />
  if (session === null) return <EmptySession />
  const activeSessionId = sessionId

  async function submitJoin(event: FormEvent) {
    event.preventDefault()
    setJoinError('')
    setJoining(true)
    try {
      const singerId = await joinSession({
        sessionId: activeSessionId,
        displayName: name,
        avatar,
        notificationPermission: notificationPermission(),
      })
      navigate(`/guest/${singerId}`)
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Could not join the party.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="app-shell join-shell">
      <StripeBand />
      <section className="join-card">
        <p className="eyebrow">{session.name}</p>
        <h1>{step === 'name' ? 'ENTER YOUR NAME' : 'BUILD AVATAR'}</h1>
        {step === 'name' ? (
          <form onSubmit={(event) => { event.preventDefault(); setStep('avatar') }}>
            <label>
              Display name
              <input autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <button className="primary" type="submit">CONTINUE</button>
          </form>
        ) : (
          <form onSubmit={submitJoin}>
            <div className="avatar-preview"><Avatar config={avatar} size="large" /></div>
            {(Object.keys(avatarLabels) as (keyof AvatarConfig)[]).map((key) => (
              <div className="avatar-row" key={key}>
                <span>{key}</span>
                <div>
                  {avatarLabels[key].map((label, index) => (
                    <button className={avatar[key] === index ? 'active' : ''} key={label} type="button" onClick={() => setAvatar({ ...avatar, [key]: index })}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {joinError && <p className="form-error">{joinError}</p>}
            <button className="primary" type="submit" disabled={joining}>{joining ? 'JOINING...' : 'JOIN PARTY'}</button>
          </form>
        )}
      </section>
    </main>
  )
}

function GuestView({ singerId }: { singerId: Id<'singers'> }) {
  const data = useQuery(api.karaoke.guestView, { singerId })
  const submitSong = useMutation(api.karaoke.submitSong)
  const startReadyEntry = useMutation(api.karaoke.startReadyEntry)
  const sendReaction = useMutation(api.karaoke.sendReaction)
  const savePush = useMutation(api.karaoke.savePushSubscription)
  const publicConfig = useQuery(api.notifications.publicConfig, {})
  const [songTitle, setSongTitle] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [dedication, setDedication] = useState('')
  const [duet, setDuet] = useState(false)
  const [duetSingerId, setDuetSingerId] = useState<Id<'singers'> | undefined>()
  const [duetManualName, setDuetManualName] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [requestError, setRequestError] = useState('')
  const [submittingRequest, setSubmittingRequest] = useState(false)

  if (data === undefined) return <LoadingScreen />
  if (data === null) return <EmptySession />

  const { session, singer, queue, singers, history, queuePosition, activeEntry, readyEntry } = data
  const isReadySinger = readyEntry && (readyEntry.singerId === singer._id || readyEntry.duetSingerId === singer._id)
  const isSinging = activeEntry && (activeEntry.singerId === singer._id || activeEntry.duetSingerId === singer._id)
  const activeOwnRequest = queue.find((entry) => entry.singerId === singer._id || entry.duetSingerId === singer._id)
  const partners = singers.filter((candidate) => candidate._id !== singer._id && candidate.displayName.toLowerCase().includes(search.toLowerCase()))

  async function submitRequest(event: FormEvent) {
    event.preventDefault()
    setRequestError('')
    setSubmittingRequest(true)
    try {
      await submitSong({
        singerId,
        songTitle,
        youtubeUrl: youtubeUrl || undefined,
        dedication: dedication || undefined,
        duetSingerId: duet ? duetSingerId : undefined,
        duetManualName: duet && !duetSingerId ? duetManualName || undefined : undefined,
      })
      setSongTitle('')
      setYoutubeUrl('')
      setDedication('')
      setDuet(false)
      setDuetSingerId(undefined)
      setDuetManualName('')
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not add that song.')
    } finally {
      setSubmittingRequest(false)
    }
  }

  async function enableNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !publicConfig?.vapidPublicKey) {
      await savePush({ singerId, notificationPermission: notificationPermission() })
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      await savePush({ singerId, notificationPermission: permission })
      return
    }
    const registration = await navigator.serviceWorker.register('/sw.js')
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicConfig.vapidPublicKey),
    })
    await savePush({
      singerId,
      notificationPermission: permission,
      pushSubscription: subscription.toJSON() as {
        endpoint: string
        expirationTime?: number | null
        keys: { p256dh: string; auth: string }
      },
    })
  }

  return (
    <main className="app-shell guest-shell">
      <StripeBand />
      <header className="guest-hero">
        <Avatar config={singer.avatar} size="large" />
        <div>
          <p className="eyebrow">WELCOME</p>
          <h1>{singer.displayName}</h1>
          <p className="position">{queuePosition > 0 ? `You're #${queuePosition} in line` : 'No active request yet'}</p>
        </div>
      </header>
      {queuePosition === 2 && <div className="notice">You're up next. Get close to the mic.</div>}
      {isReadySinger && (
        <section className="ready-card">
          <h2>{readyEntry.source === 'youtube' ? "I'M READY" : 'GET READY'}</h2>
          <p>{readyEntry.songTitle}</p>
          {readyEntry.source === 'youtube' ? (
            <button className="ready-button" onClick={() => startReadyEntry({ sessionId: session._id, singerId })}>START THE SONG</button>
          ) : (
            <p>The host will start the custom video.</p>
          )}
        </section>
      )}
      <section className="panel">
        <h2>{activeOwnRequest ? 'YOUR REQUEST' : 'REQUEST SONG'}</h2>
        <div className="stripe-divider" />
        {activeOwnRequest ? (
          <article className="active-request-card">
            <p className="eyebrow">{activeOwnRequest.status}</p>
            <h3>{activeOwnRequest.songTitle}</h3>
            <p>{singerName(activeOwnRequest, singers)}</p>
          </article>
        ) : (
          <form className="song-form" onSubmit={submitRequest}>
            <label>
              Song title
              <input autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} value={songTitle} onChange={(event) => setSongTitle(event.target.value)} required />
            </label>
            <label>
              YouTube link
              <input autoCapitalize="off" autoComplete="off" autoCorrect="off" inputMode="url" spellCheck={false} value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="Optional" />
            </label>
            <label>
              Dedicate this to
              <input value={dedication} onChange={(event) => setDedication(event.target.value)} placeholder="Optional" />
            </label>
            <label className="check-row">
              <input type="checkbox" checked={duet} onChange={(event) => setDuet(event.target.checked)} />
              This is a duet
            </label>
            {duet && (
              <div className="duet-sheet">
                <input autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find duet partner" />
                <div className="partner-grid">
                  {partners.map((partner) => (
                    <button className={duetSingerId === partner._id ? 'selected' : ''} type="button" key={partner._id} onClick={() => { setDuetSingerId(partner._id); setDuetManualName('') }}>
                      <Avatar config={partner.avatar} size="small" />
                      {partner.displayName}
                    </button>
                  ))}
                </div>
                <input autoComplete="off" value={duetManualName} onChange={(event) => { setDuetManualName(event.target.value); setDuetSingerId(undefined) }} placeholder="Or enter a walk-up singer" />
              </div>
            )}
            {requestError && <p className="form-error">{requestError}</p>}
            <button className="primary" type="submit" disabled={submittingRequest}>{submittingRequest ? 'ADDING...' : 'ADD TO QUEUE'}</button>
          </form>
        )}
      </section>
      <GuestQueueList queue={queue} singers={singers} singerId={singerId} />
      <section className="panel">
        <button className="ghost wide" onClick={enableNotifications}>ENABLE UP-NEXT ALERTS</button>
        <button className="ghost wide" onClick={() => setHistoryOpen((open) => !open)}>MY SONGS</button>
        {historyOpen && (
          <div className="history-list">
            {history.map((item) => (
              <p key={item._id}>{item.songTitle} {item.reactionSummary.map((reaction) => `${reaction.emoji}x${reaction.count}`).join(' ')}</p>
            ))}
          </div>
        )}
      </section>
      {isSinging && (
        <div className="reaction-bar">
          {emojiSet.map((emoji) => <button key={emoji} onClick={() => sendReaction({ singerId, emoji })}>{emoji}</button>)}
        </div>
      )}
    </main>
  )
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output
}

function DisplayView() {
  const data = useQuery(api.karaoke.displayView, {})
  const advanceCurrent = useMutation(api.karaoke.advanceCurrent)

  if (data === undefined) return <LoadingScreen />
  if (data === null) return <EmptySession />

  const { session, queue, singers, activeEntry, readyEntry, reactions } = data
  const joinLink = joinUrl(session._id)
  const sidePanelEntry = activeEntry ?? readyEntry ?? null

  let content
  if (session.status === 'break') {
    content = (
      <section className="display-state">
        <p className="eyebrow">{session.name}</p>
        <h1>BREAK MODE</h1>
        <p>{session.breakMessage ?? 'Back soon'}</p>
      </section>
    )
  } else if (session.stage === 'playing' && activeEntry) {
    content = (
      <section className="display-playing">
        {activeEntry.source === 'youtube' && activeEntry.youtubeVideoId ? (
          <YouTubePlayer key={activeEntry.youtubeVideoId} videoId={activeEntry.youtubeVideoId} onEnded={() => advanceCurrent({ sessionId: session._id })} />
        ) : (
          <div className="custom-video-card">
            <p className="eyebrow">CUSTOM VIDEO</p>
            <h1>{activeEntry.songTitle}</h1>
            <p>Playing now</p>
          </div>
        )}
        <ReactionFloat reactions={reactions} />
      </section>
    )
  } else if (session.stage === 'ready' && readyEntry) {
    content = (
      <section className="display-state ready-state">
        <div className="avatar-pair hero-pair">
          {singerAvatars(readyEntry, singers).map((singer) => <Avatar key={singer._id} config={singer.avatar} size="large" />)}
        </div>
        <TypeOnText text={singerName(readyEntry, singers).toUpperCase()} />
        <h2>{readyEntry.songTitle}</h2>
        <p>Waiting for {singerName(readyEntry, singers)} to start...</p>
      </section>
    )
  } else {
    content = (
      <section className="display-state idle-state">
        <p className="eyebrow">Karaoke Palace</p>
        <h1>{queue.length === 0 ? 'QUEUE OPEN' : session.name}</h1>
        <h2>{queue.length === 0 ? 'No songs waiting' : 'Ready for the next singer'}</h2>
        <p>Scan the side panel to add a song.</p>
      </section>
    )
  }

  return (
    <main className="display-shell">
      <StripeBand />
      {content}
      <DisplaySidePanel joinLink={joinLink} queue={queue} singers={singers} currentEntry={sidePanelEntry} />
      <StripeBand footer={session.stage === 'playing'} />
    </main>
  )
}

function YouTubePlayer({ videoId, onEnded }: { videoId: string; onEnded: () => void }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const endedRef = useRef(false)
  const onEndedRef = useRef(onEnded)
  const openedFallbackRef = useRef(false)
  const [playbackError, setPlaybackError] = useState<number | null>(null)
  const watchUrl = youtubeWatch(videoId)
  const embedDisabled = playbackError !== null && isEmbedDisabledError(playbackError)

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
    endedRef.current = false
    openedFallbackRef.current = false
    let player: { destroy: () => void } | null = null
    const handlePlaybackError = (code: number) => {
      setPlaybackError(code)
      if (isEmbedDisabledError(code) && !openedFallbackRef.current) {
        openedFallbackRef.current = true
        openAndFocusYouTube(watchUrl)
      }
    }
    const createPlayer = () => {
      if (!elementRef.current || !window.YT) return
      player = new window.YT.Player(elementRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
          widget_referrer: window.location.href,
        },
        events: {
          onReady: (event) => {
            const iframe = event.target.getIframe()
            iframe.referrerPolicy = 'strict-origin-when-cross-origin'
            iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.ENDED && !endedRef.current) {
              endedRef.current = true
              onEndedRef.current()
            }
          },
          onError: (event) => handlePlaybackError(event.data),
        },
      })
    }
    if (window.YT) {
      createPlayer()
    } else {
      window.onYouTubeIframeAPIReady = createPlayer
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)
    }
    return () => player?.destroy()
  }, [videoId, watchUrl])

  return (
    <div className="youtube-frame">
      <div ref={elementRef} />
      {embedDisabled && (
        <div className="youtube-fallback">
          <p className="eyebrow">YOUTUBE PLAYBACK BLOCKED</p>
          <h2>Switching to YouTube</h2>
          <p>This karaoke track cannot play embedded here. The display tried to open and focus YouTube in a new tab.</p>
          <button type="button" onClick={() => openAndFocusYouTube(watchUrl)}>OPEN YOUTUBE TAB</button>
        </div>
      )}
      {playbackError !== null && !embedDisabled && (
        <div className="youtube-warning">
          YouTube player error {playbackError}. Retrying with site origin enabled.
        </div>
      )}
    </div>
  )
}

function TypeOnText({ text }: { text: string }) {
  const [visible, setVisible] = useState('')
  useEffect(() => {
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setVisible(text.slice(0, index))
      if (index >= text.length) window.clearInterval(timer)
    }, 60)
    return () => window.clearInterval(timer)
  }, [text])
  return <h1 className="type-on">{visible}<span /></h1>
}

function ReactionFloat({ reactions }: { reactions: Doc<'reactions'>[] }) {
  return (
    <div className="reaction-rail">
      {reactions.map((reaction, index) => (
        <span key={reaction._id} style={{ right: `${(index % 3) * 56}px`, animationDelay: `${(index % 6) * 80}ms` }}>{reaction.emoji}</span>
      ))}
    </div>
  )
}

function App() {
  const route = useRoute()
  const missingUrl = !import.meta.env.VITE_CONVEX_URL

  if (missingUrl) {
    return <main className="screen center-screen"><h1>Missing VITE_CONVEX_URL</h1></main>
  }

  if (route.name === 'display') return <DisplayView />
  if (route.name === 'join') return <JoinView />
  if (route.name === 'guest') return <GuestView singerId={route.singerId} />
  return <ManageView />
}

export default App

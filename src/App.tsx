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
  body: ['Block', 'Tall', 'Wide', 'Jacket'],
  face: ['Joy', 'Cool', 'Star', 'Focus'],
  hair: ['Sweep', 'Peak', 'Cap', 'Crown'],
  accessory: ['None', 'Glasses', 'Mic', 'Band'],
  background: ['Pink', 'Amber', 'Lime', 'Cyan'],
}
const stripeColors = ['#f03070', '#f0a000', '#f0f000', '#30d060', '#30c0f0', '#c030f0']

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
            onStateChange: (event: { data: number }) => void
            onError: (event: { data: number }) => void
          }
        },
      ) => { destroy: () => void }
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

function Avatar({ config = defaultAvatar, size = 'medium' }: { config?: AvatarConfig; size?: 'small' | 'medium' | 'large' }) {
  const bg = stripeColors[config.background % stripeColors.length]
  const body = stripeColors[(config.body + 3) % stripeColors.length]
  const hair = stripeColors[(config.hair + 5) % stripeColors.length]
  const accessory = stripeColors[(config.accessory + 1) % stripeColors.length]
  const faceY = config.face % 2 === 0 ? 47 : 43
  return (
    <svg className={`avatar avatar-${size}`} viewBox="0 0 128 128" aria-hidden="true">
      <rect width="128" height="128" fill={bg} />
      <rect x="18" y="20" width="92" height="92" fill="#2a2a7a" />
      <rect x={config.body % 2 ? '34' : '28'} y="66" width={config.body % 2 ? '60' : '72'} height="42" fill={body} />
      <rect x="38" y="34" width="52" height="48" fill="#e8e8f0" />
      {config.hair === 0 && <rect x="34" y="26" width="60" height="16" fill={hair} />}
      {config.hair === 1 && <polygon points="34,42 48,24 62,42 76,24 94,42" fill={hair} />}
      {config.hair === 2 && <><rect x="30" y="28" width="68" height="14" fill={hair} /><rect x="72" y="18" width="22" height="12" fill={hair} /></>}
      {config.hair === 3 && <polygon points="34,40 44,22 58,40 70,22 84,40 94,22 98,40" fill={hair} />}
      <rect x="48" y={faceY} width="10" height="10" fill="#1e1e5a" />
      <rect x="72" y={faceY} width="10" height="10" fill="#1e1e5a" />
      {config.face === 0 && <rect x="54" y="66" width="24" height="6" fill="#1e1e5a" />}
      {config.face === 1 && <rect x="58" y="64" width="16" height="10" fill="#1e1e5a" />}
      {config.face === 2 && <polygon points="54,68 66,76 78,68" fill="#1e1e5a" />}
      {config.face === 3 && <><rect x="52" y="65" width="28" height="4" fill="#1e1e5a" /><rect x="52" y="72" width="28" height="4" fill="#1e1e5a" /></>}
      {config.accessory === 1 && <><rect x="42" y="46" width="22" height="14" fill="none" stroke={accessory} strokeWidth="5" /><rect x="68" y="46" width="22" height="14" fill="none" stroke={accessory} strokeWidth="5" /><rect x="63" y="51" width="6" height="4" fill={accessory} /></>}
      {config.accessory === 2 && <><rect x="92" y="72" width="10" height="28" fill={accessory} /><rect x="86" y="64" width="22" height="12" fill={accessory} /></>}
      {config.accessory === 3 && <rect x="34" y="38" width="60" height="8" fill={accessory} />}
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

function DisplayQueueRibbon({ queue, singers }: { queue: Doc<'queueEntries'>[]; singers: Doc<'singers'>[] }) {
  const upcoming = queue.filter((entry) => entry.status !== 'singing').slice(0, 5)
  return (
    <aside className="display-queue-ribbon" aria-label="Upcoming queue">
      <span className="display-queue-label">{upcoming.length === 0 ? 'QUEUE OPEN' : 'UP NEXT'}</span>
      <div className="display-queue-chips">
        {upcoming.length === 0 ? (
          <span className="display-empty-chip">Scan to add a song</span>
        ) : (
          upcoming.map((entry, index) => (
            <span className={index === 0 ? 'display-queue-chip next' : 'display-queue-chip'} key={entry._id}>
              <strong>{index + 1}</strong>
              {singerName(entry, singers)}
            </span>
          ))
        )}
      </div>
    </aside>
  )
}

function DisplayJoinBug({ joinLink }: { joinLink: string }) {
  return (
    <aside className="display-join-bug">
      <img alt="Join QR code" src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(joinLink)}`} />
      <span>JOIN</span>
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
        <LowerThird entry={activeEntry} singers={singers} />
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
        <div className="qr-box tv">
          <img alt="Join QR code" src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinLink)}`} />
          <p>SCAN TO SING</p>
        </div>
      </section>
    )
  }

  return (
    <main className="display-shell">
      <StripeBand />
      {content}
      <DisplayJoinBug joinLink={joinLink} />
      <DisplayQueueRibbon queue={queue} singers={singers} />
      <StripeBand footer={session.stage === 'playing'} />
    </main>
  )
}

function YouTubePlayer({ videoId, onEnded }: { videoId: string; onEnded: () => void }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const endedRef = useRef(false)
  const openedFallbackRef = useRef(false)
  const [playbackError, setPlaybackError] = useState<number | null>(null)
  const watchUrl = youtubeWatch(videoId)

  useEffect(() => {
    endedRef.current = false
    openedFallbackRef.current = false
    let player: { destroy: () => void } | null = null
    const handlePlaybackError = (code: number) => {
      setPlaybackError(code)
      if (!openedFallbackRef.current) {
        openedFallbackRef.current = true
        window.open(watchUrl, '_blank', 'noopener,noreferrer')
      }
    }
    const createPlayer = () => {
      if (!elementRef.current || !window.YT) return
      player = new window.YT.Player(elementRef.current, {
        videoId,
        playerVars: { autoplay: 1, controls: 1, rel: 0, playsinline: 1 },
        events: {
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.ENDED && !endedRef.current) {
              endedRef.current = true
              onEnded()
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
  }, [videoId, onEnded, watchUrl])

  return (
    <div className="youtube-frame">
      <div ref={elementRef} />
      {playbackError !== null && (
        <div className="youtube-fallback">
          <p className="eyebrow">YOUTUBE PLAYBACK BLOCKED</p>
          <h2>Opened in YouTube</h2>
          <p>This karaoke track cannot play embedded here.</p>
          <a href={watchUrl} target="_blank" rel="noreferrer">OPEN YOUTUBE TAB</a>
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

function LowerThird({ entry, singers }: { entry: Doc<'queueEntries'>; singers: Doc<'singers'>[] }) {
  return (
    <div className="lower-third">
      <div className="avatar-pair">
        {singerAvatars(entry, singers).map((singer) => <Avatar key={singer._id} config={singer.avatar} size="small" />)}
      </div>
      <div>
        <strong>{singerName(entry, singers)}</strong>
        <span>{entry.dedication ? `${entry.songTitle} - dedicated to ${entry.dedication}` : entry.songTitle}</span>
      </div>
    </div>
  )
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

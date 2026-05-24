# Karaoke Party App — Project Plan

## Overview

A real-time, multi-device karaoke party management system. Guests join via QR code on their phones, submit song requests, and track their place in the queue. The host manages the session from a laptop management view. A separate fullscreen display view runs on the TV. Everything syncs in real time via Convex.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + Vite | Fast dev experience, component-based views |
| Styling | Tailwind CSS | Rapid UI, dark mode for TV display |
| Real-time backend | Convex | Real-time sync across all clients, serverless functions, built-in reactivity |
| Routing | React Router | Separate routes per view (display, management, guest, join) |
| QR Code | `qrcode.react` | Client-side QR generation from session join URL |
| YouTube Embed | YouTube IFrame API | Autoplay, event callbacks for play/end detection |
| Notifications | Web Push API + Service Worker + Convex Action | "You're up next" alert to guest's phone tab |
| Analytics | Convex queries over existing data | No separate service needed |
| Deployment | Cloudflare Pages (frontend) + Convex Cloud (backend) | Global CDN edge delivery, free tiers suitable for party use |

---

## Views & Routes

### `/display` — TV Display View
Fullscreen, shown on the TV in a browser tab. Controlled entirely by state from Convex — the host never needs to touch this tab.

### `/manage` — Host Management View
Runs on the host's laptop or phone. Full session control. Responsive layout that adapts between a multi-panel desktop view and a tabbed single-column mobile view.

### `/join` — Guest Join Page
Landing page when a guest scans the QR code. Prompts for their name and joins the session.

### `/guest/:singerId` — Guest Lobby View
After joining, guests see their queue position, queue ticker, submission form, and personal history.

---

## Database Schema (Convex Tables)

### `sessions`
One document per active party. Holds session metadata: name, status (active / break / ended), theme label, created timestamp, and a flag for whether a custom video is currently expected.

### `singers`
One document per person who has joined the session. Holds their display name, session ID, times sung, join timestamp, avatar config (object of layered SVG choices), and device push subscription data for notifications.

### `queueEntries`
Each song request in the queue. Fields: session ID, singer ID, song title, YouTube video ID (nullable), whether it's a custom video, dedication message (nullable), status (waiting / singing / done / skipped), priority score, created timestamp, and position override for manual reordering.

### `reactions`
Live emoji reactions tied to the currently active queue entry. Fields: session ID, queue entry ID, emoji character, singer ID, timestamp. Short TTL — only reactions from the current performance are shown live.

### `performanceHistory`
Completed entries archived for analytics. Mirrors queueEntries at completion time, plus applause count and any reaction summary.

### `sessions.breakMode`
A flag and optional message on the session document. When break mode is active, the display view shows a party screen instead of the queue.

---

## Feature Specifications

---

### 1. Session Management

The host creates a session from the management view, sets a session name, and receives a unique session URL and QR code. The QR code encodes the `/join` URL with the session ID as a query parameter. Only one session is active at a time per deployment, but the schema supports multiple if needed later.

Sessions have three states: **active**, **break**, and **ended**. The host can toggle break mode or end the session from the management view at any time.

---

### 2. Guest Join Flow

Guests scan the QR code and land on `/join?session=<id>`. The join flow is a two-step process:

**Step 1 — Name entry:** The guest enters their display name.

**Step 2 — Avatar creator:** A Kahoot-style avatar builder lets the guest assemble a simple character from a set of layered options: body/skin tone, face expression, hair style, accessory (hat, glasses, headband, etc.), and a background color. Each category is presented as a horizontally scrollable row of illustrated options. The selections are combined into a deterministic avatar rendered as an inline SVG — no image uploads or external service needed. The final avatar config (a small object of category → choice index) is stored on the singer document and rendered consistently across all views.

After completing both steps the guest is assigned a singer document and redirected to their personal `/guest/:singerId` view. Their name and avatar appear in the queue and on the management view immediately via Convex reactivity. Avatars are shown in the queue ticker on the display view, in the singer list on the management view, and on the Ready state screen when a singer is up next.

---

### 3. Song Submission

From the guest view, guests fill out a submission form with:

- **Song title** (always required)
- **YouTube link** (optional paste) — the app extracts the video ID from the URL automatically
- If no YouTube link is provided, the entry is flagged as a **custom video** request, meaning the host will load it locally from their karaoke video generator

The submission is added to the queue as a new `queueEntry` with status `waiting`. The guest sees their entry appear in their queue view immediately.

---

### 4. Smart Queue & Priority Scoring

Each queue entry is assigned a priority score when submitted, calculated as:

- **Base score**: timestamp of submission (earlier = higher priority, all else equal)
- **Repeat penalty**: subtracted from priority for each time the singer has already sung during the session
- **New singer boost**: a one-time bonus applied to a singer's first submission if there are others who have already sung

The management view displays the computed order and allows the host to manually drag entries to override it at any time. Manual overrides persist until the host resets to auto-sort.

Duet requests are submitted as a single queue entry listing two singers (one registered, one selected from the party or entered manually). Both singers' "times sung" counts are incremented when the duet completes, and both receive the up-next notification.

---

### 5. Host Management View

The management view is fully responsive. On desktop (laptop connected to TV) it renders as a multi-panel layout with the queue, now playing controls, and singer list visible simultaneously. On mobile it collapses into a tabbed single-column layout with three tabs: **Queue**, **Now Playing**, and **Singers**. All functionality is identical between the two layouts — the mobile view is not a reduced version.

**Queue Panel**
- Full queue list with drag-to-reorder (touch-friendly drag handles on mobile)
- Each entry shows: singer name, song title, source type (YouTube / custom), dedication if present
- Actions per entry: promote to top, skip, remove
- "Mark as Custom" toggle if a guest submitted a YouTube link but the host wants to play a local version instead

**Now Playing Panel**
- Shows the active entry (singer name, avatar, song, source type)
- For YouTube songs: shows current playback status; no manual advance needed — song end is detected automatically
- For custom video songs: **"Song Finished — Advance"** button transitions to the Ready state for the next singer, and a separate **"Start Custom Video"** button transitions from Ready to Now Playing once the host has loaded the local video
- Break mode toggle
- End session button

**Singer Panel**
- List of all joined singers with times sung count
- Remove a singer from the session (they're excluded from future queue entries)

---

### 6. Display View (TV)

The display view is a fullscreen React component with five states driven entirely by Convex data:

**Idle / Waiting state**
Shown when no song is active and the queue is empty or the session just started. Shows the session name, QR code, and a prompt to join.

**Ready state**
Entered automatically when a song ends (YouTube) or manually via the management view Advance button (custom video). Shows the next singer's name in large text with their avatar, the song title, and a "Waiting for [Name] to start…" prompt. For YouTube songs, the display holds here until the singer taps their phone. For custom video songs, the display holds here indefinitely — the host uses the management view to proceed once the video is loaded and the singer is ready.

**Now Playing state — YouTube**
The YouTube IFrame embeds and autoplays the song. The singer's name, avatar, and song title are shown in a lower-third overlay. Live emoji reactions float up from the bottom of the screen as guests send them. The queue ticker scrolls along the bottom showing upcoming singers and their avatars.

**Now Playing state — Custom Video**
Instead of a YouTube embed, a full-screen card shows the singer's name, avatar, song title, and a "Custom video — playing now" banner. The host plays the video locally. Everything else (reactions, lower-third, queue ticker) behaves the same as the YouTube state.

**Break state**
Full-screen party graphic, session name, and an optional custom message set by the host.

---

### 7. Song End & Singer-Initiated Start

**Automatic transition (YouTube songs):** The YouTube IFrame API fires an `onStateChange` event when a video ends. The display view catches this and triggers a Convex mutation that archives the completed entry to `performanceHistory`, marks it done, and transitions the session to the Ready state for the next singer — all without any host input. The "Up Next" push notification is sent at this moment via the scheduled Convex action.

**Manual transition (custom video songs):** When the current entry is a custom video, the display holds on the Now Playing card after the host finishes playing it locally. The management view shows a prominent **"Song Finished — Advance"** button. Pressing it triggers the same mutation as above, transitioning to the Ready state for the next singer.

**Singer-initiated start (YouTube songs):** Once in the Ready state, the singer's phone view updates to show a large **"I'm Ready — Start the Song"** button alongside their avatar preview. Tapping it triggers a Convex mutation that transitions the session to Now Playing state and the YouTube embed loads and autoplays. This gives the singer time to get to the mic without the host needing to intervene.

**Singer-initiated start (custom video songs):** The Ready state displays the singer's name and avatar on the TV. The host loads the video locally and uses the management view **"Start Custom Video"** button to transition to Now Playing state, which updates the display card to the Now Playing — Custom Video state. The singer's phone shows a "Get ready — your song is starting!" message when this happens.

---

### 8. Queue Ticker (Display + Guest Views)

A horizontally scrolling bar at the bottom of the display view shows upcoming singers in order: "Next: [Name] → [Name] → [Name] → …". It updates in real time. The guest view shows the same ticker and additionally highlights the guest's own position with their slot number ("You're #3 in line").

---

### 9. Live Emoji Reactions

While a song is in Now Playing state, guests see a row of emoji buttons on their phone (e.g. 🔥 👏 😂 ❤️ 🎤). Tapping one writes a reaction document to Convex. The display view subscribes to reactions for the current queue entry and animates them floating up the screen in real time. Reactions are cleared when the song ends.

---

### 10. "You're Up Next" Notification

When the queue advances and a singer moves into second position, the queue advance mutation schedules a Convex action via `ctx.scheduler.runAfter` to send a Web Push notification to that singer's device. The notification reads "[Session Name]: You're up next! Get ready." The action handles VAPID signing and the outbound POST to the push endpoint entirely server-side in Convex Cloud. Guests must grant notification permission when joining; if they decline or their subscription lapses, the guest view shows a prominent in-app banner as a fallback since their queue position is always available reactively.

---

### 11. Dedication Messages

The song submission form includes an optional "Dedicate this to…" text field. If filled, the dedication appears on the display view's Now Playing lower-third: "♪ [Song] — dedicated to [Name]". It also appears on the management view's queue entry.

---

### 12. Personal History (Guest View)

The guest view has a "My Songs" tab showing every entry the guest has submitted during the session: song title, when they sang it, and the reaction emoji summary from that performance (e.g. "🔥×8 👏×12"). This data comes from `performanceHistory` filtered by singer ID.

---

### 13. Duet Support

The submission form has a "This is a duet" toggle. When enabled, instead of a free-text field a full-screen bottom sheet slides up showing all currently joined singers as selectable cards — each displaying their avatar and name. The guest taps their duet partner to select them. The list excludes the submitting guest themselves. A search/filter input at the top of the sheet allows quick filtering by name for larger parties. If the desired partner hasn't joined yet, a fallback "Enter a name manually" option is available at the bottom of the sheet for walk-up guests.

The queue entry displays both singers' names and avatars. On the display view, both avatars and names appear together on the Ready state screen and in the lower-third during the performance. Both singers' times-sung counts increment on completion, and both singers receive the "You're up next" notification when the entry reaches the front of the queue.

---

### 14. Analytics Dashboard (Management View)

A collapsible panel or modal in the management view showing session stats computed from `performanceHistory` and `singers`:

- **Total songs sung** this session
- **Singer leaderboard**: ranked by times sung, with song titles listed
- **Most reacted performance**: entry with highest total reaction count, broken down by emoji
- **Average reactions per song**
- **Song source breakdown**: X YouTube songs, Y custom videos
- **Timeline**: chronological list of all completed performances

Analytics update in real time as the session progresses via Convex reactive queries.

---

### 15. Break Mode

The host can toggle break mode from the management view at any time. When active:
- The display view switches to the Break state
- The queue pauses (guests can still submit songs)
- An optional custom message (e.g. "Back in 10 minutes!") is shown on the display
- The management view shows a prominent "End Break" button

---

## Real-Time Sync Architecture

All client views subscribe to Convex queries. No polling, no websocket management code — Convex handles all of it. Key reactive query patterns:

- **Display view** subscribes to: current session state, active queue entry, next queue entry, live reactions for active entry, upcoming queue for ticker, singer avatar configs for all displayed names
- **Management view** subscribes to: full queue, singer list (with avatars), session state, analytics aggregates — same data regardless of whether accessed from laptop or phone
- **Guest view** subscribes to: their own queue entry status, full queue order with avatars (for ticker and position), their performance history, session state (to show the Start button or ready message when they're up), full singer list (to populate the duet picker)

Mutations (writes) are Convex server functions that enforce business logic: priority recalculation on new submissions, status transitions, reaction rate limiting, etc.

---

## Notification Architecture

When a guest joins, the app requests Web Push permission and registers a Service Worker. The browser returns a push subscription object (endpoint URL + encryption keys) which is immediately saved to the singer's Convex document.

**Trigger flow:** When the host presses Advance, a Convex mutation updates the queue state and identifies which singer has just moved into the second position. The mutation calls `ctx.scheduler.runAfter(0, api.notifications.sendUpNextPush, { singerId })` to schedule the notification action asynchronously without blocking the queue state update.

**Convex action:** The `sendUpNextPush` action runs server-side in Convex Cloud. It reads the singer's push subscription from the database, constructs a Web Push payload with the session name and a "You're up next — get ready!" message, signs the request using VAPID authentication, and POSTs directly to the push endpoint URL. Because Convex actions can make arbitrary outbound HTTP requests, no third-party notification service or Cloudflare Worker relay is needed.

**VAPID keys:** Generated once and stored as Convex environment variables (set via the Convex dashboard). The private key never leaves the server — only the public key is exposed to the frontend for Service Worker registration. This is set up once at project init and never touches the Cloudflare Pages environment.

**Fallback:** If the guest declined notification permission or their subscription has expired, the action catches the error gracefully. The guest view polls their queue position reactively via Convex and shows a prominent in-app banner when they reach second position as a fallback.

---

## Song Source Handling

| Guest submits | System behavior |
|---|---|
| YouTube URL | Video ID extracted, entry marked `youtube`, displays embed on TV |
| Just a song title | Entry marked `custom`, display shows name card, host loads video locally |

The management view can toggle any entry between `youtube` and `custom` after submission, in case the host wants to swap to a local version even if the guest pasted a YouTube link.

---

## Deployment Plan

1. Scaffold with Vite + React + Convex CLI
2. Set up Convex project, define schema, generate VAPID keys and store in Convex environment variables
3. Build guest join + submission flow first (validates the core loop)
4. Build management view queue controls
5. Build display view states
6. Add priority scoring logic in Convex mutations
7. Add emoji reactions and notification system (Service Worker + Convex action)
8. Add analytics dashboard
9. QA across three simultaneous devices (TV tab, laptop, phone)
10. Deploy frontend to Cloudflare Pages (connect GitHub repo, set `vite build` as build command, `dist` as output directory, set `VITE_CONVEX_URL` environment variable in Pages dashboard), Convex to Convex Cloud

---

## Out of Scope (Potential Future Features)

- Multi-session support (multiple rooms simultaneously)
- Persistent accounts across parties
- Spotify / Apple Music integration
- Host-curated song library with search
- Shot wheel / party mini-games
- End-of-night recap shareable image

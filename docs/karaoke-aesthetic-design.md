# Karaoke Party App — Aesthetic Design Document

## Creative Direction

**Concept: "Karaoke Palace"**
The Commodore 64 meets 1980s broadcast television. Think the opening credits of a Saturday morning game show that ran on a machine with 64KB of RAM — stripes, bold geometry, pixel-perfect type, and a color palette that feels simultaneously vintage and electric. Clean enough to be readable across a room, loud enough to feel like a party.

The aesthetic has one rule: **everything is intentional, nothing is accidental.** The stripes are always in the same order. The fonts never mix casually. The colors don't wander. The result should feel like a designed artifact from an alternate 1985 where the Commodore 64 became the dominant entertainment platform and someone built the world's coolest karaoke machine on it.

---

## Color Palette

All colors defined as CSS custom properties on `:root`.

### Base

| Token | Hex | Role |
|---|---|---|
| `--c64-blue` | `#4040b0` | Primary background — the C64's signature deep royal blue |
| `--c64-blue-dark` | `#2a2a7a` | Deeper variant for layering, cards, panels |
| `--c64-blue-light` | `#6060d0` | Hover states, subtle highlights |
| `--c64-cream` | `#b0b0d0` | Primary text on dark backgrounds — the classic C64 text color |
| `--c64-white` | `#e8e8f0` | High-emphasis text, song titles, names on display |
| `--c64-border` | `#7070a0` | Dividers, input borders, subtle separators |

### The Stripe Palette

Six colors, always used in this fixed order left-to-right or top-to-bottom. Never shuffled. The stripe sequence is a brand element.

| Token | Hex | Name |
|---|---|---|
| `--stripe-1` | `#f03070` | Broadcast Pink |
| `--stripe-2` | `#f0a000` | Tape Deck Amber |
| `--stripe-3` | `#f0f000` | Phosphor Yellow |
| `--stripe-4` | `#30d060` | Floppy Lime |
| `--stripe-5` | `#30c0f0` | Datasette Cyan |
| `--stripe-6` | `#c030f0` | Synthwave Purple |

### Functional

| Token | Hex | Role |
|---|---|---|
| `--action-primary` | `#f03070` | Primary buttons, CTAs — Broadcast Pink |
| `--action-confirm` | `#30d060` | Confirm, ready, success states — Floppy Lime |
| `--action-warn` | `#f0a000` | Skip, caution states — Tape Deck Amber |
| `--action-danger` | `#f03070` | Destructive actions |
| `--overlay-scanline` | `rgba(0,0,0,0.04)` | Scanline texture overlay |

---

## Typography

Two typefaces. They never swap roles.

### Display Face — "C64 Pro Mono" (or fallback stack)
Used for: TV display text, singer names, song titles, section headers, the stripe label bands, avatar names.

```
font-family: 'C64 Pro Mono', 'Press Start 2P', 'Courier New', monospace;
```

Loaded via Google Fonts (`Press Start 2P`) as the primary web-safe fallback if C64 Pro Mono isn't bundled. Characters are wide, blocky, and immediately recognizable. All caps preferred for hero text. Letter-spacing at `0.05em` minimum.

### UI Face — "Outfit"
Used for: all phone UI, form labels, input fields, queue entries, management view body text, analytics numbers, notification banners.

```
font-family: 'Outfit', sans-serif;
```

Loaded via Google Fonts. Clean geometric sans that reads well at 14px on a phone screen. Weights used: 400 (body), 600 (labels, counts), 700 (emphasis). Pairs with the display face by contrast — functional where the display face is theatrical.

### Type Scale

| Role | Font | Size | Weight | Case |
|---|---|---|---|---|
| TV hero (singer name) | Display | `clamp(4rem, 10vw, 8rem)` | — | ALL CAPS |
| TV song title | Display | `clamp(1.5rem, 4vw, 3rem)` | — | Title Case |
| TV lower-third label | Display | `1rem` | — | ALL CAPS |
| Section header | Display | `1.25rem` | — | ALL CAPS |
| UI body | Outfit | `1rem` | 400 | Sentence |
| UI label | Outfit | `0.875rem` | 600 | ALL CAPS |
| UI count/number | Outfit | `1.5rem` | 700 | — |
| Button | Outfit | `0.9375rem` | 700 | ALL CAPS |

---

## The Stripe System

Stripes are the most recognizable visual element and appear in four contexts:

### 1. The Header Band
Every view has a stripe band at the very top — six equal-width vertical columns, each in stripe order, full width of the viewport, `8px` tall on phone, `12px` tall on TV/desktop. It's the first thing you see and the thing that makes every screen feel like the same app.

### 2. Section Dividers
Instead of plain horizontal rules, section breaks use a miniature version of the stripe band — full width, `4px` tall.

### 3. Active State Accents
When a queue entry is "now singing," its card gets a left border `6px` wide in `--stripe-1` (Broadcast Pink). When it's "ready/up next," the border is `--stripe-5` (Datasette Cyan).

### 4. TV Display State Indicator
During Now Playing state, the bottom stripe band pulses — a slow CSS `@keyframes` animation shifts the opacity of each stripe stripe in sequence, creating a slow color-wave effect that reads from across the room.

---

## Surface & Depth System

Three surface levels, all on the C64 blue spectrum:

| Level | Token | Use |
|---|---|---|
| Base | `--c64-blue` | Page/screen background |
| Raised | `--c64-blue-dark` | Cards, panels, queue entry rows |
| Inset | `#1e1e5a` | Input fields, code blocks, inactive tabs |

Borders use `--c64-border` at `1px`. No shadows — depth is created purely through color value difference, staying true to the flat, hardware-constrained aesthetic.

---

## Texture & Effects

### Scanline Overlay
A full-viewport `::before` pseudo-element on the display view applies a repeating linear gradient simulating CRT scanlines:

```
background: repeating-linear-gradient(
  to bottom,
  var(--overlay-scanline) 0px,
  var(--overlay-scanline) 1px,
  transparent 1px,
  transparent 3px
);
pointer-events: none;
```

Applied only to the TV display view at `opacity: 0.6`. Subtle on a modern LCD — evocative without being distracting.

### Pixel Border Effect
Key cards and the "I'm Ready" button use a CSS `box-shadow` stack to simulate a chunky pixel border — offset shadows in two directions creating a 3D extruded effect reminiscent of C64-era UI chrome.

### Text Glow
The TV display singer name gets a `text-shadow` in the singer's stripe color (cycled by order in the queue) — a soft two-layer glow at `0 0 20px` and `0 0 60px`. Readable and dramatic from across the room.

---

## Animation Language

### State Transitions (TV Display)
Between display states, a stripe-wipe transition plays: six colored bars slide in from left to right in sequence (staggered `50ms` apart), hold for `100ms`, then slide out right to reveal the new state. Duration: `~600ms` total. Implemented as a full-viewport overlay `<div>` with CSS keyframes, triggered by state change in React.

### Text Type-On
When the Ready state appears showing the next singer's name, each character types on one at a time at `60ms` per character, with a blinking block cursor during and after. Implemented as a simple JS interval driving a React state substring, styled with the display font.

### Emoji Reactions
Reaction emojis float up from the bottom of the TV display in random horizontal lanes. Each uses a CSS animation: translate from bottom to -120% viewport height over `2.5s` with a slight left/right wobble via `rotate` keyframes. Fade out in the final 20% of travel. Multiple simultaneous reactions stack naturally.

### Queue Position Change
When a guest's queue position improves, their position number animates — the old number slides up and fades out while the new number slides up from below. Implemented with CSS `@keyframes slideUpFade`.

### Button Press
The "I'm Ready" button on the guest view uses the pixel border effect and responds to press with a `translateY(3px)` shift and reduced box-shadow depth, simulating a physical key press. `transition: 80ms`.

---

## View-Specific Treatments

### TV Display View
Full bleed `--c64-blue` background with scanline overlay. Stripe header band `12px`. Stripe footer band `12px` with pulse animation during Now Playing. Singer name centered, hero type size, all caps, text glow. Song title below in smaller display font. Lower-third overlay: a `--c64-blue-dark` bar pinned to bottom with stripe left-border accent, singer name and song in display font. Queue ticker scrolls below lower-third in Outfit 600. QR code on idle screen rendered in `--c64-cream` on `--c64-blue-dark` with a display font label.

### Guest Phone View
Stripe header band `8px`. `--c64-blue` background. Outfit throughout for readability at small sizes. The "I'm Ready" button is full-width, `64px` tall, `--action-confirm` background, display font label, pixel border effect. Queue position shown as a large Outfit 700 number with "You're #N" label above. Emoji reaction buttons in a fixed bottom bar — six large touch targets in the six stripe colors, each showing its emoji.

### Management View — Desktop
Three-column layout. Left column: queue list. Center: now playing controls. Right: singer list. Stripe band header. Panel backgrounds in `--c64-blue-dark`. Column headers in display font, all caps, with stripe divider below.

### Management View — Mobile
Tabbed layout. Tab bar at bottom with three tabs. Active tab indicated by `--stripe-1` underline and `--c64-white` label. Same surface colors as desktop.

### Avatar Creator (Join Flow)
Full-screen step with `--c64-blue` background. Avatar preview centered and large. Category selectors as horizontal scroll rows of rounded square option tiles — `64px × 64px`, `--c64-blue-dark` background, `--c64-border` border, active state gets `--stripe-1` border `3px`. All avatar colors drawn from the stripe palette plus the base C64 palette — no outside colors introduced.

### Join / Name Entry
Minimal — centered card on `--c64-blue`. Display font "ENTER YOUR NAME" label. Outfit input field. Continue button in `--action-primary`. The party name shown at top in display font with stripe divider below.

---

## Iconography & Avatars

### Icons
No icon library. All UI icons are simple geometric SVGs drawn on a `24×24` grid in a pixel-friendly style — straight lines, 45° diagonals, no curves. Stroke color inherits from text color. Consistent `2px` stroke weight.

### Avatars
Layered SVG system. All shapes are rectangles, squares, and simple polygons — no bezier curves — keeping them authentically pixel-art adjacent even though they're vector. The palette for all avatar parts is restricted to the stripe palette plus `--c64-cream` and `--c64-white`. Avatar layers in order: background fill, body shape, face base, eyes, mouth, hair/hat, accessory. Each layer is a separate `<g>` in the SVG driven by the config object. Final avatar renders at `128×128` for join flow, `32×32` for queue ticker, `64×64` for Ready state.

---

## Responsive Breakpoints

| Breakpoint | Width | Context |
|---|---|---|
| `mobile` | < 640px | Guest phone view, host mobile management |
| `tablet` | 640px–1023px | Unlikely but handled gracefully |
| `desktop` | ≥ 1024px | Host laptop management view |
| `display` | ≥ 1280px | TV display view (always assumed landscape) |

The display view is always accessed at TV resolution and is never designed for mobile — it uses viewport-relative units (`vw`, `vh`, `clamp`) exclusively for type and spacing.

---

## Sound Design Notes *(optional enhancement)*

If ambient audio is added later, the aesthetic direction suggests: short 8-bit SFX for button presses and state transitions (not MIDI — actual C64 SID-chip style square wave tones), and a brief rising arpeggio for the stripe-wipe state transition. All SFX optional and host-toggleable.

---

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use the stripe sequence in fixed order | Shuffle or randomize stripe colors |
| Use display font for hero/theatrical moments | Use display font for body copy on phones |
| Use flat color depth (value shifts only) | Add drop shadows or blurs |
| Keep scanlines subtle | Crank scanline opacity above 0.7 |
| Animate with purpose (state changes, feedback) | Add idle animations that serve no function |
| Restrict avatar colors to the defined palette | Introduce arbitrary new colors in avatars |
| Let the TV view be dramatic and big | Scale TV-sized type down to phone views |
| Use pixel border effect sparingly on key actions | Apply pixel borders to every element |

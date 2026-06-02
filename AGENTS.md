# Lyria Radio Alarm Clock — Agent Guide

## Project Overview

**Lyria Radio Alarm Clock** (also referred to as *Lyria Radio*) is an AI-powered, retro-styled alarm clock web application. It composes or searches for custom thematic songs matched to the user's calendar agenda and local weather conditions, then plays them at the configured alarm time.

The app is designed as a **single-page client-side application** built with React and TypeScript, bundled with Vite. It is intended to run inside **Google AI Studio** (evidenced by `metadata.json` and the `window.aistudio` API integration for API key management).

Key capabilities:
- Uses **Google GenAI** (`@google/genai`) to search for real-world songs via Google Search grounding, then generates a custom performance prompt.
- Generates actual audio via the **`lyria-3-pro-preview`** music model, falling back to **`gemini-3.1-flash-tts-preview`** (TTS with `prebuiltVoiceConfig`) if music generation fails.
- Offers a **YouTube embed fallback** mode with a curated dictionary of embeddable video IDs per genre.
- Fetches real-time weather from **Open-Meteo** (free, no API key required) using browser geolocation.
- Supports 10 visual themes, 10 music genre presets, a dual agenda planner, progressive volume ramping, and a 60-second pre-warm engine.

---

## Technology Stack

| Layer | Technology | Version (approx) |
|---|---|---|
| Framework | React | ^19.2.3 |
| Language | TypeScript | ~5.8.2 |
| Build Tool | Vite | ^6.2.0 |
| CSS Framework | Tailwind CSS | via CDN (see `index.html`) |
| Icons | lucide-react | ^0.562.0 |
| AI SDK | @google/genai | ^1.34.0 |
| Fonts | Orbitron, Share Tech Mono | Google Fonts CDN |

---

## Project Structure

```
├── components/
│   ├── Clock.tsx          # Digital clock with AM/PM/alarm indicators
│   └── Visualizer.tsx     # 16-bar LED audio visualizer (simulated)
├── services/
│   ├── weather.ts         # Open-Meteo API client
│   └── genai.ts           # Google GenAI integration (song search + generation)
├── App.tsx                # Main application component (~1300 lines)
├── index.tsx              # React root mount
├── index.html             # HTML entry point (Tailwind CDN, import map, fonts)
├── index.css              # (empty — styles are inlined or Tailwind-based)
├── types.ts               # Shared TypeScript interfaces
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # NPM manifest
├── metadata.json          # AI Studio app metadata
├── LEARNINGS.md           # Project knowledge base / feature changelog
└── README.md              # Human-facing quickstart
```

### Path Aliases
- `@/` maps to the project root (`./`). Used in imports like `import { fetchWeather } from './services/weather';`.

---

## Build and Run Commands

All commands use **npm**:

```bash
# Install dependencies
npm install

# Start development server (port 3000, host 0.0.0.0)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Required Environment Variable

Create `.env.local` in the project root and set:

```bash
GEMINI_API_KEY=your_key_here
```

Vite injects this into the client bundle via `define` in `vite.config.ts`:
- `process.env.API_KEY`
- `process.env.GEMINI_API_KEY`

Because this is a **client-only SPA**, the API key is necessarily exposed in the browser bundle when running locally. In AI Studio, the key is managed by the host environment via the `window.aistudio` bridge.

---

## Code Organization & Module Divisions

### `App.tsx` (Main Component)
This is the heart of the application. It is a large monolithic component that manages:
- Global `AppState` (alarm time, agenda, calendar, weather, playback status, etc.)
- 10 selectable visual themes with CSS custom property injection
- Alarm trigger loop (`setInterval` every 1 second)
- Pre-warm logic (generates audio 60 seconds before alarm)
- Progressive volume ramp-up (`sunrise_progressive` mode)
- Calendar/agenda dual-sync (structured interactive list ↔ raw textarea)
- Genre station preset dial board
- Settings drawer (theme, volume, loudness mode, pre-warm toggle, blacklist)
- Playback orchestration (Lyria audio vs. YouTube iframe embed)

### `components/Clock.tsx`
A blinking digital clock showing HH:MM with AM/PM and alarm-active indicator lamps.

### `components/Visualizer.tsx`
A simulated 16-column LED bar visualizer that animates via `requestAnimationFrame`. It has three modes:
- **Playing**: randomized wave + beat simulation
- **Generating**: smooth sine-wave animation
- **Idle**: decay to zero

### `services/weather.ts`
Fetches current weather from Open-Meteo using latitude/longitude. Returns a fallback (20°C, clear) on failure.

### `services/genai.ts`
Two-stage pipeline:
1. **`generateMusicalPrompt`** — uses `gemini-3.5-flash` with Google Search grounding to find a real song matching context (weather, agenda, time, genre). Returns structured JSON with song metadata, a musical prompt, and lyrics.
2. **`generateSong`** — streams audio from `lyria-3-pro-preview`. If that fails (e.g., permission denied), falls back to `gemini-3.1-flash-tts-preview` with `prebuiltVoiceConfig: { voiceName: 'Fenrir' }`.

Both functions pass `User-Agent: 'aistudio-build'` in `httpOptions`.

---

## Type System (`types.ts`)

Key types:
- `AppState` — full application state shape
- `CalendarItem` — agenda event with `time`, `title`, `vibe`, `active`
- `WeatherData` — temperature, WMO condition code, isDay flag
- `MusicGenre` — union of 10 genres (`auto`, `synthwave`, `acoustic`, `lofi`, `rock`, `classical`, `jazz`, `pop`, `ambient`, `hiphop`)
- `PlaybackSource` — `'youtube' | 'lyria'`
- `SearchedSongMetadata` — title, artist, explanation, theme, style, optional YouTube ID

---

## Development Conventions

1. **Language**: All code, comments, and UI labels are in **English**.
2. **Naming**: Retro radio terminology is used heavily in IDs and class names (`speaker-deck`, `interface-deck`, `face-screen`, `radio-station-pushed-dials`, `deck-btn-toggle`, etc.).
3. **Styling**:
   - Tailwind utility classes are used for layout and typography.
   - CSS custom properties (`--radio-case`, `--radio-lit`, `--body-bg`, etc.) are injected dynamically via `document.documentElement.style.setProperty` for theming.
   - Custom keyframe animations are injected via an inline `<style>` block inside `App.tsx`.
4. **State Persistence**: User preferences (theme, volume, loudness mode, pre-warm toggle, blacklist) are stored in `localStorage` with keys prefixed `lyria_`.
5. **No Testing Framework**: There are no tests, test runners, or linting configurations in this project.
6. **No Backend**: The app is entirely client-side. Weather is fetched from a free third-party API; AI calls go directly to Google's API.

---

## Key Runtime Behaviors

### Alarm Trigger Flow
1. User sets alarm time and activates it.
2. Every second, `checkAlarm` compares current time to alarm time.
3. If **Pre-Warm** is enabled, generation starts at `alarmTime - 1 minute`.
4. At the exact alarm time:
   - If pre-warmed → transitions `ready → playing` instantly.
   - If not pre-warmed → triggers `handleGenerateAndPlay` directly.
5. Audio plays via `<audio>` element (Lyria) or YouTube iframe embed.

### Autoplay Handling
Browsers block autoplay. The app catches `audio.play()` rejection and displays a full-overlay button: **"Broadcast Muted (Click to Listen)"**.

### YouTube Fallback Mode
When `playbackSource === 'youtube'`, the app skips Lyria generation and embeds a YouTube iframe using a grounded `youtubeVideoId` or a fallback ID from `REPUTABLE_YOUTUBE_FALLBACKS`. A "Launch Trans-Beam Unlocked" link opens the video directly in a new tab to bypass iframe restrictions.

---

## Security Considerations

- **API Key Exposure**: `GEMINI_API_KEY` is embedded into the client bundle. This is acceptable for local development and AI Studio hosting, but unsuitable for public production deployment without a proxy.
- **Iframe Embedding**: The app renders third-party YouTube iframes with `allow="autoplay"`.
- **Geolocation**: The app requests browser geolocation via `navigator.geolocation` (declared in `metadata.json` under `requestFramePermissions`).
- **No Input Sanitization**: Agenda text and blacklist inputs are passed directly into AI prompts. There is no XSS output sanitization on AI-generated lyrics before rendering.

---

## AI Studio Integration Notes

- `metadata.json` declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, meaning AI Studio handles API key provisioning.
- The UI includes an **"API KEY"** button that calls `window.aistudio.openSelectKey()` if available.
- `index.html` includes an import map pointing to `esm.sh` for React and the GenAI SDK, which AI Studio may use when serving the app.

---

## Common Gotchas for Agents

- **`index.css` is empty** — do not expect global styles there. Most styling is Tailwind + inline styles + CSS custom properties.
- **App.tsx is ~1300 lines** — be cautious when editing; it is monolithic. Extracting logic into helper functions or custom hooks is often a good idea.
- **The `process.env` references are Vite-injected** — they are not Node.js `process.env` at runtime; Vite replaces them statically at build time.
- **Model names are hardcoded** in `services/genai.ts` — changing them requires editing that file directly.
- **Weather codes come from WMO** — the `WEATHER_CODES` map in `types.ts` only covers a subset. Unknown codes display as "Clear".

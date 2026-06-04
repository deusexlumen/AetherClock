# AetherClock / Lyria Radio Alarm Clock — Agent Guide

## Project Overview

**AetherClock** (also referred to as *Lyria Radio Alarm Clock* or *Lyria Radio*) is an AI-powered, retro-styled alarm clock web application. It curates thematic morning and night songs matched to the user's calendar agenda and local weather conditions, then plays them at the configured alarm time.

The app is designed as a **single-page client-side application** built with React 19 and TypeScript, bundled with Vite. It can run both locally and inside **Google AI Studio** (evidenced by `metadata.json` and the `window.aistudio` API integration for API key management).

Key capabilities:
- Uses **Google GenAI** (`@google/genai`) to search for real-world songs via Google Search grounding, then generates a custom performance prompt.
- Generates actual audio via the **`lyria-3-pro-preview`** music model, falling back to **`gemini-3.1-flash-tts-preview`** (TTS with `prebuiltVoiceConfig`) if music generation fails.
- Offers a **YouTube embed primary** mode with a curated dictionary of embeddable video IDs per genre, plus a smart playlist system (1–5 tracks).
- Generates a personalized **voice briefing** (time, weather, agenda) via Gemini TTS with selectable voices (`Fenrir`, `Kore`, `Leda`).
- Fetches real-time weather from **Open-Meteo** (free, no API key required) using browser geolocation.
- Supports **10 visual themes**, 3 of which feature full-screen animated **Babylon.js WebGL** backgrounds (Vaporwave, Space Odyssey, Sonar Marine).
- Supports **10 music genre presets**, a dual agenda planner, progressive volume ramping, a 60-second pre-warm engine, and offline fallback audio.
- Works as a **Progressive Web App (PWA)** with service worker caching, install prompts, and push notifications.

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
| 3D Engine | @babylonjs/core | ^9.10.1 |
| Fonts | Orbitron, Share Tech Mono | Google Fonts CDN |

Note: `@babylonjs/core` is listed in both `optimizeDeps.include` and `build.rollupOptions.external` in `vite.config.ts`. The project also depends on `@babylonjs/loaders`, `@babylonjs/materials`, `@babylonjs/post-processes`, and `reactylon` (^0.0.75), though `reactylon` is not currently used in the main component tree.

---

## Project Structure

```
├── components/
│   ├── themes/
│   │   ├── BabylonCanvas.tsx      # WebGL canvas wrapper for Babylon.js themes
│   │   └── scenes/
│   │       ├── vaporwave.ts       # Vaporwave Cyber-Luxe WebGL scene
│   │       ├── space.ts           # Space Odyssey WebGL scene
│   │       └── submarine.ts       # Sonar Marine WebGL scene
│   ├── Clock.tsx                  # Digital clock with AM/PM/alarm indicators
│   ├── Visualizer.tsx             # 32-bar canvas audio visualizer (FFT + simulated)
│   ├── PlaylistViewer.tsx         # Playlist queue UI with prev/next controls
│   └── PWAInstallPrompt.tsx       # Banner prompting users to install the PWA
├── services/
│   ├── weather.ts                 # Open-Meteo API client
│   ├── genai.ts                   # Google GenAI integration (song search + Lyria generation)
│   ├── playlist.ts                # YouTube fallback dictionary & playlist builder
│   ├── voiceBriefing.ts           # TTS voice briefing generation
│   ├── ttsPlayer.ts               # Simple HTMLAudioElement wrapper for base64 TTS playback
│   ├── pwa.ts                     # Service worker registration, notifications, install prompts
│   └── offlineAudio.ts            # Offline fallback alarm (MP3 + synthesized siren)
├── App.tsx                        # Main application component (~2000 lines)
├── index.tsx                      # React root mount
├── index.html                     # HTML entry point (Tailwind CDN, import map, fonts, YouTube API)
├── index.css                      # Empty — styles are inlined, Tailwind-based, or CSS custom properties
├── types.ts                       # Shared TypeScript interfaces
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # NPM manifest
├── metadata.json                  # AI Studio app metadata
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker (cache + push notifications)
│   ├── icon.svg                   # App icon
│   └── assets/
│       └── fallback-alarm.mp3     # Offline fallback alarm tone
├── LEARNINGS.md                   # Project knowledge base / feature changelog
└── README.md                      # Human-facing quickstart
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
This is the heart of the application (~2000 lines). It manages:
- Global `AppState` (alarm time, agenda, calendar, weather, playback status, etc.)
- 10 selectable visual themes with CSS custom property injection
- Alarm trigger loop (`setInterval` every 1 second)
- Pre-warm logic (generates content 60 seconds before alarm)
- Progressive volume ramp-up (`sunrise_progressive` mode)
- Calendar/agenda dual-sync (structured interactive list ↔ raw textarea)
- Genre station preset dial board
- Settings drawer (theme, volume, loudness mode, pre-warm toggle, blacklist, LLM config, voice briefing config, playlist config, notifications, offline fallback, screen saver timeout)
- Playback orchestration (voice briefing → playlist → YouTube iframe embed, or Lyria audio)
- Screen saver timer (activates after configurable idle seconds)
- Real audio visualizer connection via `AudioContext` / `AnalyserNode`

### `components/Clock.tsx`
A blinking digital clock showing HH:MM with AM/PM and alarm-active indicator lamps. Updates every second.

### `components/Visualizer.tsx`
A 32-column canvas bar visualizer. It has three modes:
- **Real FFT**: When an `AnalyserNode` is connected and active, it renders actual frequency data.
- **Simulated**: Genre-specific wave animations when playing YouTube (cross-origin prevents FFT access).
- **Idle**: Decay to zero.
During generation states, it shows a "Tuning..." pulsing indicator instead of the canvas.

### `components/PlaylistViewer.tsx`
Displays the current playlist queue, highlights the active track, shows voice briefing status, and provides prev/next skip buttons.

### `components/PWAInstallPrompt.tsx`
A fixed-bottom banner that appears when the browser emits a `beforeinstallprompt` event. Allows one-click PWA installation or dismissal (persisted in `localStorage`).

### `components/themes/BabylonCanvas.tsx`
Lazy-loads Babylon.js scene builders for the three premium WebGL themes (`vaporwave`, `space`, `submarine`). Runs a manual `requestAnimationFrame` render loop, feeds optional FFT data into the scene, and cleans up engine/scene on unmount.

### `services/weather.ts`
Fetches current weather from Open-Meteo using latitude/longitude. Returns a fallback (20°C, clear) on failure.

### `services/genai.ts`
Two-stage pipeline:
1. **`generateMusicalPrompt`** — uses `gemini-3.5-flash` (or configured text model) with Google Search grounding to find a real song matching context (weather, agenda, time, genre). Returns structured JSON with song metadata, a musical prompt, and lyrics. Includes regex-based fallback parsing if JSON parse fails, and a hardcoded fallback song if the API call fails entirely.
2. **`generateSong`** — streams audio from `lyria-3-pro-preview` with exponential backoff retry (up to 5 attempts). If that fails (e.g., permission denied), falls back to `gemini-3.1-flash-tts-preview` with `prebuiltVoiceConfig: { voiceName: 'Fenrir' }`.

Both functions pass `User-Agent: 'lyria-radio-client'` in `httpOptions`.

### `services/playlist.ts`
- `REPUTABLE_YOUTUBE_FALLBACKS`: Curated embeddable video IDs per genre.
- `generatePlaylist`: Fetches multiple tracks in parallel (capped at 3 to limit API calls), deduplicates by video ID, and pads with fallbacks if needed.
- `buildEmbedUrl`: Constructs YouTube iframe embed URLs with autoplay and modest branding.

### `services/voiceBriefing.ts`
Builds a short textual briefing from weather, agenda, and alarm time, then synthesizes it via Gemini TTS using the configured voice (`Fenrir`, `Kore`, or `Leda`). Returns base64 audio.

### `services/ttsPlayer.ts`
A small class wrapping `HTMLAudioElement` to play base64-encoded TTS audio and fire an `onEnded` callback.

### `services/pwa.ts`
Handles service worker registration, install prompt capture, notification permission requests, and alarm notifications (via Service Worker postMessage or direct `Notification`).

### `services/offlineAudio.ts`
Plays a local MP3 fallback tone when offline. If the MP3 fails, falls back to a synthesized Web Audio API siren with oscillators and gain pulsing.

---

## Type System (`types.ts`)

Key types:
- `AppState` — full application state shape (alarm, calendar, weather, status, playlist, configs, etc.)
- `CalendarItem` — agenda event with `id`, `time`, `title`, `vibe`, `active`
- `WeatherData` — temperature, WMO condition code, isDay flag
- `MusicGenre` — union of 10 genres (`auto`, `synthwave`, `acoustic`, `lofi`, `rock`, `classical`, `jazz`, `pop`, `ambient`, `hiphop`)
- `PlaybackSource` — `'youtube' | 'lyria'`
- `SearchedSongMetadata` — title, artist, explanation, theme, style, optional YouTube ID
- `PlaylistTrack` — title, artist, youtubeVideoId, whyExplanation
- `PlaylistConfig` — enabled, trackCount, shuffle, crossfadeSeconds
- `VoiceBriefingConfig` — enabled, voiceName, includeWeather, includeAgenda, includeTime, customGreeting
- `LLMConfig` — textModel, ttsModel
- `AppStatus` — `'idle' | 'generating_prompt' | 'generating_music' | 'generating_briefing' | 'ready' | 'playing_briefing' | 'playing' | 'error'`

---

## Development Conventions

1. **Language**: All code, comments, and UI labels are in **English**.
2. **Naming**: Retro radio terminology is used heavily in IDs and class names (`speaker-deck`, `interface-deck`, `face-screen`, `radio-station-pushed-dials`, `deck-btn-toggle`, etc.).
3. **Styling**:
   - Tailwind utility classes are used for layout and typography.
   - CSS custom properties (`--radio-case`, `--radio-lit`, `--body-bg`, etc.) are injected dynamically via `document.documentElement.style.setProperty` for theming.
   - Custom keyframe animations are injected via an inline `<style>` block inside `App.tsx`.
   - `index.css` is empty; do not add global styles there.
4. **State Persistence**: User preferences are stored in `localStorage` with keys prefixed `lyria_`:
   - `lyria_theme`, `lyria_volume`, `lyria_loudness`, `lyria_prewarm`, `lyria_blacklist`, `lyria_voice_briefing`, `lyria_playlist`, `lyria_llm`, `lyria_notifications`, `lyria_offline_fallback`, `lyria_screensaver_timeout`, `lyria_install_dismissed`.
5. **No Testing Framework**: There are no tests, test runners, or linting configurations in this project.
6. **No Backend**: The app is entirely client-side. Weather is fetched from a free third-party API; AI calls go directly to Google's API.
7. **TypeScript Config**: `tsconfig.json` sets `target: "ES2022"`, `experimentalDecorators: true`, and `useDefineForClassFields: false` to support Babylon.js decorators.

---

## Key Runtime Behaviors

### Alarm Trigger Flow
1. User sets alarm time and activates it.
2. Every second, `checkAlarm` compares current time to alarm time.
3. If **Pre-Warm** is enabled, generation starts at `alarmTime - 1 minute`.
4. At the exact alarm time:
   - If offline and **Offline Fallback** is enabled → plays local siren/MP3 immediately.
   - If pre-warmed → transitions `ready → playing` instantly (starts playback sequence).
   - If not pre-warmed → triggers `handleGenerateAndPlay` directly.
5. Playback sequence:
   - If voice briefing is enabled → plays briefing first, then starts playlist track 0.
   - Otherwise → starts playlist track 0 immediately.
   - YouTube tracks auto-advance on `YT.PlayerState.ENDED`.

### Autoplay Handling
Browsers block autoplay. The app catches `audio.play()` rejection and displays a full-overlay button: **"Broadcast Muted (Click to Listen)"**. For YouTube mode, the iframe uses `autoplay=1` but may still require user interaction.

### YouTube Playback Mode
When `playbackSource === 'youtube'`, the app skips Lyria generation and embeds a YouTube iframe using a grounded `youtubeVideoId` or a fallback ID from `REPUTABLE_YOUTUBE_FALLBACKS`. The app initializes the YouTube IFrame API player, listens for `onStateChange` to advance tracks, and destroys the player when switching away from YouTube mode.

### Offline Fallback
If the device is offline at alarm time and offline fallback is enabled, the app bypasses all AI/YouTube logic and immediately plays a local alarm tone (`/assets/fallback-alarm.mp3`) or a synthesized Web Audio siren.

### Screen Saver
After a configurable idle timeout (default 30s), a screen saver overlay activates when the app status is `idle` or `ready`. User interaction (mouse, keyboard, touch, scroll) resets the timer.

---

## Security Considerations

- **API Key Exposure**: `GEMINI_API_KEY` is embedded into the client bundle. This is acceptable for local development and AI Studio hosting, but unsuitable for public production deployment without a proxy.
- **Iframe Embedding**: The app renders third-party YouTube iframes with `allow="autoplay"`.
- **Geolocation**: The app requests browser geolocation via `navigator.geolocation`.
- **No Input Sanitization**: Agenda text and blacklist inputs are passed directly into AI prompts. There is no XSS output sanitization on AI-generated lyrics before rendering.
- **Service Worker**: `public/sw.js` handles caching, push notifications, and notification clicks. It runs in a separate worker context.

---

## AI Studio Integration Notes

- `metadata.json` is minimal (name + description). It does **not** declare `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` in the current version; the app relies on `process.env.GEMINI_API_KEY` injected at build time or the `window.aistudio` bridge at runtime.
- The UI includes an **"API KEY"** button that calls `window.aistudio.openSelectKey()` if available.
- `index.html` includes an import map pointing to `esm.sh` for React and the GenAI SDK, which AI Studio may use when serving the app.

---

## Common Gotchas for Agents

- **`index.css` is empty** — do not expect global styles there. Most styling is Tailwind + inline styles + CSS custom properties.
- **App.tsx is ~2000 lines** — be cautious when editing; it is monolithic. Extracting logic into helper functions or custom hooks is often a good idea.
- **The `process.env` references are Vite-injected** — they are not Node.js `process.env` at runtime; Vite replaces them statically at build time.
- **Model names are hardcoded** in `services/genai.ts` and `services/voiceBriefing.ts` — changing them requires editing those files directly. However, `App.tsx` now allows users to select text and TTS models via `llmConfig`, which is persisted to `localStorage`.
- **Weather codes come from WMO** — the `WEATHER_CODES` map in `types.ts` only covers a subset. Unknown codes display as "Clear".
- **Babylon.js bundling** — `vite.config.ts` both optimizes and externalizes `@babylonjs/core`. Scene builders in `components/themes/scenes/` lazy-load via dynamic `import()`.
- **Visualizer FFT** — Real FFT data only works for same-origin or CORS-enabled audio. YouTube cross-origin embeds cannot be connected to `AudioContext`, so the visualizer falls back to simulated genre-based animations during YouTube playback.
- **YouTube IFrame API** — The player is initialized once and reused. Track changes call `loadVideoById`. Destroy the player when switching to Lyria mode to avoid conflicts.
- **Playlist generation is capped at 3 tracks** internally to avoid excessive API calls during pre-warm, even if the user sets track count to 4 or 5.

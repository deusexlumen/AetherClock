<div align="center">

# ⏰ AetherClock

### *A task-based AI radio alarm clock: what is coming next sets the soundtrack.*

[![Live Demo](https://img.shields.io/badge/🔗_Live_Demo-pages.dev-FF6B6B?style=for-the-badge)](https://aetherclock.pages.dev)
[![GitHub Repo](https://img.shields.io/badge/🔗_GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/deusexlumen/AetherClock)

<br>

[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Babylon.js](https://img.shields.io/badge/Babylon.js-v9-FF0000?logo=babylonjs)](https://www.babylonjs.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-22d3ee)](LICENSE)

<br>

![Preview](https://img.shields.io/badge/🎛️_Retro_Radio_Interface-Cyberpunk_/_Brass_/_Space-1a1a1a?style=for-the-badge&color=ff3333)

</div>

---

## ✨ What is AetherClock?

**AetherClock** turns daily tasks into music alarms. Add a task with a time, category and mood keywords. At that time, an active task starts a broadcast whose music is selected for the activity:

1. 🗓️ **Task Alarms** — Each active task triggers at its own time; edits and deactivation update the alarm
2. 📻 **Task-Based Playlist** — Category and keywords guide the selection: focus/no vocals for a meeting, energy for training, calm for winding down
3. 🎙️ **Optional Voice Briefing** — A synthetic voice introduces the upcoming tasks, time and weather
4. 🎨 **Immersive Visuals** — 10 retro chassis themes, 3 with live WebGL backgrounds
5. 📲 **PWA** — Install it, get push notifications, and use a local alarm sound offline

> *"It's like having a radio station that only plays for you, every morning."*

---

## 🚀 Live Demo

**→ [https://aetherclock.pages.dev](https://aetherclock.pages.dev)**

Open it in your browser and use **Play your own YouTube link** to test playback without a key. Add your own Gemini key in settings for AI curation and voice briefings. Music playback requires the app to remain open; background push notifications do not automatically start music in a closed app.

---

## 🎬 Features in Detail

### 🗓️ Task alarms
Tasks store their time, category, keywords and armed state in this browser. **Test music** previews a task's selection immediately. The text-list editor preserves categories and keywords, including disabled tasks. Tasks currently form a repeating daily plan, not a dated calendar. Tasks at the same time share one broadcast with their combined context. Additional standalone alarms remain available in settings.

The selected task is supplied explicitly to the AI; its keywords take priority over generic time-of-day or weather suggestions. A Gemini key is required for semantic music selection. If AI is unavailable, the app clearly labels the generic preset fallback. See [task alarm validation](docs/task-alarms.md).

### 🎙️ AI Voice Briefing
Wake up to a personalized spoken briefing synthesized via Google Gemini TTS. Choose from three voices:
- **`Fenrir`** — Deep, commanding male
- **`Kore`** — Clear, bright female  
- **`Leda`** — Warm, soothing female

The briefing covers:
- ⏰ Current time
- 🌤️ Weather conditions & temperature (via GPS + Open-Meteo)
- 📅 Your upcoming calendar appointments
- 💬 A custom greeting of your choice

### 📻 Smart Playlist Curation
Instead of one alarm tone, AetherClock builds a **1–5 track YouTube playlist** in real-time, considering:

| Context | Music Adaptation |
|---------|-----------------|
| ☀️ Sunny weather | Upbeat, energetic tracks |
| 🌧️ Rainy weather | Lo-fi, ambient, acoustic |
| 💼 Morning meetings | Focus, instrumental |
| 🏋️ Workout scheduled | High-energy rock / electronic |
| 🌙 Night shift | Mellow jazz, chillhop |
| 🎚️ Genre preset | Synthwave, Classical, Rock, Jazz, Pop, Ambient, Hip-Hop |

With a Gemini key, **Google Search grounding** helps select existing YouTube recordings. The app does not synthesize music or change the recording's lyrics. A valid video ID does not guarantee availability: YouTube can restrict embedding, regions, accounts or autoplay. The player reports failures, tries at most two replacement tracks, and offers a local alarm sound. Without a key, the app uses preset tracks and skips the voice briefing.

### 🎨 10 Retro Themes (3 with Live WebGL)

Every theme morphs the entire UI — colors, glows, scanlines, hardware decals, and typography.

| Theme | Vibe | Background Engine |
|-------|------|-------------------|
| Obsidian Cyberpunk | Red neon, dystopian | CSS gradients + shadows |
| Sandalwood Amber | Warm, vintage wood | CSS gradients |
| Futuristic Cobalt | Blue tech, clean | CSS gradients |
| **★ Vaporwave Cyber-Luxe** | Purple & magenta, retro sun | 🌴 **WebGL** — animated grid floor, rotating sun, post-processing bloom |
| **★ Antique Mahogany Brass** | Brass screws, wood grain | CSS gradients + rivet decals |
| **★ Reactor Toxic-Green** | Biohazard stripes, warning labels | CSS gradients + hazard patterns |
| **★ Space Odyssey** | Deep space, orbital ring, planet | 🌌 **WebGL** — 3,000 star particles, rotating torus, nebula lighting |
| **★ Royal Velvet** | Gold filigree, crown accents | CSS gradients + border inlays |
| **★ Sonar Marine** | Green radar, depth readouts | 🛸 **WebGL** — sonar ping rings, rising bubbles, depth fog |
| Ivory Coast Emerald | Light mode, clean emerald | CSS gradients |

> **WebGL themes** use Babylon.js with real-time FFT audio reactivity (when playing non-YouTube audio).

### 📲 Progressive Web App

| Feature | Status |
|---------|--------|
| ⬇️ Installable (Android + Desktop) | ✅ |
| 🔕 Offline fallback alarm tone | ✅ |
| 🔔 Push notifications on alarm | ✅ |
| ⚡ Service Worker asset caching | ✅ |
| 📴 Works without internet after install | ✅ (fallback tone) |

---

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  React 19   │  │  Vite Build  │  │  Service Worker   │  │
│  │  (App.tsx)  │  │  (dist/)     │  │  (Cache + Push)   │  │
│  └──────┬──────┘  └──────────────┘  └───────────────────┘  │
│         │                                                   │
│  ┌──────┴──────────────────────────────────────────────┐   │
│  │              EXTERNAL APIs (Client-Side)             │   │
│  │  • Google Gemini (GenAI + TTS + Search Grounding)   │   │
│  │  • Open-Meteo (Weather, no API key)                 │   │
│  │  • YouTube IFrame API (Playback)                    │   │
│  │  • Browser Geolocation (GPS)                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

AI calls go directly from the browser to Google's API using the key entered in the app settings. Background push alarms additionally use Cloudflare Pages Functions, KV, D1 and a scheduled Worker.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) 22 or later and pnpm
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier works)

### 1. Clone & Install
```bash
git clone https://github.com/deusexlumen/AetherClock.git
cd AetherClock
pnpm install --frozen-lockfile
```

### 2. Configure AI
Enter your Gemini API key in the app settings. The key is stored in this browser and sent directly to Google. It is not included in the build.

### 3. Develop
```bash
pnpm dev
```
→ Opens at `http://localhost:3000`

### 4. Build for Production
```bash
pnpm build
```
→ Outputs static assets to `dist/`. Background push alarms also require the Cloudflare Functions, bindings and scheduled Worker described in `docs/kv-quota-fix.md`.

---

## 🎛️ Settings & Customization

All preferences are persisted in `localStorage` and survive reloads.

| Category | Options |
|----------|---------|
| **Voice Briefing** | On/Off, voice (`Fenrir`/`Kore`/`Leda`), custom greeting, include weather/agenda/time |
| **Playlist** | On/Off, track count (1–5), shuffle; up to three AI selections, with preset tracks filling larger queues |
| **Loudness** | Standard · Sunrise Progressive (gentle ramp) · Max Impact Shock |
| **Pre-Warm Engine** | Generates content 60s before alarm time |
| **Playback Source** | Your YouTube link, AI selections, or preset NCS tracks; availability is checked by the player |
| **Theme** | 10 visual presets |
| **Blacklist** | Comma-separated artists/keywords to avoid |
| **Notifications** | System push notifications on alarm trigger |
| **Offline Fallback** | Local synthesized tone when disconnected |

---

## 📱 PWA Installation

### Android / Chrome Desktop
1. Open [aetherclock.pages.dev](https://aetherclock.pages.dev) in Chrome
2. Tap **"Install AetherClock"** in the banner (or ⋮ → Install)
3. App appears on home screen / desktop — runs standalone, no browser chrome

### Enable Notifications
1. Open **Settings** panel in the app
2. Toggle **Push Notifications**
3. Grant browser permission
4. Receive system notifications when supported by your browser and operating system. Tap a notification to open the app; background delivery does not bypass autoplay restrictions.

---

## 🗺️ Roadmap

- [x] AI Studio decoupling (standalone deployment)
- [x] YouTube-first playback engine
- [x] Smart playlist curation (1–5 tracks)
- [x] Voice briefing (Gemini TTS)
- [x] PWA + Service Worker + offline fallback
- [x] Push notifications
- [x] Babylon.js WebGL animated themes (Vaporwave, Space, Submarine)
- [x] 10 retro chassis presets
- [ ] Background alarm via Web Push (serverless periodic sync)
- [ ] Custom user-uploaded alarm tones
- [ ] Spotify / Apple Music integration
- [ ] Multi-alarm support
- [ ] Gamified wake-up challenges (snooze limits, dismiss puzzles)

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 (Hooks + Refs) |
| Language | TypeScript 5.8 |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS (CDN) + CSS Custom Properties |
| Icons | Lucide React |
| AI SDK | `@google/genai` |
| 3D Engine | `@babylonjs/core` (WebGL2, lazy-loaded) |
| Weather | Open-Meteo (free, no key) |
| Fonts | Orbitron, Share Tech Mono (Google Fonts) |

---

## 🤝 Credits

- **Weather Data**: [Open-Meteo](https://open-meteo.com/)
- **AI / Search Grounding**: [Google Gemini](https://deepmind.google/technologies/gemini/)
- **Music Playback**: YouTube IFrame API
- **3D Engine**: [Babylon.js](https://www.babylonjs.com/)
- **Fonts**: Orbitron & Share Tech Mono via Google Fonts

---

## 📄 License

MIT — feel free to fork, remix, and build your own wake-up experience.

---

<div align="center">

**[🌐 Live Demo](https://aetherclock.pages.dev)** · **[📂 GitHub](https://github.com/deusexlumen/AetherClock)**

<sub>Built with insomnia, synthwave, and too much coffee.</sub>

</div>

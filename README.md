<div align="center">

# ⏰ AetherClock

### *An AI-powered, retro-styled radio alarm clock that composes your perfect morning soundtrack.*

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

**AetherClock** is not just an alarm clock — it's a *personal morning DJ*. Instead of a generic beep, it wakes you up with a curated AI-generated broadcast:

1. 🎙️ **Voice Briefing** — A synthetic voice tells you the time, weather, and your day's agenda
2. 📻 **Smart Playlist** — Thematic YouTube tracks matched to your mood, weather, and calendar
3. 🎨 **Immersive Visuals** — 10 retro chassis themes, 3 with live WebGL backgrounds
4. 📲 **PWA** — Install it, get push notifications, works offline

> *"It's like having a radio station that only plays for you, every morning."*

---

## 🚀 Live Demo

**→ [https://aetherclock.pages.dev](https://aetherclock.pages.dev)**

No installation required. Open it in your browser, set an alarm, and experience your first AI-curated wake-up.

---

## 🎬 Features in Detail

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

Powered by **Google Gemini with Search Grounding** — finds real, embeddable YouTube tracks, not hallucinated songs.

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

**No backend required.** All AI calls go directly from the browser to Google's API. Your Gemini API key is injected at build time via Vite.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) ≥ 18
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier works)

### 1. Clone & Install
```bash
git clone https://github.com/deusexlumen/AetherClock.git
cd AetherClock
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local:
# GEMINI_API_KEY=your_key_here
```

### 3. Develop
```bash
npm run dev
```
→ Opens at `http://localhost:3000`

### 4. Build for Production
```bash
npm run build
```
→ Outputs to `dist/` — ready for Cloudflare Pages, Netlify, or any static host.

---

## 🎛️ Settings & Customization

All preferences are persisted in `localStorage` and survive reloads.

| Category | Options |
|----------|---------|
| **Voice Briefing** | On/Off, voice (`Fenrir`/`Kore`/`Leda`), custom greeting, include weather/agenda/time |
| **Playlist** | On/Off, track count (1–5), shuffle, crossfade |
| **Loudness** | Standard · Sunrise Progressive (gentle ramp) · Max Impact Shock |
| **Pre-Warm Engine** | Generates content 60s before alarm time |
| **Playback Source** | YouTube (fast) · Lyria AI (generates unique music, slower) |
| **Theme** | 10 visual presets |
| **Blacklist** | Comma-separated artists/keywords to avoid |
| **Notifications** | System push notifications on alarm trigger |
| **Offline Fallback** | Local synthesized tone when disconnected |

---

## 🧪 Experimental: Lyria Mode

Switch the **Playback Source** from YouTube to **LYRIA** to trigger actual AI music generation via Google's Lyria model. If music generation fails, it gracefully falls back to Gemini TTS with instrumental styling.

> ⚠️ Requires a Gemini API key with Lyria access enabled.

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
4. Receive system notifications even when the app is closed

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

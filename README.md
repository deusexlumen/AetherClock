# ⏰ AetherClock

> An AI-powered, retro-styled radio alarm clock that curates thematic YouTube playlists and voice briefings matched to your calendar, weather, and mood. No AI Studio required. Runs entirely in your browser.

[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)

![AetherClock Preview](https://via.placeholder.com/800x450/1a1a1a/ff3333?text=AetherClock+Preview)

---

## ✨ Features

### 🎙️ Voice Briefing
Wake up to a personalized AI-generated voice briefing. Every morning, a synthesized voice tells you:
- The current time
- Weather conditions & temperature
- Your upcoming calendar appointments
- A custom greeting of your choice

*Powered by Google Gemini TTS (`Fenrir`, `Kore`, `Leda` voices).*

### 📻 Smart Playlist
Instead of a single generic alarm tone, AetherClock builds a curated **YouTube playlist** (1–5 tracks) based on:
- **Weather** (rainy → lo-fi, sunny → upbeat)
- **Agenda vibe** (meeting → focus, workout → high-energy)
- **Genre preset** (Synthwave, Jazz, Rock, Classical, Lo-Fi, …)
- **Time of day** (dawn ambient vs. morning energetic)

Tracks are discovered in real-time via Google Search Grounding.

### 📲 Progressive Web App (PWA)
- **Installable** on Android & Desktop Chrome
- **Offline fallback alarm tone** when no internet is available
- **Push notifications** when your alarm fires — even if the app is in the background
- **Service Worker** caches assets for instant load times

### 🎨 10 Retro Themes
From cyberpunk obsidian to premium brass mahogany. Every theme dynamically morphs the entire UI — colors, glows, scanlines, sonar grids, and hardware decals.

| Theme | Vibe |
|---|---|
| Obsidian Cyberpunk | Red neon, dystopian |
| Sandalwood Amber | Warm, vintage |
| Futuristic Cobalt | Blue tech |
| Premium Vaporwave | Purple & cyan, palm trees |
| Premium Antique Mahogany | Brass screws, wood |
| Premium Reactor Toxic-Green | Biohazard stripes |
| Premium Space Odyssey | Star twinkle, crosshairs |
| Premium Royal Velvet | Gold filigree, crowns |
| Premium Sonar Marine | Green radar grid |
| Ivory Coast Emerald | Light mode, clean |

### ⚙️ Deep Customization
Every feature is toggleable and persisted in `localStorage`:

| Setting | Options |
|---|---|
| Voice Briefing | On/Off, voice selector, custom greeting, weather/agenda/time inclusion |
| Playlist | On/Off, track count (1–5), shuffle, crossfade duration |
| Loudness | Standard, Sunrise Progressive (gentle ramp-up), Max Impact Shock |
| Pre-Warm Engine | Generates content 60s before alarm |
| Playback Source | YouTube (primary) or Lyria AI music generation (experimental) |
| Theme | 10 chassis presets |
| Blacklist | Forbidden artists/keywords |
| Push Notifications | System notifications on alarm |
| Offline Fallback | Local tone when disconnected |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) ≥ 18
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

### 1. Clone & Install
```bash
git clone https://github.com/deusexlumen/AetherClock.git
cd AetherClock
npm install
```

### 2. Configure API Key
```bash
cp .env.example .env.local
# Edit .env.local and set your key:
# GEMINI_API_KEY=your_key_here
```

### 3. Run Dev Server
```bash
npm run dev
```
Open `http://localhost:3000`

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 (Hooks + Refs) |
| Language | TypeScript 5.8 |
| Build | Vite 6 |
| Styling | Tailwind CSS (CDN) + CSS Custom Properties |
| Icons | Lucide React |
| AI SDK | `@google/genai` |
| Weather | Open-Meteo (free, no key) |
| Fonts | Orbitron, Share Tech Mono |

---

## 📖 How It Works

```
User sets alarm (e.g. 07:00)
        │
        ▼
┌─────────────────────┐
│  Pre-Warm (06:59)   │  ◄── 60s before alarm
│  - Search songs via   │
│    Gemini + Grounding │
│  - Generate TTS       │
│    briefing           │
│  - Build playlist     │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  Alarm (07:00)      │
│  - Play voice       │
│    briefing         │
│  - Start playlist   │
│    track 1          │
│  - Advance track    │
│    on end           │
└─────────────────────┘
```

### Offline Path
If the device has no internet connection at alarm time and **Offline Fallback** is enabled, AetherClock bypasses all AI/YouTube logic and immediately plays a local alarm tone via the Web Audio API.

---

## 📱 Install as App (PWA)

### Android / Chrome Desktop
1. Open AetherClock in Chrome
2. Tap the **"Install"** button in the banner (or use the browser menu → "Install AetherClock")
3. The app appears on your home screen / desktop and runs standalone

### Enable Notifications
In the **Settings** panel, toggle **Push Notifications**. Chrome will ask for permission. Once granted, you'll receive a system notification when your alarm fires — even if the app is closed.

---

## 🎛️ Settings Deep Dive

All settings are automatically saved to `localStorage` and survive page reloads.

### Voice Briefing
- **Enabled**: Master toggle
- **Voice**: `Fenrir` (deep male), `Kore` (clear female), `Leda` (warm female)
- **Custom Greeting**: e.g. `"Rise and shine, Commander"`
- **Include Weather / Agenda / Time**: Choose what the briefing covers

### Playlist
- **Enabled**: Master toggle
- **Track Count**: How many songs to curate (1–5)
- **Shuffle**: Randomize playback order
- **Crossfade**: Simulated crossfade duration between tracks

### System
- **Theme**: 10 visual chassis presets
- **Volume**: 0–100%
- **Loudness Mode**:
  - *Standard*: Fixed volume
  - *Sunrise Progressive*: Gentle 3s ramp-up from 10% → target
  - *Max Impact Shock*: 100% immediate blast
- **Pre-Warm Engine**: Start generation 60s before alarm
- **Blacklist**: Comma-separated artists/keywords to avoid

---

## 🧪 Experimental Features

### Lyria Music Generation
In the **Playback Source** toggle (top right of the station dial board), you can switch from **YouTube** to **LYRIA**. This triggers actual AI music generation via Google's Lyria model with TTS fallback. It's slower and more API-intensive, but generates truly unique tracks.

> ⚠️ Requires a Gemini API key with Lyria access.

---

## 🗺️ Roadmap

- [x] AI Studio decoupling
- [x] YouTube-first playback
- [x] Smart playlist curation
- [x] Voice briefing (TTS)
- [x] PWA + Service Worker
- [x] Offline fallback tone
- [x] Push notifications
- [ ] Background alarm via Web Push (serverless periodic sync)
- [ ] Custom user-uploaded alarm tones
- [ ] Spotify / Apple Music integration
- [ ] Multi-alarm support
- [ ] Gamified wake-up challenges (snooze limits, dismiss puzzles)

---

## 🤝 Credits

- **Weather data**: [Open-Meteo](https://open-meteo.com/)
- **AI / Search Grounding**: [Google Gemini](https://deepmind.google/technologies/gemini/)
- **Music curation**: YouTube embeds + Google Search
- **Fonts**: Orbitron & Share Tech Mono via Google Fonts

---

## 📄 License

MIT — feel free to fork, remix, and build your own wake-up experience.

---

<p align="center">
  <sub>Built with insomnia and too much synthwave.</sub>
</p>

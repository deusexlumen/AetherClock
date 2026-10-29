<!-- TODO: DEL banner missing. assets/banner-dark.png and assets/banner-light.png do not exist yet (needs Design + Lumen). Until then the existing docs/aetherclock-banner.png could stay. -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
  <img alt="AetherClock" src="assets/banner-light.png" width="100%">
</picture>

# AetherClock

A task-based radio alarm clock for the browser: each task rings at its time and plays music picked for what comes next.

[![Live](https://img.shields.io/badge/live-aetherclock.pages.dev-555)](https://aetherclock.pages.dev)
![Stack](https://img.shields.io/badge/React_19-TypeScript-555)
![PWA](https://img.shields.io/badge/PWA-installable-555)
![License](https://img.shields.io/badge/license-MIT-555)
<!-- Badge nur zusammen mit LICENSE-Datei (MIT-Text, Jahr, Rechteinhaber) im selben PR; vorbehaltlich Abhängigkeits-Check durch Lizenz -->

<!-- TODO: real screenshot or GIF of the app (Device Mode + one WebGL theme). Only image in repo today: docs/aetherclock-banner.png -->
![AetherClock](docs/aetherclock-banner.png)

> **Status:** live at [aetherclock.pages.dev](https://aetherclock.pages.dev). <!-- TODO: status line (active / frozen?) - last commit 2026-06-14 -->

## Try it

Open <https://aetherclock.pages.dev>. Use **Play your own YouTube link** to test playback without an API key. Music only plays while the app is open; a push notification does not start music in a closed app.

## Quick start

Requires Node.js 22+ and pnpm.

```bash
git clone https://github.com/deusexlumen/AetherClock.git
cd AetherClock
pnpm install --frozen-lockfile
pnpm dev        # Vite on http://localhost:3000, UI only
```

The AI endpoint `/api/generate` is a Cloudflare Pages Function. Plain Vite does not serve it:

```bash
pnpm build
pnpm dev:pages  # wrangler pages dev dist --local
```

<!-- TODO: exact D1 migration command (migrations/0001_alarm_registry.sql, 0002_ai_request_budgets.sql) -->

## Features

- **Task alarms.** Tasks with time, category and mood keywords form a repeating daily plan. Tasks at the same time share one broadcast. Standalone alarms still exist. See [docs/task-alarms.md](docs/task-alarms.md).
- **Playlist of 1–5 YouTube tracks** chosen from task, weather, time and genre, with Gemini and Google Search grounding. The app does not generate music. If a video is blocked, it tries replacements or a local alarm sound.
- **Voice briefing** (Fenrir, Kore, Leda): time, weather, upcoming tasks, custom greeting.
- **14 neo-retro themes**, 3 of them live WebGL (Babylon.js, audio-reactive when the source allows it). Device and Ambient modes, reduced-motion fallback.
- **PWA:** installable, service-worker caching, push notifications, offline fallback tone.
- **Fallback is labelled.** Without AI, the app says it is using generic presets.

## Configuration

| What | Where |
| --- | --- |
| `GEMINI_API_KEY`, optional `GEMINI_API_KEYS` (key pool) | Cloudflare Pages secrets |
| Personal Gemini key (optional) | app settings, stored in the browser, sent per request, not stored on the server |
| Push alarms in the background | Pages Functions, KV, D1 and the scheduled Worker in `cron-worker/` (`pnpm deploy:cron`, VAPID keys via `pnpm generate-vapid`). See [docs/kv-quota-fix.md](docs/kv-quota-fix.md) |
| AI routing | [docs/ai-routing.md](docs/ai-routing.md) |

All in-app settings (voice, playlist, loudness, theme, motion, blacklist, notifications) live in `localStorage`.

Weather: [Open-Meteo](https://open-meteo.com/). Fonts: Orbitron and Share Tech Mono via Google Fonts.

## License

<!-- Buxe 2026-10-29: MIT, vorbehaltlich Abhängigkeits-Check durch Lizenz. TODO: exakter Rechteinhaber-Name -->
Released under the [MIT License](LICENSE).

## Contact

<!-- TODO: contact channel (GitHub issues? Discord?) -->
Issues: <https://github.com/deusexlumen/AetherClock/issues>

---

<p><sub>by Deus Ex Lumen</sub></p>

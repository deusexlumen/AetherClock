# AetherClock — Learnings & Knowledge Base

## Context
This is an AI-powered retro-style alarm clock application named **AetherClock**. It uses the Google GenAI SDK (`@google/genai`) to search for real-world songs based on agenda events, time, weather, and genre, then plays them via the YouTube IFrame API. A verified NoCopyrightSounds (NCS) fallback pool guarantees the alarm never stays silent.

## System Insights
- **SPA Architecture**: This is a client-side Vite + React SPA.
- **Model Rules**:
  - Primary text generator: configurable (`gemini-3.1-flash` default), supporting `googleSearch` grounding.
  - Primary TTS voice generator: configurable (`gemini-3.1-flash-tts-preview` default), works with `prebuiltVoiceConfig`.
- **Telemetry**: Gemini SDK calls include `User-Agent: 'aetherclock-client'` in `httpOptions`.
- **API Keys**: Stored in AI Studio environment or `.env.local`, accessed directly in client (since this is client-only) via `process.env.GEMINI_API_KEY`.

## Solutions & Features Added
1. **Google Search Grounding**: Added Google Search grounding tool inside the text generator context to find real-world tracks fitting the precise calendar time, appointment details, or ambient weather conditions.
2. **Preset Station Tuner**: Implemented retro mechanical push-buttons that switch frequencies and modes (Auto-Tune, Rock, Lofi, Classical, Acoustic, Synthwave) mapped to digital receiving frequencies on the screen.
3. **Structured & Dual Calendar Sync**: Set up a dual-synchronizing mechanism enabling both structured click calendar modifications (add, delete, category tags) and manual, back-compatible notepad coding, ensuring full harmony.
4. **Discovered Track Cards**: Designed glowing amber-shaded LCD panels that dynamically render the metadata (Title, Artist, Curation Reason, and Found Theme) of the discovered real song before rendering its custom performance.
5. **Dynamic 1-Minute Pre-Warm Engine**: Programmed an asynchronous countdown buffer that triggers generation 60 seconds before the targeted alarm time, caching the song so it begins streaming instantly on the second.
6. **Loudness Custom Regulation**: Added dynamic audio volume level sliders and automatic sunrise progressive ramping (starts gentle at 10% and escalates 10% every 3s to targeted volume) to avoid startling sleepers.
7. **Multi-Chassis Aesthetic Themes**: Integrated ten selectable chassis skin themes with flawless light/dark contrast mapping.
8. **Artist & Term Blacklisting Filter**: Built end-to-end negative constraints passed into search grounding query instructions, allowing users to forbid specific keywords or artists.
9. **Eliminating Iframe CSP Data Fetching Restrictions**: Bypassed strict sandbox Content Security Policies (which throw `TypeError: Failed to fetch` on `data:` URIs) by removing `fetch` blob compilation entirely and assigning the synthetic `data:audio/...base64` stream directly to the HTML5 audio element's source attribute.
10. **Fixing YouTube Iframe Playback Blockages**: Replaced deprecated/blocked `listType=search` embedding (which caused "Video nicht verfügbar" screens) and removed copyrighted fallback IDs. The current architecture uses Google Search grounded `youtubeVideoId` as the primary source, falls back to a curated pool of verified, royalty-free NoCopyrightSounds tracks, and uses an NCS channel-uploads embed as the ultimate safety net.
11. **Bypassing Browser Autoplay Restrictions**: Introduced real-time error-catching for standard browser safety policies (which obstruct automated playbacks). On silent autoplay blockages, the system displays a glowing, aesthetic retro diagnostic banner saying "Broadcast Muted (Click to Listen)", enabling the user to immediately unlock the audio stream on tap.
12. **Highly Immersive Animated Premium Themes**: Upgraded the visual skin dictionary with premium presets. Utilized dynamic React `<style>` blocks to inject custom looping CSS keyframes (star twinkling, sonar radar pings, and radioactive wave movements) to provide professional-grade reactive chassis enhancements without external assets.
13. **Robust Fallback Strategy**: The playlist service validates every `youtubeVideoId` (must be 11 characters), retries missing IDs once via a focused prompt, pads playlists with verified NCS tracks, and provides an NCS channel-uploads embed as a last-resort fallback so the alarm always has audio.
14. **Lyria Removal & Rebrand**: Removed all Lyria model references and runtime artifacts, renamed the project identity to AetherClock, and migrated `lyria_*` localStorage keys to `aetherclock_*` with a one-time migration helper.

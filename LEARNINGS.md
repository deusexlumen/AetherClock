# Lyria Radio Alarm Clock - Learnings & Knowledge Base

## Context
This is an AI-powered retro-style alarm clock application named "Lyria Radio". It uses Gemini (@google/genai SDK) to search for real-world songs based on agenda events and times, and then generates tailored audio renderings via the specialized `lyria-3-pro-preview` model, or falls back to `gemini-3.1-flash-tts-preview` in audio mode.

## System Insights
- **SPA Architecture**: This is a client-side Vite + React SPA.
- **Model Rules**:
  - Primary text generator: `gemini-3.5-flash` (supporting `googleSearch` grounding).
  - Primary music generator: `lyria-3-pro-preview`.
  - Primary backup TTS voice generator: `gemini-3.1-flash-tts-preview` (replaces legacy `gemini-2.5-flash-preview-tts` and works well with `prebuiltVoiceConfig`).
- **Telemetry**: Gemini SDK calls must include `User-Agent: 'aistudio-build'` in `httpOptions`.
- **API Keys**: Stored in AI Studio environment, accessed directly in client (since this is client-only) via `process.env.GEMINI_API_KEY`.

## Solutions & Features Added
1. **Google Search Grounding**: Added Google Search grounding tool inside the `gemini-3.5-flash` generator context to find real-world tracks fitting the precise calendar time, appointment details, or ambient weather conditions.
2. **Preset Station Tuner**: Implemented retro mechanical push-buttons that switch frequencies and modes (Auto-Tune, Rock, Lofi, Classical, Acoustic, Synthwave) mapped to digital receiving frequencies on the screen.
3. **Structured & Dual Calendar Sync**: Set up a dual-synchronizing mechanism enabling both structured click calendar modifications (add, delete, category tags) and manual, back-compatible notepad coding, ensuring full harmony.
4. **Discovered Track Cards**: Designed glowing amber-shaded LCD panels that dynamically render the metadata (Title, Artist, Curation Reason, and Found Theme) of the discovered real song before rendering its custom performance.
5. **Dynamic 1-Minute Pre-Warm Engine**: Programmed an asynchronous countdown buffer that triggers generation 60 seconds before the targeted alarm time, caching the song so it begins streaming instantly on the second!
6. **Loudness Custom Regulation**: Added dynamic audio volume level sliders and automatic sunrise progressive ramping (starts gentle at 10% and escalates 10% every 3s to targeted volume) to avoid startling sleepers.
7. **Multi-Chassis Aesthetic Themes**: Integrated four selectable chassis skin themes (Obsidian Cyberpunk, Sandalwood Amber, Futuristic Cobalt, and Ivory Coast Light Emerald) with flawless light/dark contrast mapping.
8. **Artist & Term Blacklisting Filter**: Built end-to-end negative constraints passed into search grounding query instructions, allowing users to forbid specific keywords or artists.
9. **Eliminating Iframe CSP Data Fetching Restrictions**: Bypassed strict sandbox Content Security Policies (which throw `TypeError: Failed to fetch` on `data:` URIs) by removing `fetch` blob compilation entirely and assigning the synthetic `data:audio/...base64` stream directly to the HTML5 audio element's source attribute.
10. **Fixing YouTube Iframe Playback Blockages**: Replaced deprecated/blocked `listType=search` embedding (which caused "Video nicht verfügbar" screens) with an elegant dual-routing system: it extracts the Google Search grounded `youtubeVideoId` directly, falling back to a pre-curated dictionary of high-quality, embeddable, copyright-safe YouTube audio loops matching each of the 10 preset dial feeds.
11. **Bypassing Browser Autoplay Restrictions**: Introduced real-time error-catching for standard browser safety policies (which obstruct automated playbacks). On silent autoplay blockages, the system displays a glowing, aesthetic retro diagnostic banner saying "Broadcast Muted (Click to Listen)", enabling the user to immediately unlock the audio stream on tap.
12. **Highly Immersive Animated Premium Themes**: Upgraded the visual skin dictionary with three ultra-creative premium presets (Vaporwave Cyber-Luxe, Antique Mahogany Brass, Reactor Toxic Green, Space Odyssey HUD, Royal Velvet Gold, and Sonar Deep-Sea). Utilized dynamic React `<style>` blocks to inject custom looping CSS keyframes (star twinkling, sonar radar pings, and radioactive wave movements) to provide professional-grade reactive chassis enhancements without external assets.

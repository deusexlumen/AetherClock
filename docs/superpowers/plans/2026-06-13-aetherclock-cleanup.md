# AetherClock Cleanup & Robust Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all remaining Lyria branding/runtime artifacts, rename the project identity to AetherClock, and make the AI-curated alarm playlist robust so that fallback tracks are always embeddable and the alarm never stays silent.

**Architecture:**
- The primary source remains `generateMusicalPrompt` (Google GenAI with Search grounding), which must return a real song and a valid `youtubeVideoId`.
- If the AI omits the video ID, the playlist service falls back to a curated pool of verified NoCopyrightSounds (NCS) tracks that are royalty-free and embeddable.
- As a last-resort safety net, the service can emit a channel-uploads embed URL for the NCS channel so the player loads whatever upload YouTube currently serves.
- localStorage keys are migrated from the `lyria_` prefix to `aetherclock_` so existing users keep their settings.

**Tech Stack:** React 19, Vite, TypeScript, @google/genai, YouTube IFrame embed, pnpm.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `types.ts` | `PlaylistTrack` gets `youtubeVideoId?: string` and `embedUrl: string` so consumers don't rebuild embed URLs. |
| `services/playlist.ts` | Curated NCS fallback pool, deterministic selection without repeats, builds `embedUrl` for every track, last-resort NCS channel embed. |
| `services/genai.ts` | Stronger system prompt forcing a video ID, optional second attempt if ID missing, updated User-Agent. |
| `services/voiceBriefing.ts` | Updated User-Agent, keep TTS fallback behavior. |
| `App.tsx` | Use `track.embedUrl`, migrate `lyria_` localStorage keys, fix recovery logic, fix pre-warm label. |
| `components/PWAInstallPrompt.tsx` | Migrate install-dismissed localStorage key. |
| `package.json`, `metadata.json`, `public/manifest.json`, `public/sw.js` | Rename project to `aetherclock` / "AetherClock Radio Alarm". |
| `AGENTS.md`, `README.md`, `LEARNINGS.md` | Remove Lyria references and document the current YouTube-only architecture. |

---

## Task 1: Update `PlaylistTrack` type

**Files:**
- Modify: `types.ts:26-31`

- [ ] **Step 1: Change `PlaylistTrack` to carry a pre-built embed URL**

```ts
export interface PlaylistTrack {
  title: string;
  artist: string;
  youtubeVideoId?: string;
  embedUrl: string;
  whyExplanation: string;
}
```

- [ ] **Step 2: Run TypeScript check to surface all call sites**

Run: `cd C:/Users/Buxe/Projects/remix_-lyria-alarm-clock && pnpm exec tsc --noEmit`
Expected: errors in `App.tsx` and `components/PlaylistViewer.tsx` because `youtubeVideoId` is now optional/used as key.

---

## Task 2: Harden `services/playlist.ts`

**Files:**
- Modify: `services/playlist.ts`

- [ ] **Step 1: Replace copyrighted fallback IDs with verified NCS IDs**

```ts
export const RELIABLE_NCS_FALLBACKS: Record<string, { title: string; artist: string; whyExplanation: string }> = {
  'K4DyBUG242c': { title: 'On & On', artist: 'Cartoon feat. Daniel Levi', whyExplanation: 'Energetic NCS fallback tuned to your station preset.' },
  'TW9d8vYrVFQ': { title: 'Sky High', artist: 'Elektronomia', whyExplanation: 'Uplifting NCS fallback tuned to your station preset.' },
  'J2X5mJ3HDYE': { title: 'Invincible', artist: 'DEAF KEV', whyExplanation: 'Driving NCS fallback tuned to your station preset.' },
  '3nQNiWdeH2Q': { title: 'Heroes Tonight', artist: 'Janji feat. Johnning', whyExplanation: 'Motivational NCS fallback tuned to your station preset.' },
  'p7ZsBPK656s': { title: 'Blank', artist: 'Disfigure', whyExplanation: 'Melodic NCS fallback tuned to your station preset.' },
  'S19UcWdOA-I': { title: 'Fearless pt.II', artist: 'TULE feat. Chris Linton', whyExplanation: 'Epic NCS fallback tuned to your station preset.' },
  'yJg-Y5byMMw': { title: 'Mortals', artist: 'Warriyo feat. Laura Brehm', whyExplanation: 'Powerful NCS fallback tuned to your station preset.' },
};

const NCS_CHANNEL_ID = 'UC_aEa8K-EOJ3D6gOs7HcyNg';

export const buildNcsChannelEmbedUrl = (): string => {
  return `https://www.youtube.com/embed?listType=user_uploads&list=${NCS_CHANNEL_ID}&autoplay=1&controls=0&modestbranding=1&enablejsapi=1`;
};

export const buildEmbedUrl = (videoId: string | null | undefined): string | null => {
  const id = videoId?.trim();
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?autoplay=1&controls=0&modestbranding=1&playlist=${id}&loop=1&enablejsapi=1`;
};
```

- [ ] **Step 2: Rewrite `generatePlaylist` to build `embedUrl` and avoid metadata mismatch**

Key behaviors:
- Fetch tracks in parallel (cap at 3).
- Validate `youtubeVideoId` is an 11-character string.
- If AI returns a song but no ID, do **not** show the AI metadata over a random fallback; instead retry once, then fall back to NCS with honest fallback metadata.
- Pad the playlist with random NCS tracks (no repeats).
- If even the NCS pool is exhausted, return a single track using the NCS channel-uploads embed URL.

- [ ] **Step 3: Run TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS for `playlist.ts`.

---

## Task 3: Strengthen `services/genai.ts`

**Files:**
- Modify: `services/genai.ts`

- [ ] **Step 1: Update User-Agent and tighten prompt**

Change `User-Agent: 'lyria-radio-client'` to `User-Agent: 'aetherclock-client'`.
Add to system prompt:
```
- youtubeVideoId MUST be exactly 11 characters (a-z, A-Z, 0-9, _, -).
- Before returning, verify the ID by imagining a YouTube embed URL and confirming it looks valid.
```

- [ ] **Step 2: Validate the returned ID and retry once if missing/invalid**

After parsing the JSON:
- If `searchedSong.youtubeVideoId` is missing or not 11 chars, make a second API call with a shorter, stricter prompt asking only for the ID of the already-selected song.
- If still missing, return the song without ID so `playlist.ts` can fall back to NCS honestly.

- [ ] **Step 3: Run TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS for `genai.ts`.

---

## Task 4: Update `App.tsx`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Migrate localStorage keys**

Add a helper at the top of the component:
```ts
const LS_PREFIX = 'aetherclock_';
const migrateLegacyKeys = () => {
  const legacyKeys = [
    'lyria_theme', 'lyria_volume', 'lyria_loudness', 'lyria_blacklist',
    'lyria_prewarm', 'lyria_voice_briefing', 'lyria_playlist', 'lyria_llm',
    'lyria_notifications', 'lyria_offline_fallback', 'lyria_screensaver_timeout',
  ];
  for (const oldKey of legacyKeys) {
    const value = localStorage.getItem(oldKey);
    if (value !== null) {
      const newKey = oldKey.replace('lyria_', LS_PREFIX);
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
      }
      localStorage.removeItem(oldKey);
    }
  }
};
```
Call `migrateLegacyKeys()` inside the initial `useEffect`.

- [ ] **Step 2: Replace all `lyria_` key strings with `${LS_PREFIX}...`**

Replace `'lyria_theme'`, `'lyria_volume'`, etc.

- [ ] **Step 3: Use `track.embedUrl` instead of rebuilding from `youtubeVideoId`**

Replace `buildEmbedUrl(track.youtubeVideoId)` with `track.embedUrl`.

- [ ] **Step 4: Fix recovery logic**

Instead of recycling blocked IDs, filter to tracks with valid `embedUrl` and cycle through them. Add a final fallback to `buildNcsChannelEmbedUrl()`.

- [ ] **Step 5: Fix pre-warm label**

Either change UI label from "60s prior" to "2 min prior" or change code to subtract 1 minute. Recommended: change code to `min = min - 1` to match the UI label.

- [ ] **Step 6: Run TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

---

## Task 5: Update remaining Lyria branding

**Files:**
- Modify: `components/PWAInstallPrompt.tsx` (`lyria_install_dismissed` → `aetherclock_install_dismissed`)
- Modify: `services/voiceBriefing.ts` (User-Agent)
- Modify: `package.json` (`"name": "aetherclock"`)
- Modify: `metadata.json` (`"name": "AetherClock Radio Alarm"`)
- Modify: `public/manifest.json` (name/short_name)
- Modify: `public/sw.js` (cache name, notification title/tag)

- [ ] **Step 1: Apply all renames**
- [ ] **Step 2: Run TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

---

## Task 6: Update docs

**Files:**
- Modify: `AGENTS.md`, `README.md`, `LEARNINGS.md`

- [ ] **Step 1: Remove Lyria mode / `generateSong` / `PlaybackSource` references**
- [ ] **Step 2: Document current architecture: AI search → YouTube embed → NCS fallback → NCS channel uploads**
- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: PASS.

---

## Task 7: Commit and push

- [ ] **Step 1: Stage all changes**

```bash
git add -A
git status
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor: remove Lyria branding, harden playlist fallbacks to NCS

- Rename project identity to AetherClock
- Migrate lyria_ localStorage keys to aetherclock_
- Replace copyrighted fallback IDs with verified NCS tracks
- Make youtubeVideoId optional; PlaylistTrack carries embedUrl
- Add NCS channel-uploads embed as last-resort fallback
- Strengthen genai prompt and retry missing IDs once
- Fix recovery logic and pre-warm timing label"
```

- [ ] **Step 3: Push**

```bash
git push origin $(git branch --show-current)
```

---

## Self-Review

1. **Spec coverage:**
   - Lyria removal → Tasks 1, 4, 5, 6.
   - Robust playlist/GenAI → Tasks 2, 3.
   - Fallback only loads available videos → Task 2 (NCS IDs + channel embed).
   - Build/TS clean → Steps after each task.
   - Committed/pushed → Task 7.
2. **Placeholder scan:** No TBD/"implement later"; each step contains concrete code/commands.
3. **Type consistency:** `PlaylistTrack.embedUrl` is defined in Task 1 and used in Task 4; `buildNcsChannelEmbedUrl` is defined in Task 2 and used in Task 4.

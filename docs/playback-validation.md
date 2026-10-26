# Playback flow and validation

## Using the player

Use **Play your own YouTube link** to test a known video without a Gemini key. Paste a YouTube watch, short, live or youtu.be link, or an 11-character video ID. **TUNE IN** builds a queue using optional AI curation; without a Gemini key it uses preset tracks. The player shows its actual loading, buffering, paused and playing state. Audio blocked by the browser gets an explicit Start playback button.

Unavailable or embed-disabled videos receive at most two replacements. The displayed queue and metadata change with the replacement. A configuration error, blocked API script or exhausted recovery produces an actionable error with Retry YouTube, Open this track on YouTube and Play local alarm sound. STOP ends audio and destroys the player. Preparation can be cancelled without a delayed completion restarting playback.

YouTube remains an embedded player with visible controls. This app neither extracts streams nor bypasses embedding restrictions. Closed-app push delivery cannot start background YouTube music. First-run playback and notification delivery still require real device validation, particularly on iOS and Android.

## Root causes corrected

- The old mount-only effect returned before any video existed and never initialized after generation.
- Track loading watched only the queue index; a new queue at index zero was missed.
- Player containers were removed on STOP without resetting the retained player instance.
- Recovery selected IDs modulo the fallback pool, making exhaustion unreachable.
- Briefing data URLs were wrapped in a second data URL; raw PCM also lacked a WAV header.
- A stopped briefing's rejected play promise could advance a newer broadcast.
- The first AI selection was discarded and generated again; queue settings of four or five tracks yielded only three.

## Validation performed

- `pnpm test`: 85 tests passed, including bounded recovery, strict link parsing, queue reuse, YouTube API timeout/retry, data URL handling, PCM-to-WAV conversion and stale briefing cancellation.
- `pnpm exec tsc --noEmit` and `pnpm build`: passed.
- Browser regression: before the fix, TUNE IN showed STOP with zero YouTube Player constructions. After the fix, player creation, autoplay unlock, bounded failed-video recovery, STOP and restart passed with a simulated IFrame API.
- A separate browser scenario simulated Gemini text and PCM audio responses: briefing playback preceded music and used a single WAV data URL. No paid Gemini request was made for this test.
- A real YouTube embed played On & On: the browser media element reported paused=false, readyState=4 and currentTime over nine seconds. This confirms playback in the test browser, not all regions or devices.
- At a 390px viewport, direct-link playback and configuration-error retry had no horizontal overflow.

## References

- [YouTube IFrame API events and error codes](https://developers.google.com/youtube/iframe_api_reference)
- [Gemini speech output formats](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation)

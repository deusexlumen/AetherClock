# Server-side Gemini routing

Music curation, video-ID repair and voice briefings call the same-origin
`/api/generate` Pages Function. Server secrets never enter the Vite bundle.

Configure Pages secrets with `GEMINI_API_KEY` and optionally `GEMINI_API_KEYS`.
Lists accept commas, semicolons or whitespace and are deduplicated. A personal
key entered in settings joins the pool for that request; it remains in browser
storage and is not saved in D1. AetherClock has no database onboarding key store.
For this public test, only one owner-provided key is provisioned.

The selected model comes first, followed by the remaining allowed models of the
same capability. Each model tries every available key before advancing on quota
errors. Invalid keys are skipped across models; missing models and transient
provider overload move to the next model. Unknown errors fail without cascading.
Short quota cooldowns last 60 seconds; daily exhaustion resets at midnight in
America/Los_Angeles. State and in-flight pair claims are local to each Cloudflare
isolate and are rediscovered after a cold start; they are not distributed locks.
The implementation adapts `key-pool-router.ts` and `errors.ts` from the supplied
llm-router-blueprint. It deliberately fails fast when every pair is locked,
instead of waiting through quotas and missing an alarm. Truncated structured
responses receive one retry with a larger output budget and are never accepted
if still truncated. Provider-chain and filesystem persistence modules are unused.

Google quotas are per project, not per key. Keys belonging to the same project
share quota: https://ai.google.dev/gemini-api/docs/rate-limits

Requests have a 24 KB body bound, a text-only schema, fixed server-side tools,
model allowlists, a 40-second routing deadline and sanitized errors. The endpoint
requires a same-origin browser request. Origin checks do not authenticate clients.
D1 atomic counters cap admitted requests at 20/minute and 200/UTC day globally,
and 60/UTC day per hashed IP. These are conservative test request budgets, not
monetary spending caps or protection against all abuse; multiple model attempts
can occur within one admitted request. Saturation gives a labeled preset fallback.
Counters contain no API keys, prompts or raw IP addresses and expire automatically.
Run `migrations/0002_ai_request_budgets.sql` before deploying the endpoint.

For local use: create ignored `.dev.vars`, build, apply migrations using
`pnpm exec wrangler d1 migrations apply ALARM_DB --local`, then `pnpm dev:pages`.
Plain Vite serves the frontend without Pages Functions.

The default text cascade is 3.8 Flash → 3.6 Flash → 3.5 Flash-Lite →
3.1 Flash-Lite → 2.5 Flash → 2.5 Flash-Lite, using verified API model IDs.
Pro is excluded from the music cascade because the owner's project overview
shows no available Pro quota. Legacy saved defaults normalize to 3.8 Flash.
Google Search grounding is supported by these Gemini text families:
https://ai.google.dev/gemini-api/docs/google-search/
Gemma, embeddings and Live models are not interchangeable with this grounded
structured-text / TTS transport. Per-project quota values remain provider-side;
the router reacts to actual responses rather than hard-coding the screenshot.

Live testing found that ordinary Lite generation succeeds with the donated key,
while adding Google Search returns HTTP 429. If the grounded cascade exhausts
capacity, a separate text-only cascade selects a known recording. The server
checks its ID with YouTube oEmbed and requires the returned title to match the
selection. Missing/mismatched videos fail to the existing labeled preset path.
The UI explicitly discloses this mode; oEmbed does not guarantee autoplay or
regional playback. Search and ordinary generation have separate cooldown state.
SDK automatic retries are disabled so only this router controls failover; the
single explicit truncated-output retry remains enabled.

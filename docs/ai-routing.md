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

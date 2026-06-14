# Web Push Background Alarm — Design Spec

> **Status:** Draft  
> **Project:** AetherClock (`remix_-lyria-alarm-clock`)  
> **Date:** 2026-06-13  
> **Author:** Kimi Code  
> **Scope:** Allow AetherClock to trigger a native system notification + vibration when an alarm fires, even if the browser tab is closed, the device is locked, or the PWA is not running.

---

## 1. Goal

Add a reliable, server-side background alarm delivery layer using the **Web Push Protocol** and a **Cloudflare-hosted backend**.

When an active AetherClock alarm reaches its scheduled time, the user receives a native notification on their device. Tapping the notification opens AetherClock, after which the app can resume its normal personalized wake-up flow (playlist, voice briefing, visualizer).

---

## 2. Non-Goals

- The backend does **not** generate music, briefings, or run the visualizer. It only delivers a wake-up ping.
- No user accounts, OAuth, or passwords. Authentication is the device UUID stored in `localStorage`.
- No real-time sync between multiple devices for the same user.
- Sub-minute precision is not required. Cloudflare Cron Triggers run once per minute, so alarms fire within the same minute as their scheduled time.

---

## 3. Background Discovery

| Finding | Impact |
|---------|--------|
| `public/sw.js` already handles `push` and `notificationclick`. | Minimal SW work: add a `message` handler for foreground `SHOW_NOTIFICATION` postMessages. |
| `services/pwa.ts` registers the SW and requests notification permission, but does **not** subscribe via `PushManager`. | Need a new `subscribeToPush()` flow. |
| The app is deployed on Cloudflare Pages (`aetherclock.pages.dev`). | Pages Functions can host the API, but **Pages Functions do not support Cron Triggers**. |
| `web-push` (the classic Node package) does not run on Cloudflare Workers. | Use `web-push-neo`, a Web-Crypto/fetch fork that works on Workers/Pages Functions. |

### Chosen Architecture

Because Pages Functions cannot be invoked by a Cron Trigger, the design splits into two tiny Cloudflare pieces that share the **same KV namespace** and **same VAPID secrets**:

1. **AetherClock Pages Functions** (`functions/`) — exposes the public API:
   - `GET /api/vapid-public-key`
   - `POST /api/subscribe`
   - `POST /api/alarms`
   - `POST /api/unsubscribe`

2. **AetherClock Cron Worker** (`cron-worker/`) — a separate Cloudflare Worker with a single `scheduled` handler that runs every minute, scans stored device alarms, and sends Web Push notifications for any alarm that just fired.

Both share a Cloudflare KV namespace (`AETHERCLOCK_KV`) and VAPID secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).

---

## 4. Data Model

### KV Record: Per Device

Key: `device:<deviceId>`

Value (JSON):

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "expirationTime": null,
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "alarms": [
    {
      "id": "alarm-1",
      "time": "07:00",
      "label": "Workday wake-up",
      "isActive": true,
      "days": ["mon", "tue", "wed", "thu", "fri"]
    }
  ],
  "timezone": "Europe/Berlin",
  "updatedAt": "2026-06-13T07:55:00.000Z"
}
```

### Field Notes

- `subscription` follows the browser `PushSubscriptionJSON` shape.
- `alarms` stores only the subset of `Alarm` needed for server-side scheduling (`id`, `time`, `label`, `isActive`, `days`). Genre/voice/playlist config is not needed server-side.
- `timezone` is the value from `Intl.DateTimeFormat().resolvedOptions().timeZone` at subscription time.
- `updatedAt` is used for future cleanup/audit, not for scheduling.
- Server-side code reuses the existing `WeekDay` type from `types.ts`. Both `functions/` and `cron-worker/` import it from the shared type file.

---

## 5. Client Changes

### 5.1 Device ID

Generate once and persist in `localStorage`:

```ts
const getDeviceId = (): string => {
  let id = localStorage.getItem('aetherclock_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('aetherclock_device_id', id);
  }
  return id;
};
```

### 5.2 Push Subscription Flow

Add to `services/pwa.ts`:

```ts
const urlBase64ToUint8Array = (base64url: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

export const subscribeToPush = async (vapidPublicKey: string): Promise<PushSubscription | null> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return subscription;
};
```

### 5.3 Sync with Backend

Add `services/pushBackend.ts`:

```ts
export const syncAlarmsWithBackend = async (
  deviceId: string,
  alarms: Alarm[],
  subscription: PushSubscription | null,
): Promise<void> => {
  const body = {
    deviceId,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms: alarms.map(({ id, time, label, isActive, days }) => ({ id, time, label, isActive, days })),
    subscription: subscription?.toJSON() ?? null,
  };
  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};
```

Call sites in `App.tsx`:

1. After the user grants notification permission and a push subscription is obtained.
2. Whenever `state.alarms` changes (debounced ~2 s).

### 5.4 Service Worker Update

`public/sw.js` currently ignores `SHOW_NOTIFICATION` postMessages from `sendAlarmNotification`. Add:

```js
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(event.data.title || 'AetherClock', {
        body: event.data.body || 'Your alarm is ringing.',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: 'aetherclock-alarm',
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { url: event.data.url || '/' },
      })
    );
  }
});
```

---

## 6. Backend API (Pages Functions)

Directory: `functions/`

### 6.1 `GET /api/vapid-public-key`

Response:

```json
{
  "publicKey": "BGxK..."
}
```

Reads `env.VAPID_PUBLIC_KEY`.

### 6.2 `POST /api/subscribe`

Upserts a full device record.

Request body:

```json
{
  "deviceId": "...",
  "timezone": "Europe/Berlin",
  "alarms": [...],
  "subscription": {...}
}
```

Validation:

- `deviceId` must be a non-empty string.
- `timezone` must be a valid IANA time zone (test via `Intl.DateTimeFormat(undefined, { timeZone })`).
- `alarms` is an array; each alarm has `id`, `time` (`HH:MM`), `label`, `isActive`, `days`.
- `subscription` is either `null` or a valid `PushSubscriptionJSON` object.

On success, stores in KV as `device:<deviceId>` and returns `{ ok: true }`.

### 6.3 `POST /api/alarms`

Lightweight alias to update only the alarms/timezone of an existing device record.

### 6.4 `POST /api/unsubscribe`

Sets `subscription` to `null` for the device (or deletes the record if it has no alarms). Returns `{ ok: true }`.

### 6.5 `GET /api/health`

Returns `{ ok: true }` for uptime checks.

---

## 7. Cron Worker

Directory: `cron-worker/`

### 7.1 Worker Entry

```ts
import { sendNotification } from 'web-push-neo';
import type { PushSubscription } from 'web-push-neo';

export interface Env {
  AETHERCLOCK_KV: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkAndFireAlarms(env));
  },
};
```

### 7.2 Scheduling Logic

```ts
const checkAndFireAlarms = async (env: Env): Promise<void> => {
  const { keys } = await env.AETHERCLOCK_KV.list({ prefix: 'device:' });
  const now = new Date();

  await Promise.all(
    keys.map(async ({ name }) => {
      const record = await env.AETHERCLOCK_KV.get<DeviceRecord>(name, 'json');
      if (!record?.subscription || record.alarms.length === 0) return;

      let localParts: Intl.DateTimeFormatPart[];
      try {
        localParts = new Intl.DateTimeFormat('en-US', {
          timeZone: record.timezone,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          weekday: 'short',
        }).formatToParts(now);
      } catch {
        // Invalid or missing timezone; skip this device.
        return;
      }

      const localHour = Number(getPart(localParts, 'hour'));
      const localMinute = Number(getPart(localParts, 'minute'));
      const localWeekday = getPart(localParts, 'weekday')?.toLowerCase();
      const localTime = `${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}`;

      for (const alarm of record.alarms) {
        if (!alarm.isActive) continue;
        if (alarm.time !== localTime) continue;
        if (alarm.days.length > 0 && !alarm.days.includes(localWeekday as WeekDay)) continue;

        await sendAlarmPush(env, record.subscription, alarm);
      }
    })
  );
};
```

### 7.2.1 Scaling Notes

- `KVNamespace.list()` is paginated. For the initial rollout, a single list call is sufficient. If the user base grows beyond the list limit, implement cursor-based pagination.
- The worker fires all pushes concurrently with `Promise.all`. If there are many devices, batch or limit concurrency to avoid memory pressure.
- One minute granularity means alarms fire within the scheduled minute, not at the exact second.

### 7.3 Push Send & Cleanup

```ts
const sendAlarmPush = async (
  env: Env,
  subscription: PushSubscription,
  alarm: ServerAlarm,
): Promise<void> => {
  try {
    await sendNotification(
      subscription,
      JSON.stringify({
        title: 'AetherClock',
        body: `⏰ ${alarm.label} — ${alarm.time}`,
        tag: `aetherclock-alarm-${alarm.id}`,
        url: '/',
      }),
      {
        vapidDetails: {
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        },
        TTL: 60,
        urgency: 'high',
      },
    );
  } catch (err: any) {
    const status = err?.statusCode ?? 0;
    if (status === 404 || status === 410) {
      // Dead subscription; the next subscribe call from the client will fix it.
      // We do not delete the device record so alarms are not lost.
    }
  }
};
```

---

## 8. Security

- **Authentication:** The device UUID is the bearer token. The API accepts any UUID; knowing a UUID allows updating alarms for that device. This is acceptable for a zero-account MVP.
- **VAPID private key** is stored only as a Cloudflare secret, never in the repo.
- **HTTPS only.** Service workers and push subscriptions require a secure origin.
- **Input validation** on all API endpoints to prevent malformed KV writes.
- **CORS:** Functions should allow only the production origin and `localhost` during development.

---

## 9. Deployment & Secrets

### 9.1 VAPID Keys

Generate once:

```bash
pnpm exec tsx scripts/generate-vapid-keys.ts
```

Store:

- Public key: build-time env var / Pages environment variable.
- Private key: Cloudflare secret (`wrangler secret put VAPID_PRIVATE_KEY`).
- Subject: Cloudflare secret (`wrangler secret put VAPID_SUBJECT`).

### 9.2 Cloudflare KV

Create a KV namespace in the Cloudflare dashboard and bind it as `AETHERCLOCK_KV` for:

- AetherClock Pages project (Functions bindings)
- AetherClock Cron Worker (`wrangler.toml`)

### 9.3 Pages Functions

Cloudflare Pages auto-detects the `functions/` directory on the next git push. Bind `AETHERCLOCK_KV` and the VAPID env vars in the dashboard.

### 9.4 Cron Worker

Deploy from `cron-worker/`:

```bash
cd cron-worker
wrangler deploy
```

`wrangler.toml`:

```toml
name = "aetherclock-cron-worker"
main = "src/index.ts"
compatibility_date = "2026-06-01"

[[kv_namespaces]]
binding = "AETHERCLOCK_KV"
id = "<kv-namespace-id>"

[triggers]
crons = ["* * * * *"]
```

---

## 10. Local Development

### Pages Functions + KV

```bash
# .dev.vars in repo root
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com

pnpm wrangler pages dev dist --kv AETHERCLOCK_KV --local
```

### Cron Worker

```bash
cd cron-worker
# .dev.vars
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com

pnpm wrangler dev --test-scheduled
# Trigger manually:
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
```

### Browser Push in Dev

Use `chrome://serviceworker-internals` or the Application tab to inspect subscriptions. Push events can be simulated from DevTools > Service Workers > Push.

---

## 11. Testing Strategy

### Unit Tests

Add `services/alarm-server.test.ts` (shared logic extracted to `services/alarmServer.ts`):

- Alarm/timezone matching for a fixed UTC instant.
- KV record validation.
- Device record serialization/deserialization.

### Service Worker Tests

Manual for now: register SW, trigger a push, verify notification appears.

### Integration Tests

- Local Cron Worker + Pages Functions: create a device record with an alarm 1 minute in the future, manually fire the scheduled handler, assert a push is sent.

---

## 12. Rollout / Fallback

1. Merge the feature behind the existing notification toggle.
2. If push permission is denied, the app continues to use the existing foreground `setInterval` scheduler.
3. If the backend is unreachable, alarms still work while the tab is open.

---

## 13. Open Questions

1. Do we want to keep stale device records forever, or add a weekly cleanup Cron Trigger that removes records with no subscription and no active alarms?
2. Should the notification payload include the alarm label in the user’s locale, or always in the language the alarm was created?
3. Do we need a separate "test push" button in the alarm settings so users can verify delivery?

---

## 14. Summary

AetherClock will gain a robust background alarm by:

- Subscribing the PWA to Web Push with a VAPID key.
- Storing device alarms + subscriptions in Cloudflare KV.
- Running a minute-by-minute Cron Worker that checks each device’s local time and fires a push when an alarm matches.
- Showing the push as a native notification via the existing service worker.

This keeps the personalized wake-up logic in the frontend while making the "wake-up ping" reliable even when the app is closed.

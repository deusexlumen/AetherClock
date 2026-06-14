# Web Push Background Alarm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cloudflare-backed Web Push background alarm so AetherClock can wake the user even when the browser tab/PWA is closed.

**Architecture:** The frontend subscribes to push notifications and syncs a per-device alarm subset to Cloudflare KV via Pages Functions. A separate Cloudflare Worker runs on a Cron Trigger every minute, reads all device records from KV, checks each device’s local time against its active alarms, and sends a Web Push notification via `web-push-neo` when an alarm fires. The existing service worker displays the notification.

**Tech Stack:** React 19, Vite 6, TypeScript 5.8, Vitest, Cloudflare Pages Functions, Cloudflare KV, Cloudflare Worker Cron Trigger, `web-push-neo`, Wrangler.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `types.ts` | Shared types: `ServerAlarm`, `PushSubscriptionJSON`, `DeviceRecord`. |
| `services/alarmServer.ts` | Timezone-aware alarm-matching logic shared by frontend tests and cron worker. |
| `services/alarmServer.test.ts` | Unit tests for alarm matching. |
| `services/pwa.ts` | Push subscription helpers (`subscribeToPush`, `getExistingPushSubscription`). |
| `services/pushBackend.ts` | HTTP client for the Pages Functions API. |
| `services/pushBackend.test.ts` | Unit tests for the backend client. |
| `public/sw.js` | Service worker: add `message` handler for foreground `SHOW_NOTIFICATION`. |
| `App.tsx` | Wire push permission, subscription, and alarm sync into the app lifecycle. |
| `functions/_shared/validation.ts` | Input validators for Pages Functions. |
| `functions/_shared/validation.test.ts` | Unit tests for validators. |
| `functions/_shared/cors.ts` | CORS helper for Pages Functions. |
| `functions/api/vapid-public-key.ts` | `GET /api/vapid-public-key`. |
| `functions/api/subscribe.ts` | `POST /api/subscribe` — upserts full device record. |
| `functions/api/alarms.ts` | `POST /api/alarms` — updates only alarms/timezone. |
| `functions/api/unsubscribe.ts` | `POST /api/unsubscribe` — clears subscription. |
| `functions/api/health.ts` | `GET /api/health`. |
| `scripts/generate-vapid-keys.ts` | One-off script to generate VAPID keys. |
| `cron-worker/wrangler.toml` | Cron Worker config, KV binding, cron schedule. |
| `cron-worker/src/index.ts` | Worker entry with `scheduled` handler. |
| `cron-worker/src/alarmChecker.ts` | Alarm scan + Web Push send logic. |
| `vitest.config.ts` | Include `functions/**/*.test.ts` in test glob. |
| `package.json` | Add deps/scripts for wrangler, web-push-neo, tsx. |
| `.gitignore` | Ignore `.dev.vars` and `cron-worker/.dev.vars`. |

---

## Task 1: Shared Types and Alarm-Matching Logic

**Files:**
- Modify: `types.ts`
- Create: `services/alarmServer.ts`
- Create: `services/alarmServer.test.ts`

### Step 1.1: Add server-side types to `types.ts`

```ts
export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: PushSubscriptionKeys;
}

export interface ServerAlarm {
  id: string;
  time: string; // HH:MM
  label: string;
  isActive: boolean;
  days: WeekDay[];
}

export interface DeviceRecord {
  deviceId: string;
  subscription: PushSubscriptionJSON | null;
  alarms: ServerAlarm[];
  timezone: string;
  updatedAt: string;
}
```

### Step 1.2: Create `services/alarmServer.ts`

```ts
/*
 * PURPOSE: Timezone-aware alarm matching shared between client tests and cron worker
 * ARCHITECTURE: services/alarmServer
 * DEPENDENCIES: types
 * PIPELINE: test
 * LAST_VALIDATED: 2026-06-13
 */

import { ServerAlarm, WeekDay, WEEKDAYS } from '../types';

export interface LocalTimeParts {
  time: string; // HH:MM
  weekday: WeekDay;
}

const REVERSE_DAY_MAP: Record<string, WeekDay> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

const getPart = (parts: Intl.DateTimeFormatPart[], type: string): string | undefined =>
  parts.find((p) => p.type === type)?.value;

export const getLocalTimeParts = (timezone: string, date: Date): LocalTimeParts | null => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).formatToParts(date);

    const hour = Number(getPart(parts, 'hour'));
    const minute = Number(getPart(parts, 'minute'));
    const shortWeekday = getPart(parts, 'weekday');
    if (Number.isNaN(hour) || Number.isNaN(minute) || !shortWeekday) return null;

    const weekday = REVERSE_DAY_MAP[shortWeekday];
    if (!WEEKDAYS.includes(weekday)) return null;

    return {
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      weekday,
    };
  } catch {
    return null;
  }
};

export const isAlarmFiring = (
  alarm: ServerAlarm,
  localTime: string,
  localWeekday: WeekDay,
): boolean => {
  if (!alarm.isActive) return false;
  if (alarm.time !== localTime) return false;
  if (alarm.days.length > 0 && !alarm.days.includes(localWeekday)) return false;
  return true;
};
```

### Step 1.3: Create `services/alarmServer.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { getLocalTimeParts, isAlarmFiring } from './alarmServer';

describe('getLocalTimeParts', () => {
  it('returns Berlin 07:00 on Monday for a known UTC instant', () => {
    // 2026-06-15 05:00 UTC is Monday 07:00 in Europe/Berlin
    const date = new Date('2026-06-15T05:00:00.000Z');
    const result = getLocalTimeParts('Europe/Berlin', date);
    expect(result).toEqual({ time: '07:00', weekday: 'mon' });
  });

  it('returns null for invalid timezone', () => {
    const result = getLocalTimeParts('Mars/Olympus', new Date());
    expect(result).toBeNull();
  });
});

describe('isAlarmFiring', () => {
  it('fires on matching time and weekday', () => {
    const alarm = { id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] as const };
    expect(isAlarmFiring(alarm as any, '07:00', 'mon')).toBe(true);
  });

  it('does not fire on wrong weekday', () => {
    const alarm = { id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] as const };
    expect(isAlarmFiring(alarm as any, '07:00', 'tue')).toBe(false);
  });

  it('fires every day when days is empty', () => {
    const alarm = { id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: [] as const };
    expect(isAlarmFiring(alarm as any, '07:00', 'wed')).toBe(true);
  });

  it('does not fire when inactive', () => {
    const alarm = { id: 'a1', time: '07:00', label: 'Wake', isActive: false, days: [] as const };
    expect(isAlarmFiring(alarm as any, '07:00', 'mon')).toBe(false);
  });
});
```

### Step 1.4: Run tests

Run:

```bash
pnpm test
```

Expected: `services/alarmServer.test.ts` passes.

### Step 1.5: Commit

```bash
git add types.ts services/alarmServer.ts services/alarmServer.test.ts
pnpm exec tsc --noEmit
pnpm test
git commit -m "feat(web-push): add shared timezone alarm matching logic"
```

---

## Task 2: Dependencies, VAPID Keys, and Local Config

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `scripts/generate-vapid-keys.ts`
- Create: `.dev.vars.example`

### Step 2.1: Install dependencies

Run:

```bash
pnpm add -D @cloudflare/workers-types wrangler tsx web-push-neo
```

### Step 2.2: Update `tsconfig.json` types

Add `@cloudflare/workers-types` to the `types` array:

```json
{
  "compilerOptions": {
    "types": ["node", "@cloudflare/workers-types"]
  }
}
```

### Step 2.3: Create root `wrangler.toml`

This tells Wrangler how to serve the Pages Functions and bind KV locally.

```toml
name = "aetherclock"
pages_build_output_dir = "./dist"
compatibility_date = "2026-06-01"

[[kv_namespaces]]
binding = "AETHERCLOCK_KV"
id = "<production-kv-namespace-id>"
preview_id = "<preview-kv-namespace-id>"

[vars]
VAPID_PUBLIC_KEY = "<public-key>"
VAPID_SUBJECT = "mailto:you@example.com"
```

`VAPID_PRIVATE_KEY` must **not** appear here; it lives in `.dev.vars` locally and in Cloudflare secrets in production.

### Step 2.4: Add scripts to `package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "dev:pages": "wrangler pages dev dist --local",
    "deploy:cron": "wrangler deploy --config cron-worker/wrangler.toml",
    "generate-vapid": "tsx scripts/generate-vapid-keys.ts"
  }
}
```

### Step 2.5: Create `scripts/generate-vapid-keys.ts`

```ts
import { generateVAPIDKeys } from 'web-push-neo';

const keys = await generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_SUBJECT=mailto:you@example.com');
```

### Step 2.6: Create `.dev.vars.example`

```
VAPID_PUBLIC_KEY=replace_with_public_key
VAPID_PRIVATE_KEY=replace_with_private_key
VAPID_SUBJECT=mailto:you@example.com
```

### Step 2.7: Update `.gitignore`

Append:

```gitignore
# Cloudflare local secrets
.dev.vars
cron-worker/.dev.vars
```

### Step 2.8: Generate real local keys

Run:

```bash
cp .dev.vars.example .dev.vars
pnpm generate-vapid
```

Copy the printed values into `.dev.vars` (do **not** commit this file).

### Step 2.9: Commit

```bash
git add package.json pnpm-lock.yaml tsconfig.json wrangler.toml .gitignore .dev.vars.example scripts/generate-vapid-keys.ts
pnpm exec tsc --noEmit
git commit -m "chore(web-push): add wrangler, web-push-neo, VAPID key script"
```

---

## Task 3: Pages Functions API

**Files:**
- Create: `functions/_shared/validation.ts`
- Create: `functions/_shared/validation.test.ts`
- Create: `functions/_shared/cors.ts`
- Create: `functions/api/vapid-public-key.ts`
- Create: `functions/api/subscribe.ts`
- Create: `functions/api/alarms.ts`
- Create: `functions/api/unsubscribe.ts`
- Create: `functions/api/health.ts`
- Modify: `vitest.config.ts`

### Step 3.1: Update `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['services/**/*.test.ts', 'components/**/*.test.ts', 'functions/**/*.test.ts'],
  },
});
```

### Step 3.2: Create `functions/_shared/validation.ts`

```ts
import { DeviceRecord, ServerAlarm, WeekDay, WEEKDAYS } from '../../types';

const TIME_RE = /^\d{2}:\d{2}$/;

export const isValidTime = (value: unknown): value is string =>
  typeof value === 'string' && TIME_RE.test(value);

export const isValidWeekDay = (value: unknown): value is WeekDay =>
  typeof value === 'string' && (WEEKDAYS as readonly string[]).includes(value);

export const isValidServerAlarm = (value: unknown): value is ServerAlarm => {
  if (typeof value !== 'object' || value === null) return false;
  const alarm = value as Record<string, unknown>;
  return (
    typeof alarm.id === 'string' &&
    isValidTime(alarm.time) &&
    typeof alarm.label === 'string' &&
    typeof alarm.isActive === 'boolean' &&
    Array.isArray(alarm.days) &&
    alarm.days.every(isValidWeekDay)
  );
};

export const isValidSubscription = (value: unknown): value is DeviceRecord['subscription'] => {
  if (value === null) return true;
  if (typeof value !== 'object' || value === null) return false;
  const sub = value as Record<string, unknown>;
  if (typeof sub.endpoint !== 'string') return false;
  if (sub.expirationTime !== null && typeof sub.expirationTime !== 'number') return false;
  if (typeof sub.keys !== 'object' || sub.keys === null) return false;
  const keys = sub.keys as Record<string, unknown>;
  return typeof keys.p256dh === 'string' && typeof keys.auth === 'string';
};

export const isValidTimezone = (value: unknown): value is string => {
  if (typeof value !== 'string' || value === '') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const isValidDeviceRecord = (value: unknown): value is DeviceRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.deviceId === 'string' &&
    rec.deviceId.length > 0 &&
    isValidTimezone(rec.timezone) &&
    Array.isArray(rec.alarms) &&
    rec.alarms.every(isValidServerAlarm) &&
    isValidSubscription(rec.subscription)
  );
};
```

### Step 3.3: Create `functions/_shared/validation.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { isValidServerAlarm, isValidDeviceRecord, isValidTimezone } from './validation';

describe('validation', () => {
  it('validates a correct server alarm', () => {
    expect(isValidServerAlarm({ id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] })).toBe(true);
  });

  it('rejects invalid alarm time', () => {
    expect(isValidServerAlarm({ id: 'a1', time: '7:00', label: 'Wake', isActive: true, days: [] })).toBe(false);
  });

  it('validates a correct device record', () => {
    expect(
      isValidDeviceRecord({
        deviceId: 'dev-1',
        timezone: 'Europe/Berlin',
        alarms: [{ id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] }],
        subscription: null,
      }),
    ).toBe(true);
  });

  it('rejects invalid timezone', () => {
    expect(isValidTimezone('Mars/Phobos')).toBe(false);
  });
});
```

### Step 3.4: Create `functions/_shared/cors.ts`

```ts
const ALLOWED_ORIGINS = ['https://aetherclock.pages.dev', 'http://localhost:5173', 'http://localhost:8788'];

export const corsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
};

export const jsonResponse = (data: unknown, request: Request, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });

export const errorResponse = (message: string, request: Request, status = 400): Response =>
  jsonResponse({ ok: false, error: message }, request, status);
```

### Step 3.5: Create `functions/_middleware.ts`

This handles CORS preflight and attaches CORS headers to every function response.

```ts
import type { PagesFunction } from '@cloudflare/workers-types';
import { corsHeaders } from './_shared/cors';

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(context.request) });
  }
  const response = await context.next();
  const headers = corsHeaders(context.request);
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
};
```

### Step 3.6: Create `functions/api/vapid-public-key.ts`

```ts
import type { PagesFunction } from '@cloudflare/workers-types';
import { jsonResponse } from '../_shared/cors';

interface Env {
  VAPID_PUBLIC_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return jsonResponse({ publicKey: context.env.VAPID_PUBLIC_KEY }, context.request);
};
```

### Step 3.7: Create `functions/api/health.ts`

```ts
import type { PagesFunction } from '@cloudflare/workers-types';
import { jsonResponse } from '../_shared/cors';

export const onRequestGet: PagesFunction = async (context) => {
  return jsonResponse({ ok: true }, context.request);
};
```

### Step 3.8: Create `functions/api/subscribe.ts`

```ts
import type { PagesFunction } from '@cloudflare/workers-types';
import { DeviceRecord } from '../../types';
import { jsonResponse, errorResponse } from '../_shared/cors';
import { isValidDeviceRecord } from '../_shared/validation';

interface Env {
  AETHERCLOCK_KV: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse('Invalid JSON', context.request);
  }

  const record: DeviceRecord = {
    ...(body as Record<string, unknown>),
    updatedAt: new Date().toISOString(),
  } as DeviceRecord;

  if (!isValidDeviceRecord(record)) {
    return errorResponse('Invalid device record', context.request, 422);
  }

  await context.env.AETHERCLOCK_KV.put(`device:${record.deviceId}`, JSON.stringify(record));
  return jsonResponse({ ok: true }, context.request);
};
```

### Step 3.9: Create `functions/api/alarms.ts`

```ts
import type { PagesFunction } from '@cloudflare/workers-types';
import { DeviceRecord, ServerAlarm } from '../../types';
import { jsonResponse, errorResponse } from '../_shared/cors';
import { isValidServerAlarm, isValidTimezone } from '../_shared/validation';

interface Env {
  AETHERCLOCK_KV: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Invalid JSON', context.request);
  }

  const deviceId = body.deviceId;
  if (typeof deviceId !== 'string' || deviceId.length === 0) {
    return errorResponse('Missing deviceId', context.request, 422);
  }

  const timezone = body.timezone;
  if (!isValidTimezone(timezone)) {
    return errorResponse('Invalid timezone', context.request, 422);
  }

  const alarms = body.alarms;
  if (!Array.isArray(alarms) || !alarms.every(isValidServerAlarm)) {
    return errorResponse('Invalid alarms', context.request, 422);
  }

  const key = `device:${deviceId}`;
  const existing = await context.env.AETHERCLOCK_KV.get<DeviceRecord>(key, 'json');

  const record: DeviceRecord = {
    deviceId,
    timezone,
    alarms: alarms as ServerAlarm[],
    subscription: existing?.subscription ?? null,
    updatedAt: new Date().toISOString(),
  };

  await context.env.AETHERCLOCK_KV.put(key, JSON.stringify(record));
  return jsonResponse({ ok: true }, context.request);
};
```

### Step 3.10: Create `functions/api/unsubscribe.ts`

```ts
import type { PagesFunction } from '@cloudflare/workers-types';
import { DeviceRecord } from '../../types';
import { jsonResponse, errorResponse } from '../_shared/cors';

interface Env {
  AETHERCLOCK_KV: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Invalid JSON', context.request);
  }

  const deviceId = body.deviceId;
  if (typeof deviceId !== 'string' || deviceId.length === 0) {
    return errorResponse('Missing deviceId', context.request, 422);
  }

  const key = `device:${deviceId}`;
  const existing = await context.env.AETHERCLOCK_KV.get<DeviceRecord>(key, 'json');

  if (existing) {
    if (existing.alarms.length === 0) {
      await context.env.AETHERCLOCK_KV.delete(key);
    } else {
      const updated: DeviceRecord = { ...existing, subscription: null, updatedAt: new Date().toISOString() };
      await context.env.AETHERCLOCK_KV.put(key, JSON.stringify(updated));
    }
  }

  return jsonResponse({ ok: true }, context.request);
};
```

### Step 3.11: Run tests

```bash
pnpm test
```

Expected: validation tests pass, TypeScript compiles.

### Step 3.12: Test Pages Functions locally

```bash
pnpm build
pnpm dev:pages
```

In another terminal:

```bash
curl http://localhost:8788/api/health
curl http://localhost:8788/api/vapid-public-key
```

Expected: JSON responses.

### Step 3.13: Commit

```bash
git add functions vitest.config.ts
pnpm exec tsc --noEmit
pnpm test
git commit -m "feat(web-push): add Pages Functions API for subscriptions and alarms"
```

---

## Task 4: Frontend Push Subscription and Backend Sync

**Files:**
- Modify: `services/pwa.ts`
- Create: `services/pushBackend.ts`
- Create: `services/pushBackend.test.ts`
- Modify: `public/sw.js`
- Modify: `App.tsx`

### Step 4.1: Extend `services/pwa.ts`

Add after existing imports/helpers:

```ts
const urlBase64ToUint8Array = (base64url: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

export const getExistingPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
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

export const unsubscribeFromPush = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    return subscription.unsubscribe();
  }
  return false;
};
```

### Step 4.2: Create `services/pushBackend.ts`

```ts
/*
 * PURPOSE: HTTP client for the AetherClock push backend
 * ARCHITECTURE: services/pushBackend
 * DEPENDENCIES: types
 * PIPELINE: test
 * LAST_VALIDATED: 2026-06-13
 */

import { Alarm, DeviceRecord, PushSubscriptionJSON } from '../types';

const API_BASE = '/api';

const toServerAlarms = (alarms: Alarm[]): DeviceRecord['alarms'] =>
  alarms.map(({ id, time, label, isActive, days }) => ({ id, time, label, isActive, days }));

export const fetchVapidPublicKey = async (): Promise<string> => {
  const res = await fetch(`${API_BASE}/vapid-public-key`);
  if (!res.ok) throw new Error('Failed to fetch VAPID public key');
  const data = await res.json();
  if (typeof data.publicKey !== 'string') throw new Error('Invalid VAPID response');
  return data.publicKey;
};

export const syncDevice = async (
  deviceId: string,
  alarms: Alarm[],
  subscription: PushSubscriptionJSON | null,
): Promise<void> => {
  const body: Omit<DeviceRecord, 'updatedAt'> = {
    deviceId,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms: toServerAlarms(alarms),
    subscription,
  };
  const res = await fetch(`${API_BASE}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to sync device');
};

export const syncAlarms = async (deviceId: string, alarms: Alarm[]): Promise<void> => {
  const res = await fetch(`${API_BASE}/alarms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      alarms: toServerAlarms(alarms),
    }),
  });
  if (!res.ok) throw new Error('Failed to sync alarms');
};

export const unsubscribeDevice = async (deviceId: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });
  if (!res.ok) throw new Error('Failed to unsubscribe device');
};
```

### Step 4.3: Create `services/pushBackend.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchVapidPublicKey, syncDevice } from './pushBackend';

describe('pushBackend', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetches VAPID public key', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ publicKey: 'BGxK...' }),
    });
    const key = await fetchVapidPublicKey();
    expect(key).toBe('BGxK...');
    expect(fetch).toHaveBeenCalledWith('/api/vapid-public-key');
  });

  it('syncs device with server alarm subset', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    await syncDevice('dev-1', [
      { id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'], genrePreset: 'auto', playlistConfig: {} as any, voiceBriefingConfig: {} as any },
    ], null);

    const call = (fetch as any).mock.calls[0];
    expect(call[0]).toBe('/api/subscribe');
    const body = JSON.parse(call[1].body);
    expect(body.deviceId).toBe('dev-1');
    expect(body.alarms[0]).toEqual({ id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] });
    expect(body.subscription).toBeNull();
  });
});
```

### Step 4.4: Update `public/sw.js`

Add after the `notificationclick` listener:

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

### Step 4.5: Wire push flow into `App.tsx`

Import new helpers:

```ts
import {
  registerServiceWorker,
  requestNotificationPermission,
  sendAlarmNotification,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingPushSubscription,
  isOnline,
  isStandalone,
  captureInstallPrompt,
} from './services/pwa';
import { fetchVapidPublicKey, syncDevice, syncAlarms, unsubscribeDevice } from './services/pushBackend';
import { PushSubscriptionJSON } from './types';
```

Add a device ID helper in `App.tsx`:

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

Add a `pushSubscription` ref/state. For the MVP, store the subscription in a ref and sync when alarms change:

```ts
const deviceIdRef = useRef<string>(getDeviceId());
const pushSubscriptionRef = useRef<PushSubscriptionJSON | null>(null);
```

After the user toggles notifications on (or on mount if already granted), subscribe:

```ts
const enablePushNotifications = async () => {
  const granted = await requestNotificationPermission();
  if (!granted) return;
  try {
    const publicKey = await fetchVapidPublicKey();
    const subscription = await subscribeToPush(publicKey);
    if (subscription) {
      pushSubscriptionRef.current = subscription.toJSON() as PushSubscriptionJSON;
      await syncDevice(deviceIdRef.current, state.alarms, pushSubscriptionRef.current);
    }
  } catch (err) {
    console.error('[Push] subscription failed', err);
  }
};
```

Sync alarms whenever `state.alarms` changes and the user is online and has a subscription:

```ts
useEffect(() => {
  if (!isOnline() || !pushSubscriptionRef.current) return;
  syncAlarms(deviceIdRef.current, state.alarms).catch((err) =>
    console.error('[Push] alarm sync failed', err)
  );
}, [state.alarms]);
```

Also call `registerServiceWorker()` in the existing initialization effect if not already there.

### Step 4.6: Run tests and type check

```bash
pnpm exec tsc --noEmit
pnpm test
```

Expected: all tests pass.

### Step 4.7: Commit

```bash
git add services/pwa.ts services/pushBackend.ts services/pushBackend.test.ts public/sw.js App.tsx
pnpm exec tsc --noEmit
pnpm test
git commit -m "feat(web-push): add frontend push subscription and backend sync"
```

---

## Task 5: Cron Worker

**Files:**
- Create: `cron-worker/wrangler.toml`
- Create: `cron-worker/.dev.vars.example`
- Create: `cron-worker/src/index.ts`
- Create: `cron-worker/src/alarmChecker.ts`

### Step 5.1: Create `cron-worker/wrangler.toml`

```toml
name = "aetherclock-cron-worker"
main = "src/index.ts"
compatibility_date = "2026-06-01"

[[kv_namespaces]]
binding = "AETHERCLOCK_KV"
id = "<your-kv-namespace-id>"

[triggers]
crons = ["* * * * *"]
```

### Step 5.2: Create `cron-worker/.dev.vars.example`

```
VAPID_PUBLIC_KEY=replace_with_public_key
VAPID_PRIVATE_KEY=replace_with_private_key
VAPID_SUBJECT=mailto:you@example.com
```

### Step 5.3: Create `cron-worker/src/alarmChecker.ts`

```ts
import { sendNotification, type PushSubscription } from 'web-push-neo';
import { DeviceRecord, ServerAlarm } from '../../types';
import { getLocalTimeParts, isAlarmFiring } from '../../services/alarmServer';

export interface Env {
  AETHERCLOCK_KV: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

const listAllDeviceKeys = async (kv: KVNamespace): Promise<string[]> => {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: 'device:', cursor });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
};

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
      // Dead subscription. The next frontend subscribe call will replace it.
    }
  }
};

export const checkAndFireAlarms = async (env: Env): Promise<void> => {
  const now = new Date();
  const keys = await listAllDeviceKeys(env.AETHERCLOCK_KV);

  await Promise.all(
    keys.map(async (name) => {
      const record = await env.AETHERCLOCK_KV.get<DeviceRecord>(name, 'json');
      if (!record?.subscription || record.alarms.length === 0) return;

      const local = getLocalTimeParts(record.timezone, now);
      if (!local) return;

      for (const alarm of record.alarms) {
        if (isAlarmFiring(alarm, local.time, local.weekday)) {
          await sendAlarmPush(env, record.subscription as PushSubscription, alarm);
        }
      }
    }),
  );
};
```

### Step 5.4: Create `cron-worker/src/index.ts`

```ts
import type { ScheduledController, ExecutionContext } from '@cloudflare/workers-types';
import { checkAndFireAlarms, type Env } from './alarmChecker';

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkAndFireAlarms(env));
  },
};
```

### Step 5.5: Copy `.dev.vars` for cron worker

```bash
cp cron-worker/.dev.vars.example cron-worker/.dev.vars
```

Fill in the same values as the root `.dev.vars`.

### Step 5.6: Test cron worker locally

```bash
pnpm wrangler dev --config cron-worker/wrangler.toml --test-scheduled
```

In another terminal:

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
```

Expected: no errors in the wrangler terminal. To verify end-to-end, seed a device record in KV with an alarm matching the current minute and a valid push subscription, then trigger the scheduled handler.

### Step 5.7: Commit

```bash
git add cron-worker
pnpm exec tsc --noEmit
pnpm test
git commit -m "feat(web-push): add Cloudflare Cron Worker for alarm push delivery"
```

---

## Task 6: Cloudflare Deployment

### Step 6.1: Create KV namespace

Create both a production and a preview namespace. The preview namespace is used by `wrangler pages dev --local` so local testing does not touch live data.

```bash
pnpm wrangler kv namespace create AETHERCLOCK_KV
pnpm wrangler kv namespace create AETHERCLOCK_KV_PREVIEW --preview
```

Copy the returned IDs into:

1. Root `wrangler.toml` under `[[kv_namespaces]]` (`id` and `preview_id`).
2. `cron-worker/wrangler.toml` under `[[kv_namespaces]]` (`id`).

### Step 6.2: Bind KV and secrets to Pages project

In the Cloudflare dashboard for `aetherclock.pages.dev`:

1. Go to **Settings > Functions > KV namespace bindings**.
2. Add binding name `AETHERCLOCK_KV` and select the production namespace.
3. Set `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` as environment variables (or rely on the values in root `wrangler.toml`).
4. Set `VAPID_PRIVATE_KEY` as an encrypted secret (it must never be a plain variable).

### Step 6.3: Set secrets for cron worker

```bash
pnpm wrangler secret put VAPID_PRIVATE_KEY --config cron-worker/wrangler.toml
pnpm wrangler secret put VAPID_PUBLIC_KEY --config cron-worker/wrangler.toml
pnpm wrangler secret put VAPID_SUBJECT --config cron-worker/wrangler.toml
```

### Step 6.4: Deploy Pages

Push `master` or merge the PR. Cloudflare Pages will auto-detect `functions/` and deploy them.

### Step 6.5: Deploy cron worker

```bash
pnpm deploy:cron
```

### Step 6.6: Verify production

1. Open the deployed PWA.
2. Enable notifications.
3. Create an alarm 1–2 minutes in the future.
4. Close the tab/PWA.
5. Wait for the scheduled minute. A system notification should arrive.

---

## Task 7: Documentation Update

**Files:**
- Modify: `AGENTS.md`

### Step 7.1: Add a Web Push section to `AGENTS.md`

Append:

```markdown
## Web Push Background Alarm

- Background notifications are delivered via Cloudflare KV + Web Push + a separate Cron Worker.
- The Pages Functions API lives in `functions/`.
- The Cron Worker lives in `cron-worker/` and is deployed separately.
- VAPID secrets are never committed; use `.dev.vars` locally and Cloudflare secrets in production.
- Shared alarm-matching logic is in `services/alarmServer.ts` and must stay environment-agnostic (no DOM/Node-only APIs).
```

### Step 7.2: Commit

```bash
git add AGENTS.md
git commit -m "docs: document web push background alarm architecture"
```

---

## Self-Review Checklist

- [ ] Every task has exact file paths.
- [ ] No placeholders ("TBD", "implement later", etc.).
- [ ] Type names (`ServerAlarm`, `DeviceRecord`, `PushSubscriptionJSON`) are consistent across spec, API, frontend, and cron worker.
- [ ] `services/alarmServer.ts` uses only `Intl` and has unit tests.
- [ ] `functions/` code validates inputs before KV writes.
- [ ] Cron worker paginates KV list and handles invalid timezones.
- [ ] `.dev.vars` is ignored and only `.dev.vars.example` is committed.
- [ ] `AGENTS.md` is updated.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-13-web-push-background-alarm-plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh coder subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans` with checkpoints.

Which approach?

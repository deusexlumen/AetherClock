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
    if ('cursor' in page) {
      cursor = page.cursor;
    } else {
      cursor = undefined;
    }
  } while (cursor);
  return keys;
};

const sendAlarmPush = async (
  env: Env,
  subscription: PushSubscription,
  alarm: ServerAlarm,
): Promise<boolean> => {
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
    return false; // not dead
  } catch (err: any) {
    const status = err?.statusCode ?? 0;
    if (status === 404 || status === 410) {
      return true; // dead subscription
    }
    console.error('[Push] send failed', err);
    return false;
  }
};

const BATCH_SIZE = 25;

export const checkAndFireAlarms = async (env: Env): Promise<void> => {
  const now = new Date();
  const keys = await listAllDeviceKeys(env.AETHERCLOCK_KV);

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (name) => {
        const record = await env.AETHERCLOCK_KV.get<DeviceRecord>(name, 'json');
        if (!record?.subscription || record.alarms.length === 0) return;

        const local = getLocalTimeParts(record.timezone, now);
        if (!local) return;

        let dead = false;
        for (const alarm of record.alarms) {
          if (isAlarmFiring(alarm, local.time, local.weekday)) {
            const isDead = await sendAlarmPush(
              env,
              record.subscription as PushSubscription,
              alarm,
            );
            if (isDead) dead = true;
          }
        }

        if (dead) {
          await env.AETHERCLOCK_KV.put(
            name,
            JSON.stringify({ ...record, subscription: null }),
          );
        }
      }),
    );
  }
};

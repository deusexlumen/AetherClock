import { sendNotification, type PushSubscription } from 'web-push-neo';
import { DeviceRecord, ServerAlarm } from '../../types';
import { getLocalTimeParts, isAlarmFiring } from '../../services/alarmServer';
import {
  importLegacyDevicesOnce,
  listRegisteredDeviceKeys,
  unregisterDevice,
  type AlarmRegistryEnv,
} from '../../functions/_shared/alarmRegistry';

export interface Env extends AlarmRegistryEnv {
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

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
  await importLegacyDevicesOnce(env);
  const keys = await listRegisteredDeviceKeys(env.ALARM_DB);

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (name) => {
        const record = await env.AETHERCLOCK_KV.get<DeviceRecord>(name, 'json');
        if (!record?.subscription || !record.alarms.some((alarm) => alarm.isActive)) {
          await unregisterDevice(env.ALARM_DB, name.slice('device:'.length));
          return;
        }

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
          await unregisterDevice(env.ALARM_DB, record.deviceId);
        }
      }),
    );
  }
};

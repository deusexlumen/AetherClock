import type { DeviceRecord } from '../../types';

export interface AlarmRegistryEnv {
  AETHERCLOCK_KV: KVNamespace;
  ALARM_DB: D1Database;
}

const DEVICE_PREFIX = 'device:';
const BOOTSTRAP_KEY = 'kv_device_import_v1';
const INSERT_DEVICE = 'INSERT OR IGNORE INTO alarm_registry_devices (device_id) VALUES (?)';
const DELETE_DEVICE = 'DELETE FROM alarm_registry_devices WHERE device_id = ?';

/** D1 provides atomic membership updates; KV remains the source of device records. */
export const isPushEligible = (record: DeviceRecord): boolean =>
  record.subscription !== null && record.alarms.some((alarm) => alarm.isActive);

export const syncDeviceRegistration = async (
  env: AlarmRegistryEnv,
  record: DeviceRecord,
): Promise<void> => {
  if (isPushEligible(record)) {
    await env.ALARM_DB.prepare(INSERT_DEVICE).bind(record.deviceId).run();
  } else {
    await unregisterDevice(env.ALARM_DB, record.deviceId);
  }
};

export const unregisterDevice = async (db: D1Database, deviceId: string): Promise<void> => {
  await db.prepare(DELETE_DEVICE).bind(deviceId).run();
};

export const listRegisteredDeviceKeys = async (db: D1Database): Promise<string[]> => {
  const result = await db.prepare('SELECT device_id FROM alarm_registry_devices').all<{ device_id: string }>();
  return (result.results ?? []).map(({ device_id }) => `${DEVICE_PREFIX}${device_id}`);
};

/**
 * One-time import of pre-existing device keys. It is safe to retry after failures:
 * only INSERT OR IGNORE is used, so an in-flight API registration is never overwritten.
 * Once committed, the minute cron never calls KV.list() again.
 */
export const importLegacyDevicesOnce = async (env: AlarmRegistryEnv): Promise<void> => {
  const state = await env.ALARM_DB.prepare(
    'SELECT value FROM alarm_registry_meta WHERE name = ?',
  ).bind(BOOTSTRAP_KEY).first<{ value: string }>();
  if (state?.value === 'done') return;

  let cursor: string | undefined;
  do {
    const page = await env.AETHERCLOCK_KV.list({ prefix: DEVICE_PREFIX, cursor });
    const deviceIds = page.keys
      .map(({ name }) => name.startsWith(DEVICE_PREFIX) ? name.slice(DEVICE_PREFIX.length) : '')
      .filter(Boolean);

    // Keep batches bounded for the Worker runtime. The import is idempotent.
    for (let i = 0; i < deviceIds.length; i += 100) {
      const statements = deviceIds.slice(i, i + 100)
        .map((deviceId) => env.ALARM_DB.prepare(INSERT_DEVICE).bind(deviceId));
      await env.ALARM_DB.batch(statements);
    }

    if (page.list_complete) break;
    if (!('cursor' in page) || !page.cursor) throw new Error('KV listing was incomplete without a cursor');
    cursor = page.cursor;
  } while (cursor);

  await env.ALARM_DB.prepare(
    'INSERT INTO alarm_registry_meta (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value',
  ).bind(BOOTSTRAP_KEY, 'done').run();
};

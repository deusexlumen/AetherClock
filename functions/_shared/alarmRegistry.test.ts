import { describe, expect, it, vi } from 'vitest';
import type { DeviceRecord } from '../../types';
import {
  importLegacyDevicesOnce,
  isPushEligible,
  listRegisteredDeviceKeys,
  syncDeviceRegistration,
  type AlarmRegistryEnv,
} from './alarmRegistry';

const activeRecord = (deviceId: string): DeviceRecord => ({
  deviceId,
  timezone: 'Europe/Berlin',
  updatedAt: new Date('2026-10-25T00:00:00Z').toISOString(),
  subscription: {
    endpoint: 'https://push.example/endpoint',
    expirationTime: null,
    keys: { p256dh: 'p256dh', auth: 'auth' },
  },
  alarms: [{ id: 'alarm-1', time: '07:00', label: 'Wake', isActive: true, days: [] }],
});

const createEnv = (pages: Array<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>) => {
  const devices = new Set<string>();
  const meta = new Map<string, string>();
  const list = vi.fn(async ({ cursor }: { cursor?: string }) => pages[cursor ? Number(cursor) : 0]);
  const prepare = vi.fn((sql: string) => ({
    bind: (...params: string[]) => ({
      run: async () => {
        if (sql.startsWith('INSERT OR IGNORE')) devices.add(params[0]);
        if (sql.startsWith('DELETE FROM alarm_registry_devices')) devices.delete(params[0]);
        if (sql.startsWith('INSERT INTO alarm_registry_meta')) meta.set(params[0], params[1]);
        return { success: true };
      },
      first: async () => {
        const value = meta.get(params[0]);
        return value === undefined ? null : { value };
      },
    }),
    all: async () => ({ results: [...devices].map((device_id) => ({ device_id })) }),
  }));
  const db = {
    prepare,
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) =>
      Promise.all(statements.map((statement) => statement.run())),
  } as unknown as D1Database;
  const env = { ALARM_DB: db, AETHERCLOCK_KV: { list } } as unknown as AlarmRegistryEnv;
  return { env, devices, meta, list };
};

describe('D1 device registry', () => {
  it('tracks only subscribed devices with active alarms', async () => {
    const { env, devices } = createEnv([]);
    const record = activeRecord('a');
    expect(isPushEligible(record)).toBe(true);
    await syncDeviceRegistration(env, record);
    expect([...devices]).toEqual(['a']);

    await syncDeviceRegistration(env, { ...record, alarms: [{ ...record.alarms[0], isActive: false }] });
    expect([...devices]).toEqual([]);
    expect(isPushEligible({ ...record, subscription: null })).toBe(false);
  });

  it('imports legacy KV devices once and never lists again', async () => {
    const { env, devices, list } = createEnv([
      { keys: [{ name: 'device:a' }, { name: 'other:ignored' }], list_complete: false, cursor: '1' },
      { keys: [{ name: 'device:b' }], list_complete: true },
    ]);
    await importLegacyDevicesOnce(env);
    expect([...devices].sort()).toEqual(['a', 'b']);
    expect(list).toHaveBeenCalledTimes(2);

    await importLegacyDevicesOnce(env);
    expect(list).toHaveBeenCalledTimes(2);
    expect((await listRegisteredDeviceKeys(env.ALARM_DB)).sort()).toEqual(['device:a', 'device:b']);
  });

  it('does not mark a broken backfill as complete', async () => {
    const { env, meta } = createEnv([
      { keys: [{ name: 'device:a' }], list_complete: false },
    ]);
    await expect(importLegacyDevicesOnce(env)).rejects.toThrow('without a cursor');
    expect(meta.has('kv_device_import_v1')).toBe(false);
  });
});

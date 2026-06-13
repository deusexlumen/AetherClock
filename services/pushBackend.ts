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
  const data = await res.json() as { publicKey?: unknown };
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

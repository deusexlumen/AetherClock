import type { PagesFunction } from '@cloudflare/workers-types';
import { DeviceRecord } from '../../types';
import { jsonResponse, errorResponse } from '../_shared/cors';
import {
  syncDeviceRegistration,
  unregisterDevice,
  type AlarmRegistryEnv,
} from '../_shared/alarmRegistry';

interface Env extends AlarmRegistryEnv {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('Invalid JSON', context.request);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return errorResponse('Expected a JSON object', context.request, 400);
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
      await unregisterDevice(context.env.ALARM_DB, deviceId);
    } else {
      const updated: DeviceRecord = { ...existing, subscription: null, updatedAt: new Date().toISOString() };
      await context.env.AETHERCLOCK_KV.put(key, JSON.stringify(updated));
      await syncDeviceRegistration(context.env, updated);
    }
  } else {
    await unregisterDevice(context.env.ALARM_DB, deviceId);
  }

  return jsonResponse({ ok: true }, context.request);
};

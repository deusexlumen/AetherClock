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

import type { PagesFunction } from '@cloudflare/workers-types';
import { DeviceRecord, PushSubscriptionJSON } from '../../types';
import { jsonResponse, errorResponse } from '../_shared/cors';
import { isValidSubscription } from '../_shared/validation';

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

  const subscription = body.subscription;
  if (!isValidSubscription(subscription)) {
    return errorResponse('Invalid subscription', context.request, 422);
  }

  const key = `device:${deviceId}`;
  const existing = await context.env.AETHERCLOCK_KV.get<DeviceRecord>(key, 'json');
  if (!existing) {
    return errorResponse('Device not found', context.request, 404);
  }

  const updated: DeviceRecord = {
    ...existing,
    subscription: subscription as PushSubscriptionJSON,
    updatedAt: new Date().toISOString(),
  };

  await context.env.AETHERCLOCK_KV.put(key, JSON.stringify(updated));
  return jsonResponse({ ok: true }, context.request);
};

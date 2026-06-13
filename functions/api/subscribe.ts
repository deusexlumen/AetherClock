import type { PagesFunction } from '@cloudflare/workers-types';
import { DeviceRecord, ServerAlarm } from '../../types';
import { jsonResponse, errorResponse } from '../_shared/cors';
import {
  isValidDeviceRecord,
  isValidServerAlarm,
  isValidSubscription,
  isValidTimezone,
} from '../_shared/validation';

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

  const subscription = body.subscription;
  if (!isValidSubscription(subscription)) {
    return errorResponse('Invalid subscription', context.request, 422);
  }

  const record: DeviceRecord = {
    deviceId,
    timezone,
    alarms: alarms as ServerAlarm[],
    subscription,
    updatedAt: new Date().toISOString(),
  };

  if (!isValidDeviceRecord(record)) {
    return errorResponse('Invalid device record', context.request, 422);
  }

  await context.env.AETHERCLOCK_KV.put(`device:${record.deviceId}`, JSON.stringify(record));
  return jsonResponse({ ok: true }, context.request);
};

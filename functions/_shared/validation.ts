import { DeviceRecord, ServerAlarm, WeekDay, WEEKDAYS } from '../../types';

const TIME_RE = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

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
    isValidSubscription(rec.subscription) &&
    typeof rec.updatedAt === 'string'
  );
};

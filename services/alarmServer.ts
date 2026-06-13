/*
 * PURPOSE: Timezone-aware alarm matching shared between client tests and cron worker
 * ARCHITECTURE: services/alarmServer
 * DEPENDENCIES: types
 * PIPELINE: test
 * LAST_VALIDATED: 2026-06-13
 */

import { ServerAlarm, WeekDay, WEEKDAYS } from '../types';

export interface LocalTimeParts {
  time: string; // HH:MM
  weekday: WeekDay;
}

const REVERSE_DAY_MAP: Record<string, WeekDay> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

const getPart = (parts: Intl.DateTimeFormatPart[], type: string): string | undefined =>
  parts.find((p) => p.type === type)?.value;

export const getLocalTimeParts = (timezone: string, date: Date): LocalTimeParts | null => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).formatToParts(date);

    const hour = Number(getPart(parts, 'hour'));
    const minute = Number(getPart(parts, 'minute'));
    const shortWeekday = getPart(parts, 'weekday');
    if (Number.isNaN(hour) || Number.isNaN(minute) || !shortWeekday) return null;

    const weekday = REVERSE_DAY_MAP[shortWeekday];
    if (!WEEKDAYS.includes(weekday)) return null;

    return {
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      weekday,
    };
  } catch {
    return null;
  }
};

export const isAlarmFiring = (
  alarm: ServerAlarm,
  localTime: string,
  localWeekday: WeekDay,
): boolean => {
  if (!alarm.isActive) return false;
  if (alarm.time !== localTime) return false;
  if (alarm.days.length > 0 && !alarm.days.includes(localWeekday)) return false;
  return true;
};

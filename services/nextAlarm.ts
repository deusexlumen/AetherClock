import type { Alarm, WeekDay } from '../types';
const DAY_INDEX: WeekDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export interface NextAlarmOccurrence { alarm: Alarm; date: Date; millisecondsUntil: number; }
function occurrenceForDay(alarm: Alarm, now: Date, offset: number): Date | null {
  const candidate = new Date(now); candidate.setDate(now.getDate() + offset);
  const day = DAY_INDEX[candidate.getDay()];
  if (alarm.days.length > 0 && !alarm.days.includes(day)) return null;
  const [hours, minutes] = alarm.time.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  candidate.setHours(hours, minutes, 0, 0); return candidate;
}
export function getNextAlarmOccurrence(alarms: Alarm[], now: Date): NextAlarmOccurrence | null {
  let next: NextAlarmOccurrence | null = null;
  for (const alarm of alarms) {
    if (!alarm.isActive) continue;
    for (let offset = 0; offset <= 7; offset += 1) {
      const date = occurrenceForDay(alarm, now, offset);
      if (!date || date.getTime() <= now.getTime()) continue;
      if (!next || date.getTime() < next.date.getTime()) next = { alarm, date, millisecondsUntil: date.getTime() - now.getTime() };
      break;
    }
  }
  return next;
}
export function formatAlarmCountdown(milliseconds: number): string {
  if (milliseconds < 60_000) return 'due in less than a minute';
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1440); const hours = Math.floor((totalMinutes % 1440) / 60); const minutes = totalMinutes % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}
export function formatAlarmDate(date: Date, now: Date): string {
  const start = new Date(now); start.setHours(0, 0, 0, 0); const target = new Date(date); target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (days === 0) return `Today · ${time}`; if (days === 1) return `Tomorrow · ${time}`;
  return `${date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} · ${time}`;
}

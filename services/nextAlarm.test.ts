import { describe, expect, it } from 'vitest';
import type { Alarm } from '../types';
import { formatAlarmCountdown, getNextAlarmOccurrence } from './nextAlarm';
const alarm = (id: string, time: string, days: Alarm['days'] = [], isActive = true): Alarm => ({ id, time, days, isActive, label: id, genrePreset: 'auto', playlistConfig: { enabled: true, trackCount: 1, shuffle: false, crossfadeSeconds: 0 }, voiceBriefingConfig: { enabled: false, voiceName: 'Kore', includeWeather: false, includeAgenda: false, includeTime: true, customGreeting: '' } });
describe('next alarm occurrence', () => {
  const now = new Date('2026-10-29T09:00:00');
  it('selects the next daily alarm, including tomorrow', () => { const result = getNextAlarmOccurrence([alarm('later', '10:30'), alarm('tomorrow', '08:00')], now); expect(result?.alarm.id).toBe('later'); expect(result?.millisecondsUntil).toBe(90 * 60 * 1000); expect(getNextAlarmOccurrence([alarm('tomorrow', '08:00')], now)?.date.getDate()).toBe(30); });
  it('honors weekdays and disabled alarms', () => { const result = getNextAlarmOccurrence([alarm('disabled', '10:00', [], false), alarm('friday', '07:00', ['fri'])], now); expect(result?.alarm.id).toBe('friday'); expect(result?.date.getDate()).toBe(30); });
  it('returns null when nothing is armed', () => { expect(getNextAlarmOccurrence([], now)).toBeNull(); expect(getNextAlarmOccurrence([alarm('off', '10:00', [], false)], now)).toBeNull(); });
  it('formats useful countdowns', () => { expect(formatAlarmCountdown(30_000)).toContain('less than'); expect(formatAlarmCountdown(65 * 60_000)).toBe('in 1h 5m'); });
});

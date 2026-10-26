import { describe, it, expect } from 'vitest';
import { getLocalTimeParts, isAlarmFiring } from './alarmServer';
import type { ServerAlarm } from '../types';

describe('getLocalTimeParts', () => {
  it('returns Berlin 07:00 on Monday for a known UTC instant', () => {
    const date = new Date('2026-06-15T05:00:00.000Z');
    const result = getLocalTimeParts('Europe/Berlin', date);
    expect(result).toEqual({ time: '07:00', weekday: 'mon' });
  });

  it('returns null for invalid timezone', () => {
    const result = getLocalTimeParts('Mars/Olympus', new Date());
    expect(result).toBeNull();
  });

  it('formats midnight as 00:00 on the correct local day', () => {
    expect(getLocalTimeParts('Europe/Berlin', new Date('2026-06-14T22:00:00Z')))
      .toEqual({ time: '00:00', weekday: 'mon' });
  });

  it('handles the Berlin daylight-saving transition', () => {
    expect(getLocalTimeParts('Europe/Berlin', new Date('2026-10-25T00:30:00Z')))
      .toEqual({ time: '02:30', weekday: 'sun' });
    expect(getLocalTimeParts('Europe/Berlin', new Date('2026-10-25T01:30:00Z')))
      .toEqual({ time: '02:30', weekday: 'sun' });
  });
});

describe('isAlarmFiring', () => {
  it('fires on matching time and weekday', () => {
    const alarm: ServerAlarm = { id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] };
    expect(isAlarmFiring(alarm, '07:00', 'mon')).toBe(true);
  });

  it('does not fire on wrong weekday', () => {
    const alarm: ServerAlarm = { id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] };
    expect(isAlarmFiring(alarm, '07:00', 'tue')).toBe(false);
  });

  it('fires every day when days is empty', () => {
    const alarm: ServerAlarm = { id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: [] };
    expect(isAlarmFiring(alarm, '07:00', 'wed')).toBe(true);
  });

  it('does not fire when inactive', () => {
    const alarm: ServerAlarm = { id: 'a1', time: '07:00', label: 'Wake', isActive: false, days: [] };
    expect(isAlarmFiring(alarm, '07:00', 'mon')).toBe(false);
  });
});

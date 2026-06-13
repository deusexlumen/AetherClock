/*
 * PURPOSE: Unit tests for the AetherClock alarm domain service
 * ARCHITECTURE: services/alarm
 * DEPENDENCIES: alarm, vitest
 * PIPELINE: test
 * LAST_VALIDATED: 2026-06-13
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAlarm,
  getPreAlarmTime,
  getAlarmNextOccurrence,
  getNextAlarm,
  getAlarmStatusText,
  loadAlarms,
  saveAlarms,
  formatDurationToAlarm,
  getCurrentWeekDay,
  isAlarmScheduledForDay,
  DEFAULT_PLAYLIST_CONFIG,
  DEFAULT_VOICE_BRIEFING_CONFIG,
} from './alarm';

describe('createAlarm', () => {
  it('creates a default alarm', () => {
    const a = createAlarm();
    expect(a.time).toBe('07:00');
    expect(a.label).toBe('Alarm');
    expect(a.isActive).toBe(true);
    expect(a.days).toEqual([]);
    expect(a.playlistConfig).toEqual(DEFAULT_PLAYLIST_CONFIG);
    expect(a.voiceBriefingConfig).toEqual(DEFAULT_VOICE_BRIEFING_CONFIG);
    expect(a.id).toBeTruthy();
  });

  it('applies overrides', () => {
    const a = createAlarm({ time: '09:30', label: 'Gym', isActive: false });
    expect(a.time).toBe('09:30');
    expect(a.label).toBe('Gym');
    expect(a.isActive).toBe(false);
  });
});

describe('getPreAlarmTime', () => {
  it('subtracts one minute', () => {
    expect(getPreAlarmTime('07:00')).toBe('06:59');
    expect(getPreAlarmTime('00:00')).toBe('23:59');
    expect(getPreAlarmTime('12:30')).toBe('12:29');
  });

  it('throws for invalid time formats', () => {
    expect(() => getPreAlarmTime('7:00')).toThrow('Invalid alarm time format, expected HH:MM');
    expect(() => getPreAlarmTime('07:0')).toThrow('Invalid alarm time format, expected HH:MM');
    expect(() => getPreAlarmTime('not-a-time')).toThrow(
      'Invalid alarm time format, expected HH:MM',
    );
  });

  it('throws for out-of-range times', () => {
    expect(() => getPreAlarmTime('25:70')).toThrow('Alarm time out of range');
    expect(() => getPreAlarmTime('24:60')).toThrow('Alarm time out of range');
  });
});

describe('getAlarmNextOccurrence', () => {
  const mondayMorning = new Date(2026, 5, 15, 6, 0, 0);

  it('returns today for an every-day alarm', () => {
    const alarm = createAlarm({ time: '07:00', days: [] });
    const next = getAlarmNextOccurrence(alarm, mondayMorning);
    expect(next).not.toBeNull();
    expect(next!.getDay()).toBe(1);
    expect(next!.getHours()).toBe(7);
    expect(next!.getMinutes()).toBe(0);
  });

  it('skips to the next matching weekday', () => {
    const alarm = createAlarm({ time: '07:00', days: ['tue'] });
    const next = getAlarmNextOccurrence(alarm, mondayMorning);
    expect(next).not.toBeNull();
    expect(next!.getDay()).toBe(2);
  });

  it('returns null for inactive alarms', () => {
    const alarm = createAlarm({ time: '07:00', isActive: false });
    expect(getAlarmNextOccurrence(alarm, mondayMorning)).toBeNull();
  });

  it('returns the next matching day when the alarm time has already passed today', () => {
    const alarm = createAlarm({ time: '05:00', days: [] });
    const next = getAlarmNextOccurrence(alarm, mondayMorning);
    expect(next).not.toBeNull();
    expect(next!.getDay()).toBe(2);
  });

  it('skips to the next occurrence when from exactly equals the alarm time', () => {
    const mondayAtAlarm = new Date(2026, 5, 15, 7, 0, 0);
    const alarm = createAlarm({ time: '07:00', days: [] });
    const next = getAlarmNextOccurrence(alarm, mondayAtAlarm);
    expect(next).not.toBeNull();
    expect(next!.getDay()).toBe(2);
  });

  it('wraps around to the following week for non-imminent weekdays', () => {
    const saturdayMorning = new Date(2026, 5, 20, 6, 0, 0);
    const alarm = createAlarm({ time: '07:00', days: ['mon'] });
    const next = getAlarmNextOccurrence(alarm, saturdayMorning);
    expect(next).not.toBeNull();
    expect(next!.getDay()).toBe(1);
    expect(next!.getDate()).toBe(22);
  });

  it('selects the nearest matching day among multiple weekdays', () => {
    const wednesdayMorning = new Date(2026, 5, 17, 6, 0, 0);
    const alarm = createAlarm({ time: '07:00', days: ['tue', 'thu', 'fri'] });
    const next = getAlarmNextOccurrence(alarm, wednesdayMorning);
    expect(next).not.toBeNull();
    expect(next!.getDay()).toBe(4);
    expect(next!.getDate()).toBe(18);
  });
});

describe('getNextAlarm', () => {
  const mondayMorning = new Date(2026, 5, 15, 6, 0, 0);

  it('picks the soonest active alarm', () => {
    const a = createAlarm({ time: '08:00', label: 'Later' });
    const b = createAlarm({ time: '07:30', label: 'Sooner' });
    const next = getNextAlarm([a, b], mondayMorning);
    expect(next?.label).toBe('Sooner');
  });

  it('ignores inactive alarms', () => {
    const a = createAlarm({ time: '07:00', isActive: false });
    const b = createAlarm({ time: '08:00' });
    expect(getNextAlarm([a, b], mondayMorning)?.label).toBe('Alarm');
  });

  it('returns null for an empty alarm list', () => {
    expect(getNextAlarm([])).toBeNull();
  });

  it('returns null when all alarms are inactive', () => {
    const a = createAlarm({ time: '07:00', isActive: false });
    const b = createAlarm({ time: '08:00', isActive: false });
    expect(getNextAlarm([a, b], mondayMorning)).toBeNull();
  });
});

describe('getAlarmStatusText', () => {
  it('shows the next alarm label and duration', () => {
    const mondayMorning = new Date(2026, 5, 15, 7, 0, 0);
    const alarm = createAlarm({ time: '08:30', label: 'Workout' });
    const text = getAlarmStatusText([alarm], mondayMorning);
    expect(text).toBe('Next alarm: 08:30 Workout (in 1h 30m)');
  });

  it('reports no active alarms', () => {
    expect(getAlarmStatusText([])).toBe('No active alarms');
  });
});

describe('formatDurationToAlarm', () => {
  it('formats durations below one minute', () => {
    expect(formatDurationToAlarm(0)).toBe('in <1m');
    expect(formatDurationToAlarm(0.5)).toBe('in <1m');
  });

  it('formats durations below one hour', () => {
    expect(formatDurationToAlarm(1)).toBe('in 1m');
    expect(formatDurationToAlarm(59)).toBe('in 59m');
  });

  it('formats durations of one hour or more', () => {
    expect(formatDurationToAlarm(60)).toBe('in 1h 0m');
    expect(formatDurationToAlarm(90)).toBe('in 1h 30m');
    expect(formatDurationToAlarm(125)).toBe('in 2h 5m');
  });

  it('formats fractional minutes using floor', () => {
    expect(formatDurationToAlarm(89.9)).toBe('in 1h 29m');
    expect(formatDurationToAlarm(59.9)).toBe('in 59m');
    expect(formatDurationToAlarm(0.9)).toBe('in <1m');
  });
});

describe('getCurrentWeekDay', () => {
  it('maps every day of the week', () => {
    expect(getCurrentWeekDay(new Date(2026, 5, 14))).toBe('sun'); // 14.06.2026
    expect(getCurrentWeekDay(new Date(2026, 5, 15))).toBe('mon');
    expect(getCurrentWeekDay(new Date(2026, 5, 16))).toBe('tue');
    expect(getCurrentWeekDay(new Date(2026, 5, 17))).toBe('wed');
    expect(getCurrentWeekDay(new Date(2026, 5, 18))).toBe('thu');
    expect(getCurrentWeekDay(new Date(2026, 5, 19))).toBe('fri');
    expect(getCurrentWeekDay(new Date(2026, 5, 20))).toBe('sat');
  });
});

describe('isAlarmScheduledForDay', () => {
  it('treats an empty days array as every day', () => {
    const alarm = createAlarm({ days: [] });
    expect(isAlarmScheduledForDay(alarm, new Date(2026, 5, 15))).toBe(true);
    expect(isAlarmScheduledForDay(alarm, new Date(2026, 5, 20))).toBe(true);
  });

  it('matches specific weekdays only', () => {
    const alarm = createAlarm({ days: ['mon', 'wed', 'fri'] });
    expect(isAlarmScheduledForDay(alarm, new Date(2026, 5, 15))).toBe(true); // mon
    expect(isAlarmScheduledForDay(alarm, new Date(2026, 5, 16))).toBe(false); // tue
    expect(isAlarmScheduledForDay(alarm, new Date(2026, 5, 17))).toBe(true); // wed
    expect(isAlarmScheduledForDay(alarm, new Date(2026, 5, 18))).toBe(false); // thu
    expect(isAlarmScheduledForDay(alarm, new Date(2026, 5, 19))).toBe(true); // fri
  });
});

describe('loadAlarms / saveAlarms', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
  });

  it('returns a default alarm when storage is empty', () => {
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('loads and deduplicates persisted alarms', () => {
    const a = createAlarm({ time: '08:00' });
    const b = { ...createAlarm({ time: '09:00' }), id: a.id };
    saveAlarms([a, b]);
    const loaded = loadAlarms();
    expect(loaded).toHaveLength(2);
    expect(new Set(loaded.map((x) => x.id)).size).toBe(2);
  });

  it('falls back to a default alarm when persisted data is invalid', () => {
    store['aetherclock_alarms'] = JSON.stringify([{ notId: 'x' }, { id: 123, time: '08:00' }]);
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('returns an empty array when a valid empty persisted array exists', () => {
    store['aetherclock_alarms'] = JSON.stringify([]);
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(0);
  });

  it('falls back to default when persisted data contains null', () => {
    store['aetherclock_alarms'] = JSON.stringify([null]);
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('falls back to default when persisted alarm is missing required fields', () => {
    store['aetherclock_alarms'] = JSON.stringify([{ id: 'x' }]);
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('falls back to default when persisted alarm has an invalid weekday', () => {
    const invalid = {
      id: 'a',
      time: '08:00',
      label: 'Alarm',
      isActive: true,
      days: ['notaday'],
      genrePreset: 'auto',
      playlistConfig: { ...DEFAULT_PLAYLIST_CONFIG },
      voiceBriefingConfig: { ...DEFAULT_VOICE_BRIEFING_CONFIG },
    };
    store['aetherclock_alarms'] = JSON.stringify([invalid]);
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('falls back to default when persisted alarm has an invalid genrePreset', () => {
    const invalid = { ...createAlarm({ time: '08:00' }), genrePreset: 'invalid-genre' };
    store['aetherclock_alarms'] = JSON.stringify([invalid]);
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('falls back to default when persisted alarm has an invalid voiceName', () => {
    const invalid = {
      ...createAlarm({ time: '08:00' }),
      voiceBriefingConfig: { ...DEFAULT_VOICE_BRIEFING_CONFIG, voiceName: 'Odin' },
    };
    store['aetherclock_alarms'] = JSON.stringify([invalid]);
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('falls back to default when persisted alarm has an invalid time', () => {
    const invalid = { ...createAlarm(), time: '25:00' };
    store['aetherclock_alarms'] = JSON.stringify([invalid]);
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('falls back to default when persisted alarm is missing nested config fields', () => {
    const base = createAlarm({ time: '08:00' });
    const { playlistConfig, voiceBriefingConfig, ...missingNested } = base;
    store['aetherclock_alarms'] = JSON.stringify([missingNested]);
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('handles localStorage.setItem throwing gracefully', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: () => {
        throw new Error('Quota exceeded');
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    expect(() => saveAlarms([createAlarm()])).not.toThrow();
  });

  it('falls back gracefully when localStorage.getItem throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Storage inaccessible');
      },
      setItem: () => {},
      removeItem: () => {},
    });
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
  });

  it('migrates legacy single alarm settings', () => {
    store['aetherclock_alarm_time'] = '06:15';
    store['aetherclock_alarm_active'] = 'true';
    const alarms = loadAlarms();
    expect(alarms[0].time).toBe('06:15');
    expect(alarms[0].isActive).toBe(true);
    expect(store['aetherclock_alarms']).toBeDefined();
    expect(store['aetherclock_alarm_time']).toBeUndefined();
  });

  it('migrates legacy single alarm settings as inactive when active flag is false', () => {
    store['aetherclock_alarm_time'] = '06:15';
    store['aetherclock_alarm_active'] = 'false';
    const alarms = loadAlarms();
    expect(alarms[0].time).toBe('06:15');
    expect(alarms[0].isActive).toBe(false);
    expect(store['aetherclock_alarms']).toBeDefined();
    expect(store['aetherclock_alarm_time']).toBeUndefined();
  });

  it('falls back to default when legacy time is invalid', () => {
    store['aetherclock_alarm_time'] = 'not-a-time';
    store['aetherclock_alarm_active'] = 'true';
    const alarms = loadAlarms();
    expect(alarms).toHaveLength(1);
    expect(alarms[0].time).toBe('07:00');
    expect(alarms[0].isActive).toBe(true);
  });
});

/*
 * PURPOSE: Domain service for AetherClock multi-alarm scheduling and persistence
 * ARCHITECTURE: services/alarm
 * DEPENDENCIES: types
 * PIPELINE: test
 * LAST_VALIDATED: 2026-06-13
 */

import { Alarm, MusicGenre, MUSIC_GENRES, PlaylistConfig, VoiceBriefingConfig, VOICE_NAMES, WeekDay } from '../types';

export const DEFAULT_PLAYLIST_CONFIG: Readonly<PlaylistConfig> = Object.freeze({
  enabled: true,
  trackCount: 3,
  shuffle: false,
  crossfadeSeconds: 0,
});

export const DEFAULT_VOICE_BRIEFING_CONFIG: Readonly<VoiceBriefingConfig> = Object.freeze({
  enabled: true,
  voiceName: 'Fenrir',
  includeWeather: true,
  includeAgenda: true,
  includeTime: true,
  customGreeting: '',
});

export const generateAlarmId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const createAlarm = (overrides: Partial<Alarm> = {}): Alarm => {
  const { playlistConfig, voiceBriefingConfig, ...topLevelOverrides } = overrides;
  return {
    id: generateAlarmId(),
    time: '07:00',
    label: 'Alarm',
    isActive: true,
    days: [],
    genrePreset: 'auto',
    playlistConfig: { ...DEFAULT_PLAYLIST_CONFIG, ...playlistConfig },
    voiceBriefingConfig: { ...DEFAULT_VOICE_BRIEFING_CONFIG, ...voiceBriefingConfig },
    ...topLevelOverrides,
  };
};

export const getPreAlarmTime = (alarmTimeStr: string): string => {
  if (!/^\d{2}:\d{2}$/.test(alarmTimeStr)) {
    throw new Error('Invalid alarm time format, expected HH:MM');
  }
  const [hrStr, minStr] = alarmTimeStr.split(':');
  let hr = parseInt(hrStr, 10);
  let min = parseInt(minStr, 10);

  if (hr < 0 || hr > 23 || min < 0 || min > 59) {
    throw new Error('Alarm time out of range');
  }

  min = min - 1;
  if (min < 0) {
    min = 60 + min;
    hr = hr - 1;
    if (hr < 0) {
      hr = 23;
    }
  }
  return `${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
};

const REVERSE_DAY_MAP: Record<number, WeekDay> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export const getCurrentWeekDay = (date: Date = new Date()): WeekDay =>
  REVERSE_DAY_MAP[date.getDay()];

export const isAlarmScheduledForDay = (alarm: Alarm, date: Date): boolean => {
  if (alarm.days.length === 0) return true;
  return alarm.days.includes(REVERSE_DAY_MAP[date.getDay()]);
};

export const getAlarmNextOccurrence = (alarm: Alarm, from: Date): Date | null => {
  if (!alarm.isActive) return null;
  const [h, m] = alarm.time.split(':').map(Number);
  const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate(), h, m, 0, 0);

  if (isAlarmScheduledForDay(alarm, candidate) && candidate.getTime() > from.getTime()) {
    return candidate;
  }

  for (let i = 1; i <= 7; i++) {
    const next = new Date(candidate);
    next.setDate(candidate.getDate() + i);
    if (isAlarmScheduledForDay(alarm, next)) return next;
  }

  return null;
};

const findNextAlarmWithDate = (
  alarms: Alarm[],
  from: Date,
): { alarm: Alarm | null; at: Date | null } => {
  let best: { alarm: Alarm; at: Date } | null = null;
  for (const alarm of alarms) {
    const at = getAlarmNextOccurrence(alarm, from);
    if (!at) continue;
    if (!best || at.getTime() < best.at.getTime()) {
      best = { alarm, at };
    }
  }
  return best ?? { alarm: null, at: null };
};

export const getNextAlarm = (alarms: Alarm[], from: Date = new Date()): Alarm | null => {
  return findNextAlarmWithDate(alarms, from).alarm;
};

export const formatDurationToAlarm = (minutes: number): string => {
  if (minutes < 1) return 'in <1m';
  if (minutes < 60) return `in ${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `in ${h}h ${m}m`;
};

export const getAlarmStatusText = (alarms: Alarm[], from: Date = new Date()): string => {
  const { alarm: next, at } = findNextAlarmWithDate(alarms, from);
  if (!next || !at) return 'No active alarms';
  const minutes = Math.max(0, (at.getTime() - from.getTime()) / 60000);
  return `Next alarm: ${next.time} ${next.label || 'Alarm'} (${formatDurationToAlarm(minutes)})`;
};

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

const safeRemoveItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {}
};

const isWeekDay = (value: unknown): value is WeekDay =>
  typeof value === 'string' && ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(value);

const isValidTime = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
};

const isValidAlarm = (value: unknown): value is Alarm => {
  if (typeof value !== 'object' || value === null) return false;
  const alarm = value as Record<string, unknown>;

  if (typeof alarm.id !== 'string') return false;
  if (!isValidTime(alarm.time)) return false;
  if (typeof alarm.label !== 'string') return false;
  if (typeof alarm.isActive !== 'boolean') return false;
  if (!MUSIC_GENRES.includes(alarm.genrePreset as MusicGenre)) return false;
  if (!Array.isArray(alarm.days) || !alarm.days.every(isWeekDay)) return false;

  if (typeof alarm.playlistConfig !== 'object' || alarm.playlistConfig === null) return false;
  const pc = alarm.playlistConfig as Record<string, unknown>;
  if (typeof pc.enabled !== 'boolean') return false;
  if (typeof pc.trackCount !== 'number') return false;
  if (typeof pc.shuffle !== 'boolean') return false;
  if (typeof pc.crossfadeSeconds !== 'number') return false;

  if (typeof alarm.voiceBriefingConfig !== 'object' || alarm.voiceBriefingConfig === null) return false;
  const vc = alarm.voiceBriefingConfig as Record<string, unknown>;
  if (typeof vc.enabled !== 'boolean') return false;
  if (!VOICE_NAMES.includes(vc.voiceName as VoiceBriefingConfig['voiceName'])) return false;
  if (typeof vc.includeWeather !== 'boolean') return false;
  if (typeof vc.includeAgenda !== 'boolean') return false;
  if (typeof vc.includeTime !== 'boolean') return false;
  if (typeof vc.customGreeting !== 'string') return false;

  return true;
};

export const loadAlarms = (): Alarm[] => {
  const raw = safeGetItem('aetherclock_alarms');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(isValidAlarm)) {
        const seen = new Set<string>();
        return parsed.map((a) => {
          const cloned = {
            ...a,
            playlistConfig: { ...a.playlistConfig },
            voiceBriefingConfig: { ...a.voiceBriefingConfig },
          };
          if (seen.has(cloned.id)) {
            cloned.id = generateAlarmId();
          } else {
            seen.add(cloned.id);
          }
          return cloned;
        });
      }
    } catch {}
  }

  const legacyTime = safeGetItem('aetherclock_alarm_time');
  if (legacyTime && isValidTime(legacyTime)) {
    const legacyActive = safeGetItem('aetherclock_alarm_active');
    const alarm = createAlarm({
      time: legacyTime,
      isActive: legacyActive !== 'false',
      label: 'Alarm',
    });
    safeSetItem('aetherclock_alarms', JSON.stringify([alarm]));
    safeRemoveItem('aetherclock_alarm_time');
    safeRemoveItem('aetherclock_alarm_active');
    return [alarm];
  }

  return [createAlarm()];
};

export const saveAlarms = (alarms: Alarm[]): void => {
  safeSetItem('aetherclock_alarms', JSON.stringify(alarms));
};

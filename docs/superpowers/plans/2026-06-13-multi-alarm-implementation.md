# AetherClock Multi-Alarm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `alarmTime`/`isAlarmActive` state with a persisted array of alarms, each with its own time, label, recurring weekdays, genre preset, playlist, and voice briefing config, and update the scheduler + UI accordingly.

**Architecture:** Alarm logic moves to a focused `services/alarm.ts` module (creation, migration, next-alarm math, weekday filtering). `App.tsx` keeps the scheduler loop and playback orchestration but reads per-alarm config when an alarm fires. A new `components/AlarmList.tsx` renders the settings UI. Persistence uses a single `aetherclock_alarms` localStorage key.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS, pnpm, Vitest (new dev dependency).

---

## File Map

| File | Responsibility |
|------|----------------|
| `types.ts` | Add `WeekDay`, `Alarm`, and update `AppState`. |
| `services/alarm.ts` | Alarm factory, migration, next-occurrence math, persistence helpers. |
| `services/alarm.test.ts` | Unit tests for alarm math and migration. |
| `vitest.config.ts` | Vitest runner config. |
| `package.json` | Add `test` script and `vitest` dev dependency. |
| `components/AlarmList.tsx` | Settings-panel alarm list UI. |
| `App.tsx` | Replace single-alarm state/scheduler/playback with multi-alarm aware versions. |

---

## Task 1: Add multi-alarm types

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add `WeekDay` and `Alarm` and update `AppState`**

```ts
// types.ts

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface Alarm {
  id: string;
  time: string; // "HH:MM"
  label: string;
  isActive: boolean;
  days: WeekDay[];
  genrePreset: MusicGenre;
  playlistConfig: PlaylistConfig;
  voiceBriefingConfig: VoiceBriefingConfig;
}

export interface AppState {
  alarms: Alarm[];
  currentAlarmId: string | null;
  agenda: string;
  calendar: CalendarItem[];
  genrePreset: MusicGenre;
  searchedTrack: SearchedSongMetadata | null;
  location: string | null;
  weather: WeatherData | null;
  status: AppStatus;
  errorMessage: string | null;
  youtubeEmbedUrl: string | null;
  logs: string[];
  playlist: PlaylistTrack[];
  currentTrackIndex: number;
  briefingAudioSrc: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add types.ts
git commit -m "feat(types): add WeekDay and multi-alarm Alarm/AppState shapes"
```

---

## Task 2: Create alarm domain service and tests

**Files:**
- Create: `services/alarm.ts`
- Create: `services/alarm.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

Run:
```bash
pnpm add -D vitest
```
Expected: Vitest installs and `package.json` devDependencies gains `vitest`.

- [ ] **Step 2: Add test scripts to `package.json`**

Old:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
},
```
New:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
},
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['services/**/*.test.ts', 'components/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write `services/alarm.ts`**

```ts
import { Alarm, MusicGenre, PlaylistConfig, VoiceBriefingConfig, WeekDay, WEEKDAYS } from '../types';

export const DEFAULT_PLAYLIST_CONFIG: PlaylistConfig = {
  enabled: true,
  trackCount: 3,
  shuffle: false,
  crossfadeSeconds: 0,
};

export const DEFAULT_VOICE_BRIEFING_CONFIG: VoiceBriefingConfig = {
  enabled: true,
  voiceName: 'Fenrir',
  includeWeather: true,
  includeAgenda: true,
  includeTime: true,
  customGreeting: '',
};

export const generateAlarmId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const createAlarm = (overrides: Partial<Alarm> = {}): Alarm => ({
  id: generateAlarmId(),
  time: '07:00',
  label: 'Alarm',
  isActive: true,
  days: [],
  genrePreset: 'auto',
  playlistConfig: { ...DEFAULT_PLAYLIST_CONFIG },
  voiceBriefingConfig: { ...DEFAULT_VOICE_BRIEFING_CONFIG },
  ...overrides,
});

export const getPreAlarmTime = (alarmTimeStr: string): string => {
  const [hrStr, minStr] = alarmTimeStr.split(':');
  let hr = parseInt(hrStr, 10);
  let min = parseInt(minStr, 10);

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

const DAY_MAP: Record<WeekDay, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 0,
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

export const getNextAlarm = (alarms: Alarm[], from: Date = new Date()): Alarm | null => {
  let best: { alarm: Alarm; at: Date } | null = null;
  for (const alarm of alarms) {
    const at = getAlarmNextOccurrence(alarm, from);
    if (!at) continue;
    if (!best || at.getTime() < best.at.getTime()) {
      best = { alarm, at };
    }
  }
  return best?.alarm ?? null;
};

export const formatDurationToAlarm = (minutes: number): string => {
  if (minutes < 1) return 'in <1m';
  if (minutes < 60) return `in ${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `in ${h}h ${m}m`;
};

export const getAlarmStatusText = (alarms: Alarm[], from: Date = new Date()): string => {
  const next = getNextAlarm(alarms, from);
  if (!next) return 'No active alarms';
  const at = getAlarmNextOccurrence(next, from);
  if (!at) return 'No active alarms';
  const minutes = Math.ceil((at.getTime() - from.getTime()) / 60000);
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

export const loadAlarms = (): Alarm[] => {
  const raw = safeGetItem('aetherclock_alarms');
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Alarm[];
      if (Array.isArray(parsed)) {
        const seen = new Set<string>();
        const deduped = parsed.map((a) => {
          if (seen.has(a.id)) return { ...a, id: generateAlarmId() };
          seen.add(a.id);
          return a;
        });
        return deduped.length > 0 ? deduped : [createAlarm()];
      }
    } catch {}
  }

  const legacyTime = safeGetItem('aetherclock_alarm_time');
  if (legacyTime) {
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
```

- [ ] **Step 5: Write `services/alarm.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAlarm,
  getPreAlarmTime,
  getAlarmNextOccurrence,
  getNextAlarm,
  getAlarmStatusText,
  loadAlarms,
  saveAlarms,
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
});

describe('getAlarmNextOccurrence', () => {
  const mondayMorning = new Date(2026, 5, 15, 6, 0, 0); // 2026-06-15 06:00 local, Monday

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
});

describe('getAlarmStatusText', () => {
  it('shows the next alarm label and duration', () => {
    const mondayMorning = new Date(2026, 5, 15, 6, 0, 0);
    const alarm = createAlarm({ time: '08:30', label: 'Workout' });
    const text = getAlarmStatusText([alarm], mondayMorning);
    expect(text).toContain('08:30');
    expect(text).toContain('Workout');
    expect(text).toContain('in 1h 30m');
  });

  it('reports no active alarms', () => {
    expect(getAlarmStatusText([])).toBe('No active alarms');
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

  it('migrates legacy single alarm settings', () => {
    store['aetherclock_alarm_time'] = '06:15';
    store['aetherclock_alarm_active'] = 'true';
    const alarms = loadAlarms();
    expect(alarms[0].time).toBe('06:15');
    expect(alarms[0].isActive).toBe(true);
    expect(store['aetherclock_alarms']).toBeDefined();
    expect(store['aetherclock_alarm_time']).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
pnpm test
```
Expected: all tests in `services/alarm.test.ts` pass.

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.ts services/alarm.ts services/alarm.test.ts
git commit -m "feat(alarm): add alarm domain service, persistence, and tests"
```

---

## Task 3: Migrate legacy single-alarm keys

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add legacy single-alarm keys to the Lyria migration list**

Old (lines 117–129):
```ts
  const legacyKeys = [
    'lyria_theme',
    'lyria_volume',
    'lyria_loudness',
    'lyria_blacklist',
    'lyria_prewarm',
    'lyria_voice_briefing',
    'lyria_playlist',
    'lyria_llm',
    'lyria_notifications',
    'lyria_offline_fallback',
    'lyria_screensaver_timeout',
  ];
```
New:
```ts
  const legacyKeys = [
    'lyria_theme',
    'lyria_volume',
    'lyria_loudness',
    'lyria_blacklist',
    'lyria_prewarm',
    'lyria_voice_briefing',
    'lyria_playlist',
    'lyria_llm',
    'lyria_notifications',
    'lyria_offline_fallback',
    'lyria_screensaver_timeout',
    'lyria_alarm_time',
    'lyria_alarm_active',
  ];
```

- [ ] **Step 2: Commit**

```bash
git add App.tsx
git commit -m "feat(migration): include legacy single-alarm keys in Lyria migration"
```

---

## Task 4: Replace AppState with alarms array

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Update imports**

Old:
```ts
import { AppState, CalendarItem, MusicGenre, WEATHER_CODES, PlaylistConfig, VoiceBriefingConfig, LLMConfig, PlaylistTrack } from './types';
```
New:
```ts
import { AppState, CalendarItem, MusicGenre, WEATHER_CODES, PlaylistConfig, VoiceBriefingConfig, LLMConfig, PlaylistTrack, Alarm } from './types';
import { loadAlarms, saveAlarms, getNextAlarm, getAlarmStatusText, getPreAlarmTime, getCurrentWeekDay } from './services/alarm';
```

Also add `useMemo` to the React import:
```ts
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
```

- [ ] **Step 2: Remove the local `getPreAlarmTime` helper**

Delete lines 279–293:
```ts
const getPreAlarmTime = (alarmTimeStr: string): string => {
  const [hrStr, minStr] = alarmTimeStr.split(':');
  let hr = parseInt(hrStr, 10);
  let min = parseInt(minStr, 10);

  min = min - 1; // Pre-warm 1 minute before to account for generation + validation time
  if (min < 0) {
    min = 60 + min;
    hr = hr - 1;
    if (hr < 0) {
      hr = 23;
    }
  }
  return `${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
};
```

- [ ] **Step 3: Update the `AppState` initializer**

Old:
```ts
  const [state, setState] = useState<AppState>(() => {
    const calendar = parseAgendaToCalendar(initialAgenda);
    return {
      alarmTime: "07:00",
      isAlarmActive: false,
      agenda: initialAgenda,
      calendar,
      genrePreset: 'auto',
      searchedTrack: null,
      location: null,
      weather: null,
      status: 'idle',
      errorMessage: null,
      youtubeEmbedUrl: null,
      logs: [],
      playlist: [],
      currentTrackIndex: 0,
      briefingAudioSrc: null
    };
  });
```
New:
```ts
  const [state, setState] = useState<AppState>(() => {
    const calendar = parseAgendaToCalendar(initialAgenda);
    return {
      alarms: loadAlarms(),
      currentAlarmId: null,
      agenda: initialAgenda,
      calendar,
      genrePreset: 'auto',
      searchedTrack: null,
      location: null,
      weather: null,
      status: 'idle',
      errorMessage: null,
      youtubeEmbedUrl: null,
      logs: [],
      playlist: [],
      currentTrackIndex: 0,
      briefingAudioSrc: null
    };
  });
```

- [ ] **Step 4: Add derived alarm values and scheduler refs**

Insert after the `screenSaverTimerRef`/`resetScreenSaverTimerRef` block (around line 396):

```ts
  const isAnyAlarmActive = useMemo(() => state.alarms.some((a) => a.isActive), [state.alarms]);
  const currentAlarm = useMemo(
    () => state.alarms.find((a) => a.id === state.currentAlarmId) ?? null,
    [state.alarms, state.currentAlarmId]
  );
  const activeConfig = useMemo(() => {
    if (currentAlarm) {
      return {
        genrePreset: currentAlarm.genrePreset,
        playlistConfig: currentAlarm.playlistConfig,
        voiceBriefingConfig: currentAlarm.voiceBriefingConfig,
        alarmTime: currentAlarm.time,
      };
    }
    const next = getNextAlarm(state.alarms);
    return {
      genrePreset: state.genrePreset,
      playlistConfig,
      voiceBriefingConfig,
      alarmTime: next?.time ?? '07:00',
    };
  }, [currentAlarm, state.alarms, state.genrePreset, playlistConfig, voiceBriefingConfig]);
```

Add the scheduler refs near the other refs (around line 436):

```ts
  const lastMinuteRef = useRef<string>('');
  const triggeredRef = useRef<Set<string>>(new Set());
  const prewarmedRef = useRef<Set<string>>(new Set());
```

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "feat(state): replace single alarm with alarms array and derived config"
```

---

## Task 5: Refactor the scheduler for multiple alarms

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Replace the `checkAlarm` effect body**

Replace the entire `useEffect` that defines `checkAlarm` (currently lines 602–650) with:

```ts
  // Alarm Check trigger loop
  useEffect(() => {
    const checkAlarm = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      const currentDayKey = getCurrentWeekDay(now);

      if (lastMinuteRef.current !== currentTime) {
        lastMinuteRef.current = currentTime;
        triggeredRef.current.clear();
        prewarmedRef.current.clear();
      }

      for (const alarm of state.alarms) {
        if (!alarm.isActive) continue;
        if (alarm.days.length > 0 && !alarm.days.includes(currentDayKey)) continue;

        const preKey = `${alarm.id}:${currentTime}`;
        const triggerKey = `${alarm.id}:${currentTime}`;
        const preAlarmTime = getPreAlarmTime(alarm.time);

        if (
          isPreWarmEnabled &&
          currentTime === preAlarmTime &&
          state.status === 'idle' &&
          !prewarmedRef.current.has(preKey)
        ) {
          prewarmedRef.current.add(preKey);
          handleGenerateAndPlayRef.current(alarm.id, true);
        }

        if (currentTime === alarm.time && !triggeredRef.current.has(triggerKey)) {
          triggeredRef.current.add(triggerKey);
          setState((prev) => ({ ...prev, currentAlarmId: alarm.id }));
          alarmPendingRef.current = false;

          if (!isOnlineStatus && offlineFallbackEnabled) {
            setState((prev) => ({ ...prev, status: 'playing' }));
            playOfflineFallback();
            if (notificationsEnabled) {
              sendAlarmNotification('AetherClock Alarm', `Wake up! ${alarm.label}`);
            }
            return;
          }

          if (state.status === 'ready') {
            if (notificationsEnabled) {
              sendAlarmNotification('AetherClock', 'Your personalized broadcast is starting.');
            }
            startPlaybackSequenceRef.current();
          } else if (state.status === 'idle') {
            if (notificationsEnabled) {
              sendAlarmNotification('AetherClock', 'Generating your broadcast now...');
            }
            handleGenerateAndPlayRef.current(alarm.id, false);
          } else {
            alarmPendingRef.current = true;
          }
        }
      }
    };

    const interval = setInterval(checkAlarm, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.alarms, state.status, isPreWarmEnabled, isOnlineStatus, offlineFallbackEnabled, notificationsEnabled]);
```

- [ ] **Step 2: Update the auto-trigger effect**

Replace the effect (currently lines 652–662) with:

```ts
  // Auto-trigger alarm when generation finishes and alarm time was reached
  useEffect(() => {
    if (state.status === 'ready' && alarmPendingRef.current && state.currentAlarmId) {
      const alarm = state.alarms.find((a) => a.id === state.currentAlarmId);
      if (!alarm) {
        alarmPendingRef.current = false;
        return;
      }
      alarmPendingRef.current = false;
      if (notificationsEnabled) {
        sendAlarmNotification('AetherClock', 'Your personalized broadcast is starting.');
      }
      startPlaybackSequenceRef.current();
    }
  }, [state.status, state.currentAlarmId, state.alarms, notificationsEnabled]);
```

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(scheduler): support multiple recurring alarms with per-minute dedup"
```

---

## Task 6: Make playback alarm-config aware

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Refactor `handleGenerateAndPlay`**

Replace the function (currently lines 710–803) with:

```ts
  // Generate Playlist and/or Briefing
  const handleGenerateAndPlay = async (alarmId?: string, preGenerateOnly: boolean = false) => {
    const alarm = alarmId ? state.alarms.find((a) => a.id === alarmId) : undefined;
    if (alarmId && !alarm) {
      setState((prev) => ({ ...prev, status: 'idle', currentAlarmId: null }));
      return;
    }

    const config = alarm
      ? {
          genrePreset: alarm.genrePreset,
          alarmTime: alarm.time,
          playlistConfig: alarm.playlistConfig,
          voiceBriefingConfig: alarm.voiceBriefingConfig,
        }
      : {
          genrePreset: state.genrePreset,
          alarmTime: getNextAlarm(state.alarms)?.time ?? '07:00',
          playlistConfig,
          voiceBriefingConfig,
        };

    setState((prev) => ({
      ...prev,
      status: 'generating_prompt',
      searchedTrack: null,
      playlist: [],
      currentTrackIndex: 0,
      briefingAudioSrc: null,
      ...(alarm ? { currentAlarmId: alarm.id } : {}),
    }));

    try {
      const resultData = await generateMusicalPrompt(
        state.weather,
        state.location,
        state.agenda,
        new Date(),
        config.alarmTime,
        config.genrePreset,
        blacklist,
        llmConfig
      );

      let playlist: PlaylistTrack[] = [];

      if (config.playlistConfig.enabled) {
        const fetchTrack = () =>
          generateMusicalPrompt(
            state.weather,
            state.location,
            state.agenda,
            new Date(),
            config.alarmTime,
            config.genrePreset,
            blacklist,
            llmConfig
          ).then((r) => r.searchedSong);

        playlist = await generatePlaylist(fetchTrack, config.playlistConfig.trackCount, config.genrePreset);
      } else {
        if (resultData.searchedSong.youtubeVideoId) {
          const videoId = resultData.searchedSong.youtubeVideoId;
          playlist = [
            {
              title: resultData.searchedSong.title,
              artist: resultData.searchedSong.artist,
              youtubeVideoId: videoId,
              embedUrl: buildEmbedUrl(videoId) || buildNcsChannelEmbedUrl(),
              whyExplanation: resultData.searchedSong.whyExplanation,
            },
          ];
        }
      }

      let briefingSrc: string | null = null;
      if (config.voiceBriefingConfig.enabled) {
        setState((prev) => ({ ...prev, status: 'generating_briefing' }));
        const briefing = await generateVoiceBriefing(
          state.weather,
          state.calendar,
          config.alarmTime,
          config.voiceBriefingConfig,
          llmConfig
        );
        if (briefing.audioBase64) {
          briefingSrc = `data:${briefing.mimeType};base64,${briefing.audioBase64}`;
        }
      }

      const embedUrl = playlist[0]?.embedUrl || null;

      if (preGenerateOnly) {
        setState((prev) => ({
          ...prev,
          status: 'ready',
          searchedTrack: resultData.searchedSong,
          youtubeEmbedUrl: embedUrl,
          playlist,
          currentTrackIndex: 0,
          briefingAudioSrc: briefingSrc,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        status: 'playing',
        searchedTrack: resultData.searchedSong,
        youtubeEmbedUrl: embedUrl,
        playlist,
        currentTrackIndex: 0,
        briefingAudioSrc: briefingSrc,
      }));
    } catch (err: any) {
      console.error(err);
      setState((prev) => ({ ...prev, status: 'error', errorMessage: err?.message || 'Generation failed' }));
    }
  };
```

- [ ] **Step 2: Update `startPlaybackSequence`**

Replace the function (currently lines 806–826) with:

```ts
  // Start actual playback sequence (briefing -> playlist track 0)
  const startPlaybackSequence = () => {
    const briefingConfig = currentAlarm ? currentAlarm.voiceBriefingConfig : voiceBriefingConfig;
    if (state.briefingAudioSrc && briefingConfig.enabled) {
      setState((prev) => ({ ...prev, status: 'playing_briefing' }));
      ttsPlayerRef.current.play(state.briefingAudioSrc, 'audio/wav', () => {
        setState((prev) => ({
          ...prev,
          status: 'playing',
          currentTrackIndex: 0,
          youtubeEmbedUrl: prev.playlist[0]?.embedUrl || null,
        }));
      });
    } else {
      setState((prev) => ({
        ...prev,
        status: 'playing',
        currentTrackIndex: 0,
        youtubeEmbedUrl: prev.playlist[0]?.embedUrl || null,
      }));
    }
  };
```

- [ ] **Step 3: Update `handleNextTrack` to use the active alarm's shuffle setting**

Old:
```ts
  const handleNextTrack = useCallback(() => {
    errorRecoveryIndexRef.current = 0;
    if (state.playlist.length === 0) return;
    if (state.playlist.length === 1) {
      const videoId = state.playlist[0].youtubeVideoId;
      if (videoId && youtubePlayerRef.current?.loadVideoById) {
        youtubePlayerRef.current.loadVideoById(videoId);
      }
      return;
    }
    const nextIndex = playlistConfig.shuffle
      ? getNextTrackIndex(state.currentTrackIndex, state.playlist.length, true)
      : (state.currentTrackIndex + 1) % state.playlist.length;
    setState(prev => ({
      ...prev,
      currentTrackIndex: nextIndex,
      youtubeEmbedUrl: prev.playlist[nextIndex].embedUrl || null
    }));
  }, [state.playlist.length, state.currentTrackIndex, playlistConfig.shuffle]);
```
New:
```ts
  const handleNextTrack = useCallback(() => {
    errorRecoveryIndexRef.current = 0;
    if (state.playlist.length === 0) return;
    if (state.playlist.length === 1) {
      const videoId = state.playlist[0].youtubeVideoId;
      if (videoId && youtubePlayerRef.current?.loadVideoById) {
        youtubePlayerRef.current.loadVideoById(videoId);
      }
      return;
    }
    const shuffle = currentAlarm ? currentAlarm.playlistConfig.shuffle : playlistConfig.shuffle;
    const nextIndex = shuffle
      ? getNextTrackIndex(state.currentTrackIndex, state.playlist.length, true)
      : (state.currentTrackIndex + 1) % state.playlist.length;
    setState((prev) => ({
      ...prev,
      currentTrackIndex: nextIndex,
      youtubeEmbedUrl: prev.playlist[nextIndex].embedUrl || null,
    }));
  }, [state.playlist.length, state.currentTrackIndex, currentAlarm, playlistConfig.shuffle]);
```

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(playback): use per-alarm genre, playlist, and briefing config"
```

---

## Task 7: Build the alarm list UI component

**Files:**
- Create: `components/AlarmList.tsx`

- [ ] **Step 1: Write `components/AlarmList.tsx`**

```tsx
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Alarm,
  MusicGenre,
  WeekDay,
  WEEKDAYS,
  PlaylistConfig,
  VoiceBriefingConfig,
} from '../types';
import { createAlarm } from '../services/alarm';

interface AlarmListProps {
  alarms: Alarm[];
  onChange: (alarms: Alarm[]) => void;
  defaultPlaylistConfig: PlaylistConfig;
  defaultVoiceBriefingConfig: VoiceBriefingConfig;
}

const DAY_LABELS: Record<WeekDay, string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};

const GENRES: MusicGenre[] = [
  'auto',
  'rock',
  'classical',
  'jazz',
  'pop',
  'ambient',
  'hiphop',
  'lofi',
  'acoustic',
  'synthwave',
];

export const AlarmList: React.FC<AlarmListProps> = ({
  alarms,
  onChange,
  defaultPlaylistConfig,
  defaultVoiceBriefingConfig,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Alarm>) => {
    onChange(alarms.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const toggleDay = (id: string, day: WeekDay) => {
    const alarm = alarms.find((a) => a.id === id);
    if (!alarm) return;
    const days = alarm.days.includes(day)
      ? alarm.days.filter((d) => d !== day)
      : [...alarm.days, day];
    update(id, { days });
  };

  const add = () => {
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const time = `${nextHour.getHours().toString().padStart(2, '0')}:${nextHour
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const newAlarm = createAlarm({
      time,
      isActive: false,
      label: 'New Alarm',
      playlistConfig: { ...defaultPlaylistConfig },
      voiceBriefingConfig: { ...defaultVoiceBriefingConfig },
    });
    onChange([...alarms, newAlarm]);
    setEditingId(newAlarm.id);
  };

  const remove = (id: string) => {
    onChange(alarms.filter((a) => a.id !== id));
  };

  return (
    <div className="flex flex-col gap-2 pl-0 sm:pl-5">
      {alarms.map((alarm) => {
        const isEditing = editingId === alarm.id;
        return (
          <div
            key={alarm.id}
            className="bg-neutral-900/60 border border-white/5 rounded p-2 flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={alarm.time}
                onChange={(e) => update(alarm.id, { time: e.target.value })}
                className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-digital text-yellow-500 focus:outline-none focus:border-radio-lit"
              />
              <input
                type="text"
                value={alarm.label}
                onChange={(e) => update(alarm.id, { label: e.target.value })}
                placeholder="LABEL"
                className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-mono text-amber-300 placeholder-yellow-800/30 uppercase focus:outline-none focus:border-radio-lit flex-1 min-w-[80px]"
              />
              <select
                value={alarm.genrePreset}
                onChange={(e) =>
                  update(alarm.id, { genrePreset: e.target.value as MusicGenre })
                }
                className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-mono uppercase text-gray-300 focus:outline-none focus:border-radio-lit"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-[10px] font-mono text-gray-400 uppercase cursor-pointer">
                <input
                  type="checkbox"
                  checked={alarm.isActive}
                  onChange={(e) => update(alarm.id, { isActive: e.target.checked })}
                  className="w-3 h-3 accent-radio-lit"
                />
                On
              </label>
              <button
                type="button"
                onClick={() => setEditingId(isEditing ? null : alarm.id)}
                className="text-[10px] font-mono text-gray-400 hover:text-radio-lit uppercase"
              >
                {isEditing ? 'Done' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => remove(alarm.id)}
                className="p-1 hover:bg-neutral-800 rounded text-gray-600 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(alarm.id, day)}
                  className={`w-6 h-6 rounded text-[9px] font-mono uppercase transition-colors ${
                    alarm.days.includes(day)
                      ? 'bg-radio-lit text-black'
                      : 'bg-neutral-850 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>

            {isEditing && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-white/5 pt-2 mt-1">
                <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alarm.playlistConfig.enabled}
                    onChange={(e) =>
                      update(alarm.id, {
                        playlistConfig: { ...alarm.playlistConfig, enabled: e.target.checked },
                      })
                    }
                    className="w-3 h-3 accent-radio-lit"
                  />
                  Playlist
                </label>
                {alarm.playlistConfig.enabled && (
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] font-mono text-gray-500 uppercase">
                      Tracks ({alarm.playlistConfig.trackCount})
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={alarm.playlistConfig.trackCount}
                      onChange={(e) =>
                        update(alarm.id, {
                          playlistConfig: {
                            ...alarm.playlistConfig,
                            trackCount: parseInt(e.target.value, 10),
                          },
                        })
                      }
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-radio-lit"
                    />
                  </div>
                )}
                <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alarm.voiceBriefingConfig.enabled}
                    onChange={(e) =>
                      update(alarm.id, {
                        voiceBriefingConfig: {
                          ...alarm.voiceBriefingConfig,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="w-3 h-3 accent-radio-lit"
                  />
                  Voice Briefing
                </label>
                {alarm.voiceBriefingConfig.enabled && (
                  <>
                    <select
                      value={alarm.voiceBriefingConfig.voiceName}
                      onChange={(e) =>
                        update(alarm.id, {
                          voiceBriefingConfig: {
                            ...alarm.voiceBriefingConfig,
                            voiceName: e.target.value as VoiceBriefingConfig['voiceName'],
                          },
                        })
                      }
                      className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-mono uppercase text-gray-300 focus:outline-none focus:border-radio-lit"
                    >
                      <option value="Fenrir">Fenrir</option>
                      <option value="Kore">Kore</option>
                      <option value="Leda">Leda</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alarm.voiceBriefingConfig.includeWeather}
                        onChange={(e) =>
                          update(alarm.id, {
                            voiceBriefingConfig: {
                              ...alarm.voiceBriefingConfig,
                              includeWeather: e.target.checked,
                            },
                          })
                        }
                        className="w-3 h-3 accent-radio-lit"
                      />
                      Weather
                    </label>
                    <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alarm.voiceBriefingConfig.includeAgenda}
                        onChange={(e) =>
                          update(alarm.id, {
                            voiceBriefingConfig: {
                              ...alarm.voiceBriefingConfig,
                              includeAgenda: e.target.checked,
                            },
                          })
                        }
                        className="w-3 h-3 accent-radio-lit"
                      />
                      Agenda
                    </label>
                    <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alarm.voiceBriefingConfig.includeTime}
                        onChange={(e) =>
                          update(alarm.id, {
                            voiceBriefingConfig: {
                              ...alarm.voiceBriefingConfig,
                              includeTime: e.target.checked,
                            },
                          })
                        }
                        className="w-3 h-3 accent-radio-lit"
                      />
                      Time
                    </label>
                    <input
                      type="text"
                      placeholder="CUSTOM GREETING..."
                      value={alarm.voiceBriefingConfig.customGreeting}
                      onChange={(e) =>
                        update(alarm.id, {
                          voiceBriefingConfig: {
                            ...alarm.voiceBriefingConfig,
                            customGreeting: e.target.value,
                          },
                        })
                      }
                      className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-mono text-amber-300 placeholder-yellow-800/20 focus:outline-none focus:border-radio-lit"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white border border-white/5 font-mono text-[10px] font-bold rounded uppercase transition-colors py-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Add Alarm
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Run TypeScript check on the new component**

Run:
```bash
pnpm exec tsc --noEmit
```
Expected: no errors from `components/AlarmList.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/AlarmList.tsx
git commit -m "feat(ui): add AlarmList settings component"
```

---

## Task 8: Integrate the alarm list and update the main deck

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Import `AlarmList`**

After the `PWAInstallPrompt` import, add:
```ts
import { AlarmList } from './components/AlarmList';
```

- [ ] **Step 2: Insert the Alarms section into the settings drawer**

Insert this block immediately after the Theme selection section in the settings drawer (after the closing `</div>` of the theme grid, around line 1237):

```tsx
                     {/* Alarms */}
                     <div className="flex flex-col gap-2 mt-1 border-t border-radio-dim/40 pt-2">
                         <div className="flex items-center gap-2">
                             <Bell className="w-3 h-3 text-radio-lit" />
                             <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Alarms</span>
                         </div>
                         <AlarmList
                             alarms={state.alarms}
                             onChange={(nextAlarms) => setState((prev) => ({ ...prev, alarms: nextAlarms }))}
                             defaultPlaylistConfig={playlistConfig}
                             defaultVoiceBriefingConfig={voiceBriefingConfig}
                         />
                     </div>
```

- [ ] **Step 3: Replace the bottom control deck**

Replace the entire `div` with id `btn-con-deck` (currently lines 1822–1876) with:

```tsx
            {/* Bottom: Control Deck */}
            <div id="btn-con-deck" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-auto">
                {/* Next Alarm Summary */}
                <div
                    id="deck-next-alarm"
                    className="col-span-1 sm:col-span-3 bg-radio-btn rounded shadow-btn active:shadow-btn-pressed transition-all relative overflow-hidden group border-t border-white/5 p-3 flex flex-col justify-center"
                >
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Next Broadcast</span>
                    <span className="text-sm sm:text-base font-mono text-radio-lit uppercase tracking-wider truncate led-text-shadow">
                        {getAlarmStatusText(state.alarms)}
                    </span>
                </div>

                {/* Big Action Render Button */}
                <button
                   id="deck-btn-play"
                   onClick={() => {
                     if (state.status === 'playing' || state.status === 'playing_briefing') {
                        ttsPlayerRef.current.stop();
                        stopOfflineFallback();
                        setState(prev => ({ ...prev, status: 'idle', currentAlarmId: null }));
                     } else if (state.status === 'idle') {
                        handleGenerateAndPlay();
                     }
                   }}
                   disabled={state.status !== 'idle' && state.status !== 'playing' && state.status !== 'playing_briefing'}
                   className={`btn-spring col-span-1 rounded shadow-btn active:shadow-btn-pressed flex flex-col items-center justify-center p-2 border-t border-white/5 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-radio-lit focus-visible:ring-inset`}
                   aria-label={state.status === 'playing' || state.status === 'playing_briefing' ? 'Stop Tuner' : 'Generate broadcast'}
                >
                   {state.status === 'playing' || state.status === 'playing_briefing' ? (
                      <Power className="w-5 h-5 text-red-500 mb-1 drop-shadow-[0_0_3px_rgba(239,68,68,0.5)]" />
                   ) : state.status !== 'idle' ? (
                      <Loader2 className="w-5 h-5 text-yellow-500 animate-spin mb-1" />
                   ) : (
                      <Play className="w-5 h-5 text-green-500 mb-1 drop-shadow-[0_0_3px_rgba(34,197,94,0.5)]" />
                   )}
                   <span className="text-[8px] font-bold text-gray-300 uppercase">
                      {state.status === 'playing' || state.status === 'playing_briefing' ? 'STOP' : 'TUNE IN'}
                   </span>
                </button>
            </div>
```

- [ ] **Step 4: Update the genre dial board `onClick`**

Old:
```ts
                             onClick={() => {
                                setState(prev => ({ 
                                  ...prev, 
                                  genrePreset: station,
                                  isAlarmActive: true,
                                  searchedTrack: null,
                                  playlist: [],
                                  currentTrackIndex: 0
                                }));
                             }}
```
New:
```ts
                             onClick={() => {
                                setState(prev => ({ 
                                  ...prev, 
                                  genrePreset: station,
                                  searchedTrack: null,
                                  playlist: [],
                                  currentTrackIndex: 0
                                }));
                             }}
```

- [ ] **Step 5: Update `Clock` and screen-saver indicators**

Old (around line 1538):
```tsx
                    <Clock className="mb-2" isAlarmActive={state.isAlarmActive} />
```
New:
```tsx
                    <Clock className="mb-2" isAlarmActive={isAnyAlarmActive} />
```

Old screen-saver block (around lines 1905–1911):
```tsx
          <div className="text-center">
            <Clock isAlarmActive={state.isAlarmActive} />
            {state.isAlarmActive && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-radio-lit animate-pulse shadow-[0_0_8px_rgba(255,51,51,0.8)]" />
                <span className="text-radio-lit font-mono text-xs uppercase tracking-widest">Alarm Armed</span>
              </div>
            )}
          </div>
```
New:
```tsx
          <div className="text-center">
            <Clock isAlarmActive={isAnyAlarmActive} />
            {isAnyAlarmActive && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-radio-lit animate-pulse shadow-[0_0_8px_rgba(255,51,51,0.8)]" />
                <span className="text-radio-lit font-mono text-xs uppercase tracking-widest">Alarm Armed</span>
              </div>
            )}
          </div>
```

- [ ] **Step 6: Commit**

```bash
git add App.tsx components/AlarmList.tsx
git commit -m "feat(ui): integrate alarm list into settings and show next alarm summary"
```

---

## Task 9: Add persistence effect and clean up remaining references

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add alarm persistence effect**

Insert after the screen-saver logic `useEffect` (around line 423):

```ts
  // Persist alarms whenever they change
  useEffect(() => {
    saveAlarms(state.alarms);
  }, [state.alarms]);
```

- [ ] **Step 2: Verify no stale `alarmTime`/`isAlarmActive` references remain**

Run:
```bash
grep -n "state\.alarmTime\|state\.isAlarmActive\|isAlarmActive:" App.tsx
```
Expected: only matches in comments or inside the migration key list. If any production references remain, update them to use `state.alarms`/`isAnyAlarmActive`.

- [ ] **Step 3: Run TypeScript check**

Run:
```bash
pnpm exec tsc --noEmit
```
Expected: `error TS0: no errors` or exit code 0.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(persistence): persist alarm array and clean up legacy single-alarm refs"
```

---

## Task 10: Verify build, types, and tests

**Files:** all

- [ ] **Step 1: Run type check**

Run:
```bash
pnpm exec tsc --noEmit
```
Expected: exit code 0.

- [ ] **Step 2: Run unit tests**

Run:
```bash
pnpm test
```
Expected: all tests pass.

- [ ] **Step 3: Run production build**

Run:
```bash
pnpm build
```
Expected: `dist/` is generated with no errors.

- [ ] **Step 4: Manual smoke checklist**

Run the dev server (`pnpm dev`), open `http://localhost:3000`, and verify:

1. The main clock area shows "Next Broadcast" with the default 07:00 alarm.
2. Opening settings shows the Alarms section with one default alarm.
3. You can add a second alarm, toggle days, change its time/label/genre, and toggle it active/inactive.
4. The next-alarm summary updates immediately when you edit active alarms.
5. Deleting an alarm removes it from the list and summary.
6. (Optional) Temporarily set an alarm 2 minutes in the future with pre-warm on and confirm generation starts at the pre-warm minute and playback starts at the alarm minute.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(build): verify multi-alarm feature passes tsc, tests, and build"
```

---

## Task 11: Push to remote

**Files:** none

- [ ] **Step 1: Push the branch**

Run:
```bash
git push origin master
```
Expected: commits uploaded successfully.

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| `Alarm` type with id/time/label/active/days/genre/playlist/voice | Task 1 |
| `AppState.alarms` + `currentAlarmId`, remove single alarm fields | Task 4 |
| Migration from legacy `aetherclock_alarm_time` / `aetherclock_alarm_active` | Task 2, 3 |
| Scheduler filters active + weekday, matches time, pre-warm 1 min, dedup | Task 5 |
| Uses alarm's own genre/playlist/voice config on trigger | Task 6 |
| Main clock shows next alarm summary | Task 8 |
| Settings Alarms section with add/edit/delete/weekday/genre/active | Task 7, 8 |
| Persistence under `aetherclock_alarms` | Task 2, 9 |
| Invalid/missing array fallback, duplicate ID dedup | Task 2 |
| Deleted alarm during pre-warm cancels gracefully | Task 6 |
| Build/TS/tests pass | Task 10 |

### Placeholder Scan

No `TBD`, `TODO`, or "add appropriate error handling" placeholders remain. Every step includes concrete code, file paths, and commands.

### Type Consistency

- `Alarm.playlistConfig` is `PlaylistConfig`; `Alarm.voiceBriefingConfig` is `VoiceBriefingConfig`.
- `handleGenerateAndPlay(alarmId?, preGenerateOnly?)` is used consistently by the scheduler and the manual button.
- `getCurrentWeekDay`, `getPreAlarmTime`, and `getNextAlarm` are imported from `services/alarm` in both `App.tsx` and tests.

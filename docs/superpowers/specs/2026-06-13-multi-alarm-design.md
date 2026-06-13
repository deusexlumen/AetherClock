# AetherClock Multi-Alarm Design Spec

## Goal
Replace the current single-alarm (`alarmTime` + `isAlarmActive`) with a flexible multi-alarm system. Users can create, edit, enable/disable, and delete multiple alarms, each with its own time, label, recurring weekdays, genre preset, playlist config, and voice briefing config.

## Scope
This spec covers only the **Multi-Alarm** feature. Web Push background alarms will be handled in a separate follow-up spec once the alarm data model is stable.

## Architecture

### Data Model

```ts
// types.ts
export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

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
  // ... existing fields ...
  alarms: Alarm[];
  currentAlarmId: string | null;
  // Removed: alarmTime, isAlarmActive
}
```

- `id` is generated with `crypto.randomUUID()` when available, falling back to a timestamp + random string.
- `days` empty means "one-time / every day" — to keep it simple initially, an empty array means the alarm fires every day (same behavior as the current single alarm).
- Each alarm carries its own `playlistConfig` and `voiceBriefingConfig` so users can have, e.g., a "Workout" alarm with high-energy rock + no briefing, and a "Gentle Wake" alarm with lofi + briefing.

### State Migration

On app load, before React state initializers run, a migration helper checks:
1. If `aetherclock_alarms` exists → use it.
2. Else if legacy `aetherclock_alarm_time` exists → create one `Alarm` from it, persist under `aetherclock_alarms`, and remove the legacy key.
3. Else → initialize a default alarm at `07:00`.

### Alarm Scheduler

Replace the current `checkAlarm` logic with a scheduler that:
1. Every second computes the current local time and weekday.
2. Filters alarms where `isActive === true` and `days` is empty or includes today.
3. Finds any alarm whose `time` matches the current time exactly (to the minute).
4. Pre-warm (if enabled) starts 1 minute before the matched alarm time.
5. When the alarm time hits, triggers `handleGenerateAndPlay` with the alarm's own config.
6. Sets `currentAlarmId` to the triggered alarm's ID.
7. Prevents re-triggering the same minute via a `triggeredMinutes` set keyed by `alarmId + HH:MM`.

### UI Changes

**Main Clock Area**
- Replace single "Active" toggle with a summary: "Next alarm: 07:00 Workout (in 8h 12m)".
- Keep a prominent "Stop" / "TUNE IN" button.

**Settings Panel**
- Add an "Alarms" section above or near the existing playlist/voice briefing sections.
- Each alarm is shown as a compact row/card:
  - Time (editable time input)
  - Label (editable text)
  - Weekday toggles (M T W T F S S)
  - Genre preset dropdown
  - Active toggle
  - Edit/Delete buttons
- "+ Add Alarm" button creates a new inactive alarm at the current time + 1 hour, focused for editing.

### Configuration Flow

When an alarm fires:
1. `handleGenerateAndPlay(alarmId, preGenerateOnly)` looks up the alarm.
2. Uses the alarm's `genrePreset`, `playlistConfig`, and `voiceBriefingConfig` instead of global defaults.
3. Pre-warm uses the alarm's config as well.

### Persistence

- `aetherclock_alarms`: JSON array of `Alarm`.
- `aetherclock_alarm_time` and `aetherclock_alarm_active` are removed after migration.
- Global `aetherclock_playlist`, `aetherclock_voice_briefing`, etc. remain as defaults for new alarms.

### Error Handling

- Invalid/missing alarm array → fall back to default single alarm.
- Duplicate alarm IDs → deduplicate on load.
- Active alarm deleted while pre-warm is running → cancel pre-warm gracefully.

## Out of Scope

- Snooze / dismiss per alarm.
- Alarm-specific themes or volume.
- One-time (non-recurring) alarms with a specific date.
- Web Push / background triggering.

## Validation Criteria

1. `pnpm exec tsc --noEmit` passes.
2. `pnpm build` succeeds.
3. User can add, edit, delete, and toggle multiple alarms.
4. Next alarm indicator shows the upcoming active alarm correctly.
5. Alarm triggers at the configured time using its own genre/briefing config.
6. Legacy single-alarm settings migrate into the new array format without loss.
7. Changes are committed and pushed.

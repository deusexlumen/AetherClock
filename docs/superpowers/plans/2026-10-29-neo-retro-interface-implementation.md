# AetherClock Neo-Retro Interface Implementation Plan

**Date:** 2026-10-29  
**Design spec:** `docs/superpowers/specs/2026-10-29-neo-retro-interface-design.md`  
**Spec approval:** Approved by repository owner on 2026-10-29  
**Target branch:** `feat/neo-retro-interface`

## Implementation strategy

Use vertical, testable slices. First extract theme data and visual-preference handling from `App.tsx`; then replace presentation regions one at a time while leaving alarm scheduling, generation, playback recovery, push synchronization, and service contracts in place. Each slice must build before the next begins.

The recommended execution method is direct implementation on the existing feature branch with staged commits, a browser-preview checkpoint, and no merge to `master` without explicit owner approval.

## Slice 1 — Establish the visual domain model

### Files

- Modify `types.ts`.
- Add `components/themes/registry.ts`.
- Add `services/visualSettings.ts`.
- Add `services/visualSettings.test.ts`.
- Add `components/themes/registry.test.ts`.

### Work

1. Add a `ThemeId` union for the ten existing IDs and `neonNocturne`, `solaris`, `artDeco`, and `aurora`.
2. Add typed visual preferences for display mode, motion intensity/speed, audio reactivity, glow, particle density, quality, reduced-motion preference, circadian lighting, favorite themes, and random-theme mode.
3. Add optional `themeId?: ThemeId` to `Alarm` and `CalendarItem`; visual preferences remain excluded from `ServerAlarm` and push payloads.
4. Move the existing `THEMES` object out of `App.tsx` into a data-driven registry. Preserve all existing color tokens and IDs.
5. Extend registry entries with name, category, hardware anchor, scene type, preview treatment, supported controls, and theme defaults.
6. Implement defensive loading, validation, clamping, persistence, and per-group reset for visual preferences under `aetherclock_visual_settings`.
7. Implement pure theme-resolution helpers: global selection, per-alarm override/inheritance, deterministic daily random selection, and per-alarm random selection.
8. Preserve `aetherclock_theme` as the migration source and compatibility fallback; never reset existing tasks, alarms, model choices, or keys.

### Tests

- Registry contains fourteen unique themes with valid metadata and scene references.
- Invalid stored values fall back safely and numeric values are clamped.
- Legacy theme IDs migrate without changing unrelated storage.
- Daily random selection is stable within one day; per-alarm selection is stable for one alarm event.
- Alarm/theme inheritance and overrides resolve correctly.

## Slice 2 — Extract the radio shell without changing behavior

### Files

- Modify `App.tsx`.
- Add `components/layout/RadioShell.tsx`.
- Add `components/layout/ChassisDecor.tsx`.
- Add `components/layout/StatusBar.tsx`.
- Add `styles/neo-retro.css`.

### Work

1. Move device casing, speaker deck, hardware decals, glass face, and theme overlays into focused presentational components.
2. Move inline keyframes and reusable physical-material treatments into the new stylesheet; keep CSS custom properties as the theme-token mechanism.
3. Replace per-theme JSX decal chains with registry-driven decoration variants.
4. Keep `App.tsx` as the temporary owner of alarm/playback state and pass explicit props/callbacks to the extracted shell.
5. Preserve existing DOM accessibility behavior and primary control labels during the extraction.

### Verification

- Build after extraction.
- Compare all ten existing themes before adding new visual features.
- Smoke-test planner, tuner buttons, settings open/close, tune-in, stop, and screensaver wake-up.

## Slice 3 — Build the Now view and primary navigation

### Files

- Modify `App.tsx`.
- Add `components/layout/AppNavigation.tsx`.
- Add `components/NowView.tsx`.
- Add `components/NextAlarmSummary.tsx`.
- Add `components/ControlDeck.tsx`.
- Add `services/nextAlarm.ts`.
- Add `services/nextAlarm.test.ts`.

### Work

1. Add Now, Alarms, Tuner, and Themes navigation; use in-app state rather than URL routing so static hosting and PWA behavior remain simple.
2. Build the Now view around current time/date, next armed alarm and countdown, system status, and primary actions.
3. Compute the next occurrence across task alarms and standalone alarms with weekday handling; do not alter the alarm trigger loop.
4. Keep track metadata, playlist, player, visualizer, and error notices available in Now when relevant, but prevent them from displacing the primary alarm hierarchy.
5. Move the existing play/cancel/stop behavior into `ControlDeck` without rewriting its callbacks.
6. Make empty states action-oriented and concise.

### Tests

- Next-alarm selection across midnight, weekdays, disabled alarms, simultaneous tasks, and no-armed-alarm states.
- Existing alarm service tests remain unchanged and pass.
- Desktop and mobile first-screen hierarchy checks.

## Slice 4 — Separate Alarms and Tuner workflows

### Files

- Modify `App.tsx`.
- Add `components/AlarmsView.tsx`.
- Add `components/TunerView.tsx`.
- Modify `components/AlarmList.tsx`.
- Modify `components/CalendarPlanner.tsx`.

### Work

1. Place `CalendarPlanner`, text-list editing, standalone alarms, and their save/error states in Alarms.
2. Add an optional visual-theme selector to task and standalone-alarm editing with `Use global theme` as the default.
3. Move genre preset buttons, station frequency/status, direct YouTube input, and related playback context into Tuner.
4. Preserve planner preview, alarm editing/arming, agenda conversion, and backend synchronization exactly.
5. Ensure visual overrides do not enter AI prompts, notification content, or server alarm matching.

### Verification

- Create, edit, disable, and preview task alarms.
- Create and edit standalone alarms with and without theme overrides.
- Confirm existing local data loads with no visual override.
- Run alarm, calendar, push-backend, and alarm-server tests.

## Slice 5 — Replace the configuration drawer

### Files

- Add `components/settings/SettingsPanel.tsx`.
- Add `components/settings/SettingsTabs.tsx`.
- Add `components/settings/AlarmSettings.tsx`.
- Add `components/settings/PlaybackSettings.tsx`.
- Add `components/settings/BriefingSettings.tsx`.
- Add `components/settings/DesignSettings.tsx`.
- Add `components/settings/SystemSettings.tsx`.
- Modify `App.tsx`.

### Work

1. Implement an accessible dialog/panel with Alarms, Playback, Briefing & AI, Design & Motion, and System groups.
2. Move every existing option into its appropriate group without dropping functionality: loudness, volume, pre-warm, blacklist, voice settings, playlist, models, API key, notifications, offline fallback, and timeout.
3. Add progressive disclosure for advanced options and a reset action for each visual/settings group.
4. Preserve existing persistence keys for non-visual settings.
5. Add focus management, Escape close, visible focus, descriptive labels, and appropriate dialog semantics.
6. Keep destructive or permission-related actions explicit; do not request notification permission merely from opening settings.

### Verification

- Keyboard-only navigation and focus return.
- Every pre-existing setting persists across reload.
- Group resets affect only their documented scope.
- Existing AI, PWA, and playback service tests pass.

## Slice 6 — Add the visual theme gallery and fourteen themes

### Files

- Add `components/themes/ThemeGallery.tsx`.
- Add `components/themes/ThemePreview.tsx`.
- Add `components/ThemesView.tsx`.
- Modify `components/themes/registry.ts`.
- Modify `styles/neo-retro.css`.
- Modify `App.tsx`.

### Work

1. Build responsive theme cards with lightweight animated CSS/SVG previews, selected/favorite states, category, and hardware-anchor detail.
2. Provide one shared detailed preview area; never instantiate one Babylon engine per card.
3. Add favorites and random-theme controls backed by Slice 1 helpers.
4. Add Neon Nocturne, Solaris Console, Art Deco Broadcast, and Aurora Field as layered CSS/SVG themes with physical-radio anchors.
5. Give every existing theme a deliberate, bounded micro-animation and reduced-motion equivalent.
6. Preserve readable text and control contrast independently of background animation.

### Verification

- All fourteen themes can be previewed and applied repeatedly.
- Favorite/random/global/per-alarm choices survive reload.
- No WebGL engine is created for ordinary gallery cards.
- Reduced-motion mode stops continuous preview and chassis animation.

## Slice 7 — Implement Device and Ambient modes

### Files

- Add `components/AmbientClock.tsx`.
- Modify `components/layout/RadioShell.tsx`.
- Modify `components/NowView.tsx`.
- Modify `App.tsx`.
- Modify `styles/neo-retro.css`.

### Work

1. Add a persistent Device/Ambient control with an obvious way back to full controls.
2. Expand the display into an immersive clock scene while retaining a hardware frame, tuner line, or status lamp.
3. Reveal controls on pointer, touch, or keyboard interaction without hiding critical alarm/playback state.
4. Integrate the existing screensaver timeout with Ambient Mode and eliminate the disconnected duplicate overlay presentation.
5. Use display/chassis transitions that do not block primary actions or remount the YouTube player unnecessarily.

### Verification

- Repeated Device/Ambient transitions during idle, ready, briefing, playing, and alarm states.
- Screensaver wake by pointer, touch, and keyboard.
- No playback restart solely from changing display mode.

## Slice 8 — Upgrade Babylon rendering and scene controls

### Files

- Modify `components/themes/BabylonCanvas.tsx`.
- Add `components/themes/scenes/sceneTypes.ts`.
- Modify `components/themes/scenes/vaporwave.ts`.
- Modify `components/themes/scenes/space.ts`.
- Modify `components/themes/scenes/submarine.ts`.
- Add `components/themes/CssSceneFallback.tsx`.

### Work

1. Define a scene-settings contract for motion, speed, audio response, glow, density, quality, circadian phase, and application status.
2. Update settings through refs/scene metadata rather than rebuilding engines or triggering React updates per animation frame.
3. Add engine initialization error handling, WebGL-unavailable detection, and a polished CSS fallback with non-blocking status reporting.
4. Cap device pixel ratio and expensive effects by quality level; reduce particle counts and bloom in Balanced/Saver modes.
5. Pause or throttle rendering when hidden and clean up RAF, resize listeners, scenes, and engines on every unmount.
6. Expand the three existing scenes with layered detail and smooth state transitions while maintaining their original identity.
7. Apply audio-reactivity scaling to available FFT data; do not claim real FFT for cross-origin YouTube playback.
8. Derive circadian lighting from local time and existing weather day/night context without adding scheduling side effects.

### Verification

- Repeated CSS/WebGL theme switches and WebGL scene switches.
- Simulated WebGL failure and engine initialization rejection.
- Hidden-tab pause/resume and quality changes during a running scene.
- Reduced-motion mode with no continuous scene movement.
- No growing listener/engine count after repeated mounts.

## Slice 9 — Responsive, accessibility, and interaction polish

### Files

- Modify all new view/settings/theme components as needed.
- Modify `styles/neo-retro.css`.
- Modify `App.tsx` only for integration fixes.

### Work

1. Tune layouts for narrow mobile, large mobile, tablet, desktop, and wide desktop rather than uniformly scaling the radio.
2. Maintain readable body/control text, minimum practical touch targets, and visible focus across dark and light themes.
3. Honor system reduced-motion changes and the explicit user override.
4. Ensure tabs, sliders, selects, theme cards, and dialog actions have accessible names and states.
5. Remove animation from status meaning: online, error, armed, blocked, and playing states always have text equivalents.

### Verification

- Keyboard-only complete flow.
- Touch-sized control review on mobile.
- Light-theme contrast and long track/task names.
- Zoomed layout and reduced-motion checks.

## Slice 10 — Full regression and delivery checkpoint

### Work

1. Run `pnpm test` and `pnpm build` and resolve all introduced failures.
2. Exercise task and standalone alarm creation/editing/arming, next-alarm countdown, tune-in, cancel, stop/dismiss, direct YouTube selection, playback errors, and local fallback.
3. Verify legacy localStorage migration and persistence of every new preference.
4. Exercise all main views and modes at desktop and mobile sizes and check the browser console for introduced errors.
5. Update README feature/theme counts and settings documentation only after the implementation matches them.
6. Save a preview version for owner review and report the branch/commit. Do not merge or publish a production release without explicit approval.

## Delivery gates

The implementation is ready for owner review only when all design-spec acceptance criteria are met, tests/build pass, no primary alarm/playback flow has regressed, and both Device and Ambient modes retain the retro-radio identity. Any discovered need to change backend contracts or alarm scheduling stops the affected slice and is raised for separate approval.

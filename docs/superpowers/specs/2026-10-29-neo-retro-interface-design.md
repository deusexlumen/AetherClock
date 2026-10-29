# AetherClock Neo-Retro Interface Design

**Date:** 2026-10-29  
**Status:** Approved design direction; awaiting written-spec review  
**Branch:** `feat/neo-retro-interface`

## 1. Product intent

AetherClock must remain immediately recognizable as a characterful retro radio alarm clock. The redesign improves usability, visual hierarchy, animation quality, and customization without sanding off that identity. Modern presentation and retro hardware are complementary: every theme retains at least one physical-radio anchor such as a speaker grille, tuner, LED, mechanical control, or hardware frame.

The approved direction is a Neo-Retro Cockpit with an Ambient Mode and a theme laboratory. The existing alarm, AI, playback, push-notification, and backend behavior remains intact except where the UI must call it more clearly or pass an optional visual preference.

## 2. Experience and information architecture

### Primary view

The initial view prioritizes, in order:

1. Current time and date.
2. Next armed alarm, its task, and a live countdown.
3. Playback, connection, and alarm status.
4. Primary actions: add alarm, test the next selection, tune in, and stop/dismiss when relevant.

Task planning, tuner presets, themes, and configuration use clearly separated views or tabs instead of one long form beneath the clock. Existing planner and text-list editing capabilities remain available. Empty states explain the next useful action in one concise step.

### Device Mode

Device Mode preserves the physical radio as the main visual object. The speaker grille, illuminated display, tactile controls, status lamps, and chassis remain visible. Modern controls may sit inside the display or beside the device, but they must not turn the product into a generic dashboard.

### Ambient Mode

Ambient Mode expands the display into an immersive clock scene. Secondary controls recede while a restrained hardware frame, tuner detail, or status lamp preserves the radio identity. Interaction reveals the controls immediately. Entering and leaving Ambient Mode uses a purposeful display/chassis transition rather than a generic page fade.

The existing screensaver timeout remains configurable and integrates with Ambient Mode instead of presenting a disconnected overlay.

## 3. Navigation and settings

Primary navigation separates **Now**, **Alarms**, **Tuner**, and **Themes**. Configuration is grouped into:

- **Alarms** — standalone alarms and alarm-related defaults.
- **Playback** — volume, loudness, playlist, source, and pre-warm.
- **Briefing & AI** — voice briefing, models, and optional personal key.
- **Design & Motion** — theme, display mode, scene controls, and accessibility.
- **System** — notifications, installation, offline fallback, and screensaver.

Frequently used controls remain visible. Advanced controls are progressively disclosed. Each settings group includes a reset action for that group and a clear saved-state indication. No setting is represented only by an ambiguous icon.

## 4. Theme system

### Existing themes

All ten existing themes remain available and retain their names and core identity. Each receives deliberate micro-animation appropriate to its material and character. Vaporwave Cyber-Luxe, Space Odyssey, and Sonar Marine receive expanded scene detail and clearer state transitions.

### New hybrid themes

Four themes extend the registry:

1. **Neon Nocturne** — night-drive instrumentation, analog meters, and a restrained luminous city atmosphere.
2. **Solaris Console** — a warm daylight instrument using layered, time-responsive light and tactile radio details.
3. **Art Deco Broadcast** — geometric tuner ornament, machined surfaces, and broadcast-era typography.
4. **Aurora Field** — atmospheric generative layers with a minimal but visible radio frame.

These are design concepts, not licenses to introduce unrelated visual frameworks or remove the hardware anchor.

### Theme gallery

The theme picker becomes a visual gallery with animated lightweight previews, names, categories, favorite toggles, and a selected state. Selecting a card previews the theme without discarding unrelated settings. A full live preview runs at most one WebGL scene; gallery cards must not each create a Babylon engine.

Users can mark favorites, choose a random-theme mode, and optionally assign a theme to an individual alarm. An alarm without an explicit theme inherits the global selection.

## 5. Motion, atmosphere, and quality controls

Design & Motion exposes bounded, understandable controls:

- Motion intensity: 0–100.
- Motion speed: 0.25×–2×.
- Audio reactivity: 0–100.
- Glow/bloom intensity: 0–100.
- Particle density: 0–100 where applicable.
- Quality: Auto, High, Balanced, Saver.
- Reduced motion: Follow system, Reduced, Full motion.
- Device/Ambient display mode.
- Circadian lighting on/off.
- Screensaver behavior and timeout.

Theme-specific defaults remain meaningful when a user has not customized a value. Controls that do not apply to a selected theme are hidden or clearly disabled with an explanation.

Circadian lighting derives scene atmosphere from local time and available day/night context. It must never change alarm times or playback scheduling. Alarm, playing, idle, error, and briefing states may influence the scene, but status text remains readable independently of animation.

Transitions are motivated by the object: tuner travel, display shutters, lamp changes, scene lighting, and control-deck movement. Motion does not delay primary actions.

## 6. Accessibility, responsiveness, and performance

- Desktop and mobile use the same information hierarchy with responsive layout rather than simply shrinking the desktop device.
- Core text and controls receive readable type sizes, contrast, focus indicators, and touch targets.
- Keyboard navigation covers navigation, dialogs, tabs, theme cards, sliders, and primary playback/alarm actions.
- Follow-system reduced motion is the default. Reduced mode replaces continuous ambient movement with static or minimally transitioning scenes.
- Auto quality considers device capability and measured rendering pressure. It may cap pixel ratio, reduce particles, and disable expensive post-processing.
- Rendering pauses or throttles when the document is hidden and when a scene is not visible.
- WebGL failure or absence produces a polished CSS fallback and a non-blocking status message; the clock and alarms remain usable.
- Animated previews and background scenes must not cause continuous React state updates at animation-frame frequency.

## 7. Technical design

The implementation uses the existing React, TypeScript, CSS, and Babylon.js stack. No new application-state framework is required.

The monolithic `App.tsx` UI is separated incrementally into focused components, including a primary clock/status display, next-alarm summary, control deck, navigation, settings dialog/panel, theme gallery, and motion controls. Alarm orchestration and service behavior are not rewritten as part of this extraction.

A data-driven theme registry contains theme metadata, hardware-anchor details, preview type, scene type, supported motion controls, and defaults. `BabylonCanvas` and scene builders receive a stable scene-settings object or ref-based updates and continue to clean up engines, scenes, observers, and animation loops on unmount.

Visual preferences persist in browser storage under the existing `aetherclock_` naming convention. Loading logic migrates or extends current preferences without resetting existing alarms, tasks, API settings, or theme selection. New alarm theme assignment is optional and backward-compatible.

No backend, Cloudflare binding, Gemini routing, push payload, or service-worker protocol change is required for this redesign.

## 8. Acceptance criteria

The redesign is complete when:

- The first screen exposes time, next armed alarm/countdown, status, and primary actions without scrolling on typical desktop and mobile viewports.
- The retro radio remains visually identifiable in Device Mode, Ambient Mode, and every new theme.
- All ten existing themes and four new hybrid themes are selectable.
- Theme selection uses visual previews and supports favorites, random selection, global selection, and optional per-alarm inheritance/override.
- Motion, audio response, quality, reduced motion, display mode, and circadian controls persist across reloads.
- Existing alarms, task planning, playback controls, and settings continue to work with previously stored data.
- Reduced-motion and CSS fallback modes remain functional without WebGL.
- Keyboard and touch users can reach all primary flows.
- Production build and automated tests pass, with no new browser-console errors in the exercised flows.

## 9. Verification

Verification includes:

- `pnpm test` and `pnpm build`.
- Desktop and mobile visual checks for Now, Alarms, Tuner, Themes, settings, Device Mode, and Ambient Mode.
- Theme switching across CSS and WebGL scenes, including repeated mounts/unmounts.
- Reload persistence and legacy-preference migration.
- Keyboard-only and reduced-motion checks.
- Simulated WebGL-unavailable fallback.
- Alarm creation/editing/arming, next-alarm countdown, tune-in, stop/dismiss, and playback smoke tests without changing backend contracts.

## 10. Non-goals

This work does not add Spotify/Apple Music, accounts, cloud synchronization, new backend persistence, dated-calendar semantics, or a rewrite of alarm scheduling. It also does not replace the retro radio with a generic modern dashboard.

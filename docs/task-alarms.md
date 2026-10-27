# Task-based music alarms

Each task owns a daily alarm at its time. The task's active checkbox arms or disarms it. Changing a time or title updates the derived alarm; deleting a task removes it. Existing standalone alarms are preserved separately. Tasks at the same minute share one broadcast rather than repeatedly interrupting one another.

The derived alarms are used by the foreground scheduler, next-alarm display and push synchronization. The push backend receives alarm IDs, times and labels, while the music curator receives the structured task category and keywords. Task IDs remain stable during ordinary edits. The daily schedule, categories, keywords and active state survive a page reload in local storage.

For an automatic task alarm, that exact task is pinned as the selection context, including when tasks share a time. Manual TUNE IN uses the next active task relative to the current local time. Test music previews the chosen task even when it is disarmed; previewing does not arm it. Keywords and activity take priority; genre is a style constraint and weather is secondary. Existing YouTube recordings are selected, not generated or rewritten.

Examples:

- 09:00 Presentation / work / confident, focused, no vocals
- 18:00 Training / fitness / energetic, driving rhythm
- 22:30 Wind down / chill / calm, gentle, no drums

The text-list format is `09:00 [work] Presentation | keywords: confident, no vocals`. Prefix a line with `!` to disarm it. Applying a text list preserves IDs for tasks with unchanged time and title.

## Validation

100 unit tests pass, including task-to-alarm derivation, time edits, disarming/removal, category/keyword round trips, persistence, midnight context and structured Gemini request content.

A browser scenario advanced the local clock from 08:59 to 09:00 without pressing TUNE IN. One broadcast started for two coinciding tasks. The request contained the focus task's work category and confident/no vocals keywords. A disarmed 09:01 task did not fire. After editing the active task to 09:02, chill and calm/no lyrics, a reload preserved the changes and the next automatic request used those exact values. Deleting the playing task stopped playback and removed its schedule. A separate test held pre-generation across the alarm time: only one AI request ran and music started when preparation finished, without restarting the job. Gemini and the IFrame API were simulated in these scenarios; actual YouTube playback was validated separately.

Automatic music playback requires the app to remain open and browser audio permission. Push notifications can notify a closed app on supported devices, but cannot force background YouTube playback. Semantic matching requires the server Gemini pool or an optional personal key; generic presets are explicitly labeled when that service is unavailable. The plan currently repeats daily and does not support calendar dates.

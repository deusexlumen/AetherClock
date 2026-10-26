import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMusicContext, calendarToAlarms, formatCalendarToAgenda, loadCalendar, parseAgendaToCalendar, parseKeywords, saveCalendar } from './calendar';
import { DEFAULT_PLAYLIST_CONFIG, DEFAULT_VOICE_BRIEFING_CONFIG } from './alarm';
import type { CalendarItem } from '../types';

const task = (changes: Partial<CalendarItem> = {}): CalendarItem => ({ id: 'meeting', time: '09:00', title: 'Presentation', vibe: 'work', keywords: ['focused', 'no vocals'], active: true, ...changes });
afterEach(() => vi.unstubAllGlobals());

describe('task planning', () => {
  it('keeps categories, keywords and disabled tasks across text-list round trips', () => {
    const original = [task(), task({ id: 'disabled', time: '17:00', title: 'Training', vibe: 'fitness', active: false, keywords: ['energetic'] })];
    expect(parseAgendaToCalendar(formatCalendarToAgenda(original)).map(({ id, ...item }) => item))
      .toEqual(original.map(({ id, ...item }) => item));
  });
  it('reads legacy times and 12-hour notation correctly', () => {
    expect(parseAgendaToCalendar('0800 Meeting\n8:30 Coffee\n12am Sleep\n12pm Lunch').map(item => item.time))
      .toEqual(['08:00', '08:30', '00:00', '12:00']);
  });
  it('does not turn invalid explicit times into silent nine-am alarms', () => {
    expect(() => parseAgendaToCalendar('25:99 Meeting')).toThrow('Invalid time');
  });
  it('requires a time before arming tasks imported from free text', () => {
    expect(() => parseAgendaToCalendar('Focus, no vocals')).toThrow('Add a valid time');
    expect(parseAgendaToCalendar('8:30pm Reading')[0].time).toBe('20:30');
  });
  it('accepts bullet points or comma-separated mood keywords without duplicates', () => {
    expect(parseKeywords('ruhig, ohne Gesang\nFokus; ruhig')).toEqual(['ruhig', 'ohne Gesang', 'Fokus']);
  });
  it('saves task edits and alarm state across reloads', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    expect(saveCalendar([task({ active: false, time: '10:30' })])).toBe(true);
    expect(loadCalendar()).toEqual([task({ active: false, time: '10:30' })]);
  });
  it('reports unavailable storage', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('full'); }, getItem: () => { throw new Error('denied'); } });
    expect(saveCalendar([task()])).toBe(false);
    expect(loadCalendar()).toEqual([]);
  });
});

describe('task alarms and music context', () => {
  it('derives each alarm from its task and keeps identity when edited', () => {
    const original = calendarToAlarms([task()], 'auto', DEFAULT_PLAYLIST_CONFIG, DEFAULT_VOICE_BRIEFING_CONFIG)[0];
    const edited = calendarToAlarms([task({ time: '10:30', title: 'New meeting', active: false })], 'auto', DEFAULT_PLAYLIST_CONFIG, DEFAULT_VOICE_BRIEFING_CONFIG)[0];
    expect(original).toMatchObject({ id: 'task:meeting', calendarItemId: 'meeting', time: '09:00', isActive: true });
    expect(edited).toMatchObject({ id: original.id, time: '10:30', label: 'New meeting', isActive: false });
    expect(calendarToAlarms([], 'auto', DEFAULT_PLAYLIST_CONFIG, DEFAULT_VOICE_BRIEFING_CONFIG)).toEqual([]);
  });
  it('uses the triggering task even when another task has the same time', () => {
    const tasks = [task(), task({ id: 'gym', title: 'Training', vibe: 'fitness', keywords: ['energy'] })];
    expect(buildMusicContext(tasks, '09:00', 'gym').focus?.title).toBe('Training');
    expect(buildMusicContext(tasks, '09:00', 'gym').direction).toContain('movement');
  });
  it('excludes disabled tasks from automatic selection', () => {
    expect(buildMusicContext([task({ active: false })], '08:59').focus).toBeNull();
  });
  it('handles the next daily occurrence across midnight', () => {
    const context = buildMusicContext([task({ time: '00:15' })], '23:55');
    expect(context.focus).toMatchObject({ minutesUntil: 20, nextDay: true });
  });
});

import type { Alarm, CalendarItem, MusicGenre, PlaylistConfig, VoiceBriefingConfig } from '../types';

export const CALENDAR_CATEGORIES = ['general', 'work', 'social', 'fitness', 'family', 'chill'] as const;
const STORAGE_KEY = 'aetherclock_calendar';
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const parseKeywords = (value: string): string[] =>
  [...new Set(value.split(/[,;\n]/).map(word => word.trim()).filter(Boolean))];

const categoryFor = (title: string): string => {
  if (/\b(meeting|call|work|team|office|project|arbeit|projekt|besprechung)\b/i.test(title)) return 'work';
  if (/\b(gym|run|workout|sport|training|fitness|exercise|laufen)\b/i.test(title)) return 'fitness';
  if (/\b(nursery|pickup|family|kid|son|daughter|child|familie|kind|kita)\b/i.test(title)) return 'family';
  if (/\b(sleep|relax|bed|reading|yoga|schlafen|lesen|entspannen)\b/i.test(title)) return 'chill';
  if (/\b(lunch|dinner|coffee|restaurant|essen|treffen|kaffee)\b/i.test(title)) return 'social';
  return 'general';
};

export const parseAgendaToCalendar = (agenda: string): CalendarItem[] => agenda.split('\n')
  .map(line => line.trim()).filter(Boolean).map((line, index) => {
    const active = !line.startsWith('!');
    let text = line.replace(/^!\s*/, '').replace(/^[-*•]\s*/, '');
    const match = text.match(/^(\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\d{4}|\d{1,2}\s*(?:am|pm))(?=\s|$)/i);
    if (!match) throw new Error(`Add a valid time on line ${index + 1}.`);
    let time = '09:00';
    if (match) {
      const token = match[1].replace(/\s/g, '');
      const ampm = token.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i);
      if (ampm) {
        const hour = Number(ampm[1]);
        if (hour < 1 || hour > 12) throw new Error(`Invalid time on line ${index + 1}.`);
        time = `${String(hour % 12 + (ampm[3].toLowerCase() === 'pm' ? 12 : 0)).padStart(2, '0')}:${ampm[2] || '00'}`;
      } else time = token.includes(':') ? token.padStart(5, '0') : `${token.slice(0, 2)}:${token.slice(2)}`;
      if (!TIME.test(time)) throw new Error(`Invalid time on line ${index + 1}.`);
      text = text.slice(match[0].length).trim().replace(/^[-–]\s*/, '');
    }
    const category = text.match(/^\[([a-z]+)\]\s*/i);
    if (category) text = text.slice(category[0].length);
    const [title, keywordText = ''] = text.split(/\s*\|\s*keywords:\s*/i);
    const vibe = category && CALENDAR_CATEGORIES.includes(category[1].toLowerCase() as typeof CALENDAR_CATEGORIES[number])
      ? category[1].toLowerCase() : categoryFor(title);
    return { id: `item-${index}-${time.replace(':', '')}`, time, title: title.trim() || 'Scheduled task',
      vibe, keywords: parseKeywords(keywordText), active };
  });

export const formatCalendarToAgenda = (items: CalendarItem[]): string => items.map(item =>
  `${item.active ? '' : '! '}${item.time} [${item.vibe || 'general'}] ${item.title}${item.keywords?.length ? ` | keywords: ${item.keywords.join(', ')}` : ''}`,
).join('\n');

export const loadCalendar = (): CalendarItem[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CalendarItem => !!item && typeof item === 'object'
      && typeof item.id === 'string' && typeof item.title === 'string'
      && typeof item.time === 'string' && TIME.test(item.time) && typeof item.active === 'boolean')
      .map(item => ({ ...item, keywords: Array.isArray(item.keywords) ? item.keywords.filter((word): word is string => typeof word === 'string') : [] }));
  } catch { return []; }
};

export const saveCalendar = (items: CalendarItem[]): boolean => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; }
  catch { return false; }
};

const CATEGORY_DIRECTION: Record<string, string> = {
  work: 'Support concentration and a clear head; favor low-distraction music unless the keywords request otherwise.',
  fitness: 'Support movement, energy and motivation; favor a steady rhythmic drive.',
  social: 'Support an open, warm and sociable mood.',
  family: 'Support a friendly, positive atmosphere suitable for shared time.',
  chill: 'Support winding down, calm and relaxation.',
  general: 'Infer the useful mood from the task title and keywords.',
};

export const buildMusicContext = (items: CalendarItem[], anchorTime: string, focusId?: string) => {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const anchor = TIME.test(anchorTime) ? minutes(anchorTime) : 0;
  const upcoming = items.filter(item => (item.active || item.id === focusId) && TIME.test(item.time)).map(item => ({
    ...item, minutesUntil: (minutes(item.time) - anchor + 1440) % 1440,
    nextDay: minutes(item.time) < anchor,
  })).sort((a, b) => a.minutesUntil - b.minutesUntil);
  const focus = upcoming.find(item => item.id === focusId) || upcoming[0] || null;
  return { anchorTime, focus, upcoming: upcoming.slice(0, 3), coinciding: focus ? upcoming.filter(item => item.minutesUntil === focus.minutesUntil) : [],
    direction: focus ? CATEGORY_DIRECTION[focus.vibe || 'general'] || CATEGORY_DIRECTION.general : 'No active task is scheduled. Use the preferred genre and time of day.' };
};

export const calendarToAlarms = (
  items: CalendarItem[], genrePreset: MusicGenre, playlistConfig: PlaylistConfig,
  voiceBriefingConfig: VoiceBriefingConfig,
): Alarm[] => items.filter(item => TIME.test(item.time)).map(item => ({
  id: `task:${item.id}`, calendarItemId: item.id, time: item.time, label: item.title,
  isActive: item.active, days: [], genrePreset,
  playlistConfig: { ...playlistConfig }, voiceBriefingConfig: { ...voiceBriefingConfig },
}));

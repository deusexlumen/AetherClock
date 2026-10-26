import React, { useState } from 'react';
import type { CalendarItem } from '../types';
import { CALENDAR_CATEGORIES, formatCalendarToAgenda, parseAgendaToCalendar, parseKeywords } from '../services/calendar';

interface Props { items: CalendarItem[]; onChange(items: CalendarItem[]): void; onPreview(id: string): void; }

export const CalendarPlanner: React.FC<Props> = ({ items, onChange, onPreview }) => {
  const [mode, setMode] = useState<'planner' | 'text'>('planner');
  const [editing, setEditing] = useState<string | null>(null);
  const [time, setTime] = useState('09:00');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [keywords, setKeywords] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const field = 'w-full min-w-0 rounded border border-white/20 bg-neutral-900 px-3 py-2 text-sm text-gray-200';
  const reset = () => { setEditing(null); setTitle(''); setKeywords(''); setError(''); };
  const publish = (next: CalendarItem[]) => onChange([...next].sort((a, b) => a.time.localeCompare(b.time)));

  return <section id="planner-section" aria-label="Daily task planner" className="rounded border border-white/10 bg-neutral-900/60 p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-bold text-radio-lit">Your day sets the soundtrack</h2>
      <div className="flex gap-3 text-xs">
        <button type="button" aria-pressed={mode === 'planner'} className="underline py-2" onClick={() => setMode('planner')}>Task planner</button>
        <button type="button" aria-pressed={mode === 'text'} className="underline py-2" onClick={() => { setDraft(formatCalendarToAgenda(items)); setMode('text'); setError(''); }}>Text list</button>
      </div>
    </div>
    <p className="text-xs text-gray-400">Every active task is a daily music alarm at its scheduled time. Its category and keywords guide the track selection. Keep the app open for music playback.</p>
    {mode === 'planner' ? <>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {!items.length && <p className="text-sm text-gray-400 py-3">Start with your next task — for example a meeting, a workout or time to unwind.</p>}
        {items.map(item => <article key={item.id} className={`rounded border border-white/10 p-3 ${item.active ? '' : 'opacity-60'}`}>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-2 min-w-0 flex-1 text-sm">
              <input type="checkbox" aria-label={`Arm task ${item.title}`} checked={item.active} onChange={event => publish(items.map(other => other.id === item.id ? { ...other, active: event.target.checked } : other))} />
              <span className="text-radio-lit font-mono">{item.time}</span>
              <span className="break-words min-w-0">{item.title}</span>
            </label>
            <span className="text-xs text-gray-400">{item.vibe || 'general'} · {item.active ? 'Alarm on' : 'Alarm off'}</span>
          </div>
          {!!item.keywords?.length && <p className="mt-2 text-xs text-amber-200 break-words">{item.keywords.join(' · ')}</p>}
          <div className="flex gap-4 mt-2 text-xs">
            <button type="button" className="underline py-1 text-radio-lit" aria-label={`Test music for ${item.title}`} onClick={() => onPreview(item.id)}>Test music</button>
            <button type="button" className="underline py-1" aria-label={`Edit task ${item.title}`} onClick={() => {
              setEditing(item.id); setTime(item.time); setTitle(item.title); setCategory(item.vibe || 'general'); setKeywords(item.keywords?.join(', ') || ''); setError('');
            }}>Edit</button>
            <button type="button" className="underline py-1 text-red-300" aria-label={`Delete task ${item.title}`} onClick={() => { publish(items.filter(other => other.id !== item.id)); if (editing === item.id) reset(); }}>Delete</button>
          </div>
        </article>)}
      </div>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-white/10 pt-3" onSubmit={event => {
        event.preventDefault();
        if (!title.trim()) { setError('Enter a task title.'); return; }
        const old = items.find(item => item.id === editing);
        const item: CalendarItem = { id: editing || crypto.randomUUID(), time, title: title.trim(), vibe: category,
          keywords: parseKeywords(keywords), active: old?.active ?? true };
        publish(editing ? items.map(other => other.id === editing ? item : other) : [...items, item]); reset();
      }}>
        <label className="text-xs text-gray-300">Time<input type="time" required aria-label="Task time" value={time} onChange={event => setTime(event.target.value)} className={field} /></label>
        <label className="text-xs text-gray-300">Category<select aria-label="Task category" value={category} onChange={event => setCategory(event.target.value)} className={field}>{CALENDAR_CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-xs text-gray-300 sm:col-span-2">Task<input required maxLength={200} aria-label="Task title" placeholder="Presentation to the team" value={title} onChange={event => setTitle(event.target.value)} className={field} /></label>
        <label className="text-xs text-gray-300 sm:col-span-2">Keywords / mood<textarea aria-label="Task keywords" maxLength={1000} placeholder="confident, focused, no vocals" value={keywords} onChange={event => setKeywords(event.target.value)} className={field} rows={2} /><span className="text-gray-400">Separate keywords with commas or new lines. Your own words are welcome.</span></label>
        <div className="sm:col-span-2 flex gap-4 items-center">
          <button type="submit" className="rounded border border-radio-lit px-4 py-2 text-radio-lit">{editing ? 'Save task' : 'Add task'}</button>
          {editing && <button type="button" className="underline text-sm" onClick={reset}>Cancel edit</button>}
        </div>
      </form>
    </> : <form className="space-y-2" onSubmit={event => {
      event.preventDefault();
      try {
        const used = new Set<string>();
        const next = parseAgendaToCalendar(draft).map(item => {
          const previous = items.find(old => old.time === item.time && old.title === item.title && !used.has(old.id));
          if (previous) used.add(previous.id);
          return { ...item, id: previous?.id || crypto.randomUUID() };
        });
        publish(next); setDraft(formatCalendarToAgenda(next)); setError('');
      }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to read task list.'); }
    }}>
      <p className="text-xs text-gray-400">Example: 09:00 [work] Presentation | keywords: confident, no vocals<br />Prefix a line with ! to exclude it from music selection. Times repeat as a daily plan.</p>
      <textarea aria-label="Task text list" value={draft} onChange={event => setDraft(event.target.value)} rows={8} className={`${field} font-mono`} />
      <button type="submit" className="rounded border border-radio-lit px-4 py-2 text-radio-lit">Apply task list</button>
    </form>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </section>;
};

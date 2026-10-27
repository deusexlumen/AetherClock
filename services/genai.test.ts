import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./aiTransport', () => ({ generateAI: (_kind: string, request: unknown) => mocks.request(request) }));
import { buildMusicPrompt, generateMusicalPrompt } from './genai';

const tasks = [{ id: 'meeting', time: '09:00', title: 'Presentation', active: true, vibe: 'work', keywords: ['confident', 'no vocals'] },
  { id: 'disabled', time: '08:00', title: 'Hidden task', active: false, vibe: 'fitness', keywords: ['not included'] }];
const song = { title: 'Example', artist: 'Example Artist', youtubeVideoId: 'K4DyBUG242c', whyExplanation: 'Focused instrumental music for the presentation.' };
beforeEach(() => { mocks.request.mockReset(); });

describe('task-based AI curation', () => {
  it('transmits actual task categories and keywords, with task context first', async () => {
    mocks.request.mockResolvedValue({ text: JSON.stringify({ searchedSong: song }) });
    await generateMusicalPrompt(null, null, tasks, new Date(), '09:00', 'auto', undefined, undefined, 'meeting');
    const prompt = mocks.request.mock.calls[0][0].contents.parts[0].text;
    expect(prompt).toContain('PRIMARY selection criteria');
    expect(prompt).toContain('"vibe": "work"');
    expect(prompt).toContain('"no vocals"');
    expect(prompt).toContain('Presentation');
    expect(prompt).not.toContain('Hidden task');
  });
  it('preserves keywords in their original language', () => {
    const prompt = buildMusicPrompt([{ ...tasks[0], keywords: ['ruhig', 'ohne Gesang'] }], '09:00', 'jazz', null, null);
    expect(prompt).toContain('ohne Gesang');
    expect(prompt).toContain('"preferredGenre": "jazz"');
  });
  it('does not pretend a generic preset was selected for the task when server AI is unavailable', async () => {
    mocks.request.mockRejectedValue(new Error('Unavailable'));
    const result = await generateMusicalPrompt(null, null, tasks, new Date(), '09:00', 'auto');
    expect(result.notice).toContain('not selected for your task keywords');
    expect(mocks.request).toHaveBeenCalled();
  });
  it('does not fabricate song metadata from malformed AI output', async () => {
    mocks.request.mockResolvedValue({ text: 'not valid JSON' });
    const result = await generateMusicalPrompt(null, null, tasks, new Date(), '09:00', 'auto');
    expect(result.searchedSong.foundTheme).toBe('Preset fallback');
  });
});

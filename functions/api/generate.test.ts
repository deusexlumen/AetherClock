import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), keys: [] as string[] }));
vi.mock('@google/genai', () => ({ Modality: { AUDIO: 'AUDIO' }, GoogleGenAI: class {
  constructor(options: { apiKey: string }) { mocks.keys.push(options.apiKey); }
  models = { generateContent: mocks.generate };
} }));
import { onRequestPost, reserveBudget, verifyYouTubeSelection } from './generate';

function dbMock(allowed = true) {
  return { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn().mockResolvedValue({}) })) })),
    batch: vi.fn().mockResolvedValue(Array.from({ length: 3 }, () => ({ results: allowed ? [{ requests: 1 }] : [] }))) };
}
const body = () => ({ kind: 'music', apiKeys: '', request: { model: 'gemini-3.8-flash', contents: { parts: [{ text: 'Find focus music.' }] } } });
const call = (value: unknown, db = dbMock(), origin = 'https://aetherclock.pages.dev') => onRequestPost({
  request: new Request('https://aetherclock.pages.dev/api/generate', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(value) }),
  env: { GEMINI_API_KEY: 'server-primary', GEMINI_API_KEYS: 'server-extra server-primary', ALARM_DB: db }, waitUntil: vi.fn(),
} as any);
beforeEach(() => { mocks.generate.mockReset().mockResolvedValue({ text: '{"ok":true}' }); mocks.keys.length = 0; });
afterEach(() => vi.unstubAllGlobals());

describe('server AI transport', () => {
  it('routes 3.8 voice requests through REST while preserving the browser audio contract', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: 'UklGRg==', mime_type: 'audio/wav' }] }] })));
    vi.stubGlobal('fetch', fetch);
    const response = await call({ kind: 'voice', apiKeys: '', delivery: { style: 'radio', pace: 80, expression: 90 }, request: {
      model: 'gemini-3.8-flash-tts', contents: { parts: [{ text: 'Good morning.' }] },
      config: { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Sulafat' } } } },
    } });
    expect(response.status).toBe(200);
    expect((await response.json() as any).candidates[0].content.parts[0].inlineData).toEqual({ data: 'UklGRg==', mimeType: 'audio/wav' });
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent.generation_config.speech_config).toEqual([{ voice: 'Sulafat' }]);
    expect(sent.input[0].content[0].text).toBe('Good morning.');
    expect(sent.input[0].content[0].annotations[0].style).toContain('radio presenter');
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('uses server env keys without requiring a personal key or returning credentials', async () => {
    const result = await call(body());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ text: '{"ok":true}' });
    expect(['server-primary', 'server-extra']).toContain(mocks.keys[0]);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects cross-origin requests before using the pool', async () => {
    expect((await call(body(), dbMock(), 'https://evil.example')).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each([null, [], { kind: 'music' }, { ...body(), request: { model: 'expensive-custom-model' } }])('rejects invalid payloads: %j', async value => {
    expect((await call(value)).status).toBeGreaterThanOrEqual(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('rejects oversized bodies even without a content-length', async () => {
    const value = body(); value.request.contents.parts[0].text = 'x'.repeat(25_000);
    expect((await call(value)).status).toBe(413);
  });
  it('fails closed when the global budget is exhausted', async () => {
    expect((await call(body(), dbMock(false))).status).toBe(429);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('never returns raw provider errors', async () => {
    mocks.generate.mockRejectedValue(new Error('sensitive provider error'));
    const response = await call(body());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('sensitive');
  });
  it('requires all budget reservations to succeed', async () => {
    const db = dbMock(); db.batch.mockResolvedValue([{ results: [{}] }, { results: [] }, { results: [{}] }]);
    expect(await reserveBudget(db as any, '127.0.0.1')).toBe(false);
  });
  it('accepts a real video whose title matches, without claiming autoplay is verified', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"title":"Artist - Experience (Official Video)"}')));
    const text = JSON.stringify({ searchedSong: { title: 'Experience', youtubeVideoId: 'K4DyBUG242c' } });
    expect(JSON.parse(await verifyYouTubeSelection(text)).searchedSong.title).toBe('Experience');
  });
  it('rejects a hallucinated video or a mismatched recording', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"title":"Never Gonna Give You Up"}')));
    await expect(verifyYouTubeSelection(JSON.stringify({ searchedSong: { title: 'Experience', youtubeVideoId: 'dQw4w9WgXcQ' } }))).rejects.toThrow('does not match');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(verifyYouTubeSelection('{"youtubeVideoId":"K4DyBUG242c"}')).rejects.toThrow('Video unavailable');
  });
  it('retries one truncated structured response with a larger budget', async () => {
    mocks.generate.mockResolvedValueOnce({ candidates: [{ finishReason: 'MAX_TOKENS' }] }).mockResolvedValueOnce({ text: '{"ok":true}' });
    expect((await call(body())).status).toBe(200);
    expect(mocks.generate.mock.calls[0][0].config.maxOutputTokens).toBe(4096);
    expect(mocks.generate.mock.calls[1][0].config.maxOutputTokens).toBe(8192);
  });
  it('uses ordinary AI plus YouTube verification when the search quota is exhausted', async () => {
    const selected = JSON.stringify({ searchedSong: { title: 'Experience', youtubeVideoId: 'K4DyBUG242c' } });
    mocks.generate.mockImplementation(params => params.config.tools
      ? Promise.reject({ status: 429 }) : Promise.resolve({ text: selected }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"title":"Ludovico Einaudi - Experience"}')));
    const response = await call(body());
    expect(response.status).toBe(200);
    const data = await response.json() as { text: string; notice: string };
    expect(data.notice).toContain('Google Search was unavailable');
    expect(JSON.parse(data.text).searchedSong.title).toBe('Experience');
    expect(mocks.generate.mock.calls.at(-1)![0].config.tools).toBeUndefined();
  });
  it('corrects one mismatched suggestion using the checked catalog', async () => {
    let ordinaryCalls = 0;
    mocks.generate.mockImplementation(params => {
      if (params.config.tools) return Promise.reject({ status: 429 });
      ordinaryCalls++;
      return Promise.resolve({ text: JSON.stringify({ searchedSong: ordinaryCalls === 1
        ? { title: 'Experience', youtubeVideoId: 'dQw4w9WgXcQ' }
        : { title: 'River Flows in You', youtubeVideoId: '7maJOI3QMu0' } }) });
    });
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify({
      title: url.includes('dQw4w9WgXcQ') ? 'Never Gonna Give You Up' : 'Yiruma - River Flows in You',
    })))));
    const response = await call(body());
    expect(response.status).toBe(200);
    expect(ordinaryCalls).toBe(2);
    expect(mocks.generate.mock.calls.at(-1)![0].contents.at(-1).parts[0].text).toContain('ONLY from this catalog');
  });
});

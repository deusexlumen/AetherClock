import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), keys: [] as string[] }));
vi.mock('@google/genai', () => ({ Modality: { AUDIO: 'AUDIO' }, GoogleGenAI: class {
  constructor(options: { apiKey: string }) { mocks.keys.push(options.apiKey); }
  models = { generateContent: mocks.generate };
} }));
import { onRequestPost, reserveBudget } from './generate';

function dbMock(allowed = true) {
  return { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn().mockResolvedValue({}) })) })),
    batch: vi.fn().mockResolvedValue(Array.from({ length: 3 }, () => ({ results: allowed ? [{ requests: 1 }] : [] }))) };
}
const body = () => ({ kind: 'music', apiKeys: '', request: { model: 'gemini-3.5-flash', contents: { parts: [{ text: 'Find focus music.' }] } } });
const call = (value: unknown, db = dbMock(), origin = 'https://aetherclock.pages.dev') => onRequestPost({
  request: new Request('https://aetherclock.pages.dev/api/generate', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(value) }),
  env: { GEMINI_API_KEY: 'server-primary', GEMINI_API_KEYS: 'server-extra server-primary', ALARM_DB: db }, waitUntil: vi.fn(),
} as any);
beforeEach(() => { mocks.generate.mockReset().mockResolvedValue({ text: '{"ok":true}' }); mocks.keys.length = 0; });

describe('server AI transport', () => {
  it('uses server env keys without requiring a personal key or returning credentials', async () => {
    const result = await call(body());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ text: '{"ok":true}' });
    expect(mocks.keys[0]).toBe('server-primary');
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
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ key: vi.fn((): string | null => null) }));
vi.mock('./apiKey', () => ({ getApiKey: mocks.key }));
import { generateAI } from './aiTransport';

beforeEach(() => { mocks.key.mockReturnValue(null); });
afterEach(() => vi.unstubAllGlobals());
describe('same-origin AI requests', () => {
  it('upgrades saved 3.1 voice preferences to 3.8', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetch);
    await generateAI('voice', { model: 'gemini-3.1-flash-tts-preview', contents: { parts: [{ text: 'Morning' }] } });
    expect(JSON.parse(fetch.mock.calls[0][1].body).request.model).toBe('gemini-3.8-flash-tts');
  });
  it('uses the server with no personal key', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"text":"result"}'));
    vi.stubGlobal('fetch', fetch);
    expect(await generateAI('music', { model: 'gemini-3.5-flash', contents: { parts: [{ text: 'Music' }] } })).toEqual({ text: 'result' });
    expect(fetch.mock.calls[0][0]).toBe('/api/generate');
    expect(JSON.parse(fetch.mock.calls[0][1].body).apiKeys).toBe('');
  });
  it('joins optional personal keys and normalizes saved legacy TTS models', async () => {
    mocks.key.mockReturnValue('personal-a,personal-b');
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetch);
    await generateAI('voice', { model: 'gemini-2.5-flash-tts', contents: { parts: [{ text: 'Morning' }] } });
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent.apiKeys).toBe('personal-a,personal-b');
    expect(sent.request.model).toBe('gemini-2.5-flash-preview-tts');
  });
  it('does not expose server error bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private detail', { status: 503 })));
    await expect(generateAI('music', { model: 'x', contents: '' })).rejects.toThrow('AI request unavailable (503)');
  });
});

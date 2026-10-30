import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './voices';
afterEach(() => vi.unstubAllGlobals());
const call = (env = {}, origin?: string) => onRequestGet({ request: new Request('https://aetherclock.pages.dev/api/voices', { headers: origin ? { Origin: origin } : {} }), env } as any);
describe('public prebuilt voice catalog', () => {
  it('rejects foreign origins', async () => { expect((await call({}, 'https://other.example')).status).toBe(403); });
  it('provides studio voices without credentials', async () => {
    const response = await call();
    const result = await response.json() as any;
    expect(result.voices).toHaveLength(30); expect(result.extended).toBe(false);
  });
  it('loads additional prebuilt IDs without returning custom voices or provider credentials', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ voices: [
      { id: 'voice_arlo', display_name: 'Arlo', description: 'Confident and clear', type: 'prebuilt' },
      { id: 'voice_private', display_name: 'Private persona', type: 'prompted' },
    ] })));
    vi.stubGlobal('fetch', fetch);
    const db = { prepare: vi.fn(() => ({ bind: vi.fn() })), batch: vi.fn().mockResolvedValue([{ results: [{}] }, { results: [{}] }, { results: [{}] }]) };
    const response = await call({ GEMINI_API_KEY: 'secret-test-key', ALARM_DB: db });
    const text = await response.text(); const result = JSON.parse(text);
    expect(result.voices).toHaveLength(31);
    expect(result.voices.some((voice: any) => voice.id === 'voice_arlo')).toBe(true);
    expect(text).not.toContain('Private persona'); expect(text).not.toContain('secret-test-key');
    expect(fetch.mock.calls[0][0].searchParams.get('type')).toBe('prebuilt');
  });
});

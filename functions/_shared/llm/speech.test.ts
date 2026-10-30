import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateSpeech } from './speech';
import { classifyError } from './errors';

afterEach(() => vi.unstubAllGlobals());

describe('Gemini 3.8 speech migration', () => {
  it('sends a verbatim transcript with metadata and preserves complete WAV bytes', async () => {
    const wav = btoa('RIFFcomplete WAV');
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ steps: [
      { type: 'user_input', content: [{ type: 'audio', data: 'ignore' }] },
      { type: 'model_output', content: [{ type: 'audio', data: wav, mime_type: 'audio/wav' }] },
    ] })));
    vi.stubGlobal('fetch', fetch);
    const result = await generateSpeech('gemini-3.8-flash-tts', 'test-key', 'Good morning.', 'Fenrir', 1000);
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request.input[0].content[0]).toEqual({ type: 'text', text: 'Good morning.', annotations: [{ type: 'speech_metadata', style: '' }] });
    expect(request.response_format).toEqual({ type: 'audio', mime_type: 'audio/wav' });
    expect(request.generation_config.speech_config).toEqual([{ voice: 'Fenrir' }]);
    expect(result.candidates?.[0].content?.parts?.[0].inlineData).toEqual({ data: wav, mimeType: 'audio/wav' });
  });
  it('preserves daily quota status for key/model failover without leaking provider details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private-key quota per day' } }), { status: 429 })));
    try { await generateSpeech('gemini-3.8-flash-tts', 'test-key', 'Hi', 'Kore', 1000); throw new Error('Expected failure'); }
    catch (error) {
      expect(classifyError(error)).toEqual({ class: 'quota', quota: 'rpd' });
      expect(String(error)).not.toContain('private-key');
    }
  });
  it('rejects missing audio instead of reporting successful speech', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"steps":[]}')));
    await expect(generateSpeech('gemini-3.8-flash-tts', 'test-key', 'Hi', 'Kore', 1000)).rejects.toThrow('no WAV');
  });
});

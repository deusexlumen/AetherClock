import type { GenerateContentResponse } from '@google/genai';

/** Use REST for the 3.8 schema, independently of the legacy text SDK. */
export async function generateSpeech(model: string, apiKey: string, text: string, voice: string, timeout: number): Promise<GenerateContentResponse> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(timeout),
    body: JSON.stringify({
      model,
      input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: '' }] }] }],
      response_format: { type: 'audio', mime_type: 'audio/wav' },
      generation_config: { speech_config: [{ voice }] },
    }),
  });
  if (!response.ok) {
    // Preserve quota classification without exposing provider messages or keys.
    const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const daily = /per[-_ ]?day|daily/i.test(detail?.error?.message || '');
    throw Object.assign(new Error(daily ? 'Speech daily quota unavailable' : 'Speech generation unavailable'), { status: response.status });
  }
  const result = await response.json() as { steps?: { type?: string; content?: { type?: string; data?: string; mime_type?: string }[] }[] };
  const audio = result.steps?.filter(step => step.type === 'model_output')
    .flatMap(step => step.content || []).filter(part => part.type === 'audio').at(-1);
  if (!audio?.data || (audio.mime_type && audio.mime_type !== 'audio/wav')) throw new Error('Speech returned no WAV audio');
  // Keep the existing browser transport; WAV passes through without a new header.
  return { candidates: [{ content: { role: 'model', parts: [{ inlineData: { data: audio.data, mimeType: 'audio/wav' } }] } }] } as GenerateContentResponse;
}

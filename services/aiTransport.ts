import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { getApiKey } from './apiKey';
import { normalizeAIModel } from './aiModels';
import type { VoiceDelivery } from './voiceOptions';

/** Personal keys join the server pool for this request only. Never fetch env keys. */
export async function generateAI(kind: 'music' | 'voice', request: GenerateContentParameters, delivery?: VoiceDelivery): Promise<GenerateContentResponse & { notice?: string }> {
  const response = await fetch('/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, request: { ...request, model: normalizeAIModel(request.model) }, ...(kind === 'voice' ? { delivery } : {}), apiKeys: getApiKey() || '' }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`AI request unavailable (${response.status})`);
  return await response.json() as GenerateContentResponse;
}

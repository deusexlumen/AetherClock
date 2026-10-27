import { GoogleGenAI, Modality } from '@google/genai';
import type { PagesFunction } from '@cloudflare/workers-types';
import { createKeyPoolRouter, resolveApiKeys } from '../_shared/llm/router';
import { jsonResponse, errorResponse } from '../_shared/cors';
import { TEXT_MODELS, VOICE_MODELS } from '../../services/aiModels';

interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_API_KEYS?: string;
  ALARM_DB: D1Database;
}

const router = createKeyPoolRouter();

/** Atomic shared budgets: limits cannot be bypassed by concurrent isolates. */
export async function reserveBudget(db: D1Database, ip: string, now = Date.now()): Promise<boolean> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const identity = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  const minute = Math.floor(now / 60_000), day = Math.floor(now / 86_400_000);
  const buckets = [
    { key: `all:m:${minute}`, max: 20, expires: (minute + 1) * 60_000 },
    { key: `all:d:${day}`, max: 200, expires: (day + 1) * 86_400_000 },
    { key: `${identity}:d:${day}`, max: 60, expires: (day + 1) * 86_400_000 },
  ];
  const results = await db.batch(buckets.map(b => db.prepare(
    'INSERT INTO ai_request_budgets (bucket, requests, expires_at) VALUES (?, 1, ?) '
    + 'ON CONFLICT(bucket) DO UPDATE SET requests = requests + 1 WHERE requests < ? RETURNING requests',
  ).bind(b.key, b.expires, b.max)));
  return results.every(result => result.results.length === 1);
}

export const onRequestPost: PagesFunction<Env> = async context => {
  const { request, env } = context;
  // CORS alone is not authentication, but browser cross-origin calls are rejected.
  if (request.headers.get('Origin') !== new URL(request.url).origin) return errorResponse('Origin rejected', request, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return errorResponse('Expected JSON', request, 415);
  let body: any;
  try {
    // Stream with a hard bound, including chunked bodies without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return errorResponse('Expected body', request);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 24_000) { await reader.cancel(); return errorResponse('Request too large', request, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return errorResponse('Invalid JSON', request); }
  if (!body || !['music', 'voice'].includes(body.kind) || !body.request
    || typeof body.apiKeys !== 'string' || body.apiKeys.length > 4000) return errorResponse('Invalid AI request', request);
  const incoming = body.request;
  const models = body.kind === 'voice' ? VOICE_MODELS : TEXT_MODELS;
  if (typeof incoming.model !== 'string' || !models.includes(incoming.model)) return errorResponse('Unsupported model', request, 422);
  // Only text input, no client-chosen tools, URLs, files, token caps or endpoints.
  const contents = incoming.contents;
  const items = Array.isArray(contents) ? contents : [contents];
  if (!items.length || items.length > 3 || !items.every(item => item && Array.isArray(item.parts)
    && item.parts.length > 0 && item.parts.length <= 3
    && item.parts.every((part: any) => typeof part.text === 'string' && part.text.length <= 16_000))) {
    return errorResponse('Expected bounded text input', request, 422);
  }
  const textLength = items.reduce((total, item) => total + item.parts.reduce((sum: number, part: { text: string }) => sum + part.text.length, 0), 0);
  if (textLength > (body.kind === 'voice' ? 2000 : 16_000)) return errorResponse('Text too long', request, 422);
  const system = incoming.config?.systemInstruction;
  if (system !== undefined && (typeof system !== 'string' || system.length > 4000)) return errorResponse('Invalid instruction', request, 422);
  const keys = resolveApiKeys(body.apiKeys, env.GEMINI_API_KEY, env.GEMINI_API_KEYS);
  if (!keys.length) return errorResponse('AI is not configured', request, 503);
  try {
    if (!await reserveBudget(env.ALARM_DB, request.headers.get('CF-Connecting-IP') || 'unknown')) return errorResponse('AI request limit reached', request, 429);
    context.waitUntil(env.ALARM_DB.prepare('DELETE FROM ai_request_budgets WHERE expires_at < ?').bind(Date.now()).run());
    const deadline = Date.now() + 40_000;
    const chain = [incoming.model, ...models.filter(m => m !== incoming.model)];
    const response = await router.call(chain, keys, async (model, apiKey) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('AI deadline exceeded');
      const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: Math.min(12_000, remaining) } });
      const voiceName = incoming.config?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName;
      const config = body.kind === 'voice' ? {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ['Fenrir', 'Kore', 'Leda'].includes(voiceName) ? voiceName : 'Kore' } } },
      } : { systemInstruction: system, responseMimeType: 'application/json', tools: [{ googleSearch: {} }], maxOutputTokens: 4096 };
      const params = { model, contents: items.map(item => ({ parts: item.parts.map((part: any) => ({ text: part.text })) })), config };
      let result = await ai.models.generateContent(params);
      if (body.kind === 'music' && result.candidates?.[0]?.finishReason === 'MAX_TOKENS' && Date.now() < deadline) {
        // Exactly one retry for a truncated structured answer, as in the blueprint.
        result = await ai.models.generateContent({ ...params, config: { ...config, maxOutputTokens: 8192,
          httpOptions: { timeout: Math.min(12_000, deadline - Date.now()) } } });
      }
      if (result.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new Error('AI response truncated');
      return result;
    });
    // SDK .text is a prototype getter; include it explicitly for JSON transport.
    const result = body.kind === 'voice' ? { candidates: response.candidates } : { text: response.text };
    const output = jsonResponse(result, request);
    output.headers.set('Cache-Control', 'no-store');
    return output;
  } catch {
    return errorResponse('AI temporarily unavailable', request, 503);
  }
};

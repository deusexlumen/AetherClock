import type { PagesFunction } from '@cloudflare/workers-types';
import { jsonResponse, errorResponse } from '../_shared/cors';
import { resolveApiKeys } from '../_shared/llm/router';
import { reserveBudget } from './generate';
import { BUILTIN_VOICES, isVoiceId, type VoiceOption } from '../../services/voiceOptions';

interface Env { GEMINI_API_KEY?: string; GEMINI_API_KEYS?: string; ALARM_DB: D1Database; }
let cached: { until: number; language: string; voices: VoiceOption[] } | undefined;
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (request.headers.get('Origin') && request.headers.get('Origin') !== new URL(request.url).origin) return errorResponse('Origin rejected', request, 403);
  const language = new URL(request.url).searchParams.get('language') === 'en-US' ? 'en-US' : 'de-DE';
  const reply = (voices: VoiceOption[], extended: boolean) => {
    const response = jsonResponse({ voices, extended }, request);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  if (cached && cached.until > Date.now() && cached.language === language) return reply(cached.voices, true);
  const keys = resolveApiKeys(env.GEMINI_API_KEY, env.GEMINI_API_KEYS);
  if (!keys.length) return reply(BUILTIN_VOICES, false);
  try {
    if (!await reserveBudget(env.ALARM_DB, request.headers.get('CF-Connecting-IP') || 'unknown')) return reply(BUILTIN_VOICES, false);
    const voices = new Map(BUILTIN_VOICES.map(voice => [voice.id, voice]));
    let pageToken = '';
    for (let page = 0; page < 3; page++) {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/voices');
      url.searchParams.set('type', 'prebuilt'); url.searchParams.set('page_size', '1000');
      url.searchParams.set('language_code', language);
      if (pageToken) url.searchParams.set('page_token', pageToken);
      const response = await fetch(url, { headers: { 'x-goog-api-key': keys[0] }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) return reply(BUILTIN_VOICES, false);
      const result = await response.json() as { voices?: { id?: string; display_name?: string; description?: string; type?: string; language_code?: string; accent?: string }[]; next_page_token?: string };
      for (const voice of result.voices || []) {
        if (!isVoiceId(voice.id) || (voice.type && voice.type !== 'prebuilt')) continue;
        // Enforce language locally too, even if the provider ignores its filter.
        if (!(voice.language_code || voice.id).toLowerCase().startsWith(language.slice(0, 2) + '-')) continue;
        voices.set(voice.id, { id: voice.id, name: (voice.display_name || voice.id).slice(0, 100), description: language === 'de-DE' ? 'Deutsch' : 'English' });
      }
      pageToken = result.next_page_token || '';
      if (!pageToken) break;
    }
    cached = { until: Date.now() + 3600_000, language, voices: [...voices.values()] };
    return reply(cached.voices, true);
  } catch { return reply(BUILTIN_VOICES, false); }
};

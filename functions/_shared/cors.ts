import type { Request as CfRequest, Response as CfResponse } from '@cloudflare/workers-types';

const ALLOWED_ORIGINS = ['https://aetherclock.pages.dev', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:8788'];

const isAllowedOrigin = (origin: string): boolean => {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return url.origin === origin && url.protocol === 'https:' && url.hostname.endsWith('.aetherclock.pages.dev');
  } catch {
    return false;
  }
};

export const corsHeaders = (request: CfRequest): Record<string, string> => {
  const origin = request.headers.get('Origin') || '';
  return {
    ...(isAllowedOrigin(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
};

export const jsonResponse = (data: unknown, _request: CfRequest, status = 200): CfResponse =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as CfResponse;

export const errorResponse = (message: string, request: CfRequest, status = 400): CfResponse =>
  jsonResponse({ ok: false, error: message }, request, status);

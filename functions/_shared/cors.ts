import type { Request as CfRequest, Response as CfResponse } from '@cloudflare/workers-types';

const ALLOWED_ORIGINS = ['https://aetherclock.pages.dev', 'http://localhost:5173', 'http://localhost:8788'];

export const corsHeaders = (request: CfRequest): Record<string, string> => {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
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

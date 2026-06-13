import type { PagesFunction, Response as CfResponse } from '@cloudflare/workers-types';
import { corsHeaders } from './_shared/cors';

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(context.request) }) as unknown as CfResponse;
  }
  const response = await context.next();
  const headers = corsHeaders(context.request);
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
};

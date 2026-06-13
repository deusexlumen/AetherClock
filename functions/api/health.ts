import type { PagesFunction } from '@cloudflare/workers-types';
import { jsonResponse } from '../_shared/cors';

export const onRequestGet: PagesFunction = async (context) => {
  return jsonResponse({ ok: true }, context.request);
};

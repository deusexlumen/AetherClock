import type { PagesFunction } from '@cloudflare/workers-types';
import { jsonResponse } from '../_shared/cors';

interface Env {
  VAPID_PUBLIC_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return jsonResponse({ publicKey: context.env.VAPID_PUBLIC_KEY }, context.request);
};

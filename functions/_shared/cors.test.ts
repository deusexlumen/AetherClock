import { describe, expect, it } from 'vitest';
import { corsHeaders } from './cors';
import type { Request as CfRequest } from '@cloudflare/workers-types';

const headersFor = (origin: string) => corsHeaders(new Request('https://aetherclock.pages.dev/api/health', {
  headers: { Origin: origin },
}) as unknown as CfRequest);

describe('CORS', () => {
  it('allows the production site and HTTPS Pages previews', () => {
    expect(headersFor('https://aetherclock.pages.dev')['Access-Control-Allow-Origin']).toBe('https://aetherclock.pages.dev');
    expect(headersFor('https://abc.aetherclock.pages.dev')['Access-Control-Allow-Origin']).toBe('https://abc.aetherclock.pages.dev');
  });

  it('does not grant access to arbitrary or spoofed origins', () => {
    for (const origin of ['https://evil.example', 'http://abc.aetherclock.pages.dev', 'https://aetherclock.pages.dev.evil.example']) {
      expect(headersFor(origin)['Access-Control-Allow-Origin']).toBeUndefined();
    }
  });
});

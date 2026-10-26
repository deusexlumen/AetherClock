import { describe, expect, it } from 'vitest';
import { onRequestPost as alarms } from './alarms';
import { onRequestPost as subscribe } from './subscribe';
import { onRequestPost as resubscribe } from './resubscribe';
import { onRequestPost as unsubscribe } from './unsubscribe';

describe('push API request validation', () => {
  for (const [name, handler] of Object.entries({ alarms, subscribe, resubscribe, unsubscribe })) {
    it(`${name} rejects JSON null and arrays before accessing device data`, async () => {
      for (const body of ['null', '[]']) {
        const response = await handler({ request: new Request('https://example.com/api', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        }) } as never);
        expect(response.status).toBe(400);
      }
    });
  }
});

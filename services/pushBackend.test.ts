import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchVapidPublicKey, syncDevice, syncAlarms, unsubscribeDevice } from './pushBackend';
import { createAlarm } from './alarm';

describe('pushBackend', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetches VAPID public key', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ publicKey: 'BGxK...' }),
    });
    const key = await fetchVapidPublicKey();
    expect(key).toBe('BGxK...');
    expect(fetch).toHaveBeenCalledWith('/api/vapid-public-key');
  });

  it('throws when VAPID response is not ok', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchVapidPublicKey()).rejects.toThrow('Failed to fetch VAPID public key');
  });

  it('throws when VAPID publicKey is missing', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    await expect(fetchVapidPublicKey()).rejects.toThrow('Invalid VAPID response');
  });

  it('syncs device with server alarm subset', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const alarm = createAlarm({ id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] });
    await syncDevice('dev-1', [alarm], null);

    const call = (fetch as any).mock.calls[0];
    expect(call[0]).toBe('/api/subscribe');
    const body = JSON.parse(call[1].body);
    expect(body.deviceId).toBe('dev-1');
    expect(body.alarms[0]).toEqual({ id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] });
    expect(body.subscription).toBeNull();
    expect(typeof body.timezone).toBe('string');
  });

  it('syncs alarms', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const alarm = createAlarm({ id: 'a2', time: '08:00', label: 'Work', isActive: true, days: ['tue', 'thu'] });
    await syncAlarms('dev-1', [alarm]);

    const call = (fetch as any).mock.calls[0];
    expect(call[0]).toBe('/api/alarms');
    const body = JSON.parse(call[1].body);
    expect(body.deviceId).toBe('dev-1');
    expect(body.alarms[0]).toEqual({ id: 'a2', time: '08:00', label: 'Work', isActive: true, days: ['tue', 'thu'] });
    expect(typeof body.timezone).toBe('string');
  });

  it('throws when syncAlarms response is not ok', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });
    const alarm = createAlarm();
    await expect(syncAlarms('dev-1', [alarm])).rejects.toThrow('Failed to sync alarms');
  });

  it('unsubscribes device', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    await unsubscribeDevice('dev-1');

    const call = (fetch as any).mock.calls[0];
    expect(call[0]).toBe('/api/unsubscribe');
    const body = JSON.parse(call[1].body);
    expect(body.deviceId).toBe('dev-1');
  });

  it('throws when unsubscribeDevice response is not ok', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(unsubscribeDevice('dev-1')).rejects.toThrow('Failed to unsubscribe device');
  });
});

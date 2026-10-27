import { describe, it, expect, vi } from 'vitest';
import { createKeyPoolRouter, resolveApiKeys } from './router';

describe('blueprint key pool', () => {
  it('parses and deduplicates personal and env keys in order', () => {
    expect(resolveApiKeys('a,b a', 'b; c\nd', undefined)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('tries every key for one model before moving to the next', async () => {
    const exec = vi.fn().mockRejectedValueOnce({ status: 429 }).mockRejectedValueOnce({ status: 429 }).mockResolvedValue('ok');
    expect(await createKeyPoolRouter().call(['primary', 'fallback'], ['a', 'b'], exec)).toBe('ok');
    expect(exec.mock.calls).toEqual([['primary', 'a'], ['primary', 'b'], ['fallback', 'a']]);
  });
  it('skips an invalid key across models', async () => {
    const exec = vi.fn().mockRejectedValueOnce({ status: 403 }).mockRejectedValueOnce({ status: 429 }).mockResolvedValue('ok');
    await createKeyPoolRouter().call(['one', 'two'], ['a', 'b'], exec);
    expect(exec.mock.calls).toEqual([['one', 'a'], ['one', 'b'], ['two', 'b']]);
  });
  it.each([404, 503])('skips other keys when a model returns %i', async status => {
    const exec = vi.fn().mockRejectedValueOnce({ status }).mockResolvedValue('ok');
    await createKeyPoolRouter().call(['one', 'two'], ['a', 'b'], exec);
    expect(exec.mock.calls).toEqual([['one', 'a'], ['two', 'a']]);
  });
  it('holds daily quota until midnight Pacific, even when the UTC date changes', async () => {
    let now = Date.parse('2026-10-27T23:50:00Z');
    const router = createKeyPoolRouter(() => now);
    const exec = vi.fn().mockRejectedValueOnce({ status: 429, message: 'quota per day' }).mockResolvedValue('ok');
    await expect(router.call(['one'], ['a'], exec)).rejects.toThrow();
    now = Date.parse('2026-10-28T00:10:00Z');
    await expect(router.call(['one'], ['a'], exec)).rejects.toThrow();
    expect(exec).toHaveBeenCalledTimes(1);
    now = Date.parse('2026-10-28T07:01:00Z');
    expect(await router.call(['one'], ['a'], exec)).toBe('ok');
  });
  it('fails fast while all pairs cool down, and recovers after one minute', async () => {
    let now = 0;
    const router = createKeyPoolRouter(() => now);
    const exec = vi.fn().mockRejectedValueOnce({ status: 429 }).mockResolvedValue('ok');
    await expect(router.call(['one'], ['a'], exec)).rejects.toThrow();
    await expect(router.call(['one'], ['a'], exec)).rejects.toThrow();
    now = 60_001;
    expect(await router.call(['one'], ['a'], exec)).toBe('ok');
  });
  it('propagates defects without failover', async () => {
    const exec = vi.fn().mockRejectedValue(new Error('Invalid request structure'));
    await expect(createKeyPoolRouter().call(['one', 'two'], ['a', 'b'], exec)).rejects.toThrow('Invalid request structure');
    expect(exec).toHaveBeenCalledTimes(1);
  });
  it('does not run concurrent requests on the same pair', async () => {
    let release: (value: string) => void;
    const router = createKeyPoolRouter();
    const exec = vi.fn(() => new Promise<string>(resolve => { release = resolve; }));
    const pending = router.call(['one'], ['a'], exec);
    await expect(router.call(['one'], ['a'], exec)).rejects.toThrow();
    release!('ok');
    await expect(pending).resolves.toBe('ok');
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

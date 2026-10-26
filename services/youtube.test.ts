import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules(); });

describe('YouTube API loading', () => {
  it('uses an already loaded API without requesting another script', async () => {
    const api = { Player: vi.fn() };
    vi.stubGlobal('window', { YT: api });
    const { loadYouTubeAPI } = await import('./youtube');
    expect(await loadYouTubeAPI()).toBe(api);
  });

  it('shares one pending request and resolves when YouTube is ready', async () => {
    const target = {} as { YT?: object; onYouTubeIframeAPIReady?: () => void };
    const script = { src: '', async: false, onerror: null, remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal('window', target);
    vi.stubGlobal('document', { createElement: () => script, head: { appendChild: append } });
    const { loadYouTubeAPI } = await import('./youtube');
    const pending = loadYouTubeAPI();
    expect(loadYouTubeAPI()).toBe(pending);
    target.YT = { Player: vi.fn() };
    target.onYouTubeIframeAPIReady!();
    expect(await pending).toBe(target.YT);
    expect(append).toHaveBeenCalledOnce();
  });

  it('times out a blocked API and permits an explicit retry', async () => {
    vi.useFakeTimers();
    const script = { src: '', async: false, onerror: null, remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { createElement: () => script, head: { appendChild: append } });
    const { loadYouTubeAPI } = await import('./youtube');
    const pending = loadYouTubeAPI();
    const rejected = expect(pending).rejects.toThrow('could not be reached');
    await vi.advanceTimersByTimeAsync(12000);
    await rejected;
    const retry = loadYouTubeAPI();
    const retryRejected = expect(retry).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(12000);
    await retryRejected;
    expect(append).toHaveBeenCalledTimes(2);
  });
});

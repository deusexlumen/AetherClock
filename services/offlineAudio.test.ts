import { afterEach, describe, expect, it, vi } from 'vitest';
import { playOfflineFallback, stopOfflineFallback } from './offlineAudio';

afterEach(() => {
  stopOfflineFallback();
  vi.unstubAllGlobals();
});

describe('offline alarm audio', () => {
  it('stops the currently playing fallback audio', async () => {
    const audio = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), currentTime: 5, loop: false, volume: 0 };
    vi.stubGlobal('Audio', vi.fn(function () { return audio; }));
    await playOfflineFallback();
    stopOfflineFallback();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(0);
  });

  it('does not start a siren if playback fails after the alarm was stopped', async () => {
    let rejectPlayback!: (error: Error) => void;
    const audio = { play: vi.fn(() => new Promise<void>((_, reject) => { rejectPlayback = reject; })), pause: vi.fn(), currentTime: 0, loop: false, volume: 0 };
    const audioContext = vi.fn();
    vi.stubGlobal('Audio', vi.fn(function () { return audio; }));
    vi.stubGlobal('window', { AudioContext: audioContext });
    const playback = playOfflineFallback();
    stopOfflineFallback();
    rejectPlayback(new Error('blocked'));
    await playback;
    expect(audioContext).not.toHaveBeenCalled();
  });
});

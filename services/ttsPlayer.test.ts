import { afterEach, describe, expect, it, vi } from 'vitest';
import { TTSPlayer } from './ttsPlayer';

afterEach(() => vi.unstubAllGlobals());

describe('briefing playback', () => {
  it('wraps raw PCM audio in a browser-playable WAV container', () => {
    const ctor = vi.fn(function (_source: string) { return { play: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() }; });
    vi.stubGlobal('Audio', ctor);
    new TTSPlayer().play('data:audio/L16;codec=pcm;rate=24000;base64,AAAAAA==', 'audio/wav');
    const url = ctor.mock.calls[0][0] as string;
    expect(url.startsWith('data:audio/wav;base64,')).toBe(true);
    const bytes = Uint8Array.from(atob(url.split(',')[1]), char => char.charCodeAt(0));
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(24000);
    expect(new DataView(bytes.buffer).getUint32(40, true)).toBe(4);
  });
  it('accepts a complete data URL without encoding it twice', () => {
    const audio = { play: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const ctor = vi.fn(function () { return audio; });
    vi.stubGlobal('Audio', ctor);
    new TTSPlayer().play('data:audio/wav;base64,AAAA', 'audio/wav');
    expect(ctor).toHaveBeenCalledWith('data:audio/wav;base64,AAAA');
  });

  it('does not advance the playlist after a stopped briefing rejects', async () => {
    let rejectPlayback!: (error: Error) => void;
    const audio = { play: vi.fn(() => new Promise<void>((_, reject) => { rejectPlayback = reject; })), pause: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), src: '' };
    vi.stubGlobal('Audio', vi.fn(function () { return audio; }));
    const next = vi.fn();
    const player = new TTSPlayer();
    player.play('AAAA', 'audio/wav', next);
    player.stop();
    rejectPlayback(new Error('aborted'));
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();
  });
});

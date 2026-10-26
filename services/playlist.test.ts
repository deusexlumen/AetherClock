import { describe, expect, it } from 'vitest';
import { buildEmbedUrl, getRecoveryTrack, generatePlaylist } from './playlist';
import { canRetryYouTubeVideo, describeYouTubeError, parseYouTubeInput } from './youtube';

describe('YouTube playback recovery', () => {
  it('accepts supported video links and rejects lookalike websites', () => {
    expect(parseYouTubeInput('https://youtu.be/K4DyBUG242c?t=10')).toBe('K4DyBUG242c');
    expect(parseYouTubeInput('https://www.youtube.com/watch?v=K4DyBUG242c')).toBe('K4DyBUG242c');
    expect(parseYouTubeInput('https://youtube.com.evil.example/watch?v=K4DyBUG242c')).toBeNull();
    expect(parseYouTubeInput('https://youtube.com/playlist?list=abc')).toBeNull();
    expect(parseYouTubeInput('javascript:alert(1)')).toBeNull();
  });

  it('reuses the initial selection and respects a five-track queue with bounded AI calls', async () => {
    let calls = 0;
    const first = { title: 'On & On', artist: 'Cartoon', youtubeVideoId: 'K4DyBUG242c', whyExplanation: 'Selected', foundTheme: 'Morning', styleDescription: 'Electronic' };
    const tracks = await generatePlaylist(async () => { calls++; return first; }, 5, 'auto', first);
    expect(calls).toBe(2);
    expect(tracks).toHaveLength(5);
    expect(tracks[0].title).toBe('On & On');
    expect(new Set(tracks.map(track => track.youtubeVideoId)).size).toBe(5);
  });

  it('rejects URLs and malformed IDs rather than generating invalid embeds', () => {
    expect(buildEmbedUrl('https://example.com')).toBeNull();
    expect(buildEmbedUrl('bad')).toBeNull();
    expect(buildEmbedUrl(' K4DyBUG242c ')).toContain('/embed/K4DyBUG242c?');
  });

  it('tries distinct replacements and stops after three failed videos', () => {
    const failed = new Set(['K4DyBUG242c']);
    const second = getRecoveryTrack(failed)!;
    expect(failed.has(second.youtubeVideoId!)).toBe(false);
    failed.add(second.youtubeVideoId!);
    const third = getRecoveryTrack(failed)!;
    expect(failed.has(third.youtubeVideoId!)).toBe(false);
    failed.add(third.youtubeVideoId!);
    expect(getRecoveryTrack(failed)).toBeNull();
  });

  it('distinguishes player configuration errors from unavailable videos', () => {
    expect(canRetryYouTubeVideo(153)).toBe(false);
    expect(canRetryYouTubeVideo(101)).toBe(true);
    expect(canRetryYouTubeVideo(0)).toBe(false);
    expect(describeYouTubeError(153)).toContain('verify');
  });
});

// BUXE_OS v24.X -- PLAYLIST SERVICE
import { MusicGenre, PlaylistTrack, SearchedSongMetadata } from '../types';

// Garantiert embeddable Fallback-Videos (Lofi-Radio Streams)
export const REPUTABLE_YOUTUBE_FALLBACKS: Record<MusicGenre, string[]> = {
  auto: ['jfKfPfyJRdk', '5qap5aO4i9A'],
  synthwave: ['jfKfPfyJRdk', '5qap5aO4i9A'],
  acoustic: ['jfKfPfyJRdk', '5qap5aO4i9A'],
  lofi: ['jfKfPfyJRdk', '5qap5aO4i9A'],
  rock: ['jfKfPfyJRdk', '5qap5aO4i9A'],
  classical: ['jfKfPfyJRdk', '5qap5aO4i9A'],
  jazz: ['jfKfPfyJRdk', '5qap5aO4i9A'],
  pop: ['jfKfPfyJRdk', '5qap5aO4i9A'],
  ambient: ['jfKfPfyJRdk', '5qap5aO4i9A'],
  hiphop: ['jfKfPfyJRdk', '5qap5aO4i9A'],
};

export const buildEmbedUrl = (videoId: string | null | undefined): string | null => {
  const id = videoId?.trim();
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?autoplay=1&controls=0&modestbranding=1&playlist=${id}&loop=1&enablejsapi=1`;
};

export const getFallbackVideoId = (genre: MusicGenre): string => {
  const list = REPUTABLE_YOUTUBE_FALLBACKS[genre] || REPUTABLE_YOUTUBE_FALLBACKS.auto;
  return list[Math.floor(Math.random() * list.length)];
};

export const generatePlaylist = async (
  fetchTrackFn: () => Promise<SearchedSongMetadata>,
  trackCount: number,
  genre: MusicGenre = 'auto'
): Promise<PlaylistTrack[]> => {
  const tracks: PlaylistTrack[] = [];
  const usedIds = new Set<string>();
  // Cap track generation to avoid excessive API calls during pre-warm
  const safeTrackCount = Math.min(trackCount, 3);

  // Fetch in parallel for speed
  const promises = Array.from({ length: safeTrackCount }, () =>
    fetchTrackFn().catch((err) => {
      console.warn('Playlist track fetch failed', err);
      return null;
    })
  );

  const results = await Promise.all(promises);

  for (const meta of results) {
    if (!meta) continue;
    const videoId = meta.youtubeVideoId?.trim();
    if (!videoId) continue;
    if (usedIds.has(videoId)) continue;
    usedIds.add(videoId);

    tracks.push({
      title: meta.title,
      artist: meta.artist,
      youtubeVideoId: videoId,
      whyExplanation: meta.whyExplanation,
    });
  }

  // Mit Fallbacks auffuellen, damit der Alarm nie stumm bleibt
  while (tracks.length < safeTrackCount) {
    const fallbackId = getFallbackVideoId(genre);
    if (!usedIds.has(fallbackId)) {
      usedIds.add(fallbackId);
      tracks.push({
        title: 'Fallback Broadcast',
        artist: 'AetherClock Radio',
        youtubeVideoId: fallbackId,
        whyExplanation: 'Emergency fallback signal tuned to your station preset.',
      });
    } else {
      // Wenn alle Fallbacks schon verbraucht sind, abbrechen um Endlosschleife zu vermeiden
      break;
    }
  }

  return tracks;
};

export const getNextTrackIndex = (
  current: number,
  total: number,
  shuffle: boolean
): number => {
  if (shuffle) {
    let next = Math.floor(Math.random() * total);
    if (total > 1 && next === current) {
      next = (next + 1) % total;
    }
    return next;
  }
  return (current + 1) % total;
};

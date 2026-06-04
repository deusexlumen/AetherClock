import { MusicGenre, PlaylistTrack, SearchedSongMetadata } from '../types';

export const REPUTABLE_YOUTUBE_FALLBACKS: Record<MusicGenre, string> = {
  auto: "jfKfPfyJRdk",
  synthwave: "4xDzrJKXOOY",
  acoustic: "2u_t_v8IeBY",
  lofi: "jfKfPfyJRdk",
  rock: "mQD69vY0_D0",
  classical: "9E6b3swZ44g",
  jazz: "3HNJ_t49N_I",
  pop: "A67ZkAd1dQ0",
  ambient: "tNkZs56_86s",
  hiphop: "hHW1oY26kxQ"
};

export const buildEmbedUrl = (videoId: string): string => {
  const id = videoId?.trim();
  if (!id) {
    return `https://www.youtube.com/embed/?autoplay=1&controls=0&modestbranding=1&enablejsapi=1`;
  }
  return `https://www.youtube.com/embed/${id}?autoplay=1&controls=0&modestbranding=1&playlist=${id}&loop=1&enablejsapi=1`;
};

export const getFallbackVideoId = (genre: MusicGenre): string => {
  return REPUTABLE_YOUTUBE_FALLBACKS[genre] || REPUTABLE_YOUTUBE_FALLBACKS.auto;
};

export const generatePlaylist = async (
  fetchTrackFn: () => Promise<SearchedSongMetadata>,
  trackCount: number
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

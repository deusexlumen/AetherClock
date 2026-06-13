// BUXE_OS v24.X -- PLAYLIST SERVICE
import { MusicGenre, PlaylistTrack, SearchedSongMetadata } from '../types';

// Verified NoCopyrightSounds fallback tracks. NCS releases are royalty-free and
// generally embeddable worldwide, making them a safe safety net when the AI
// cannot provide a working youtubeVideoId.
export const RELIABLE_NCS_FALLBACKS: Record<string, { title: string; artist: string; whyExplanation: string }> = {
  'K4DyBUG242c': { title: 'On & On', artist: 'Cartoon feat. Daniel Levi', whyExplanation: 'Energetic NCS fallback tuned to your station preset.' },
  'TW9d8vYrVFQ': { title: 'Sky High', artist: 'Elektronomia', whyExplanation: 'Uplifting NCS fallback tuned to your station preset.' },
  'J2X5mJ3HDYE': { title: 'Invincible', artist: 'DEAF KEV', whyExplanation: 'Driving NCS fallback tuned to your station preset.' },
  '3nQNiWdeH2Q': { title: 'Heroes Tonight', artist: 'Janji feat. Johnning', whyExplanation: 'Motivational NCS fallback tuned to your station preset.' },
  'p7ZsBPK656s': { title: 'Blank', artist: 'Disfigure', whyExplanation: 'Melodic NCS fallback tuned to your station preset.' },
  'S19UcWdOA-I': { title: 'Fearless pt.II', artist: 'TULE feat. Chris Linton', whyExplanation: 'Epic NCS fallback tuned to your station preset.' },
  'yJg-Y5byMMw': { title: 'Mortals', artist: 'Warriyo feat. Laura Brehm', whyExplanation: 'Powerful NCS fallback tuned to your station preset.' },
};

const NCS_FALLBACK_IDS = Object.keys(RELIABLE_NCS_FALLBACKS);
const NCS_CHANNEL_ID = 'UC_aEa8K-EOJ3D6gOs7HcyNg';

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export const isValidVideoId = (id: string | null | undefined): id is string => {
  return typeof id === 'string' && YOUTUBE_ID_REGEX.test(id.trim());
};

export const buildEmbedUrl = (videoId: string | null | undefined): string | null => {
  const id = videoId?.trim();
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?autoplay=1&controls=0&modestbranding=1&playlist=${id}&loop=1&enablejsapi=1`;
};

export const buildNcsChannelEmbedUrl = (): string => {
  return `https://www.youtube.com/embed?listType=user_uploads&list=${NCS_CHANNEL_ID}&autoplay=1&controls=0&modestbranding=1&enablejsapi=1`;
};

export const getFallbackTrack = (usedIds: Set<string>): PlaylistTrack => {
  const availableIds = NCS_FALLBACK_IDS.filter((id) => !usedIds.has(id));
  const pool = availableIds.length > 0 ? availableIds : NCS_FALLBACK_IDS;
  const videoId = pool[Math.floor(Math.random() * pool.length)];
  const info = RELIABLE_NCS_FALLBACKS[videoId];
  usedIds.add(videoId);

  return {
    title: info?.title || 'AetherClock Radio',
    artist: info?.artist || 'NoCopyrightSounds',
    youtubeVideoId: videoId,
    embedUrl: buildEmbedUrl(videoId) || buildNcsChannelEmbedUrl(),
    whyExplanation: info?.whyExplanation || 'Emergency fallback signal tuned to your station preset.',
  };
};

export const generatePlaylist = async (
  fetchTrackFn: () => Promise<SearchedSongMetadata>,
  trackCount: number,
  _genre: MusicGenre = 'auto'
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
    if (!meta) {
      tracks.push(getFallbackTrack(usedIds));
      continue;
    }

    const videoId = meta.youtubeVideoId?.trim();

    if (isValidVideoId(videoId) && !usedIds.has(videoId)) {
      usedIds.add(videoId);
      tracks.push({
        title: meta.title || 'AetherClock Radio',
        artist: meta.artist || 'Unknown Artist',
        youtubeVideoId: videoId,
        embedUrl: buildEmbedUrl(videoId) || buildNcsChannelEmbedUrl(),
        whyExplanation: meta.whyExplanation || 'Curated by AetherClock AI.',
      });
    } else {
      // The AI did not return a usable video ID. Use a reliable fallback so the
      // alarm never stays silent, but keep the AI's explanation if it helps.
      const fallback = getFallbackTrack(usedIds);
      tracks.push({
        ...fallback,
        whyExplanation: meta.whyExplanation
          ? `${meta.whyExplanation} (fallback player)`
          : fallback.whyExplanation,
      });
    }
  }

  // Pad with fallbacks until we have the requested number of tracks.
  while (tracks.length < safeTrackCount) {
    tracks.push(getFallbackTrack(usedIds));
  }

  // Ultimate safety net: if somehow no tracks were produced, return the NCS
  // channel uploads player so YouTube serves any available NCS upload.
  if (tracks.length === 0) {
    tracks.push({
      title: 'AetherClock Safety Net',
      artist: 'NoCopyrightSounds',
      embedUrl: buildNcsChannelEmbedUrl(),
      whyExplanation: 'Emergency channel fallback — playing the latest NCS uploads.',
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

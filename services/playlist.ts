// BUXE_OS v24.X -- PLAYLIST SERVICE
import { MusicGenre, PlaylistTrack, SearchedSongMetadata } from '../types';

// Preset tracks used when AI selection fails. Embedding availability is checked
// by the player at runtime and can vary by region, video and browser.
export const RELIABLE_NCS_FALLBACKS: Record<string, { title: string; artist: string; whyExplanation: string }> = {
  'K4DyBUG242c': { title: 'On & On', artist: 'Cartoon feat. Daniel Levi', whyExplanation: 'Energetic NCS preset track. Availability depends on YouTube.' },
  'TW9d8vYrVFQ': { title: 'Sky High', artist: 'Elektronomia', whyExplanation: 'Uplifting NCS preset track. Availability depends on YouTube.' },
  'J2X5mJ3HDYE': { title: 'Invincible', artist: 'DEAF KEV', whyExplanation: 'Driving NCS preset track. Availability depends on YouTube.' },
  '3nQNiWdeH2Q': { title: 'Heroes Tonight', artist: 'Janji feat. Johnning', whyExplanation: 'Motivational NCS preset track. Availability depends on YouTube.' },
  'p7ZsBPK656s': { title: 'Blank', artist: 'Disfigure', whyExplanation: 'Melodic NCS preset track. Availability depends on YouTube.' },
  'S19UcWdOA-I': { title: 'Fearless pt.II', artist: 'TULE feat. Chris Linton', whyExplanation: 'Epic NCS preset track. Availability depends on YouTube.' },
  'yJg-Y5byMMw': { title: 'Mortals', artist: 'Warriyo feat. Laura Brehm', whyExplanation: 'Powerful NCS preset track. Availability depends on YouTube.' },
};

const NCS_FALLBACK_IDS = Object.keys(RELIABLE_NCS_FALLBACKS);

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export const isValidVideoId = (id: string | null | undefined): id is string => {
  return typeof id === 'string' && YOUTUBE_ID_REGEX.test(id.trim());
};

export const buildEmbedUrl = (videoId: string | null | undefined): string | null => {
  const id = videoId?.trim();
  if (!isValidVideoId(id)) return null;
  return `https://www.youtube.com/embed/${id}?controls=1&playsinline=1&enablejsapi=1`;
};

// Stop after two automatic replacements rather than cycling failed IDs forever.
export const getRecoveryTrack = (failedIds: Set<string>): PlaylistTrack | null => {
  if (failedIds.size >= 3) return null;
  const id = NCS_FALLBACK_IDS.find(candidate => !failedIds.has(candidate));
  if (!id) return null;
  return { ...RELIABLE_NCS_FALLBACKS[id], youtubeVideoId: id, embedUrl: buildEmbedUrl(id)! };
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
    embedUrl: buildEmbedUrl(videoId)!,
    whyExplanation: info?.whyExplanation || 'Emergency fallback signal tuned to your station preset.',
  };
};

export const generatePlaylist = async (
  fetchTrackFn: () => Promise<SearchedSongMetadata>,
  trackCount: number,
  _genre: MusicGenre = 'auto',
  firstTrack?: SearchedSongMetadata,
): Promise<PlaylistTrack[]> => {
  const tracks: PlaylistTrack[] = [];
  const usedIds = new Set<string>();
  // Cap track generation to avoid excessive API calls during pre-warm
  const requestedCount = Number.isFinite(trackCount) ? Math.max(1, Math.min(Math.floor(trackCount), 5)) : 1;
  const safeTrackCount = Math.min(requestedCount, 3);

  // Fetch in parallel for speed
  const promises = Array.from({ length: safeTrackCount - (firstTrack ? 1 : 0) }, () =>
    fetchTrackFn().catch((err) => {
      console.warn('Playlist track fetch failed', err);
      return null;
    })
  );

  const results = [...(firstTrack ? [firstTrack] : []), ...await Promise.all(promises)];

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
        embedUrl: buildEmbedUrl(videoId)!,
        whyExplanation: meta.whyExplanation || 'Curated by AetherClock AI.',
      });
    } else {
      // Use the replacement's own metadata; the AI explanation describes a different song.
      const fallback = getFallbackTrack(usedIds);
      tracks.push(fallback);
    }
  }

  // Pad with fallbacks until we have the requested number of tracks.
  while (tracks.length < requestedCount) {
    tracks.push(getFallbackTrack(usedIds));
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

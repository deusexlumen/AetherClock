// BUXE_OS v24.X -- PLAYLIST SERVICE
import { MusicGenre, PlaylistTrack, SearchedSongMetadata } from '../types';

// Garantiert embeddable Fallback-Videos (keine Livestreams — echte Musikvideos)
export const REPUTABLE_YOUTUBE_FALLBACKS: Record<MusicGenre, string[]> = {
  auto: ['kJQP7kiw5Fk', 'RgKAFK5djSk', 'JGwWNGJdvx8'],
  synthwave: ['4NRXx6U8ABQ', 'JGwWNGJdvx8', 'kJQP7kiw5Fk'],
  acoustic: ['JGwWNGJdvx8', 'RgKAFK5djSk', 'CevxZvSJLk8'],
  lofi: ['JGwWNGJdvx8', 'RgKAFK5djSk', 'kJQP7kiw5Fk'],
  rock: ['btPJPFnesV4', 'eVTXPUF4Oz4', 'CevxZvSJLk8'],
  classical: ['RgKAFK5djSk', 'JGwWNGJdvx8', 'kJQP7kiw5Fk'],
  jazz: ['RgKAFK5djSk', 'kJQP7kiw5Fk', 'JGwWNGJdvx8'],
  pop: ['kJQP7kiw5Fk', 'CevxZvSJLk8', 'JGwWNGJdvx8'],
  ambient: ['RgKAFK5djSk', 'JGwWNGJdvx8', 'kJQP7kiw5Fk'],
  hiphop: ['RgKAFK5djSk', 'kJQP7kiw5Fk', 'JGwWNGJdvx8'],
};

// Fallback-Metadaten für bekannte IDs, damit der Name im UI stimmt
export const FALLBACK_TRACK_INFO: Record<string, { title: string; artist: string; whyExplanation: string }> = {
  'kJQP7kiw5Fk': { title: 'Despacito', artist: 'Luis Fonsi', whyExplanation: 'Pop-energy fallback tuned to your station preset.' },
  'RgKAFK5djSk': { title: 'See You Again', artist: 'Wiz Khalifa', whyExplanation: 'Melodic fallback tuned to your station preset.' },
  'JGwWNGJdvx8': { title: 'Shape of You', artist: 'Ed Sheeran', whyExplanation: 'Chill-rhythm fallback tuned to your station preset.' },
  'btPJPFnesV4': { title: 'Eye of the Tiger', artist: 'Survivor', whyExplanation: 'High-energy rock fallback tuned to your station preset.' },
  'eVTXPUF4Oz4': { title: 'In The End', artist: 'Linkin Park', whyExplanation: 'Alt-rock fallback tuned to your station preset.' },
  'CevxZvSJLk8': { title: 'Roar', artist: 'Katy Perry', whyExplanation: 'Pop-anthem fallback tuned to your station preset.' },
  '4NRXx6U8ABQ': { title: 'Blinding Lights', artist: 'The Weeknd', whyExplanation: 'Synthwave fallback tuned to your station preset.' },
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
    let videoId = meta.youtubeVideoId?.trim();

    // Wenn die KI kein Video-ID liefert, weise ein passendes Fallback-Video zu
    // aber behalte die kuratierten Metadaten bei
    if (!videoId) {
      let attempts = 0;
      do {
        videoId = getFallbackVideoId(genre);
        attempts++;
      } while (usedIds.has(videoId) && attempts < 10);
    }

    if (!videoId) continue;
    if (usedIds.has(videoId)) continue;
    usedIds.add(videoId);

    // Falls es ein bekannter Fallback ist, zeige den echten Songnamen an
    const fallbackInfo = FALLBACK_TRACK_INFO[videoId];

    tracks.push({
      title: meta.title || fallbackInfo?.title || 'Radio Broadcast',
      artist: meta.artist || fallbackInfo?.artist || 'AetherClock Radio',
      youtubeVideoId: videoId,
      whyExplanation: meta.whyExplanation || fallbackInfo?.whyExplanation || 'Emergency fallback signal tuned to your station preset.',
    });
  }

  // Mit Fallbacks auffuellen, damit der Alarm nie stumm bleibt
  while (tracks.length < safeTrackCount) {
    const fallbackId = getFallbackVideoId(genre);
    if (!usedIds.has(fallbackId)) {
      usedIds.add(fallbackId);
      const info = FALLBACK_TRACK_INFO[fallbackId];
      tracks.push({
        title: info?.title || 'Radio Broadcast',
        artist: info?.artist || 'AetherClock Radio',
        youtubeVideoId: fallbackId,
        whyExplanation: info?.whyExplanation || 'Emergency fallback signal tuned to your station preset.',
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

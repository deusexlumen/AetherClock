export interface YouTubePlayerHandle {
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  playVideo(): void;
  stopVideo(): void;
  setVolume(volume: number): void;
  getPlayerState(): number;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

export interface YouTubePlayerOptions {
  videoId: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady(event: { target: YouTubePlayerHandle }): void;
    onError(event: { data: number }): void;
    onStateChange(event: { data: number }): void;
    onAutoplayBlocked(): void;
  };
}

interface YouTubeAPI {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayerHandle;
}

type YouTubeWindow = Window & {
  YT?: YouTubeAPI;
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<YouTubeAPI> | null = null;

export const loadYouTubeAPI = (): Promise<YouTubeAPI> => {
  const target = window as YouTubeWindow;
  if (target.YT?.Player) return Promise.resolve(target.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
    const previousCallback = target.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    const cleanup = () => {
      clearTimeout(timeout);
      script.onerror = null;
      if (target.onYouTubeIframeAPIReady === ready) target.onYouTubeIframeAPIReady = previousCallback;
    };
    const fail = () => {
      cleanup();
      script.remove();
      reject(new Error('YouTube could not be reached. Check your connection or content blocker.'));
    };
    const ready = () => {
      cleanup();
      previousCallback?.();
      if (target.YT?.Player) resolve(target.YT);
      else fail();
    };
    const timeout = setTimeout(fail, 12000);
    target.onYouTubeIframeAPIReady = ready;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error) => {
    apiPromise = null;
    throw error;
  });
  return apiPromise;
};

export const describeYouTubeError = (code: number): string => {
  switch (code) {
    case 100: return 'This video is unavailable or private.';
    case 101:
    case 150: return 'The video owner does not allow playback in other apps.';
    case 153: return 'YouTube could not verify this embedded player. Try opening the app in your browser.';
    case 2: return 'YouTube rejected this video ID.';
    case 5: return 'YouTube could not play this video in this browser.';
    default: return 'YouTube playback failed.';
  }
};

export const canRetryYouTubeVideo = (code: number): boolean => [2, 5, 100, 101, 150].includes(code);

export const parseYouTubeInput = (input: string): string | null => {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/)?.[1] || null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
};

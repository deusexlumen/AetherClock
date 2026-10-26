import React, { useEffect, useRef } from 'react';
import { loadYouTubeAPI, type YouTubePlayerHandle } from '../services/youtube';

interface Props {
  videoId: string;
  playing: boolean;
  volume: number;
  onPlayer(player: YouTubePlayerHandle | null): void;
  onEnded(): void;
  onError(code: number, message?: string): void;
  onBlocked(): void;
  onPlaying(): void;
  onStatus(status: string): void;
}

export const YouTubePlayer: React.FC<Props> = (props) => {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayerHandle | null>(null);
  const ready = useRef(false);
  const suppressEnded = useRef(false);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    let disposed = false;
    let playbackTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      if (!disposed) latest.current.onError(0, 'YouTube did not finish loading. Check your connection or content blocker.');
    }, 15000);
    loadYouTubeAPI().then((api) => {
      if (disposed || !host.current) return;
      const mount = document.createElement('div');
      host.current.appendChild(mount);
      player.current = new api.Player(mount, {
        videoId: latest.current.videoId,
        playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: ({ target }) => {
            if (disposed) return;
            ready.current = true;
            latest.current.onStatus('Loading YouTube');
            clearTimeout(timeout);
            const iframe = target.getIframe();
            iframe.title = 'YouTube music player';
            iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            target.setVolume(latest.current.volume);
            latest.current.onPlayer(target);
            if (latest.current.playing) target.loadVideoById(latest.current.videoId);
            else target.cueVideoById(latest.current.videoId);
          },
          onError: ({ data }) => {
            suppressEnded.current = true;
            clearTimeout(timeout);
            clearTimeout(playbackTimer);
            if (!disposed) latest.current.onError(data);
          },
          onStateChange: ({ data }) => {
            if (disposed) return;
            clearTimeout(playbackTimer);
            latest.current.onStatus(({ 0: 'Track ended', 1: 'Playing', 2: 'Paused', 3: 'Buffering', 5: 'Ready' } as Record<number, string>)[data] || 'Loading YouTube');
            if (data === 0 && latest.current.playing && !suppressEnded.current) latest.current.onEnded();
            if (data === 1) {
              if (latest.current.playing) latest.current.onPlaying();
              else player.current?.stopVideo();
            }
            if (data === 3) playbackTimer = setTimeout(() => {
              latest.current.onError(0, 'YouTube is taking too long to buffer. Try another track or the local alarm sound.');
            }, 20000);
          },
          onAutoplayBlocked: () => { if (!disposed) latest.current.onBlocked(); },
        },
      });
    }).catch((error: Error) => {
      if (!disposed) {
        clearTimeout(timeout);
        latest.current.onError(0, error.message);
      }
    });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      clearTimeout(playbackTimer);
      player.current?.destroy();
      player.current = null;
      ready.current = false;
      latest.current.onPlayer(null);
    };
  }, []);

  useEffect(() => {
    if (!player.current || !ready.current) return;
    suppressEnded.current = !props.playing;
    latest.current.onStatus(props.playing ? 'Loading YouTube' : 'Ready');
    if (props.playing) player.current.loadVideoById(props.videoId);
    else player.current.cueVideoById(props.videoId);
  }, [props.videoId, props.playing]);

  return <div ref={host} className="w-full h-full [&_iframe]:w-full [&_iframe]:h-full" />;
};

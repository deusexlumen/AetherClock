import React, { useRef, useState, useEffect } from 'react';
import { PlaylistTrack } from '../types';
import { SkipBack, SkipForward, Radio } from 'lucide-react';

interface Props {
  playlist: PlaylistTrack[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  isPlayingBriefing: boolean;
}

export const PlaylistViewer: React.FC<Props> = ({ playlist, currentIndex, onNext, onPrev, isPlayingBriefing }) => {
  const prevIndexRef = useRef(currentIndex);
  const [flashWrap, setFlashWrap] = useState(false);

  useEffect(() => {
    if (currentIndex === 0 && prevIndexRef.current === playlist.length - 1 && playlist.length > 1) {
      setFlashWrap(true);
      const t = setTimeout(() => setFlashWrap(false), 1500);
      return () => clearTimeout(t);
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex, playlist.length]);

  if (playlist.length === 0) return null;

  return (
    <div className="bg-black/40 border border-white/10 rounded-lg p-2.5 flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-1">
          <Radio className="w-2.5 h-2.5 text-radio-lit" /> Playlist Queue
        </span>
        <span className={`text-[8px] font-digital transition-colors duration-300 ${flashWrap ? 'text-yellow-400' : 'text-radio-lit/70'}`}>
          {flashWrap ? 'RESTARTING PLAYLIST' : `${currentIndex + 1} / ${playlist.length}`}
        </span>
      </div>

      {isPlayingBriefing && (
        <div className="flex items-center gap-2 px-2 py-1 bg-radio-lit/10 border border-radio-lit/20 rounded">
          <div className="w-1.5 h-1.5 rounded-full bg-radio-lit animate-pulse" />
          <span className="text-[9px] font-mono text-radio-lit uppercase tracking-wider">Voice Briefing...</span>
        </div>
      )}

      <div className="flex flex-col gap-0.5 max-h-[80px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
        {playlist.map((track, idx) => (
          <div
            key={`${track.title}-${track.artist}-${idx}`}
            className={`flex items-center gap-2 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all
              ${idx === currentIndex && !isPlayingBriefing
                ? 'bg-radio-lit/10 border border-radio-lit/30 text-radio-lit'
                : 'text-gray-500 border border-transparent'
              }`}
          >
            <span className="text-[8px] font-digital w-4 text-right">{idx + 1}</span>
            <span className="truncate flex-1">{track.title}</span>
            <span className="text-[8px] text-gray-600 normal-case truncate max-w-[80px]">{track.artist}</span>
          </div>
        ))}
      </div>

      {playlist.length > 1 && (
        <div className="flex justify-center gap-2 mt-0.5">
          <button
            onClick={onPrev}
            disabled={isPlayingBriefing}
            className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous track"
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <button
            onClick={onNext}
            disabled={isPlayingBriefing}
            className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next track"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { parseYouTubeInput } from '../services/youtube';

export const YouTubeInput: React.FC<{ onPlay(id: string): void }> = ({ onPlay }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  return <details className="rounded border border-white/10 p-3 text-sm text-gray-300">
    <summary className="cursor-pointer">Play your own YouTube link</summary>
    <p className="mt-2 text-xs text-gray-400">Try a specific video without AI or an API key. Some videos cannot be embedded.</p>
    <form className="mt-2 flex flex-wrap gap-2" onSubmit={event => {
      event.preventDefault();
      const id = parseYouTubeInput(input);
      if (!id) { setError('Enter a valid YouTube video link or 11-character video ID.'); return; }
      setError(''); onPlay(id);
    }}>
      <input aria-label="YouTube video link" aria-invalid={!!error} aria-describedby={error ? 'youtube-input-error' : undefined}
        value={input} onChange={event => setInput(event.target.value)} placeholder="https://www.youtube.com/watch?v=…"
        className="min-w-0 flex-1 rounded bg-neutral-900 border border-white/20 px-3 py-2" />
      <button type="submit" className="rounded border border-radio-lit px-3 py-2 text-radio-lit">Play video</button>
    </form>
    {error && <p id="youtube-input-error" role="alert" className="mt-2 text-red-300">{error}</p>}
  </details>;
};

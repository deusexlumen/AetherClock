import React, { useEffect, useRef, useState } from 'react';
import type { LLMConfig, VoiceBriefingConfig } from '../../types';
import { BUILTIN_VOICES, DELIVERY_STYLES, normalizeDelivery, type VoiceOption } from '../../services/voiceOptions';
import { generateVoiceBriefing } from '../../services/voiceBriefing';
import { audioUrl } from '../../services/ttsPlayer';

interface Props { config: VoiceBriefingConfig; llmConfig: LLMConfig; onChange: (config: VoiceBriefingConfig) => void; }
export const VoiceControls: React.FC<Props> = ({ config, llmConfig, onChange }) => {
  const [voices, setVoices] = useState(BUILTIN_VOICES);
  const [query, setQuery] = useState('');
  const [catalogState, setCatalogState] = useState('Loading voice library…');
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState('');
  const audio = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/voices', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json() as { voices: VoiceOption[]; extended: boolean };
      if (controller.signal.aborted) return;
      if (Array.isArray(data.voices) && data.voices.length) setVoices(data.voices);
      setCatalogState(data.extended ? 'Full voice library loaded' : '30 studio voices available. Extended library is temporarily unavailable.');
    }).catch(() => { if (!controller.signal.aborted) setCatalogState('30 studio voices available. Extended library is temporarily unavailable.'); });
    return () => { controller.abort(); generation.current++; audio.current?.pause(); };
  }, []);
  const delivery = normalizeDelivery(config.delivery);
  const selected = voices.find(voice => voice.id === config.voiceName);
  const filtered = voices.filter(voice => `${voice.name} ${voice.description}`.toLowerCase().includes(query.toLowerCase()));
  const choices = selected && !filtered.includes(selected) ? [selected, ...filtered] : filtered;
  const stop = () => { generation.current++; audio.current?.pause(); audio.current = null; setPreviewState('idle'); };
  const patch = (next: Partial<VoiceBriefingConfig>) => { stop(); setError(''); onChange({ ...config, ...next }); };
  const preview = async () => {
    if (previewState !== 'idle') { stop(); return; }
    const current = ++generation.current; setError(''); setPreviewState('loading');
    try {
      const result = await generateVoiceBriefing(null, [], '', { ...config, includeAgenda: false, includeTime: false, includeWeather: false,
        customGreeting: 'Guten Morgen. Dein Tag beginnt ganz in deinem Tempo. Zeit für deine Musik.' }, { ...llmConfig, ttsModel: llmConfig.ttsModel.startsWith('gemini-3.8-') ? llmConfig.ttsModel : 'gemini-3.8-flash-tts' });
      if (current !== generation.current) return;
      if (!result.audioBase64) throw new Error();
      const player = new Audio(audioUrl(result.audioBase64, result.mimeType)); audio.current = player;
      player.onended = () => { if (current === generation.current) setPreviewState('idle'); };
      player.onerror = () => { if (current === generation.current) { setPreviewState('idle'); setError('Playback failed. Try the preview again.'); } };
      await player.play(); if (current === generation.current) setPreviewState('playing');
    } catch { if (current === generation.current) { setPreviewState('idle'); setError('Voice preview unavailable. Try again or choose another voice.'); } }
  };
  return <div className="voice-controls settings-subsection">
    <div className="settings-form-grid">
      <label className="text-control"><span>Find a voice</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or character, e.g. warm" /></label>
      <label className="select-control"><span>Voice · {voices.length} available</span><select value={config.voiceName} onChange={event => patch({ voiceName: event.target.value })}>
        {!selected && <option value={config.voiceName}>{config.voiceName}</option>}
        {choices.map(voice => <option key={voice.id} value={voice.id}>{voice.name} — {voice.description}</option>)}
      </select><small>{selected?.description || 'Your saved voice'}{!filtered.length && ' · No matching voices'}</small></label>
      <label className="select-control"><span>Delivery style</span><select value={delivery.style} onChange={event => patch({ delivery: { ...delivery, style: event.target.value } })}>{DELIVERY_STYLES.map(style => <option key={style.id} value={style.id}>{style.name}</option>)}</select></label>
      <label className="range-control"><span><b>Speaking pace</b><output>{delivery.pace < 35 ? 'Slow' : delivery.pace > 65 ? 'Brisk' : 'Natural'}</output></span><input type="range" min="0" max="100" value={delivery.pace} onChange={event => patch({ delivery: { ...delivery, pace: Number(event.target.value) } })} /><small>Unhurried ← → Brisk</small></label>
      <label className="range-control"><span><b>Expression & emphasis</b><output>{delivery.expression < 35 ? 'Subtle' : delivery.expression > 65 ? 'Expressive' : 'Balanced'}</output></span><input type="range" min="0" max="100" value={delivery.expression} onChange={event => patch({ delivery: { ...delivery, expression: Number(event.target.value) } })} /><small>Restrained ← → Lively</small></label>
    </div>
    <div className="voice-preview-row"><button type="button" className="primary-small" onClick={preview}>{previewState === 'loading' ? 'Cancel preview' : previewState === 'playing' ? 'Stop preview' : 'Preview voice'}</button><span role="status" aria-live="polite">{previewState === 'loading' ? 'Preparing your voice…' : previewState === 'playing' ? 'Playing preview' : catalogState}</span></div>
    <small>Delivery controls use Gemini 3.8. Actual pacing and expression vary by voice; no prompt needed.</small>
    {error && <p role="alert">{error}</p>}
  </div>;
};

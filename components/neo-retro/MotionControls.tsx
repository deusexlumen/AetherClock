import React from 'react';
import type { VisualSettings } from '../../types';
interface Props { settings: VisualSettings; onChange: (settings: VisualSettings) => void; compact?: boolean; }
const RangeControl: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; suffix?: string; onChange: (value: number) => void; hint?: string }> = ({ label, value, min = 0, max = 100, step = 1, suffix = '%', onChange, hint }) => <label className="range-control"><span><b>{label}</b><output>{value}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />{hint && <small>{hint}</small>}</label>;
export const MotionControls: React.FC<Props> = ({ settings, onChange, compact = false }) => {
  const patch = (value: Partial<VisualSettings>) => onChange({ ...settings, ...value });
  return <div className={`motion-controls ${compact ? 'motion-controls--compact' : ''}`}><div className="control-grid">
    <RangeControl label="Motion intensity" value={settings.motionIntensity} onChange={motionIntensity => patch({ motionIntensity })} />
    <RangeControl label="Motion speed" value={settings.motionSpeed} min={.25} max={2} step={.25} suffix="×" onChange={motionSpeed => patch({ motionSpeed })} />
    <RangeControl label="Audio response" value={settings.audioReactivity} onChange={audioReactivity => patch({ audioReactivity })} hint="Uses real FFT only when the audio source makes it available." />
    <RangeControl label="Glow / bloom" value={settings.glowIntensity} onChange={glowIntensity => patch({ glowIntensity })} />
    <RangeControl label="Particle density" value={settings.particleDensity} onChange={particleDensity => patch({ particleDensity })} />
  </div><div className="control-grid control-grid--selects">
    <label className="select-control"><span>Render quality</span><select value={settings.quality} onChange={event => patch({ quality: event.target.value as VisualSettings['quality'] })}><option value="auto">Auto · adapt to device</option><option value="high">High · full detail</option><option value="balanced">Balanced</option><option value="saver">Saver · minimal load</option></select></label>
    <label className="select-control"><span>Reduced motion</span><select value={settings.reducedMotion} onChange={event => patch({ reducedMotion: event.target.value as VisualSettings['reducedMotion'] })}><option value="system">Follow system</option><option value="reduced">Reduced / static</option><option value="full">Full motion</option></select></label>
    <label className="select-control"><span>Display mode</span><select value={settings.displayMode} onChange={event => patch({ displayMode: event.target.value as VisualSettings['displayMode'] })}><option value="device">Device · full radio</option><option value="ambient">Ambient · expanded display</option></select></label>
    <label className="toggle-control"><input type="checkbox" checked={settings.circadian} onChange={event => patch({ circadian: event.target.checked })} /><span><b>Circadian lighting</b><small>Scene light follows local time and day/night context.</small></span></label>
  </div></div>;
};

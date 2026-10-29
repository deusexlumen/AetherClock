import React from 'react';
import { Maximize2, Power, Radio, Play } from 'lucide-react';
import { Clock } from '../Clock';
import { formatAlarmCountdown, formatAlarmDate } from '../../services/nextAlarm';
import type { NeoRetroProps } from './NeoRetroTypes';
export const AmbientClock: React.FC<{ props: NeoRetroProps; automatic?: boolean }> = ({ props: p, automatic = false }) => {
  const playing = p.state.status === 'playing' || p.state.status === 'playing_briefing'; const track = p.state.playlist[p.state.currentTrackIndex];
  return <section className={`ambient-layer ${automatic ? 'ambient-layer--automatic' : ''}`} data-phase={p.circadian.phase} aria-label="Ambient clock"><div className="ambient-light-field" aria-hidden="true"><i /><i /><i /></div><div className="ambient-frame">
    <header className="ambient-header"><span className="ambient-brand"><Radio size={15} /> AETHERCLOCK <i /> {p.theme.shortName}</span><button type="button" onClick={() => automatic ? p.onScreenSaverWake() : p.onVisualSettingsChange({ ...p.visualSettings, displayMode: 'device' })}><Maximize2 size={15} /> {automatic ? 'Wake receiver' : 'Back to radio'}</button></header>
    <div className="ambient-center"><span className="ambient-date">{p.now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}</span><Clock isAlarmActive={p.isAnyAlarmActive} />{p.nextAlarm ? <div className="ambient-next"><span>Next broadcast</span><strong>{formatAlarmDate(p.nextAlarm.date, p.now)}</strong><small>{p.nextAlarm.alarm.label} · {formatAlarmCountdown(p.nextAlarm.millisecondsUntil)}</small></div> : <div className="ambient-next"><span>Receiver standing by</span><strong>No armed alarms</strong></div>}{playing && track && <div className="ambient-track"><span>Now transmitting</span><b>{track.title}</b><small>{track.artist}</small></div>}</div>
    <footer className="ambient-footer"><span><i className={p.isOnlineStatus ? 'online' : 'offline'} /> {p.isOnlineStatus ? 'SIGNAL LOCKED' : 'OFFLINE MODE'}</span><button type="button" className="ambient-play" onClick={p.onPlayToggle}>{playing ? <Power size={17} /> : <Play size={17} />}{playing ? 'Stop broadcast' : 'Tune in'}</button><span>{automatic ? 'INTERACT TO WAKE' : 'AMBIENT DISPLAY'}</span></footer>
  </div></section>;
};

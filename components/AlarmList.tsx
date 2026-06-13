import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Alarm,
  MusicGenre,
  WeekDay,
  WEEKDAYS,
  PlaylistConfig,
  VoiceBriefingConfig,
  MUSIC_GENRES,
  VOICE_NAMES,
} from '../types';
import { createAlarm } from '../services/alarm';

interface AlarmListProps {
  alarms: Alarm[];
  onChange: (alarms: Alarm[]) => void;
  defaultPlaylistConfig: PlaylistConfig;
  defaultVoiceBriefingConfig: VoiceBriefingConfig;
}

const DAY_LABELS: Record<WeekDay, string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};



export const AlarmList: React.FC<AlarmListProps> = ({
  alarms,
  onChange,
  defaultPlaylistConfig,
  defaultVoiceBriefingConfig,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Alarm>) => {
    onChange(alarms.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const toggleDay = (id: string, day: WeekDay) => {
    const alarm = alarms.find((a) => a.id === id);
    if (!alarm) return;
    const days = alarm.days.includes(day)
      ? alarm.days.filter((d) => d !== day)
      : [...alarm.days, day];
    update(id, { days });
  };

  const add = () => {
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const time = `${nextHour.getHours().toString().padStart(2, '0')}:${nextHour
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const newAlarm = createAlarm({
      time,
      isActive: false,
      label: 'New Alarm',
      playlistConfig: { ...defaultPlaylistConfig },
      voiceBriefingConfig: { ...defaultVoiceBriefingConfig },
    });
    onChange([...alarms, newAlarm]);
    setEditingId(newAlarm.id);
  };

  const remove = (id: string) => {
    onChange(alarms.filter((a) => a.id !== id));
    if (editingId === id) setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-2 pl-0 sm:pl-5">
      {alarms.map((alarm) => {
        const isEditing = editingId === alarm.id;
        return (
          <div
            key={alarm.id}
            className="bg-neutral-900/60 border border-white/5 rounded p-2 flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={`alarm-time-${alarm.id}`}
                className="sr-only"
              >
                Time
              </label>
              <input
                id={`alarm-time-${alarm.id}`}
                type="time"
                value={alarm.time}
                onChange={(e) => update(alarm.id, { time: e.target.value })}
                className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-digital text-yellow-500 focus:outline-none focus:border-radio-lit"
              />
              <label
                htmlFor={`alarm-label-${alarm.id}`}
                className="sr-only"
              >
                Label
              </label>
              <input
                id={`alarm-label-${alarm.id}`}
                type="text"
                value={alarm.label}
                onChange={(e) => update(alarm.id, { label: e.target.value })}
                placeholder="LABEL"
                className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-mono text-amber-300 placeholder-yellow-800/30 uppercase focus:outline-none focus:border-radio-lit flex-1 min-w-[80px]"
              />
              <label
                htmlFor={`alarm-genre-${alarm.id}`}
                className="sr-only"
              >
                Genre
              </label>
              <select
                id={`alarm-genre-${alarm.id}`}
                value={alarm.genrePreset}
                onChange={(e) =>
                  update(alarm.id, { genrePreset: e.target.value as MusicGenre })
                }
                className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-mono uppercase text-gray-300 focus:outline-none focus:border-radio-lit"
              >
                {MUSIC_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-[10px] font-mono text-gray-400 uppercase cursor-pointer">
                <input
                  type="checkbox"
                  checked={alarm.isActive}
                  onChange={(e) => update(alarm.id, { isActive: e.target.checked })}
                  className="w-3 h-3 accent-radio-lit"
                />
                On
              </label>
              <button
                type="button"
                onClick={() => setEditingId(isEditing ? null : alarm.id)}
                aria-expanded={isEditing}
                aria-controls={`alarm-settings-${alarm.id}`}
                className="text-[10px] font-mono text-gray-400 hover:text-radio-lit uppercase"
              >
                {isEditing ? 'Done' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => remove(alarm.id)}
                aria-label="Delete alarm"
                className="p-1 hover:bg-neutral-800 rounded text-gray-600 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(alarm.id, day)}
                  className={`w-6 h-6 rounded text-[9px] font-mono uppercase transition-colors ${
                    alarm.days.includes(day)
                      ? 'bg-radio-lit text-black'
                      : 'bg-neutral-850 text-gray-500 hover:text-gray-300'
                  }`}
                  aria-pressed={alarm.days.includes(day)}
                  aria-label={day}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>

            {isEditing && (
              <div
                id={`alarm-settings-${alarm.id}`}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-white/5 pt-2 mt-1"
              >
                <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alarm.playlistConfig.enabled}
                    onChange={(e) =>
                      update(alarm.id, {
                        playlistConfig: { ...alarm.playlistConfig, enabled: e.target.checked },
                      })
                    }
                    className="w-3 h-3 accent-radio-lit"
                  />
                  Playlist
                </label>
                {alarm.playlistConfig.enabled && (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5 flex-1">
                      <label className="text-[8px] font-mono text-gray-500 uppercase">
                        Tracks ({alarm.playlistConfig.trackCount})
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={alarm.playlistConfig.trackCount}
                        onChange={(e) =>
                          update(alarm.id, {
                            playlistConfig: {
                              ...alarm.playlistConfig,
                              trackCount: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-radio-lit"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alarm.playlistConfig.shuffle}
                        onChange={(e) =>
                          update(alarm.id, {
                            playlistConfig: { ...alarm.playlistConfig, shuffle: e.target.checked },
                          })
                        }
                        className="w-3 h-3 accent-radio-lit"
                      />
                      Shuffle
                    </label>
                  </div>
                )}
                <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alarm.voiceBriefingConfig.enabled}
                    onChange={(e) =>
                      update(alarm.id, {
                        voiceBriefingConfig: {
                          ...alarm.voiceBriefingConfig,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="w-3 h-3 accent-radio-lit"
                  />
                  Voice Briefing
                </label>
                {alarm.voiceBriefingConfig.enabled && (
                  <>
                    <label
                      htmlFor={`alarm-voice-${alarm.id}`}
                      className="sr-only"
                    >
                      Voice
                    </label>
                    <select
                      id={`alarm-voice-${alarm.id}`}
                      value={alarm.voiceBriefingConfig.voiceName}
                      onChange={(e) =>
                        update(alarm.id, {
                          voiceBriefingConfig: {
                            ...alarm.voiceBriefingConfig,
                            voiceName: e.target.value as VoiceBriefingConfig['voiceName'],
                          },
                        })
                      }
                      className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-mono uppercase text-gray-300 focus:outline-none focus:border-radio-lit"
                    >
                      {VOICE_NAMES.map((voiceName) => (
                        <option key={voiceName} value={voiceName}>
                          {voiceName}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alarm.voiceBriefingConfig.includeWeather}
                        onChange={(e) =>
                          update(alarm.id, {
                            voiceBriefingConfig: {
                              ...alarm.voiceBriefingConfig,
                              includeWeather: e.target.checked,
                            },
                          })
                        }
                        className="w-3 h-3 accent-radio-lit"
                      />
                      Weather
                    </label>
                    <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alarm.voiceBriefingConfig.includeAgenda}
                        onChange={(e) =>
                          update(alarm.id, {
                            voiceBriefingConfig: {
                              ...alarm.voiceBriefingConfig,
                              includeAgenda: e.target.checked,
                            },
                          })
                        }
                        className="w-3 h-3 accent-radio-lit"
                      />
                      Agenda
                    </label>
                    <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alarm.voiceBriefingConfig.includeTime}
                        onChange={(e) =>
                          update(alarm.id, {
                            voiceBriefingConfig: {
                              ...alarm.voiceBriefingConfig,
                              includeTime: e.target.checked,
                            },
                          })
                        }
                        className="w-3 h-3 accent-radio-lit"
                      />
                      Time
                    </label>
                    <label
                      htmlFor={`alarm-greeting-${alarm.id}`}
                      className="sr-only"
                    >
                      Custom greeting
                    </label>
                    <input
                      id={`alarm-greeting-${alarm.id}`}
                      type="text"
                      placeholder="CUSTOM GREETING..."
                      value={alarm.voiceBriefingConfig.customGreeting}
                      onChange={(e) =>
                        update(alarm.id, {
                          voiceBriefingConfig: {
                            ...alarm.voiceBriefingConfig,
                            customGreeting: e.target.value,
                          },
                        })
                      }
                      className="bg-neutral-850 border border-white/5 rounded px-2 py-1 text-xs font-mono text-amber-300 placeholder-yellow-800/20 focus:outline-none focus:border-radio-lit"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white border border-white/5 font-mono text-[10px] font-bold rounded uppercase transition-colors py-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Add Alarm
      </button>
    </div>
  );
};

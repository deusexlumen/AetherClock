import { TEXT_MODELS } from './services/aiModels';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { canRetryYouTubeVideo, describeYouTubeError } from './services/youtube';
import { AppState, CalendarItem, MusicGenre, PlaylistConfig, VoiceBriefingConfig, LLMConfig, PlaylistTrack } from './types';
import { fetchWeather } from './services/weather';
import {
  registerServiceWorker,
  requestNotificationPermission,
  sendAlarmNotification,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingPushSubscription,
  notifyServiceWorkerDeviceId,
  isOnline,
  isStandalone,
  captureInstallPrompt,
} from './services/pwa';
import { fetchVapidPublicKey, syncDevice, syncAlarms, unsubscribeDevice } from './services/pushBackend';
import { getApiKey, setApiKey, hasApiKey } from './services/apiKey';
import { PushSubscriptionJSON } from './types';
import { playOfflineFallback, stopOfflineFallback } from './services/offlineAudio';
import { buildMusicContext, calendarToAlarms, formatCalendarToAgenda, loadCalendar, saveCalendar } from './services/calendar';
import { generateMusicalPrompt } from './services/genai';
import { generateVoiceBriefing } from './services/voiceBriefing';
import { TTSPlayer } from './services/ttsPlayer';
import { generatePlaylist, getNextTrackIndex, getRecoveryTrack, buildEmbedUrl } from './services/playlist';
import { loadAlarms, saveAlarms, getPreAlarmTime, getCurrentWeekDay } from './services/alarm';
import './styles/neo-retro.css';
import { AetherClockInterface } from './components/neo-retro/AetherClockInterface';
import type { AppView } from './components/neo-retro/NeoRetroTypes';
import { getThemeDefinition } from './components/themes/registry';
import { getCircadianSnapshot, loadVisualSettings, resolveTheme, saveVisualSettings } from './services/visualSettings';
import { getNextAlarmOccurrence } from './services/nextAlarm';
import type { ThemeId, VisualSettings } from './types';

// One-time migration of legacy Lyria localStorage keys to AetherClock keys.
// Runs at module load so state initializers read the migrated values.
(() => {
  const legacyKeys = [
    'lyria_theme',
    'lyria_volume',
    'lyria_loudness',
    'lyria_blacklist',
    'lyria_prewarm',
    'lyria_voice_briefing',
    'lyria_playlist',
    'lyria_llm',
    'lyria_notifications',
    'lyria_offline_fallback',
    'lyria_screensaver_timeout',
    'lyria_alarm_time',
    'lyria_alarm_active',
  ];
  for (const oldKey of legacyKeys) {
    try {
      const value = localStorage.getItem(oldKey);
      if (value !== null) {
        const newKey = oldKey.replace('lyria_', 'aetherclock_');
        if (localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, value);
        }
        localStorage.removeItem(oldKey);
      }
    } catch (e) {
      // Ignore storage errors (e.g., private mode)
    }
  }
})();

const App: React.FC = () => {
  const getDeviceId = (): string => {
    let id = localStorage.getItem('aetherclock_device_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('aetherclock_device_id', id);
    }
    return id;
  };

  const [state, setState] = useState<AppState>(() => {
    const calendar = loadCalendar();
    return {
      alarms: (() => { try { return localStorage.getItem('aetherclock_alarms') || localStorage.getItem('aetherclock_alarm_time') ? loadAlarms() : []; } catch { return []; } })(),
      currentAlarmId: null,
      generatedForAlarmId: null,
      agenda: formatCalendarToAgenda(calendar),
      calendar,
      genrePreset: 'auto',
      searchedTrack: null,
      location: null,
      weather: null,
      status: 'idle',
      errorMessage: null,
      youtubeEmbedUrl: null,
      logs: [],
      playlist: [],
      currentTrackIndex: 0,
      briefingAudioSrc: null
    };
  });

  // Settings and Customize State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [visualSettings, setVisualSettings] = useState<VisualSettings>(() => loadVisualSettings());
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(visualSettings.themeId);
  const [themePreviewOverride, setThemePreviewOverride] = useState<ThemeId | null>(null);
  const [activeView, setActiveView] = useState<AppView>('now');
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('aetherclock_volume');
    const parsed = saved !== null ? parseInt(saved, 10) : 75;
    return Number.isNaN(parsed) ? 75 : Math.max(0, Math.min(100, parsed));
  });
  const [loudnessMode, setLoudnessMode] = useState<'standard' | 'sunrise_progressive' | 'max_impact'>(() => {
    return (localStorage.getItem('aetherclock_loudness') as any) || 'standard';
  });
  const [blacklist, setBlacklist] = useState<string>(() => {
    return localStorage.getItem('aetherclock_blacklist') || '';
  });
  const [isPreWarmEnabled, setIsPreWarmEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('aetherclock_prewarm');
    return saved !== null ? saved === 'true' : true;
  });
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [localFallbackActive, setLocalFallbackActive] = useState(false);
  const [playerAttempt, setPlayerAttempt] = useState(0);
  const [videoStatus, setVideoStatus] = useState('Loading YouTube');

  const [voiceBriefingConfig, setVoiceBriefingConfig] = useState<VoiceBriefingConfig>(() => {
    try {
      const saved = localStorage.getItem('aetherclock_voice_briefing');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      enabled: true,
      voiceName: 'Fenrir',
      includeWeather: true,
      includeAgenda: true,
      includeTime: true,
      customGreeting: ''
    };
  });

  const [playlistConfig, setPlaylistConfig] = useState<PlaylistConfig>(() => {
    try {
      const saved = localStorage.getItem('aetherclock_playlist');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      enabled: true,
      trackCount: 3,
      shuffle: false,
      crossfadeSeconds: 0
    };
  });

  const [llmConfig, setLLMConfig] = useState<LLMConfig>(() => {
    try {
      const saved = localStorage.getItem('aetherclock_llm');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, ttsModel: !parsed.ttsModel || parsed.ttsModel === 'gemini-3.1-flash-tts-preview' ? 'gemini-3.8-flash-tts' : parsed.ttsModel };
      }
    } catch {}
    return {
      textModel: TEXT_MODELS[0],
      ttsModel: 'gemini-3.8-flash-tts'
    };
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('aetherclock_notifications') === 'true';
  });
  const [offlineFallbackEnabled, setOfflineFallbackEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('aetherclock_offline_fallback');
    return saved !== null ? saved === 'true' : true;
  });
  const [isOnlineStatus, setIsOnlineStatus] = useState<boolean>(true);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [isScreenSaverActive, setIsScreenSaverActive] = useState<boolean>(false);
  const [screenSaverTimeout, setScreenSaverTimeout] = useState<number>(() => {
    const saved = localStorage.getItem('aetherclock_screensaver_timeout');
    const parsed = saved !== null ? parseInt(saved, 10) : 30;
    return Number.isNaN(parsed) ? 30 : Math.max(5, parsed);
  });
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => getApiKey() ?? '');
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const reducedMotion = visualSettings.reducedMotion === 'reduced' || (visualSettings.reducedMotion === 'system' && systemReducedMotion);

  const screenSaverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetScreenSaverTimerRef = useRef<() => void>(() => {});

  const effectiveAlarms = useMemo(() => [
    ...calendarToAlarms(state.calendar, state.genrePreset, playlistConfig, voiceBriefingConfig),
    ...state.alarms,
  ], [state.calendar, state.genrePreset, playlistConfig, voiceBriefingConfig, state.alarms]);
  const [calendarStorageError, setCalendarStorageError] = useState(false);
  useEffect(() => { setCalendarStorageError(!saveCalendar(state.calendar)); }, [state.calendar]);
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClockNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  const localClockTime = clockNow.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const nextMusicContext = buildMusicContext(state.calendar, localClockTime);
  const isAnyAlarmActive = useMemo(() => effectiveAlarms.some((a) => a.isActive), [effectiveAlarms]);
  const currentAlarm = useMemo(
    () => effectiveAlarms.find((a) => a.id === state.currentAlarmId) ?? null,
    [effectiveAlarms, state.currentAlarmId]
  );
  const nextAlarm = useMemo(() => getNextAlarmOccurrence(effectiveAlarms, clockNow), [effectiveAlarms, clockNow]);
  useEffect(() => {
    setThemePreviewOverride(null);
  }, [state.currentAlarmId]);
  const resolvedThemeId = themePreviewOverride ?? resolveTheme({
    globalThemeId: currentTheme,
    alarmThemeId: currentAlarm?.themeId,
    randomMode: visualSettings.randomMode,
    now: clockNow,
    alarmId: currentAlarm ? `${currentAlarm.id}:${clockNow.getFullYear()}-${clockNow.getMonth()}-${clockNow.getDate()}` : undefined,
  });
  const activeTheme = getThemeDefinition(resolvedThemeId);
  const circadian = getCircadianSnapshot(clockNow, state.weather?.isDay);

  // Screen saver logic
  const resetScreenSaverTimer = () => {
    if (screenSaverTimerRef.current) {
      clearTimeout(screenSaverTimerRef.current);
    }
    if (isScreenSaverActive) {
      setIsScreenSaverActive(false);
    }
    screenSaverTimerRef.current = setTimeout(() => {
      if (state.status === 'idle' || state.status === 'ready') {
        setIsScreenSaverActive(true);
      }
    }, screenSaverTimeout * 1000);
  };
  resetScreenSaverTimerRef.current = resetScreenSaverTimer;

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetScreenSaverTimerRef.current();
    events.forEach(e => window.addEventListener(e, handler));
    handler();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (screenSaverTimerRef.current) clearTimeout(screenSaverTimerRef.current);
    };
  }, []);

  // Persist alarms whenever they change
  useEffect(() => {
    saveAlarms(state.alarms);
  }, [state.alarms]);

  // Sync alarms to the push backend whenever they change and a subscription exists
  useEffect(() => {
    if (!isOnline() || !pushSubscriptionRef.current) return;
    syncAlarms(deviceIdRef.current, effectiveAlarms).catch((err) =>
      console.error('[Push] alarm sync failed', err)
    );
  }, [effectiveAlarms]);

  // TTS Player instance
  const ttsPlayerRef = useRef(new TTSPlayer());

  // YouTube IFrame Player
  const youtubePlayerRef = useRef<any>(null);

  // Refs for stable alarm-check callbacks (initialized with dummies to avoid TDZ)
  const handleGenerateAndPlayRef = useRef<any>(() => {});
  const startPlaybackSequenceRef = useRef<any>(() => {});
  const handleNextTrackRef = useRef<any>(() => {});
  const generationEpochRef = useRef<number>(0);
  const pendingTaskAlarmRef = useRef<string | null>(null);
  const failedVideoIdsRef = useRef(new Set<string>());
  const lastMinuteRef = useRef<string>('');
  const triggeredRef = useRef<Set<string>>(new Set());
  const prewarmedRef = useRef<Set<string>>(new Set());
  const deviceIdRef = useRef<string>(getDeviceId());
  const pushSubscriptionRef = useRef<PushSubscriptionJSON | null>(null);

  // Stations configuration
  const getStationName = (genre: MusicGenre): string => {
    switch (genre) {
      case 'auto': return 'AUTO-TUNE RECEIVER';
      case 'synthwave': return 'NEON SYNTHWAVE';
      case 'acoustic': return 'ACOUSTIC HORIZON';
      case 'lofi': return 'LO-FI COFFEEBEATS';
      case 'rock': return 'ROCK HYPERENERGY';
      case 'classical': return 'CLASSICAL DAWN';
      case 'jazz': return 'MIDNIGHT JAZZ';
      case 'pop': return 'POP FREQUENCY';
      case 'ambient': return 'AMBIENT SPACE';
      case 'hiphop': return 'URBAN BEATS';
    }
  };

  const getStationFreq = (genre: MusicGenre): string => {
    switch (genre) {
      case 'auto': return '98.1';
      case 'synthwave': return '106.8';
      case 'acoustic': return '94.2';
      case 'lofi': return '102.4';
      case 'rock': return '88.5';
      case 'classical': return '107.9';
      case 'jazz': return '90.3';
      case 'pop': return '101.1';
      case 'ambient': return '89.7';
      case 'hiphop': return '96.5';
    }
  };

  const enablePushNotifications = async (): Promise<boolean> => {
    let granted = false;
    try {
      granted = await requestNotificationPermission();
    } catch (err) {
      console.error('[Push] permission request failed', err);
    }
    if (!granted) {
      setNotificationsEnabled(false);
      localStorage.setItem('aetherclock_notifications', 'false');
      return false;
    }
    try {
      const publicKey = await fetchVapidPublicKey();
      const subscription = await subscribeToPush(publicKey);
      if (!subscription) {
        setNotificationsEnabled(false);
        localStorage.setItem('aetherclock_notifications', 'false');
        return false;
      }
      pushSubscriptionRef.current = subscription.toJSON() as unknown as PushSubscriptionJSON;
      await syncDevice(deviceIdRef.current, effectiveAlarms, pushSubscriptionRef.current);
      notifyServiceWorkerDeviceId(deviceIdRef.current);
      setNotificationsEnabled(true);
      localStorage.setItem('aetherclock_notifications', 'true');
      return true;
    } catch (err) {
      console.error('[Push] subscription failed', err);
      setNotificationsEnabled(false);
      localStorage.setItem('aetherclock_notifications', 'false');
      return false;
    }
  };

  // Initialize GPS coords & weather
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setState(prev => ({ ...prev, location: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}` })); 
          const weather = await fetchWeather(latitude, longitude);
          setState(prev => ({ ...prev, weather }));
        },
        () => setState(prev => ({ ...prev, location: "Not Found" }))
      );
    }
  }, []);

  // PWA: Register service worker and listen for install prompt
  useEffect(() => {
    registerServiceWorker();
    setIsAppInstalled(isStandalone());

    const handleInstallPrompt = (e: Event) => {
      captureInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  // Restore existing push subscription on reload and tell the SW our device id
  useEffect(() => {
    getExistingPushSubscription()
      .then((subscription) => {
        if (!subscription) return;
        pushSubscriptionRef.current = subscription.toJSON() as unknown as PushSubscriptionJSON;
        notifyServiceWorkerDeviceId(deviceIdRef.current);
        syncDevice(deviceIdRef.current, effectiveAlarms, pushSubscriptionRef.current).catch((err) =>
          console.error('[Push] restore subscription sync failed', err)
        );
      })
      .catch((err) => console.error('[Push] restore subscription failed', err));
  }, []);

  // Tell a newly activated service worker our device id (e.g. after an update)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = () => notifyServiceWorkerDeviceId(deviceIdRef.current);
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler);
  }, []);

  // Online/Offline status + resync alarms when connectivity returns
  useEffect(() => {
    const updateOnline = () => setIsOnlineStatus(isOnline());
    const handleOnline = () => {
      updateOnline();
      if (pushSubscriptionRef.current) {
        syncAlarms(deviceIdRef.current, effectiveAlarms).catch((err) =>
          console.error('[Push] online resync failed', err)
        );
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', updateOnline);
    setIsOnlineStatus(isOnline());
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, [effectiveAlarms]);

  // Set YouTube player volume on change
  useEffect(() => {
    if (youtubePlayerRef.current && typeof youtubePlayerRef.current.setVolume === 'function' && loudnessMode !== 'sunrise_progressive') {
      youtubePlayerRef.current.setVolume(volume);
    }
  }, [volume, loudnessMode, state.status]);

  // Progressive sunrise-progressive volume ramp-up handler
  useEffect(() => {
    if (state.status === 'playing' && loudnessMode === 'sunrise_progressive') {
      let currentVol = Math.min(10, volume);
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.setVolume === 'function') {
        youtubePlayerRef.current.setVolume(currentVol);
      }
      
      const interval = setInterval(() => {
        currentVol += 10;
        if (currentVol >= volume) {
          currentVol = volume;
          clearInterval(interval);
        }
        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.setVolume === 'function') {
          youtubePlayerRef.current.setVolume(currentVol);
        }
      }, 3000); // progressive raise every 3 seconds
      return () => clearInterval(interval);
    }
  }, [state.status, loudnessMode, volume]);

  // Max Impact Shock Alarm: Sofort 100% Lautstaerke
  useEffect(() => {
    if (state.status === 'playing' && loudnessMode === 'max_impact') {
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.setVolume === 'function') {
        youtubePlayerRef.current.setVolume(100);
      }
    }
  }, [state.status, loudnessMode]);

  // Apply theme tokens and keep visual preferences backward-compatible.
  useEffect(() => {
    const cols = activeTheme.colors;
    document.documentElement.style.setProperty('--body-bg', cols.bodyBg);
    document.documentElement.style.setProperty('--body-text', cols.bodyText);
    document.documentElement.style.setProperty('--body-bg-gradient', cols.bodyBgGradient);
    document.documentElement.style.setProperty('--led-shadow', cols.ledShadow);
    document.documentElement.style.setProperty('--radio-case', cols.case);
    document.documentElement.style.setProperty('--radio-face', cols.face);
    document.documentElement.style.setProperty('--radio-dim', cols.dim);
    document.documentElement.style.setProperty('--radio-lit', cols.lit);
    document.documentElement.style.setProperty('--radio-glow', cols.glow);
    document.documentElement.style.setProperty('--radio-btn', cols.btn);
    document.documentElement.dataset.aetherTheme = resolvedThemeId;
  }, [activeTheme, resolvedThemeId]);

  useEffect(() => {
    saveVisualSettings(visualSettings);
  }, [visualSettings]);

  // Alarm Check trigger loop
  useEffect(() => {
    const checkAlarm = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      const minuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}:${currentTime}`;
      const currentDayKey = getCurrentWeekDay(now);

      // Minute rollover: clear per-minute dedup sets so alarms can fire again in future minutes.
      if (lastMinuteRef.current !== minuteKey) {
        lastMinuteRef.current = minuteKey;
        triggeredRef.current.clear();
        prewarmedRef.current.clear();
      }

      for (const alarm of effectiveAlarms) {
        if (!alarm.isActive) continue;
        if (alarm.days.length > 0 && !alarm.days.includes(currentDayKey)) continue;

        const prewarmKey = `${alarm.id}:${minuteKey}`;
        const triggerKey = `${alarm.id}:${minuteKey}`;
        const preAlarmTime = getPreAlarmTime(alarm.time);

        if (
          isPreWarmEnabled &&
          currentTime === preAlarmTime &&
          state.status === 'idle' &&
          !prewarmedRef.current.has(prewarmKey)
        ) {
          prewarmedRef.current.add(prewarmKey);
          handleGenerateAndPlayRef.current(alarm.id, true);
          return;
        }

        if (currentTime === alarm.time && !triggeredRef.current.has(triggerKey)) {
          // A speaker can play one broadcast at a time. Simultaneous tasks share
          // one broadcast; all their context is supplied to the curator.
          for (const due of effectiveAlarms) {
            if (due.isActive && due.time === currentTime && (due.days.length === 0 || due.days.includes(currentDayKey))) {
              triggeredRef.current.add(`${due.id}:${minuteKey}`);
            }
          }
          setState((prev) => ({ ...prev, currentAlarmId: alarm.id }));

          if (!isOnlineStatus && offlineFallbackEnabled) {
            generationEpochRef.current++;
            ttsPlayerRef.current.stop();
            youtubePlayerRef.current?.stopVideo?.();
            setPlaybackError(null);
            setIsAutoplayBlocked(false);
            setLocalFallbackActive(true);
            setState((prev) => ({ ...prev, status: 'playing' }));
            playOfflineFallback();
            if (notificationsEnabled) {
              sendAlarmNotification('AetherClock Alarm', `Wake up! ${alarm.label}`);
            }
            return;
          }

          if (state.currentAlarmId === alarm.id && ['generating_prompt', 'generating_briefing'].includes(state.status)) {
            pendingTaskAlarmRef.current = alarm.id;
            return;
          }

          if (state.status === 'ready') {
            if (state.generatedForAlarmId === alarm.id) {
              if (notificationsEnabled) {
                sendAlarmNotification('AetherClock', 'Your personalized broadcast is starting.');
              }
              startPlaybackSequenceRef.current(state.briefingAudioSrc, state.playlist, alarm.voiceBriefingConfig);
            } else {
              if (notificationsEnabled) {
                sendAlarmNotification('AetherClock', 'Generating your broadcast now...');
              }
              handleGenerateAndPlayRef.current(alarm.id, false);
            }
          } else if (state.status === 'idle') {
            if (notificationsEnabled) {
              sendAlarmNotification('AetherClock', 'Generating your broadcast now...');
            }
            handleGenerateAndPlayRef.current(alarm.id, false);
          } else {
            // Interrupt any active playback for the new alarm.
            ttsPlayerRef.current.stop();
            stopOfflineFallback();
            if (youtubePlayerRef.current && typeof youtubePlayerRef.current.stopVideo === 'function') {
              youtubePlayerRef.current.stopVideo();
            }
            setState((prev) => ({ ...prev, status: 'idle' }));
            handleGenerateAndPlayRef.current(alarm.id, false);
          }
          // Only the first matching alarm per minute is triggered.
          return;
        }
      }
    };

    const interval = setInterval(checkAlarm, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAlarms, state.status, state.currentAlarmId, state.generatedForAlarmId, state.briefingAudioSrc, state.playlist, isPreWarmEnabled, isOnlineStatus, offlineFallbackEnabled, notificationsEnabled]);

  // Sync inputs
  const syncCalendarToAgenda = (newCalendar: CalendarItem[]) => {
    prewarmedRef.current.clear();
    const currentTask = currentAlarm?.calendarItemId;
    const stopCurrent = !!currentTask && !newCalendar.some(item => item.id === currentTask && item.active);
    const cancelPreparation = ['ready', 'generating_prompt', 'generating_briefing'].includes(state.status);
    if (stopCurrent || cancelPreparation) {
      pendingTaskAlarmRef.current = null;
      generationEpochRef.current++;
      ttsPlayerRef.current.stop();
      stopOfflineFallback();
      youtubePlayerRef.current?.stopVideo?.();
      setLocalFallbackActive(false);
      setPlaybackError(null);
      setPlaybackNotice(null);
      setIsAutoplayBlocked(false);
    }
    const formatted = formatCalendarToAgenda(newCalendar);
    setState(prev => ({
      ...prev,
      calendar: newCalendar,
      agenda: formatted,
      ...(stopCurrent || cancelPreparation ? { status: 'idle' as const, currentAlarmId: null, generatedForAlarmId: null } : {}),
    }));
  };

  // Generate Playlist and/or Briefing
  const handleGenerateAndPlay = async (alarmId?: string, preGenerateOnly: boolean = false) => {
    pendingTaskAlarmRef.current = null;
    setPlaybackError(null);
    setPlaybackNotice(null);
    setLocalFallbackActive(false);
    failedVideoIdsRef.current.clear();
    ttsPlayerRef.current.stop();
    stopOfflineFallback();
    generationEpochRef.current += 1;
    const epoch = generationEpochRef.current;

    const alarm = alarmId ? effectiveAlarms.find((a) => a.id === alarmId) : undefined;
    if (alarmId && !alarm) {
      setState((prev) => ({ ...prev, status: 'idle', currentAlarmId: null }));
      return;
    }

    const config = alarm
      ? {
          genrePreset: alarm.genrePreset,
          alarmTime: alarm.time,
          playlistConfig: alarm.playlistConfig,
          voiceBriefingConfig: alarm.voiceBriefingConfig,
        }
      : {
          genrePreset: state.genrePreset,
          alarmTime: localClockTime,
          playlistConfig,
          voiceBriefingConfig,
        };

    setState((prev) => ({
      ...prev,
      status: 'generating_prompt',
      searchedTrack: null,
      playlist: [],
      currentTrackIndex: 0,
      briefingAudioSrc: null,
      currentAlarmId: alarm?.id ?? null,
      generatedForAlarmId: null,
    }));

    try {
      const resultData = await generateMusicalPrompt(
        state.weather,
        state.location,
        state.calendar,
        new Date(),
        config.alarmTime,
        config.genrePreset,
        blacklist,
        llmConfig,
        alarm?.calendarItemId
      );
      if (epoch !== generationEpochRef.current) return;

      const fetchTrack = () => generateMusicalPrompt(
        state.weather, state.location, state.calendar, new Date(),
        config.alarmTime, config.genrePreset, blacklist, llmConfig, alarm?.calendarItemId,
      ).then(result => result.searchedSong);
      const playlist = await generatePlaylist(
        fetchTrack,
        config.playlistConfig.enabled ? config.playlistConfig.trackCount : 1,
        config.genrePreset,
        resultData.searchedSong,
      );
      if (epoch !== generationEpochRef.current) return;
      if (resultData.notice) setPlaybackNotice(resultData.notice);

      let briefingSrc: string | null = null;
      if (config.voiceBriefingConfig.enabled) {
        setState((prev) => ({ ...prev, status: 'generating_briefing' }));
        const briefing = await generateVoiceBriefing(
          state.weather,
          buildMusicContext(state.calendar, config.alarmTime, alarm?.calendarItemId).upcoming,
          config.alarmTime,
          config.voiceBriefingConfig,
          llmConfig
        );
        if (briefing.audioBase64) {
          briefingSrc = `data:${briefing.mimeType};base64,${briefing.audioBase64}`;
        }
        if (epoch !== generationEpochRef.current) return;
      }

      const embedUrl = playlist[0]?.embedUrl || null;

      if (epoch !== generationEpochRef.current) return;
      setState((prev) => ({
        ...prev,
        status: 'ready',
        searchedTrack: { ...resultData.searchedSong, ...playlist[0] },
        youtubeEmbedUrl: embedUrl,
        playlist,
        currentTrackIndex: 0,
        briefingAudioSrc: briefingSrc,
        generatedForAlarmId: alarm?.id ?? null,
      }));
      if (preGenerateOnly && pendingTaskAlarmRef.current !== alarm?.id) {
        return;
      }
      pendingTaskAlarmRef.current = null;
      startPlaybackSequenceRef.current(briefingSrc, playlist, config.voiceBriefingConfig);
    } catch (err: any) {
      if (epoch !== generationEpochRef.current) return;
      console.error(err);
      setState((prev) => ({ ...prev, status: 'error', errorMessage: err?.message || 'Generation failed' }));
    }
  };

  // Start actual playback sequence (briefing -> playlist track 0)
  const startPlaybackSequence = (
    initialBriefingSrc: string | null,
    initialPlaylist: PlaylistTrack[],
    briefingConfig: VoiceBriefingConfig
  ) => {
    if (initialBriefingSrc && briefingConfig.enabled) {
      setState((prev) => ({ ...prev, status: 'playing_briefing' }));
      ttsPlayerRef.current.play(initialBriefingSrc, 'audio/wav', () => {
        setState((prev) => ({
          ...prev,
          status: 'playing',
          currentTrackIndex: 0,
          youtubeEmbedUrl: initialPlaylist[0]?.embedUrl || null,
        }));
      });
    } else {
      setState((prev) => ({
        ...prev,
        status: 'playing',
        currentTrackIndex: 0,
        youtubeEmbedUrl: initialPlaylist[0]?.embedUrl || null,
      }));
    }
  };

  // Advance to next track in playlist
  const handleNextTrack = useCallback(() => {
    stopOfflineFallback();
    setLocalFallbackActive(false);
    failedVideoIdsRef.current.clear();
    setPlaybackError(null);
    setPlaybackNotice(null);
    if (state.playlist.length === 0) return;
    if (state.playlist.length === 1) {
      const videoId = state.playlist[0].youtubeVideoId;
      if (videoId && youtubePlayerRef.current?.loadVideoById) {
        youtubePlayerRef.current.loadVideoById(videoId);
      }
      return;
    }
    const shuffle = currentAlarm ? currentAlarm.playlistConfig.shuffle : playlistConfig.shuffle;
    const nextIndex = shuffle
      ? getNextTrackIndex(state.currentTrackIndex, state.playlist.length, true)
      : (state.currentTrackIndex + 1) % state.playlist.length;
    setState((prev) => ({
      ...prev,
      currentTrackIndex: nextIndex,
      youtubeEmbedUrl: prev.playlist[nextIndex].embedUrl || null,
    }));
  }, [state.playlist, state.currentTrackIndex, currentAlarm, playlistConfig.shuffle]);

  const handlePrevTrack = useCallback(() => {
    stopOfflineFallback();
    setLocalFallbackActive(false);
    failedVideoIdsRef.current.clear();
    setPlaybackError(null);
    setPlaybackNotice(null);
    if (state.playlist.length <= 1) return;
    const prevIndex = state.currentTrackIndex === 0 ? state.playlist.length - 1 : state.currentTrackIndex - 1;
    setState(prev => ({
      ...prev,
      currentTrackIndex: prevIndex,
      youtubeEmbedUrl: prev.playlist[prevIndex].embedUrl || null
    }));
  }, [state.playlist.length, state.currentTrackIndex]);

  // Sync refs after function definitions (avoids TDZ)
  handleGenerateAndPlayRef.current = handleGenerateAndPlay;
  startPlaybackSequenceRef.current = startPlaybackSequence;
  handleNextTrackRef.current = handleNextTrack;

  // Manage autoplay-blocked state for TTS briefing
  useEffect(() => {
    if (state.status === 'idle') {
      setIsAutoplayBlocked(false);
    }
  }, [state.status]);

  const handleYouTubeError = (code: number, message?: string) => {
    setIsAutoplayBlocked(false);
    const failedId = state.playlist[state.currentTrackIndex]?.youtubeVideoId;
    if (failedId) failedVideoIdsRef.current.add(failedId);
    const replacement = canRetryYouTubeVideo(code)
      ? getRecoveryTrack(failedVideoIdsRef.current)
      : null;
    if (replacement) {
      setPlaybackNotice(`The previous video could not be embedded. Trying ${replacement.title} by ${replacement.artist}.`);
      setState(prev => ({
        ...prev,
        playlist: prev.playlist.map((track, index) => index === prev.currentTrackIndex ? replacement : track),
        youtubeEmbedUrl: replacement.embedUrl || null,
      }));
      return;
    }
    youtubePlayerRef.current?.stopVideo?.();
    setPlaybackError(message || describeYouTubeError(code));
  };

  const handlePlayToggle = () => {
    if (state.status !== 'idle' && state.status !== 'error') {
      pendingTaskAlarmRef.current = null;
      generationEpochRef.current++;
      ttsPlayerRef.current.stop();
      stopOfflineFallback();
      youtubePlayerRef.current?.stopVideo?.();
      setPlaybackError(null);
      setPlaybackNotice(null);
      setLocalFallbackActive(false);
      setState(prev => ({ ...prev, status: 'idle', currentAlarmId: null }));
    } else {
      void handleGenerateAndPlay();
    }
  };

  const handleNotificationsChange = async (enabled: boolean) => {
    if (enabled) {
      await enablePushNotifications();
      return;
    }
    setNotificationsEnabled(false);
    localStorage.setItem('aetherclock_notifications', 'false');
    try {
      await unsubscribeFromPush();
      await unsubscribeDevice(deviceIdRef.current);
      pushSubscriptionRef.current = null;
    } catch (error) {
      console.error('[Push] unsubscribe failed', error);
    }
  };

  const handleGenreChange = (genrePreset: MusicGenre) => {
    setState(prev => ({ ...prev, genrePreset, searchedTrack: null, playlist: [], currentTrackIndex: 0 }));
  };

  const handleYouTubeSelection = (videoId: string) => {
    pendingTaskAlarmRef.current = null;
    generationEpochRef.current++;
    ttsPlayerRef.current.stop();
    stopOfflineFallback();
    failedVideoIdsRef.current.clear();
    setPlaybackError(null);
    setPlaybackNotice('Playing your YouTube selection. AI curation and voice briefing are skipped.');
    setIsAutoplayBlocked(false);
    setLocalFallbackActive(false);
    setPlayerAttempt(attempt => attempt + 1);
    const track = { title: 'Your YouTube selection', artist: 'YouTube', youtubeVideoId: videoId, embedUrl: buildEmbedUrl(videoId)!, whyExplanation: 'Selected directly by you.' };
    setState(prev => ({ ...prev, status: 'playing', playlist: [track], currentTrackIndex: 0,
      currentAlarmId: null, generatedForAlarmId: null, briefingAudioSrc: null, youtubeEmbedUrl: track.embedUrl,
      searchedTrack: { ...track, foundTheme: 'Your choice', styleDescription: 'Direct YouTube playback' } }));
  };

  const handleRetryYouTube = () => {
    setPlaybackError(null);
    setLocalFallbackActive(false);
    stopOfflineFallback();
    failedVideoIdsRef.current.clear();
    setPlayerAttempt(attempt => attempt + 1);
  };

  const handlePlayLocalAlarm = () => {
    ttsPlayerRef.current.stop();
    youtubePlayerRef.current?.stopVideo?.();
    setLocalFallbackActive(true);
    void playOfflineFallback();
  };

  const handleSelectTheme = (themeId: ThemeId) => {
    setThemePreviewOverride(themeId);
    setCurrentTheme(themeId);
    setVisualSettings(prev => ({ ...prev, themeId, randomMode: 'off' }));
  };

  return <AetherClockInterface
    state={state}
    effectiveAlarms={effectiveAlarms}
    now={clockNow}
    nextAlarm={nextAlarm}
    nextMusicContext={nextMusicContext}
    activeView={activeView}
    onViewChange={setActiveView}
    theme={activeTheme}
    globalThemeId={currentTheme}
    visualSettings={visualSettings}
    onVisualSettingsChange={setVisualSettings}
    onSelectTheme={handleSelectTheme}
    reducedMotion={reducedMotion}
    circadian={circadian}
    isSettingsOpen={isSettingsOpen}
    onSettingsOpenChange={setIsSettingsOpen}
    isAnyAlarmActive={isAnyAlarmActive}
    isOnlineStatus={isOnlineStatus}
    isScreenSaverActive={isScreenSaverActive}
    onScreenSaverWake={() => setIsScreenSaverActive(false)}
    volume={volume}
    onVolumeChange={value => { setVolume(value); localStorage.setItem('aetherclock_volume', String(value)); }}
    loudnessMode={loudnessMode}
    onLoudnessModeChange={value => { setLoudnessMode(value); localStorage.setItem('aetherclock_loudness', value); }}
    blacklist={blacklist}
    onBlacklistChange={value => { setBlacklist(value); localStorage.setItem('aetherclock_blacklist', value); }}
    isPreWarmEnabled={isPreWarmEnabled}
    onPreWarmChange={value => { setIsPreWarmEnabled(value); localStorage.setItem('aetherclock_prewarm', String(value)); }}
    voiceBriefingConfig={voiceBriefingConfig}
    onVoiceBriefingConfigChange={value => { setVoiceBriefingConfig(value); localStorage.setItem('aetherclock_voice_briefing', JSON.stringify(value)); }}
    playlistConfig={playlistConfig}
    onPlaylistConfigChange={value => { setPlaylistConfig(value); localStorage.setItem('aetherclock_playlist', JSON.stringify(value)); }}
    llmConfig={llmConfig}
    onLLMConfigChange={value => { setLLMConfig(value); localStorage.setItem('aetherclock_llm', JSON.stringify(value)); }}
    notificationsEnabled={notificationsEnabled}
    onNotificationsChange={value => { void handleNotificationsChange(value); }}
    offlineFallbackEnabled={offlineFallbackEnabled}
    onOfflineFallbackChange={value => { setOfflineFallbackEnabled(value); localStorage.setItem('aetherclock_offline_fallback', String(value)); }}
    screenSaverTimeout={screenSaverTimeout}
    onScreenSaverTimeoutChange={value => { setScreenSaverTimeout(value); localStorage.setItem('aetherclock_screensaver_timeout', String(value)); }}
    geminiApiKey={geminiApiKey}
    onGeminiApiKeyChange={value => { setGeminiApiKey(value); setApiKey(value); }}
    hasPersonalApiKey={hasApiKey()}
    onAlarmsChange={alarms => setState(prev => ({ ...prev, alarms }))}
    onCalendarChange={syncCalendarToAgenda}
    onPreviewTask={id => handleGenerateAndPlayRef.current(`task:${id}`)}
    onGenerateAndPlay={alarmId => { void handleGenerateAndPlay(alarmId); }}
    onPlayToggle={handlePlayToggle}
    onNextTrack={handleNextTrack}
    onPrevTrack={handlePrevTrack}
    onGenreChange={handleGenreChange}
    onYouTubePlay={handleYouTubeSelection}
    onYouTubeError={handleYouTubeError}
    onPlayer={player => { youtubePlayerRef.current = player; }}
    playerAttempt={playerAttempt}
    playbackError={playbackError}
    playbackNotice={playbackNotice}
    localFallbackActive={localFallbackActive}
    isAutoplayBlocked={isAutoplayBlocked}
    videoStatus={videoStatus}
    onVideoStatus={setVideoStatus}
    onPlaybackBlocked={() => setIsAutoplayBlocked(true)}
    onPlaybackPlaying={() => { setIsAutoplayBlocked(false); setPlaybackError(null); }}
    onRetryYouTube={handleRetryYouTube}
    onPlayLocalAlarm={handlePlayLocalAlarm}
    onUnlockAutoplay={() => { youtubePlayerRef.current?.playVideo?.(); setIsAutoplayBlocked(false); }}
    onDismissAutoplay={() => setIsAutoplayBlocked(false)}
    calendarStorageError={calendarStorageError}
    getStationName={getStationName}
    getStationFreq={getStationFreq}
  />;
};

export default App;

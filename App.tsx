import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Clock } from './components/Clock';
import { Visualizer } from './components/Visualizer';
import { PlaylistViewer } from './components/PlaylistViewer';
import { AppState, CalendarItem, MusicGenre, WEATHER_CODES, PlaylistConfig, VoiceBriefingConfig, LLMConfig, PlaylistTrack } from './types';
import { fetchWeather } from './services/weather';
import {
  registerServiceWorker,
  requestNotificationPermission,
  sendAlarmNotification,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingPushSubscription,
  isOnline,
  isStandalone,
  captureInstallPrompt,
} from './services/pwa';
import { fetchVapidPublicKey, syncDevice, syncAlarms, unsubscribeDevice } from './services/pushBackend';
import { PushSubscriptionJSON } from './types';
import { playOfflineFallback, stopOfflineFallback } from './services/offlineAudio';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { AlarmList } from './components/AlarmList';
import { generateMusicalPrompt } from './services/genai';
import { generateVoiceBriefing } from './services/voiceBriefing';
import { TTSPlayer } from './services/ttsPlayer';
import { generatePlaylist, getNextTrackIndex, buildEmbedUrl, buildNcsChannelEmbedUrl } from './services/playlist';
import { loadAlarms, saveAlarms, getNextAlarm, getAlarmStatusText, getPreAlarmTime, getCurrentWeekDay } from './services/alarm';
import { BabylonCanvas } from './components/themes/BabylonCanvas';
import { 
  Power, 
  Play, 
  Loader2, 
  MapPin, 
  Calendar, 
  Radio, 
  Plus, 
  Trash2, 
  Sparkles, 
  Clock as ClockIcon, 
  Compass, 
  CheckCircle,
  HelpCircle,
  Sliders,
  Settings,
  Volume2,
  EyeOff,
  ExternalLink,
  SkipForward,
  SkipBack,
  ListMusic,
  Mic,
  Download,
  WifiOff,
  Bell
} from 'lucide-react';

// Help helper to parse manual agenda lists to structured calendar objects
export const parseAgendaToCalendar = (agenda: string): CalendarItem[] => {
  const lines = agenda.split('\n').filter(l => l.trim().length > 0);
  return lines.map((line, idx) => {
    const cleanedLine = line.trim();
    // try to match time patterns like 0800, 08:00, 8:00 or 8am/8pm
    const timeMatch = cleanedLine.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?/i) || cleanedLine.match(/^(\d{4})/);
    let time = "09:00";
    let title = cleanedLine;
    
    if (timeMatch) {
      if (timeMatch[1] && timeMatch[2]) {
        // e.g. "08:00"
        time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        title = cleanedLine.substring(timeMatch[0].length).trim();
      } else if (timeMatch[0].length === 4 && !isNaN(Number(timeMatch[0]))) {
        // e.g. "0800"
        time = `${timeMatch[0].substring(0, 2)}:${timeMatch[0].substring(2, 4)}`;
        title = cleanedLine.substring(4).trim();
      } else if (timeMatch[1] && !timeMatch[2]) {
        // e.g. "8 am"
        let hr = parseInt(timeMatch[1]);
        if (timeMatch[3]?.toLowerCase() === 'pm' && hr < 12) hr += 12;
        if (timeMatch[3]?.toLowerCase() === 'am' && hr === 12) hr = 0;
        time = `${hr.toString().padStart(2, '0')}:00`;
        title = cleanedLine.substring(timeMatch[0].length).trim();
      }
    }
    
    // Clean leading syntax characters like dash or bullet
    title = title.replace(/^[-*•\s]+/, '');

    // Guess category vibe based on terms
    let vibe = "general";
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("meeting") || lowerTitle.includes("call") || lowerTitle.includes("work") || lowerTitle.includes("team") || lowerTitle.includes("office") || lowerTitle.includes("project")) {
      vibe = "work";
    } else if (lowerTitle.includes("lunch") || lowerTitle.includes("dinner") || lowerTitle.includes("coffee") || lowerTitle.includes("meet") || lowerTitle.includes("eat") || lowerTitle.includes("restaurant")) {
      vibe = "social";
    } else if (lowerTitle.includes("gym") || lowerTitle.includes("run") || lowerTitle.includes("workout") || lowerTitle.includes("sport") || lowerTitle.includes("training") || lowerTitle.includes("fitness") || lowerTitle.includes("exercise")) {
      vibe = "fitness";
    } else if (lowerTitle.includes("nursery") || lowerTitle.includes("pickup") || lowerTitle.includes("family") || lowerTitle.includes("kid") || lowerTitle.includes("son") || lowerTitle.includes("daughter") || lowerTitle.includes("child")) {
      vibe = "family";
    } else if (lowerTitle.includes("sleep") || lowerTitle.includes("relax") || lowerTitle.includes("bed") || lowerTitle.includes("reading") || lowerTitle.includes("yoga")) {
      vibe = "chill";
    }

    return {
      id: `item-${idx}-${time.replace(':', '')}-${title.slice(0, 12).replace(/\W/g, '')}`,
      time,
      title: title || "Scheduled Event",
      vibe,
      active: true
    };
  });
};

export const formatCalendarToAgenda = (calendar: CalendarItem[]): string => {
  return calendar
    .filter(item => item.active)
    .map(item => `${item.time.replace(':', '')} ${item.title}`)
    .join('\n');
};

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

const THEMES = {
  obsidian: {
    name: "Obsidian Cyberpunk",
    case: "#151515",
    face: "#080808",
    dim: "#2a1212",
    lit: "#ff3333",
    glow: "rgba(255, 51, 51, 0.6)",
    btn: "#222222",
    bodyBg: "#121212",
    bodyText: "#e5e5e5",
    bodyBgGradient: "radial-gradient(circle at 50% 50%, #1a1a1a 0%, #000000 100%)",
    ledShadow: "0 0 10px rgba(255, 51, 51, 0.7)"
  },
  amber: {
    name: "Sandalwood Amber",
    case: "#3c2214",
    face: "#0c0603",
    dim: "#3a2000",
    lit: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.6)",
    btn: "#2b1b12",
    bodyBg: "#1b120c",
    bodyText: "#fcd34d",
    bodyBgGradient: "radial-gradient(circle at 50% 50%, #291a10 0%, #0f0a06 100%)",
    ledShadow: "0 0 10px rgba(245, 158, 11, 0.7)"
  },
  cobalt: {
    name: "Futuristic Cobalt",
    case: "#0f172a",
    face: "#05070f",
    dim: "#0c2030",
    lit: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.6)",
    btn: "#1e293b",
    bodyBg: "#090d16",
    bodyText: "#cbd5e1",
    bodyBgGradient: "radial-gradient(circle at 50% 50%, #111827 0%, #030712 100%)",
    ledShadow: "0 0 10px rgba(56, 189, 248, 0.7)"
  },
  ivory: {
    name: "Ivory Coast Emerald (Light)",
    case: "#f8fafc",
    face: "#f1f5f9",
    dim: "#cbd5e1",
    lit: "#10b981",
    glow: "rgba(16, 185, 129, 0.6)",
    btn: "#e2e8f0",
    bodyBg: "#e2e8f0",
    bodyText: "#0f172a",
    bodyBgGradient: "radial-gradient(circle at 50% 50%, #f1f5f9 0%, #cbd5e1 100%)",
    ledShadow: "0 0 8px rgba(16, 185, 129, 0.5)"
  },
  vaporwave: {
    name: "Premium Vaporwave Cyber-Luxe 🌴",
    case: "#2d0b3d",
    face: "#0d001a",
    dim: "#5c0066",
    lit: "#ff00cc",
    glow: "rgba(255, 0, 204, 0.9)",
    btn: "#4a154b",
    bodyBg: "#090013",
    bodyText: "#ff99ff",
    bodyBgGradient: "radial-gradient(circle at 50% 40%, #200435 0%, #030006 100%)",
    ledShadow: "0 0 16px rgba(255, 0, 204, 0.95), 0 0 30px rgba(255, 0, 204, 0.4)"
  },
  antique: {
    name: "Premium Antique Mahogany Brass 📻",
    case: "#5a3825",
    face: "#1c0d02",
    dim: "#442200",
    lit: "#ff7700",
    glow: "rgba(255, 119, 0, 0.85)",
    btn: "#3b1d0b",
    bodyBg: "#130904",
    bodyText: "#ffd2a1",
    bodyBgGradient: "linear-gradient(135deg, #2a140a 0%, #070301 100%)",
    ledShadow: "0 0 12px rgba(255, 119, 0, 0.8), 0 0 25px rgba(255, 119, 0, 0.3)"
  },
  toxic: {
    name: "Premium Reactor Toxic-Green ☢️",
    case: "#1b2a1a",
    face: "#040a04",
    dim: "#0a290a",
    lit: "#39ff14",
    glow: "rgba(57, 255, 20, 0.9)",
    btn: "#243f24",
    bodyBg: "#050d05",
    bodyText: "#99ff99",
    bodyBgGradient: "radial-gradient(circle at 50% 50%, #102410 0%, #000200 100%)",
    ledShadow: "0 0 16px rgba(57, 255, 20, 0.9), 0 0 30px rgba(57, 255, 20, 0.4)"
  },
  space: {
    name: "Premium Space Odyssey 🌌",
    case: "#090d16",
    face: "#02040a",
    dim: "#101f30",
    lit: "#00f0ff",
    glow: "rgba(0, 240, 255, 0.95)",
    btn: "#131a26",
    bodyBg: "#05070c",
    bodyText: "#b3f0ff",
    bodyBgGradient: "radial-gradient(circle at 50% 50%, #0d1527 0%, #010204 100%)",
    ledShadow: "0 0 16px rgba(0, 240, 255, 0.9), 0 0 30px rgba(0, 240, 255, 0.4)"
  },
  royal: {
    name: "Premium Royal Velvet 👑",
    case: "#2b1a30",
    face: "#0d0412",
    dim: "#3a140d",
    lit: "#ffd700",
    glow: "rgba(255, 215, 0, 0.95)",
    btn: "#201024",
    bodyBg: "#0a0210",
    bodyText: "#ffe680",
    bodyBgGradient: "linear-gradient(135deg, #1d0228 0%, #030006 100%)",
    ledShadow: "0 0 16px rgba(255, 215, 0, 0.9), 0 0 30px rgba(255, 215, 0, 0.4)"
  },
  submarine: {
    name: "Premium Sonar Marine 🛸",
    case: "#091f24",
    face: "#01070b",
    dim: "#042c16",
    lit: "#22ff44",
    glow: "rgba(34, 255, 68, 0.95)",
    btn: "#0a242a",
    bodyBg: "#01060b",
    bodyText: "#a3ffa3",
    bodyBgGradient: "radial-gradient(circle at 50% 50%, #05161f 0%, #000305 100%)",
    ledShadow: "0 0 16px rgba(34, 255, 68, 0.9), 0 0 35px rgba(0, 150, 255, 0.4)"
  }
};



const App: React.FC = () => {
  const getDeviceId = (): string => {
    let id = localStorage.getItem('aetherclock_device_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('aetherclock_device_id', id);
    }
    return id;
  };

  const initialAgenda = `0800 Drop Ava at nursery\n1000 Team meeting\n1200 lunch with Amanda\n1400 call with Jerry`;

  const [state, setState] = useState<AppState>(() => {
    const calendar = parseAgendaToCalendar(initialAgenda);
    return {
      alarms: loadAlarms(),
      currentAlarmId: null,
      generatedForAlarmId: null,
      agenda: initialAgenda,
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
  const [currentTheme, setCurrentTheme] = useState<'obsidian' | 'amber' | 'cobalt' | 'ivory' | 'vaporwave' | 'antique' | 'toxic' | 'space' | 'royal' | 'submarine'>(() => {
    return (localStorage.getItem('aetherclock_theme') as any) || 'obsidian';
  });
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
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      textModel: 'gemini-3.5-flash',
      ttsModel: 'gemini-3.1-flash-tts-preview'
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
  const screenSaverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetScreenSaverTimerRef = useRef<() => void>(() => {});

  const isAnyAlarmActive = useMemo(() => state.alarms.some((a) => a.isActive), [state.alarms]);
  const currentAlarm = useMemo(
    () => state.alarms.find((a) => a.id === state.currentAlarmId) ?? null,
    [state.alarms, state.currentAlarmId]
  );
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
    syncAlarms(deviceIdRef.current, state.alarms).catch((err) =>
      console.error('[Push] alarm sync failed', err)
    );
  }, [state.alarms]);

  // TTS Player instance
  const ttsPlayerRef = useRef(new TTSPlayer());

  // YouTube IFrame Player
  const youtubePlayerRef = useRef<any>(null);
  const youtubeContainerRef = useRef<HTMLDivElement>(null);

  // Refs for stable alarm-check callbacks (initialized with dummies to avoid TDZ)
  const handleGenerateAndPlayRef = useRef<any>(() => {});
  const startPlaybackSequenceRef = useRef<any>(() => {});
  const handleNextTrackRef = useRef<any>(() => {});
  const generationEpochRef = useRef<number>(0);
  const errorRecoveryIndexRef = useRef<number>(0);
  const lastMinuteRef = useRef<string>('');
  const triggeredRef = useRef<Set<string>>(new Set());
  const prewarmedRef = useRef<Set<string>>(new Set());
  const deviceIdRef = useRef<string>(getDeviceId());
  const pushSubscriptionRef = useRef<PushSubscriptionJSON | null>(null);

  const getRecoveryVideoId = (index: number): string | null => {
    const playlistIds = state.playlist.map(t => t.youtubeVideoId).filter(Boolean) as string[];
    // Verified NCS fallback IDs; these are royalty-free and embeddable.
    const emergencyIds = ['K4DyBUG242c', 'TW9d8vYrVFQ', 'J2X5mJ3HDYE', '3nQNiWdeH2Q', 'p7ZsBPK656s', 'S19UcWdOA-I', 'yJg-Y5byMMw'];
    const allIds = [...new Set([...playlistIds, ...emergencyIds])];
    if (allIds.length === 0) return null;
    return allIds[index % allIds.length];
  };
  // Dual-Planner Tabs
  const [plannerTab, setPlannerTab] = useState<'interactive' | 'textarea'>('interactive');
  
  // New Appointment Fields
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newVibe, setNewVibe] = useState("general");



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
      await syncDevice(deviceIdRef.current, state.alarms, pushSubscriptionRef.current);
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

  // Restore existing push subscription on reload
  useEffect(() => {
    getExistingPushSubscription()
      .then((subscription) => {
        if (!subscription) return;
        pushSubscriptionRef.current = subscription.toJSON() as unknown as PushSubscriptionJSON;
        syncDevice(deviceIdRef.current, state.alarms, pushSubscriptionRef.current).catch((err) =>
          console.error('[Push] restore subscription sync failed', err)
        );
      })
      .catch((err) => console.error('[Push] restore subscription failed', err));
  }, []);

  // Online/Offline status
  useEffect(() => {
    const updateOnline = () => setIsOnlineStatus(isOnline());
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    setIsOnlineStatus(isOnline());
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

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

  // Autoplay-Block Erkennung fuer mobile Browser
  useEffect(() => {
    if (state.status !== 'playing') return;
    const timer = setTimeout(() => {
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getPlayerState === 'function') {
        const playerState = youtubePlayerRef.current.getPlayerState();
        const YT = (window as any).YT;
        if (YT && playerState !== YT.PlayerState.PLAYING && playerState !== YT.PlayerState.BUFFERING) {
          setIsAutoplayBlocked(true);
        }
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [state.status, state.currentTrackIndex]);

  // Apply dark/light body properties on theme changes
  useEffect(() => {
    const cols = THEMES[currentTheme];
    if (!cols) return;
    document.documentElement.style.setProperty('--body-bg', cols.bodyBg);
    document.documentElement.style.setProperty('--body-text', cols.bodyText);
    document.documentElement.style.setProperty('--body-bg-gradient', cols.bodyBgGradient);
    document.documentElement.style.setProperty('--led-shadow', cols.ledShadow);
    
    // Set custom radio structural token properties for real-time morphing
    document.documentElement.style.setProperty('--radio-case', cols.case);
    document.documentElement.style.setProperty('--radio-face', cols.face);
    document.documentElement.style.setProperty('--radio-dim', cols.dim);
    document.documentElement.style.setProperty('--radio-lit', cols.lit);
    document.documentElement.style.setProperty('--radio-glow', cols.glow);
    document.documentElement.style.setProperty('--radio-btn', cols.btn);
  }, [currentTheme]);

  // Alarm Check trigger loop
  useEffect(() => {
    const checkAlarm = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      const currentDayKey = getCurrentWeekDay(now);

      // Minute rollover: clear per-minute dedup sets so alarms can fire again in future minutes.
      if (lastMinuteRef.current !== currentTime) {
        lastMinuteRef.current = currentTime;
        triggeredRef.current.clear();
        prewarmedRef.current.clear();
      }

      for (const alarm of state.alarms) {
        if (!alarm.isActive) continue;
        if (alarm.days.length > 0 && !alarm.days.includes(currentDayKey)) continue;

        const prewarmKey = `${alarm.id}:${currentTime}`;
        const triggerKey = `${alarm.id}:${currentTime}`;
        const preAlarmTime = getPreAlarmTime(alarm.time);

        if (
          isPreWarmEnabled &&
          currentTime === preAlarmTime &&
          state.status === 'idle' &&
          !prewarmedRef.current.has(prewarmKey)
        ) {
          prewarmedRef.current.add(prewarmKey);
          handleGenerateAndPlayRef.current(alarm.id, true);
        }

        if (currentTime === alarm.time && !triggeredRef.current.has(triggerKey)) {
          triggeredRef.current.add(triggerKey);
          setState((prev) => ({ ...prev, currentAlarmId: alarm.id }));

          if (!isOnlineStatus && offlineFallbackEnabled) {
            setState((prev) => ({ ...prev, status: 'playing' }));
            playOfflineFallback();
            if (notificationsEnabled) {
              sendAlarmNotification('AetherClock Alarm', `Wake up! ${alarm.label}`);
            }
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
  }, [state.alarms, state.status, isPreWarmEnabled, isOnlineStatus, offlineFallbackEnabled, notificationsEnabled]);

  // Sync inputs
  const syncCalendarToAgenda = (newCalendar: CalendarItem[]) => {
    const formatted = formatCalendarToAgenda(newCalendar);
    setState(prev => ({
      ...prev,
      calendar: newCalendar,
      agenda: formatted
    }));
  };

  const syncTextareaToCalendar = (text: string) => {
    const parsed = parseAgendaToCalendar(text);
    setState(prev => ({
      ...prev,
      agenda: text,
      calendar: parsed
    }));
  };

  // Structured Item add/remove
  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const item: CalendarItem = {
      id: `item-${Date.now()}`,
      time: newTime,
      title: newTitle.trim(),
      vibe: newVibe,
      active: true
    };
    const updated = [...state.calendar, item].sort((a, b) => a.time.localeCompare(b.time));
    syncCalendarToAgenda(updated);
    setNewTitle("");
  };

  const handleRemoveItem = (id: string) => {
    const updated = state.calendar.filter(item => item.id !== id);
    syncCalendarToAgenda(updated);
  };

  const handleToggleItem = (id: string) => {
    const updated = state.calendar.map(item => item.id === id ? { ...item, active: !item.active } : item);
    syncCalendarToAgenda(updated);
  };

  // Generate Playlist and/or Briefing
  const handleGenerateAndPlay = async (alarmId?: string, preGenerateOnly: boolean = false) => {
    generationEpochRef.current += 1;
    const epoch = generationEpochRef.current;

    const alarm = alarmId ? state.alarms.find((a) => a.id === alarmId) : undefined;
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
          alarmTime: getNextAlarm(state.alarms)?.time ?? '07:00',
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
        state.agenda,
        new Date(),
        config.alarmTime,
        config.genrePreset,
        blacklist,
        llmConfig
      );
      if (epoch !== generationEpochRef.current) return;

      let playlist: PlaylistTrack[] = [];

      if (config.playlistConfig.enabled) {
        const fetchTrack = () =>
          generateMusicalPrompt(
            state.weather,
            state.location,
            state.agenda,
            new Date(),
            config.alarmTime,
            config.genrePreset,
            blacklist,
            llmConfig
          ).then((r) => r.searchedSong);

        playlist = await generatePlaylist(fetchTrack, config.playlistConfig.trackCount, config.genrePreset);
        if (epoch !== generationEpochRef.current) return;
      } else {
        if (resultData.searchedSong.youtubeVideoId) {
          const videoId = resultData.searchedSong.youtubeVideoId;
          playlist = [
            {
              title: resultData.searchedSong.title,
              artist: resultData.searchedSong.artist,
              youtubeVideoId: videoId,
              embedUrl: buildEmbedUrl(videoId) || buildNcsChannelEmbedUrl(),
              whyExplanation: resultData.searchedSong.whyExplanation,
            },
          ];
        }
      }

      let briefingSrc: string | null = null;
      if (config.voiceBriefingConfig.enabled) {
        setState((prev) => ({ ...prev, status: 'generating_briefing' }));
        const briefing = await generateVoiceBriefing(
          state.weather,
          state.calendar,
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
        searchedTrack: resultData.searchedSong,
        youtubeEmbedUrl: embedUrl,
        playlist,
        currentTrackIndex: 0,
        briefingAudioSrc: briefingSrc,
        generatedForAlarmId: alarm?.id ?? null,
      }));
      if (preGenerateOnly) {
        return;
      }
      startPlaybackSequenceRef.current(briefingSrc, playlist, config.voiceBriefingConfig);
    } catch (err: any) {
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
    errorRecoveryIndexRef.current = 0;
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
  }, [state.playlist.length, state.currentTrackIndex, currentAlarm, playlistConfig.shuffle]);

  const handlePrevTrack = useCallback(() => {
    errorRecoveryIndexRef.current = 0;
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

  // YouTube IFrame Player: initialize once
  useEffect(() => {
    if (youtubePlayerRef.current) return; // Already initialized

    const videoId = state.playlist[state.currentTrackIndex]?.youtubeVideoId
      || state.searchedTrack?.youtubeVideoId;

    if (!videoId) {
      console.warn('[YT] No videoId available for player initialization');
      return;
    }

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const createPlayer = () => {
      if (!youtubeContainerRef.current) {
        retryTimer = setTimeout(createPlayer, 100);
        return;
      }
      if (youtubePlayerRef.current) return;
      console.log('[YT] Creating player for video:', videoId);
      youtubePlayerRef.current = new (window as any).YT.Player(youtubeContainerRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
        },
        events: {
          onReady: () => {
            console.log('[YT] Player ready');
          },
          onError: (event: any) => {
            console.warn('[YT] Player error code:', event.data);
            // Embedding errors: 100=not found, 101/150=embedding disabled, 2=invalid param, 5=HTML5 error
            errorRecoveryIndexRef.current += 1;
            const nextId = getRecoveryVideoId(errorRecoveryIndexRef.current);
            if (!nextId) {
              console.error('[YT] Alle Recovery-IDs erschoepft — springe zum naechsten Track.');
              errorRecoveryIndexRef.current = 0;
              handleNextTrackRef.current();
              return;
            }
            console.log('[YT] Retrying with recovery ID:', nextId);
            youtubePlayerRef.current?.loadVideoById?.(nextId);
          },
          onStateChange: (event: any) => {
            if (event.data === (window as any).YT.PlayerState.ENDED) {
              handleNextTrackRef.current();
            }
          },
        },
      });
    };

    if ((window as any).YT && (window as any).YT.Player) {
      createPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = createPlayer;
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      (window as any).onYouTubeIframeAPIReady = null;
    };
  }, []);

  // YouTube IFrame Player: load next video when track changes
  useEffect(() => {
    if (!youtubePlayerRef.current || !youtubePlayerRef.current.loadVideoById) return;
    errorRecoveryIndexRef.current = 0; // Reset recovery on intentional track change

    const videoId = state.playlist[state.currentTrackIndex]?.youtubeVideoId
      || state.searchedTrack?.youtubeVideoId;

    if (!videoId) {
      console.warn('[YT] No videoId available for track change');
      return;
    }

    youtubePlayerRef.current.loadVideoById(videoId);
  }, [state.currentTrackIndex]);

  // YouTube IFrame Player: destroy on unmount
  useEffect(() => {
    return () => {
      if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 overflow-hidden select-none">
      <style>{`
        @keyframes vaporPulse {
          0%, 100% { filter: drop-shadow(0 0 5px #ff00cc) brightness(0.9); }
          50% { filter: drop-shadow(0 0 15px #ff00cc) brightness(1.2); }
        }
        @keyframes sonarPing {
          0% { transform: scale(0.6) translate(-50%, -50%); opacity: 0.8; }
          100% { transform: scale(2.2) translate(-50%, -50%); opacity: 0; }
        }
        @keyframes starryTwinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.85; }
        }
        @keyframes spaceScanner {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes warningStatic {
          0% { transform: translate(0,0); }
          50% { transform: translate(-1px, 1px); }
          100% { transform: translate(1px, -1px); }
        }
        @keyframes luxuryCrest {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes signalRay {
          0% { opacity: 0.2; }
          50% { opacity: 0.7; }
          100% { opacity: 0.2; }
        }
        .animate-vapor-pulse { animation: vaporPulse 3s infinite ease-in-out; }
        .animate-sonar-ping { animation: sonarPing 4s infinite cubic-bezier(0.1, 0.8, 0.3, 1); transform-origin: top left; }
        .animate-starry-twinkle { animation: starryTwinkle 4s infinite ease-in-out; }
        .animate-space-scanner { animation: spaceScanner 8s infinite linear; }
        .animate-warning-static { animation: warningStatic 0.15s infinite; }
        .animate-luxury-crest { background-size: 200% 200%; animation: luxuryCrest 6s infinite ease-in-out; }
        .animate-signal-ray { animation: signalRay 2s infinite ease-in-out; }
        
        /* LED warm-up glow instead of instant on */
        @keyframes ledWarmUp {
          0% { opacity: 0; box-shadow: 0 0 0px currentColor; }
          40% { opacity: 0.6; box-shadow: 0 0 4px currentColor; }
          100% { opacity: 1; box-shadow: 0 0 8px currentColor, 0 0 16px currentColor; }
        }
        .led-warm-up {
          animation: ledWarmUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        
        /* Springy button press */
        .btn-spring {
          transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
        }
        .btn-spring:active {
          transform: scale(0.92) translateY(1px);
        }
        
        /* Subtle ambient pulse for active elements */
        @keyframes ambientPulse {
          0%, 100% { box-shadow: 0 0 5px rgba(255, 51, 51, 0.2); }
          50% { box-shadow: 0 0 15px rgba(255, 51, 51, 0.5); }
        }
        .ambient-pulse {
          animation: ambientPulse 3s infinite ease-in-out;
        }
        
        .sonar-grid-bg {
          background-image: 
            linear-gradient(rgba(34, 255, 68, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 255, 68, 0.02) 1px, transparent 1px);
          background-size: 24px 24px;
        }
      `}</style>
      
      {/* WebGPU Theme Background */}
      <BabylonCanvas theme={currentTheme} />

      {/* The Device Case */}
      <div id="device-wrapper" className="relative z-10 bg-radio-case w-full max-w-5xl rounded-xl shadow-device border-t border-white/10 p-6 md:p-10 flex flex-col lg:flex-row gap-8 transition-all duration-300 overflow-hidden">
         
         {/* THEME SPECIFIC CHASSIS OVERLAYS & HARDWARE DECALS */}
         {currentTheme === 'vaporwave' && (
           <>
             <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-pink-500/10 to-transparent pointer-events-none z-0 mix-blend-screen animate-pulse"></div>
             <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-[#ff00cc]/5 rounded-full blur-2xl pointer-events-none"></div>
             <div className="absolute -left-12 -top-12 w-48 h-48 bg-[#38bdf8]/5 rounded-full blur-2xl pointer-events-none"></div>
           </>
         )}
         {currentTheme === 'antique' && (
           <>
             {/* Simulated brass screw rivets on the outer chassis cabinet corners */}
             <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-200 via-yellow-600 to-amber-950 shadow-md border border-amber-900/40 pointer-events-none z-20 flex items-center justify-center">
                <div className="w-1.5 h-[1px] bg-amber-950/80 transform rotate-45"></div>
             </div>
             <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-200 via-yellow-600 to-amber-950 shadow-md border border-amber-900/40 pointer-events-none z-20 flex items-center justify-center">
                <div className="w-1.5 h-[1px] bg-amber-950/80 transform -rotate-12"></div>
             </div>
             <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-200 via-yellow-600 to-amber-950 shadow-md border border-amber-900/40 pointer-events-none z-20 flex items-center justify-center">
                <div className="w-1.5 h-[1px] bg-amber-950/80 transform rotate-12"></div>
             </div>
             <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-200 via-yellow-600 to-amber-950 shadow-md border border-amber-900/40 pointer-events-none z-20 flex items-center justify-center">
                <div className="w-1.5 h-[1px] bg-amber-950/80 transform -rotate-45"></div>
             </div>
           </>
         )}
         {currentTheme === 'toxic' && (
           <>
             {/* Biohazard security striped yellow/black hazard warning trim at the top & bottom margins */}
             <div className="absolute top-0 inset-x-0 h-1.5 bg-[repeating-linear-gradient(45deg,#eab308,#eab308_10px,#000_10px,#000_20px)] opacity-60 border-b border-black/30 pointer-events-none z-20"></div>
             <div className="absolute bottom-0 inset-x-0 h-1.5 bg-[repeating-linear-gradient(45deg,#eab308,#eab308_10px,#000_10px,#000_20px)] opacity-60 border-t border-black/30 pointer-events-none z-20"></div>
             <div className="absolute inset-y-0 left-0 w-1 bg-[repeating-linear-gradient(0deg,#eab308,#eab308_10px,#000_10px,#000_20px)] opacity-40 pointer-events-none z-20"></div>
             <div className="absolute inset-y-0 right-0 w-1 bg-[repeating-linear-gradient(0deg,#eab308,#eab308_10px,#000_10px,#000_20px)] opacity-40 pointer-events-none z-20"></div>
           </>
         )}
         {currentTheme === 'space' && (
           <>
             {/* Star twinkling animation elements inside the chassis container */}
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(0,180,255,0.08)_0%,transparent_60%)] pointer-events-none z-0"></div>
             <div className="absolute top-1/4 left-1/3 w-1 h-3 bg-white rounded-full animate-starry-twinkle pointer-events-none"></div>
             <div className="absolute top-2/3 left-1/2 w-1.5 h-1.5 bg-[#00f0ff] rounded-full animate-starry-twinkle pointer-events-none" style={{ animationDelay: '1.5s' }}></div>
             <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-[#d8b4fe] rounded-full animate-starry-twinkle pointer-events-none" style={{ animationDelay: '3s' }}></div>
             {/* Laser blue tech bar indicators at the top and bottom edge */}
             <div className="absolute top-0 inset-x-0 h-0.5 bg-cyan-400 opacity-80 pointer-events-none z-20 shadow-[0_0_10px_#00f0ff]"></div>
             <div className="absolute bottom-0 inset-x-0 h-0.5 bg-purple-500 opacity-80 pointer-events-none z-20 shadow-[0_0_10px_rgba(168,85,247,0.8)]"></div>
             {/* Crosshair design elements in the corners */}
             <div className="absolute top-2 left-2 text-[7px] text-cyan-400 font-mono tracking-widest opacity-60 pointer-events-none z-20">SYS_LOCKED_HD</div>
             <div className="absolute bottom-2 right-2 text-[7px] text-cyan-400 font-mono tracking-widest opacity-60 pointer-events-none z-20">GRID_SECTOR_07</div>
           </>
         )}
         {currentTheme === 'royal' && (
           <>
             {/* Gold frame fillets and royal crown vector accent lines */}
             <div className="absolute inset-0 border-[3px] border-amber-500/30 rounded-xl pointer-events-none z-20 mix-blend-color-dodge"></div>
             <div className="absolute inset-1.5 border border-amber-500/15 rounded-lg pointer-events-none z-20"></div>
             <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-amber-500/20 text-amber-300 font-mono text-[8px] uppercase tracking-widest px-4 py-0.5 rounded-b-md border-x border-b border-amber-500/40 pointer-events-none z-20 font-bold">
                 👑 EXCLUSIVE CABINET V.I.P 👑
              </div>
             <div className="absolute left-2 inset-y-8 w-[1px] bg-gradient-to-b from-transparent via-amber-500/40 to-transparent pointer-events-none"></div>
             <div className="absolute right-2 inset-y-8 w-[1px] bg-gradient-to-b from-transparent via-amber-500/40 to-transparent pointer-events-none"></div>
           </>
         )}
         {currentTheme === 'submarine' && (
           <>
             {/* Sonar sweep target vector grid lines */}
             <div className="absolute inset-0 sonar-grid-bg pointer-events-none z-0"></div>
             <div className="absolute top-1/2 left-1/2 w-64 h-64 border border-green-500/25 rounded-full pointer-events-none z-0 animate-sonar-ping"></div>
             <div className="absolute top-1/2 left-1/2 w-64 h-64 border border-green-500/10 rounded-full pointer-events-none z-0 animate-sonar-ping" style={{ animationDelay: '2s' }}></div>
             <div className="absolute top-4 left-4 flex items-center gap-1.5 pointer-events-none z-20">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-[7.5px] font-mono text-green-400 tracking-widest uppercase">SONAR RE-CON PING: ON</span>
             </div>
             <div className="absolute bottom-4 left-4 text-[7px] text-green-500 font-mono tracking-widest uppercase pointer-events-none z-20">
               DEPTH REG: 2400 METERS
             </div>
           </>
         )}

         {/* Left: Vintage Speaker Grille with dynamic badge status */}
         <div id="speaker-deck" className="hidden lg:flex w-32 xl:w-40 flex-shrink-0 flex-col justify-between relative">
             <div className="absolute inset-x-0 top-0 bottom-24 bg-speaker-grille bg-[length:8px_8px] opacity-70 rounded-lg shadow-inset-screen border border-black"></div>
             
             {/* Sub System diagnostics Dial Info */}
             <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-[85%] bg-black/85 border border-white/10 p-2 rounded text-[8px] font-mono text-center text-radio-dim uppercase tracking-wider leading-relaxed z-10">
               <span className="text-radio-lit/80 block led-text-shadow font-digital">TUNING STATS</span>
               SYSTEM: COMM<br/>
               BAND: AM/FM<br/>
               VIBE: PROG_CUR
             </div>

             {/* Badge */}
             <div id="radio-badge" className="mt-auto w-full bg-black/80 border border-white/20 py-2 rounded text-[7px] xl:text-[9px] font-mono text-radio-dim uppercase tracking-wider text-center z-20 leading-tight">
                MODEL:<br/><span className="text-radio-lit led-text-shadow">AETHERCLOCK</span>
             </div>
         </div>

         {/* Right: Main Interface Deck */}
         <div id="interface-deck" className="flex-1 flex flex-col gap-6 relative z-10">
            
            {/* Top Display Panel (Glass Face) */}
            <div id="face-screen" className="bg-radio-face border-4 border-radio-dim rounded-lg p-6 relative shadow-inset-screen overflow-hidden min-h-[320px] flex flex-col">
                {/* Glass Glare */}
                <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-white/5 to-transparent pointer-events-none transform skew-x-12 z-20"></div>
                
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0 mb-4 relative z-10 border-b border-radio-dim/40 pb-3">
                    <div className="flex flex-col w-full sm:w-auto overflow-hidden">
                        <span className="text-radio-lit text-xs font-mono uppercase tracking-widest opacity-80 flex items-center gap-2 w-full">
                             <MapPin className="w-3.5 h-3.5 text-radio-lit flex-shrink-0" /> 
                             {state.location ? (
                               <span className="font-digital tracking-widest truncate">{state.location}</span>
                             ) : "ACQUIRING COORDS..."}
                        </span>
                        <div className="flex items-center gap-2 mt-1.5">
                             <span className="font-digital text-xl text-radio-lit led-text-shadow">
                               {state.weather ? `${state.weather.temperature}°C` : "--°C"}
                             </span>
                             {state.weather && (
                               <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest pt-1 border-l border-white/10 pl-2">
                                 {WEATHER_CODES[state.weather.conditionCode] || 'Clear'}
                                </span>
                             )}
                        </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                        <div className="flex items-center gap-2">
                            {!isOnlineStatus && (
                              <span className="text-[8px] font-mono text-yellow-500 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                <WifiOff className="w-3 h-3" /> OFFLINE
                              </span>
                            )}
                            <div className="text-radio-lit text-xs font-mono border border-radio-lit/30 px-2 py-0.5 rounded shadow-[0_0_5px_rgba(255,51,51,0.3)] uppercase tracking-widest bg-red-950/20">
                                {state.status === 'idle' ? 'SYSTEM READY' : state.status.replace(/_/g, ' ').toUpperCase()}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <button 
                                id="btn-settings-toggle"
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className={`text-[10px] sm:text-[11px] font-mono border px-2 py-0.5 rounded uppercase tracking-widest transition-all flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-radio-lit
                                  ${isSettingsOpen 
                                    ? 'bg-radio-lit/10 border-radio-lit text-radio-lit shadow-[0_0_5px_rgba(255,51,51,0.3)]' 
                                    : 'text-gray-400 hover:text-white border-gray-700 hover:border-gray-500'
                                  }
                                `}
                                aria-label="Toggle Settings panel"
                            >
                                <Settings className="w-3 h-3 animate-[spin_5s_linear_infinite]" /> CONFIG
                            </button>
                        </div>
                    </div>
                </div>

                {/* SYSTEM CONFIGURATION DRAWER SCREEN OVERLAY */}
                {isSettingsOpen && (
                  <div className="bg-neutral-900/95 border-2 border-radio-lit/30 rounded p-4 flex flex-col gap-3 text-left animate-[fadeIn_0.3s_ease-out] relative z-30 mb-4 shadow-inset-screen overflow-y-auto max-h-[340px]">
                     <div className="flex justify-between items-center pb-1.5 border-b border-radio-dim/40">
                         <span className="text-[10px] text-radio-lit font-bold uppercase tracking-widest flex items-center gap-1.5 led-text-shadow">
                            <Settings className="w-3.5 h-3.5" /> SYSTEM CORES CONFIGURATION
                         </span>
                         <button 
                            onClick={() => setIsSettingsOpen(false)}
                            className="text-[9px] font-mono text-gray-500 hover:text-radio-lit uppercase hover:underline"
                         >
                            [CLOSE]
                         </button>
                     </div>
                     
                     {/* 1. Theme selection */}
                     <div className="flex flex-col gap-1">
                         <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">Aesthetic Chassis & HUD Theme</label>
                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                             {Object.entries(THEMES).map(([key, t]) => (
                                 <button
                                     key={key}
                                     type="button"
                                     onClick={() => {
                                         setCurrentTheme(key as any);
                                         localStorage.setItem('aetherclock_theme', key);
                                     }}
                                     className={`p-1.5 rounded font-mono text-[8px] sm:text-[9px] font-bold uppercase border tracking-wider transition-all duration-100 text-center
                                         ${currentTheme === key
                                             ? 'bg-neutral-850 border-radio-lit text-radio-lit shadow-inner bg-opacity-90 leading-none py-2'
                                             : 'bg-neutral-800/20 border-white/5 text-gray-400 hover:text-gray-150 hover:border-white/10 shadow-sm leading-none py-2'
                                         }`}
                                 >
                                     {t.name.replace("Premium ", "")} {['vaporwave', 'antique', 'toxic', 'space', 'royal', 'submarine'].includes(key) ? '★' : ''}
                                 </button>
                             ))}
                         </div>
                     </div>

                     {/* Alarms */}
                     <div className="flex flex-col gap-2 mt-1 border-t border-radio-dim/40 pt-2">
                         <div className="flex items-center gap-2">
                             <Bell className="w-3 h-3 text-radio-lit" />
                             <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Alarms</span>
                         </div>
                         <AlarmList
                             alarms={state.alarms}
                             onChange={(nextAlarms) => setState((prev) => ({ ...prev, alarms: nextAlarms }))}
                             defaultPlaylistConfig={playlistConfig}
                             defaultVoiceBriefingConfig={voiceBriefingConfig}
                         />
                     </div>

                     {/* 2. Output Volume Level */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                         <div className="flex flex-col gap-1">
                             <div className="flex justify-between items-center">
                                <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                   <Volume2 className="w-3 h-3 text-radio-lit" /> Volume Output Level
                                </label>
                                <span className="text-[10px] font-digital text-radio-lit led-text-shadow">{volume}%</span>
                             </div>
                             <input 
                                 type="range"
                                 min="0"
                                 max="100"
                                 value={volume}
                                 onChange={(e) => {
                                     const v = parseInt(e.target.value, 10);
                                     setVolume(v);
                                     localStorage.setItem('aetherclock_volume', String(v));
                                 }}
                                 className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-radio-lit"
                             />
                         </div>

                         {/* 3. Loudness Auto-Regulation Selection */}
                         <div className="flex flex-col gap-1">
                             <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">Wake-up Loudness Regulation</label>
                             <select
                                 value={loudnessMode}
                                 onChange={(e) => {
                                     const mode = e.target.value as any;
                                     setLoudnessMode(mode);
                                     localStorage.setItem('aetherclock_loudness', mode);
                                 }}
                                 className="w-full bg-neutral-850 border border-white/5 rounded px-2 py-1 text-[9px] font-mono uppercase text-gray-300 outline-none focus:border-radio-lit"
                             >
                                 <option value="standard">STANDARD (FIXED TARGET AMPLITUDE)</option>
                                 <option value="sunrise_progressive">SUNRISE PROGRESSIVE (GENTLE RAMP UP)</option>
                                 <option value="max_impact">MAX IMPACT SHOCK ALARM (100% BOOST)</option>
                             </select>
                         </div>
                     </div>

                     {/* 4. Pre-Warm Option & Blacklist Filters */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                         <div className="flex flex-col gap-1 justify-center">
                             <div className="flex items-center gap-2">
                                 <input 
                                     id="prewarm-toggle"
                                     type="checkbox"
                                     checked={isPreWarmEnabled}
                                     onChange={(e) => {
                                         const enabled = e.target.checked;
                                         setIsPreWarmEnabled(enabled);
                                         localStorage.setItem('aetherclock_prewarm', String(enabled));
                                     }}
                                     className="w-3.5 h-3.5 rounded border-neutral-700 text-radio-lit bg-neutral-900 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-radio-lit"
                                 />
                                 <label htmlFor="prewarm-toggle" className="text-[9px] font-mono text-gray-300 uppercase tracking-wider select-none cursor-pointer">
                                     Pre-Warm Engine (Tuning 60s prior)
                                 </label>
                             </div>
                             <p className="text-[7.5px] text-gray-500 font-mono mt-0.5 leading-relaxed uppercase">
                                 Generates and buffers the personalized radio track exactly 1 min before play so there is no delay at wake-up.
                             </p>
                         </div>

                         <div className="flex flex-col gap-1">
                             <label htmlFor="blacklist-input" className="text-[9.5px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                 <EyeOff className="w-3 h-3 text-red-500" /> Forbidden Keywords & Artists
                             </label>
                             <input 
                                 id="blacklist-input"
                                 type="text"
                                 placeholder="E.G. JUSTIN BIEBER, NICKELBACK..."
                                 value={blacklist}
                                 onChange={(e) => {
                                     setBlacklist(e.target.value);
                                     localStorage.setItem('aetherclock_blacklist', e.target.value);
                                 }}
                                 className="w-full bg-neutral-850 border border-white/5 rounded px-2.5 py-1 text-[9px] font-mono uppercase text-amber-300 placeholder-yellow-800/20 outline-none focus:border-radio-lit"
                             />
                         </div>
                     </div>

                     {/* 5. Voice Briefing */}
                     <div className="flex flex-col gap-2 mt-1 border-t border-radio-dim/40 pt-2">
                         <div className="flex items-center gap-2">
                             <Mic className="w-3 h-3 text-radio-lit" />
                             <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Voice Briefing</span>
                             <input
                                 type="checkbox"
                                 checked={voiceBriefingConfig.enabled}
                                 onChange={(e) => {
                                     const next = { ...voiceBriefingConfig, enabled: e.target.checked };
                                     setVoiceBriefingConfig(next);
                                     localStorage.setItem('aetherclock_voice_briefing', JSON.stringify(next));
                                 }}
                                 className="ml-auto w-3.5 h-3.5 rounded border-neutral-700 text-radio-lit bg-neutral-900 accent-radio-lit cursor-pointer"
                             />
                         </div>
                         {voiceBriefingConfig.enabled && (
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                                 <select
                                     value={voiceBriefingConfig.voiceName}
                                     onChange={(e) => {
                                         const next = { ...voiceBriefingConfig, voiceName: e.target.value as any };
                                         setVoiceBriefingConfig(next);
                                         localStorage.setItem('aetherclock_voice_briefing', JSON.stringify(next));
                                     }}
                                     className="w-full bg-neutral-850 border border-white/5 rounded px-2 py-1 text-[9px] font-mono uppercase text-gray-300 outline-none focus:border-radio-lit"
                                 >
                                     <option value="Fenrir">FENRIR</option>
                                     <option value="Kore">KORE</option>
                                     <option value="Leda">LEDA</option>
                                 </select>
                                 <input
                                     type="text"
                                     placeholder="CUSTOM GREETING..."
                                     value={voiceBriefingConfig.customGreeting}
                                     onChange={(e) => {
                                         const next = { ...voiceBriefingConfig, customGreeting: e.target.value };
                                         setVoiceBriefingConfig(next);
                                         localStorage.setItem('aetherclock_voice_briefing', JSON.stringify(next));
                                     }}
                                     className="w-full bg-neutral-850 border border-white/5 rounded px-2 py-1 text-[9px] font-mono text-amber-300 placeholder-yellow-800/20 outline-none focus:border-radio-lit"
                                 />
                                 <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                                     <input type="checkbox" checked={voiceBriefingConfig.includeWeather} onChange={(e) => { const next = { ...voiceBriefingConfig, includeWeather: e.target.checked }; setVoiceBriefingConfig(next); localStorage.setItem('aetherclock_voice_briefing', JSON.stringify(next)); }} className="w-3 h-3 accent-radio-lit" /> Weather
                                 </label>
                                 <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                                     <input type="checkbox" checked={voiceBriefingConfig.includeAgenda} onChange={(e) => { const next = { ...voiceBriefingConfig, includeAgenda: e.target.checked }; setVoiceBriefingConfig(next); localStorage.setItem('aetherclock_voice_briefing', JSON.stringify(next)); }} className="w-3 h-3 accent-radio-lit" /> Agenda
                                 </label>
                                 <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                                     <input type="checkbox" checked={voiceBriefingConfig.includeTime} onChange={(e) => { const next = { ...voiceBriefingConfig, includeTime: e.target.checked }; setVoiceBriefingConfig(next); localStorage.setItem('aetherclock_voice_briefing', JSON.stringify(next)); }} className="w-3 h-3 accent-radio-lit" /> Time
                                 </label>
                             </div>
                         )}
                     </div>

                     {/* 6. Playlist */}
                     <div className="flex flex-col gap-2 mt-1 border-t border-radio-dim/40 pt-2">
                         <div className="flex items-center gap-2">
                             <ListMusic className="w-3 h-3 text-radio-lit" />
                             <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Playlist</span>
                             <input
                                 type="checkbox"
                                 checked={playlistConfig.enabled}
                                 onChange={(e) => {
                                     const next = { ...playlistConfig, enabled: e.target.checked };
                                     setPlaylistConfig(next);
                                     localStorage.setItem('aetherclock_playlist', JSON.stringify(next));
                                 }}
                                 className="ml-auto w-3.5 h-3.5 rounded border-neutral-700 text-radio-lit bg-neutral-900 accent-radio-lit cursor-pointer"
                             />
                         </div>
                         {playlistConfig.enabled && (
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                                 <div className="flex flex-col gap-0.5">
                                     <label className="text-[8px] font-mono text-gray-500 uppercase">Tracks ({playlistConfig.trackCount})</label>
                                     <input
                                         type="range" min="1" max="5"
                                         value={playlistConfig.trackCount}
                                         onChange={(e) => {
                                             const next = { ...playlistConfig, trackCount: parseInt(e.target.value) };
                                             setPlaylistConfig(next);
                                             localStorage.setItem('aetherclock_playlist', JSON.stringify(next));
                                         }}
                                         className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-radio-lit"
                                     />
                                 </div>

                                 <label className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase cursor-pointer">
                                     <input type="checkbox" checked={playlistConfig.shuffle} onChange={(e) => { const next = { ...playlistConfig, shuffle: e.target.checked }; setPlaylistConfig(next); localStorage.setItem('aetherclock_playlist', JSON.stringify(next)); }} className="w-3 h-3 accent-radio-lit" /> Shuffle
                                 </label>
                             </div>
                         )}
                     </div>

                     {/* 7. LLM Model Selection */}
                     <div className="flex flex-col gap-2 mt-1 border-t border-radio-dim/40 pt-2">
                         <div className="flex items-center gap-2">
                             <Sliders className="w-3 h-3 text-radio-lit" />
                             <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">LLM Models</span>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                             <div className="flex flex-col gap-1">
                                 <label className="text-[8px] font-mono text-gray-500 uppercase">Text / Curation Model</label>
                                 <select
                                     value={llmConfig.textModel}
                                     onChange={(e) => {
                                         const next = { ...llmConfig, textModel: e.target.value as any };
                                         setLLMConfig(next);
                                         localStorage.setItem('aetherclock_llm', JSON.stringify(next));
                                     }}
                                     className="w-full bg-neutral-850 border border-white/5 rounded px-2 py-1 text-[9px] font-mono uppercase text-gray-300 outline-none focus:border-radio-lit"
                                 >
                                     <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                                     <option value="gemini-3-flash">Gemini 3 Flash</option>
                                     <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
                                     <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                     <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                                     <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                 </select>
                             </div>
                             <div className="flex flex-col gap-1">
                                 <label className="text-[8px] font-mono text-gray-500 uppercase">TTS Model</label>
                                 <select
                                     value={llmConfig.ttsModel}
                                     onChange={(e) => {
                                         const next = { ...llmConfig, ttsModel: e.target.value as any };
                                         setLLMConfig(next);
                                         localStorage.setItem('aetherclock_llm', JSON.stringify(next));
                                     }}
                                     className="w-full bg-neutral-850 border border-white/5 rounded px-2 py-1 text-[9px] font-mono uppercase text-gray-300 outline-none focus:border-radio-lit"
                                 >
                                     <option value="gemini-3.1-flash-tts-preview">Gemini 3.1 Flash TTS</option>
                                     <option value="gemini-2.5-flash-tts">Gemini 2.5 Flash TTS</option>
                                     <option value="gemini-2.5-pro-tts">Gemini 2.5 Pro TTS</option>
                                 </select>
                             </div>
                         </div>
                     </div>

                     {/* 8. PWA & Notifications */}
                     <div className="flex flex-col gap-2 mt-1 border-t border-radio-dim/40 pt-2">
                         <div className="flex items-center gap-2">
                             <Download className="w-3 h-3 text-radio-lit" />
                             <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">PWA & System</span>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                             <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2">
                                     <Bell className="w-3 h-3 text-gray-500" />
                                     <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider cursor-pointer flex items-center gap-1.5">
                                         <input
                                             type="checkbox"
                                             checked={notificationsEnabled}
                                             onChange={async (e) => {
                                                 const enabled = e.target.checked;
                                                 if (enabled) {
                                                     const ok = await enablePushNotifications();
                                                     if (!ok) {
                                                         setNotificationsEnabled(false);
                                                         localStorage.setItem('aetherclock_notifications', 'false');
                                                     }
                                                 } else {
                                                     setNotificationsEnabled(false);
                                                     localStorage.setItem('aetherclock_notifications', 'false');
                                                     try {
                                                         await unsubscribeFromPush();
                                                         await unsubscribeDevice(deviceIdRef.current);
                                                         pushSubscriptionRef.current = null;
                                                     } catch (err) {
                                                         console.error('[Push] unsubscribe failed', err);
                                                     }
                                                 }
                                             }}
                                             className="w-3 h-3 accent-radio-lit cursor-pointer"
                                         />
                                         Push Notifications
                                     </label>
                                 </div>
                                 <p className="text-[7.5px] text-gray-500 font-mono leading-relaxed">
                                     Show system notifications when the alarm fires, even if the app is in the background.
                                 </p>
                             </div>
                             <div className="flex flex-col gap-1">
                                 <div className="flex flex-col gap-0.5">
                                     <label className="text-[8px] font-mono text-gray-500 uppercase">Screensaver Timeout ({screenSaverTimeout}s)</label>
                                     <input
                                         type="range" min="5" max="300" step="5"
                                         value={screenSaverTimeout}
                                         onChange={(e) => {
                                             const val = parseInt(e.target.value);
                                             setScreenSaverTimeout(val);
                                             localStorage.setItem('aetherclock_screensaver_timeout', String(val));
                                         }}
                                         className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-radio-lit"
                                     />
                                 </div>
                             </div>
                             <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2">
                                     <WifiOff className="w-3 h-3 text-gray-500" />
                                     <label className="text-[9px] font-mono text-gray-400 uppercase tracking-wider cursor-pointer flex items-center gap-1.5">
                                         <input
                                             type="checkbox"
                                             checked={offlineFallbackEnabled}
                                             onChange={(e) => {
                                                 const enabled = e.target.checked;
                                                 setOfflineFallbackEnabled(enabled);
                                                 localStorage.setItem('aetherclock_offline_fallback', String(enabled));
                                             }}
                                             className="w-3 h-3 accent-radio-lit cursor-pointer"
                                         />
                                         Offline Fallback Tone
                                     </label>
                                 </div>
                                 <p className="text-[7.5px] text-gray-500 font-mono leading-relaxed">
                                     Play a local alarm tone when no internet connection is available at alarm time.
                                 </p>
                             </div>
                         </div>
                     </div>
                  </div>
                )}

                <div className="flex-grow flex flex-col justify-center gap-4">
                    <Clock className="mb-2" isAlarmActive={isAnyAlarmActive} />
                    
                    {/* TUNED SEARCH TRACK RETRO DISPLAY: Displays discovered song context */}
                    {state.searchedTrack ? (
                      <div className="bg-amber-950/25 border border-amber-500/20 p-3 rounded-lg flex flex-col text-left relative animate-[fadeIn_0.5s_ease-out] shadow-inner mb-2">
                         <div className="flex justify-between items-center pb-1 border-b border-amber-500/10 mb-1.5">
                            <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                              <Radio className="w-2.5 h-2.5 text-radio-lit animate-pulse" /> Live Song Tuned
                            </span>
                            <span className="text-[7.5px] font-digital text-radio-lit led-text-shadow">
                              STATION {getStationFreq(state.genrePreset)} MHz
                            </span>
                         </div>
                         <div className="text-radio-lit text-xs sm:text-sm font-bold truncate tracking-wider led-text-shadow uppercase flex items-center gap-1">
                           {state.searchedTrack.title} <span className="text-gray-500 text-[10px] font-normal font-mono normal-case">by</span> {state.searchedTrack.artist}
                         </div>
                         
                         <p className="text-[9.5px] sm:text-[10.5px] text-amber-500/80 font-mono leading-normal mt-1 italic pl-1 border-l-2 border-red-500/30">
                           "{state.searchedTrack.whyExplanation}"
                         </p>
                         
                         <div className="flex justify-between items-center text-[7.5px] text-gray-500 font-mono tracking-wider mt-2 pt-1 border-t border-amber-500/5">
                            <span>Preset Theme: {state.searchedTrack.foundTheme}</span>
                            <span>Aesthetic: {state.searchedTrack.styleDescription.substring(0, 32)}</span>
                         </div>
                      </div>
                    ) : (
                      /* Fallback Idle / Scanning frequency tuner view */
                      <div className="bg-black/30 border border-white/5 p-3 rounded-lg flex items-center justify-between font-mono mb-2">
                        <div className="flex flex-col text-left gap-0.5">
                          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1"><Compass className="w-2.5 h-2.5 animate-spin-slow" /> Tuner State</span>
                          <span className="text-xs font-digital text-radio-lit/50 uppercase tracking-widest led-text-shadow">
                            {state.status === 'generating_prompt' ? 'TUNING STATION...' : getStationName(state.genrePreset)}
                          </span>
                        </div>
                        <div className="text-right flex flex-col gap-0.5">
                          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest block">Band frequency</span>
                          <span className="text-sm font-digital text-radio-lit/70 led-text-shadow">
                            {state.status === 'generating_prompt' ? 'SCAN...' : `${getStationFreq(state.genrePreset)} MHz`}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Playlist Viewer */}
                    {state.playlist.length > 0 && ['ready', 'generating_prompt', 'generating_briefing', 'playing_briefing', 'playing'].includes(state.status) && (
                      <PlaylistViewer
                        playlist={state.playlist}
                        currentIndex={state.currentTrackIndex}
                        onNext={handleNextTrack}
                        onPrev={handlePrevTrack}
                        isPlayingBriefing={state.status === 'playing_briefing'}
                      />
                    )}

                    {/* Visualizer and Stream Progress */}
                    <div id="visualizer-slot" className={`relative transition-all duration-500 ease-in-out ${(state.status === 'playing' || state.status === 'playing_briefing') ? 'h-32 sm:h-48' : 'h-24'}`}>
                        {(state.status === 'playing' || state.status === 'playing_briefing') ? (
                          <div 
                            className="w-full h-full relative rounded overflow-hidden border-2 border-white/10 shadow-inset-screen pointer-events-auto transition-opacity duration-1000"
                            style={{ opacity: state.status === 'playing' ? 1 : 0.3 }}
                          >
                            <div className="absolute inset-x-0 top-0 h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-10 pointer-events-none opacity-50 block"></div>
                            
                            {/* TRANS-BEAM DIRECT FEED BYPASS CONTROLLER */}
                            <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5">
                              <a 
                                 href={`https://www.youtube.com/watch?v=${state.playlist[state.currentTrackIndex]?.youtubeVideoId || state.searchedTrack?.youtubeVideoId || ''}`}
                                 target="_blank"
                                 rel="noreferrer"
                                 className="flex items-center gap-1 px-2.5 py-1 bg-black/95 hover:bg-radio-lit text-radio-lit hover:text-neutral-50 border border-radio-lit/50 hover:border-transparent rounded text-[9px] uppercase tracking-wider font-mono transition-all shadow-[0_0_8px_var(--radio-glow)] cursor-pointer"
                                 title="Open direct YouTube trans-beam broadcast in new browser tab to bypass iframe blocks"
                              >
                                 <ExternalLink className="w-3 h-3" /> LAUNCH TRANS-BEAM UNLOCKED ↗
                              </a>
                            </div>

                            <div 
                               ref={youtubeContainerRef}
                               className="w-full h-full opacity-80 mix-blend-screen sepia-[0.3]" 
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full relative">
                            <Visualizer 
                              analyser={null} 
                              isActive={false} 
                              status={state.status} 
                              genre={state.genrePreset}
                            />
                          </div>
                        )}
                    </div>


                </div>
            </div>

            {/* MECHANICAL RADIO PRESET DIAL BOARD (The Genre Stations) */}
            <div id="radio-station-pushed-dials" className="flex flex-col gap-1.5 p-3 bg-neutral-900/60 rounded border border-white/5 self-stretch">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-[9px] font-mono text-radio-dim uppercase tracking-widest pl-1 flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-red-500/60" /> Preset Tuner Station Presets (Freq Select)
                   </span>

                </div>
                
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                   {(['auto', 'rock', 'classical', 'jazz', 'pop', 'ambient', 'hiphop', 'lofi', 'acoustic', 'synthwave'] as MusicGenre[]).map((station) => {
                       const active = state.genrePreset === station;
                       return (
                          <button
                             key={station}
                             type="button"
                             onClick={() => {
                                setState(prev => ({ 
                                  ...prev, 
                                  genrePreset: station,
                                  searchedTrack: null,
                                  playlist: [],
                                  currentTrackIndex: 0
                                }));
                             }}
                             className={`btn-spring p-2 rounded font-mono text-[9px] font-bold uppercase border tracking-wider relative overflow-hidden flex flex-col items-center gap-1
                                ${active 
                                  ? 'bg-neutral-800 border-radio-lit/80 text-radio-lit shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_0_8px_rgba(255,51,51,0.2)] led-text-shadow' 
                                  : 'bg-neutral-800/40 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-neutral-850 shadow-btn hover:border-white/10'
                                }
                             `}
                          >
                             {/* Indicator Lamp */}
                             <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-radio-lit led-warm-up' : 'bg-black opacity-30'}`} style={{ color: 'var(--radio-lit)' }}></div>
                             
                             <span className="text-[8px] leading-none mb-0.5">{station}</span>
                             <span className="text-[7px] text-gray-600 block leading-none font-digital font-medium">{getStationFreq(station)}</span>
                          </button>
                       );
                   })}
                </div>
            </div>

            {/* Middle Frame: Interactive Smart Agenda & Planner Manager */}
            <div id="planner-section" className="flex flex-col gap-1">
                <div className="flex justify-between items-end px-1 border-b border-radio-dim/40 pb-1">
                    <label className="text-[10px] font-mono text-radio-dim uppercase tracking-widest pl-1">
                      Daily Schedule & Alarms
                    </label>
                    <div className="flex gap-2">
                       <button
                          type="button"
                          onClick={() => setPlannerTab('interactive')}
                          className={`text-[8.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all flex items-center gap-1 border
                             ${plannerTab === 'interactive' 
                               ? 'bg-neutral-800 border-radio-lit text-radio-lit' 
                               : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300'
                             }`}
                       >
                          <Calendar className="w-2.5 h-2.5" /> Interactive Planner
                       </button>
                       <button
                          type="button"
                          onClick={() => setPlannerTab('textarea')}
                          className={`text-[8.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all flex items-center gap-1 border
                             ${plannerTab === 'textarea' 
                               ? 'bg-neutral-800 border-radio-lit text-radio-lit' 
                               : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300'
                             }`}
                       >
                          <ClockIcon className="w-2.5 h-2.5" /> Raw Agenda Code
                       </button>
                    </div>
                </div>

                <div className="bg-neutral-850/60 rounded border border-white/5 p-3 shadow-inner min-h-[140px] flex flex-col justify-between">
                    {plannerTab === 'interactive' ? (
                       <div className="flex flex-col gap-3">
                          {/* List of custom items */}
                          <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                             {state.calendar.length === 0 ? (
                                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest py-4 text-center">No Calendar Events Placed</p>
                             ) : (
                                state.calendar.map((item) => (
                                   <div 
                                      key={item.id}
                                      className={`flex justify-between items-center p-2 rounded border transition-colors bg-neutral-900 border-neutral-800
                                         ${item.active ? 'opacity-100 hover:border-neutral-700' : 'opacity-40 hover:opacity-60'}
                                      `}
                                   >
                                      <div className="flex items-center gap-3">
                                         <button 
                                            type="button"
                                            onClick={() => handleToggleItem(item.id)}
                                            className="focus:outline-none"
                                            title={item.active ? "Mute Appointment" : "Active Appointment"}
                                         >
                                            <CheckCircle className={`w-4 h-4 transition-colors ${item.active ? 'text-radio-lit' : 'text-gray-600'}`} />
                                         </button>
                                         <span className="font-digital text-sm text-yellow-500 min-w-[45px] tracking-widest">{item.time}</span>
                                         <span className="font-mono text-xs text-gray-300 uppercase tracking-wider truncate max-w-[200px] sm:max-w-md">{item.title}</span>
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                         <span className={`text-[7px] font-mono px-2 py-0.5 rounded-full border uppercase
                                            ${item.vibe === 'work' ? 'bg-orange-950/30 border-orange-850 text-orange-400' :
                                              item.vibe === 'social' ? 'bg-blue-950/30 border-blue-850 text-blue-400' :
                                              item.vibe === 'fitness' ? 'bg-rose-950/30 border-rose-850 text-rose-400' :
                                              item.vibe === 'family' ? 'bg-emerald-950/30 border-emerald-850 text-emerald-400' :
                                              item.vibe === 'chill' ? 'bg-purple-950/30 border-purple-850 text-purple-400' :
                                              'bg-zinc-900 border-zinc-805 text-zinc-500'
                                            }
                                         `}>
                                            {item.vibe || 'general'}
                                         </span>
                                         
                                         <button
                                            type="button"
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="p-1 hover:bg-neutral-800 rounded text-gray-600 hover:text-red-500 transition-colors"
                                         >
                                            <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                      </div>
                                   </div>
                                ))
                             )}
                          </div>

                          {/* Quick Add Form */}
                          <form onSubmit={handleAddNewItem} className="grid grid-cols-1 sm:grid-cols-12 gap-2 border-t border-white/5 pt-3 mt-1">
                             <div className="sm:col-span-3">
                                <input
                                   type="time"
                                   value={newTime}
                                   onChange={(e) => setNewTime(e.target.value)}
                                   className="w-full h-8 px-2 bg-neutral-900 border border-neutral-800 rounded font-digital text-sm text-yellow-500 text-center uppercase focus:outline-none focus:border-radio-lit"
                                />
                             </div>
                             <div className="sm:col-span-5">
                                <input
                                   type="text"
                                   placeholder="NEW APPOINTMENT TITLE..."
                                   value={newTitle}
                                   onChange={(e) => setNewTitle(e.target.value)}
                                   required
                                   className="w-full h-8 px-2.5 bg-neutral-900 border border-neutral-800 rounded font-mono text-xs text-amber-300 placeholder-yellow-800/30 uppercase focus:outline-none focus:border-radio-lit"
                                />
                             </div>
                             <div className="sm:col-span-2">
                                <select
                                   value={newVibe}
                                   onChange={(e) => setNewVibe(e.target.value)}
                                   className="w-full h-8 px-1 bg-neutral-900 border border-neutral-800 rounded font-mono text-[10px] text-gray-400 uppercase focus:outline-none focus:border-radio-lit"
                                >
                                   <option value="general">GENERAL</option>
                                   <option value="work">WORK</option>
                                   <option value="social">SOCIAL</option>
                                   <option value="fitness">FITNESS</option>
                                   <option value="family">FAMILY</option>
                                   <option value="chill">CHILL</option>
                                </select>
                             </div>
                             <div className="sm:col-span-2">
                                <button
                                   type="submit"
                                   className="w-full h-8 flex items-center justify-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white border border-white/5 font-mono text-[10px] font-bold rounded uppercase transition-colors"
                                >
                                   <Plus className="w-3.5 h-3.5" /> Add
                                </button>
                             </div>
                          </form>
                       </div>
                    ) : (
                       /* Retro Code Textarea View */
                       <textarea 
                           className="w-full bg-transparent font-mono text-sm text-amber-300 placeholder-yellow-800/30 outline-none px-2 uppercase tracking-wider resize-none h-32 scrollbar-thin scrollbar-thumb-yellow-900 scrollbar-track-transparent"
                           placeholder="ENTER AGENDA CODES (E.G. 0800 MEETING)..." 
                           value={state.agenda}
                           onChange={(e) => syncTextareaToCalendar(e.target.value)}
                       />
                    )}
                </div>
            </div>

            {/* Bottom: Control Deck */}
            <div id="btn-con-deck" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-auto">
                {/* Next Alarm Summary */}
                <div
                    id="deck-next-alarm"
                    className="col-span-1 sm:col-span-3 bg-radio-btn rounded shadow-btn active:shadow-btn-pressed transition-all relative overflow-hidden group border-t border-white/5 p-3 flex flex-col justify-center"
                >
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Next Broadcast</span>
                    <span className="text-sm sm:text-base font-mono text-radio-lit uppercase tracking-wider truncate led-text-shadow">
                        {getAlarmStatusText(state.alarms)}
                    </span>
                </div>

                {/* Big Action Render Button */}
                <button
                   id="deck-btn-play"
                   onClick={() => {
                     if (state.status === 'playing' || state.status === 'playing_briefing') {
                        ttsPlayerRef.current.stop();
                        stopOfflineFallback();
                        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.stopVideo === 'function') {
                          youtubePlayerRef.current.stopVideo();
                        }
                        setState(prev => ({ ...prev, status: 'idle', currentAlarmId: null }));
                     } else if (state.status === 'idle') {
                        handleGenerateAndPlay();
                     }
                   }}
                   disabled={state.status !== 'idle' && state.status !== 'playing' && state.status !== 'playing_briefing'}
                   className={`btn-spring col-span-1 rounded shadow-btn active:shadow-btn-pressed flex flex-col items-center justify-center p-2 border-t border-white/5 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-radio-lit focus-visible:ring-inset`}
                   aria-label={state.status === 'playing' || state.status === 'playing_briefing' ? 'Stop Tuner' : 'Generate broadcast'}
                >
                   {state.status === 'playing' || state.status === 'playing_briefing' ? (
                      <Power className="w-5 h-5 text-red-500 mb-1 drop-shadow-[0_0_3px_rgba(239,68,68,0.5)]" />
                   ) : state.status !== 'idle' ? (
                      <Loader2 className="w-5 h-5 text-yellow-500 animate-spin mb-1" />
                   ) : (
                      <Play className="w-5 h-5 text-green-500 mb-1 drop-shadow-[0_0_3px_rgba(34,197,94,0.5)]" />
                   )}
                   <span className="text-[8px] font-bold text-gray-300 uppercase">
                      {state.status === 'playing' || state.status === 'playing_briefing' ? 'STOP' : 'TUNE IN'}
                   </span>
                </button>
            </div>

         </div>

      </div>



      {/* Weather service attribution */}
      {state.weather && (
        <a 
          href="https://open-meteo.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="absolute bottom-2 right-4 text-[10px] text-white/20 font-mono hover:text-white/50 transition-colors z-0"
        >
          Weather data by Open-Meteo
        </a>
      )}

      <PWAInstallPrompt />

      {/* Screen Saver Overlay */}
      {isScreenSaverActive && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-6 cursor-pointer transition-opacity duration-700"
          onClick={() => setIsScreenSaverActive(false)}
        >
          <div className="text-center">
            <Clock isAlarmActive={isAnyAlarmActive} />
            {isAnyAlarmActive && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-radio-lit animate-pulse shadow-[0_0_8px_rgba(255,51,51,0.8)]" />
                <span className="text-radio-lit font-mono text-xs uppercase tracking-widest">Alarm Armed</span>
              </div>
            )}
          </div>
          <span className="text-gray-600 font-mono text-[10px] uppercase tracking-widest animate-pulse">
            Tap to wake
          </span>
        </div>
      )}

      {/* Autoplay Unlock Overlay */}
      {isAutoplayBlocked && (
        <div 
          className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center gap-4 cursor-pointer"
          onClick={() => {
            if (youtubePlayerRef.current?.playVideo) {
              youtubePlayerRef.current.playVideo();
            }
            setIsAutoplayBlocked(false);
          }}
        >
          <span className="text-radio-lit font-mono text-sm uppercase tracking-widest animate-pulse">
            Broadcast Muted (Click to Listen)
          </span>
          <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest">
            Tap anywhere to unlock audio
          </span>
        </div>
      )}
    </div>
  );
};

export default App;

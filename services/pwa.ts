export interface PWAState {
  isInstalled: boolean;
  installPrompt: Event | null;
  notificationsEnabled: boolean;
}

type InstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
};

let deferredPrompt: InstallPromptEvent | null = null;

export const registerServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[PWA] Service Worker registered:', registration.scope);
    } catch (err) {
      console.warn('[PWA] Service Worker registration failed:', err);
    }
  }
};

export const captureInstallPrompt = (event: Event): void => {
  event.preventDefault();
  deferredPrompt = event as InstallPromptEvent;
};

export const getDeferredPrompt = (): InstallPromptEvent | null => {
  if (deferredPrompt) return deferredPrompt;
  const win = window as unknown as Window & { deferredInstallPrompt?: InstallPromptEvent | null };
  return win.deferredInstallPrompt || null;
};

export const clearDeferredPrompt = (): void => {
  deferredPrompt = null;
};

export const installPWA = async (): Promise<boolean> => {
  const prompt = getDeferredPrompt();
  if (!prompt) return false;
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

export const sendAlarmNotification = (title: string, body: string): void => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      url: window.location.href
    });
  } else {
    const options: NotificationOptions & { vibrate?: number[] } = {
      body,
      icon: '/icon.svg',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200]
    };
    new Notification(title, options);
  }
};

export const isOnline = (): boolean => navigator.onLine;

export const isStandalone = (): boolean => {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (window.matchMedia('(display-mode: standalone)').matches) ||
         (nav.standalone === true);
};

const urlBase64ToUint8Array = (base64url: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

export const getExistingPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

export const subscribeToPush = async (vapidPublicKey: string): Promise<PushSubscription | null> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return subscription;
};

export const unsubscribeFromPush = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    return subscription.unsubscribe();
  }
  return false;
};

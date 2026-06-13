export interface PWAState {
  isInstalled: boolean;
  installPrompt: Event | null;
  notificationsEnabled: boolean;
}

let deferredPrompt: any = null;

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
  deferredPrompt = event;
};

export const getDeferredPrompt = (): any => {
  if (deferredPrompt) return deferredPrompt;
  return (window as any).deferredInstallPrompt || null;
};

export const clearDeferredPrompt = (): void => {
  deferredPrompt = null;
};

export const installPWA = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  (deferredPrompt as any).prompt();
  const { outcome } = await (deferredPrompt as any).userChoice;
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
    new Notification(title, {
      body,
      icon: '/icon.svg',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200]
    } as any);
  }
};

export const isOnline = (): boolean => navigator.onLine;

export const isStandalone = (): boolean => {
  return (window.matchMedia('(display-mode: standalone)').matches) ||
         ((window as any).navigator?.standalone === true);
};

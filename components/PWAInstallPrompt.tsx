import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { installPWA, getDeferredPrompt, isStandalone, clearDeferredPrompt, captureInstallPrompt } from '../services/pwa';

export const PWAInstallPrompt: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedRaw = localStorage.getItem('lyria_install_dismissed');
    if (dismissedRaw) {
      const dismissedAt = parseInt(dismissedRaw, 10);
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      if (!Number.isNaN(dismissedAt) && Date.now() - dismissedAt < SEVEN_DAYS) {
        return;
      }
      localStorage.removeItem('lyria_install_dismissed');
    }

    const checkPrompt = () => {
      if (getDeferredPrompt()) {
        setVisible(true);
      }
    };

    // Check immediately and after a delay (in case prompt fires late)
    checkPrompt();
    const timer = setTimeout(checkPrompt, 2000);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      captureInstallPrompt(e);
      setVisible(true);
    };

    const onAppInstalled = () => {
      setVisible(false);
      clearDeferredPrompt();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const accepted = await installPWA();
    if (accepted) {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('lyria_install_dismissed', String(Date.now()));
    setVisible(false);
    clearDeferredPrompt();
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 border border-radio-lit/30 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
      <Download className="w-4 h-4 text-radio-lit flex-shrink-0" />
      <div className="flex flex-col">
        <span className="text-[10px] font-mono text-white uppercase tracking-wider">Install AetherClock</span>
        <span className="text-[8px] font-mono text-gray-400">Add to home screen for offline access</span>
      </div>
      <button
        onClick={handleInstall}
        className="ml-2 px-3 py-1 bg-radio-lit/10 hover:bg-radio-lit/20 border border-radio-lit/40 rounded text-[9px] font-mono text-radio-lit uppercase tracking-wider transition-colors"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 text-gray-500 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

import { useState, useEffect } from 'react';

function checkIsStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function checkIsIos() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIosDevice = /iphone|ipad|ipod/i.test(ua);
  const isMacTouch = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 0;
  return isIosDevice || isMacTouch;
}

export function usePwaInstall() {
  const [isStandalone, setIsStandalone] = useState(checkIsStandalone);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem('pwa_install_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const isIos = checkIsIos();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e) => {
      if (e.matches) setIsStandalone(true);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleMediaChange);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  const promptInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
        return { outcome: choiceResult.outcome };
      } catch (err) {
        console.error('Error triggering PWA install prompt:', err);
      }
    }
    return { outcome: 'manual_guide' };
  };

  const dismissPrompt = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('pwa_install_dismissed', 'true');
    } catch (err) {
      console.error('Error saving dismissal state:', err);
    }
  };

  const resetDismiss = () => {
    setIsDismissed(false);
    try {
      localStorage.removeItem('pwa_install_dismissed');
    } catch (err) {
      console.error('Error removing dismissal state:', err);
    }
  };

  return {
    isStandalone,
    canPromptNative: !!deferredPrompt,
    isIos,
    isDismissed,
    promptInstall,
    dismissPrompt,
    resetDismiss,
  };
}

import { registerSW } from 'virtual:pwa-register';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export type PwaSnapshot = {
  isInstalled: boolean;
  isInstallable: boolean;
  isOffline: boolean;
  updateAvailable: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();

let state: PwaSnapshot = {
  isInstalled: false,
  isInstallable: false,
  isOffline: false,
  updateAvailable: false,
};

let initialized = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

function isLocalhostHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function emit() {
  for (const listener of listeners) listener();
}

function setState(partial: Partial<PwaSnapshot>) {
  state = { ...state, ...partial };
  emit();
}

function detectInstalledMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

export function getPwaSnapshot(): PwaSnapshot {
  return state;
}

export function subscribeToPwaState(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function canPromptInstall() {
  return deferredPrompt != null;
}

export function isIosInstallHintAvailable() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isSafari = ua.includes('safari') && !/(crios|fxios|edgios)/.test(ua);
  return isIos && isSafari && !detectInstalledMode();
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    deferredPrompt = null;
    setState({ isInstallable: false });
    return true;
  }
  return false;
}

export async function applyPwaUpdate() {
  if (!updateServiceWorker) return;
  await updateServiceWorker(true);
}

export function refreshPwaApp() {
  if (typeof window === 'undefined') return;
  window.location.reload();
}

export function initializePwa() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  setState({
    isInstalled: detectInstalledMode(),
    isInstallable: deferredPrompt != null && !detectInstalledMode(),
    isOffline: navigator.onLine === false,
    updateAvailable: false,
  });

  const syncInstallState = () => {
    setState({
      isInstalled: detectInstalledMode(),
      isInstallable: deferredPrompt != null && !detectInstalledMode(),
    });
  };

  window.addEventListener('online', () => setState({ isOffline: false }));
  window.addEventListener('offline', () => setState({ isOffline: true }));
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setState({ isInstalled: true, isInstallable: false });
  });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    syncInstallState();
  });

  const standaloneMedia = window.matchMedia('(display-mode: standalone)');
  const fullscreenMedia = window.matchMedia('(display-mode: fullscreen)');
  standaloneMedia.addEventListener?.('change', syncInstallState);
  fullscreenMedia.addEventListener?.('change', syncInstallState);

  if (
    'serviceWorker' in navigator &&
    import.meta.env.PROD &&
    !isLocalhostHost(window.location.hostname)
  ) {
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        setState({ updateAvailable: true });
      },
      onRegisteredSW() {
        setState({ updateAvailable: false });
      },
    });
  }
}

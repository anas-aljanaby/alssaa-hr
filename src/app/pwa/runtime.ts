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
let idleApplyTimer: ReturnType<typeof setTimeout> | null = null;

// How often to poll the server for a new service worker while the app is open.
const SW_UPDATE_POLL_MS = 30 * 60 * 1000;
// After an update is detected, wait this long with no user input before silently applying.
const IDLE_AUTO_APPLY_MS = 30 * 1000;

function isLocalhostHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isSwEnabledOnLocalhostBuild(): boolean {
  return import.meta.env.VITE_ENABLE_SW_ON_LOCALHOST === 'true';
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

// Call this from "safe" route boundaries (e.g. arriving at a login screen, a
// dashboard root, or just after a successful save) to silently apply a pending
// update without interrupting whatever the user is doing.
export async function applyUpdateIfPending() {
  if (!state.updateAvailable || !updateServiceWorker) return false;
  await updateServiceWorker(true);
  return true;
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

  const shouldRegisterSw =
    'serviceWorker' in navigator &&
    import.meta.env.PROD &&
    (!isLocalhostHost(window.location.hostname) || isSwEnabledOnLocalhostBuild());

  if (shouldRegisterSw) {
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        setState({ updateAvailable: true });
        scheduleIdleAutoApply();
      },
      onRegisteredSW(_swUrl, registration) {
        setState({ updateAvailable: false });
        if (registration) setupAutoUpdateTriggers(registration);
      },
    });
  }
}

function clearIdleApplyTimer() {
  if (idleApplyTimer) {
    clearTimeout(idleApplyTimer);
    idleApplyTimer = null;
  }
}

// Reset on every user input. If the user is idle for IDLE_AUTO_APPLY_MS while
// an update is waiting, apply silently — the reload happens during dead time
// rather than mid-flow.
function scheduleIdleAutoApply() {
  if (!state.updateAvailable) return;
  clearIdleApplyTimer();
  idleApplyTimer = setTimeout(() => {
    if (state.updateAvailable && updateServiceWorker) {
      void updateServiceWorker(true);
    }
  }, IDLE_AUTO_APPLY_MS);
}

function setupAutoUpdateTriggers(registration: ServiceWorkerRegistration) {
  const checkForUpdate = () => {
    void registration.update().catch(() => {});
  };

  // Poll periodically. The browser only checks for a new SW on navigation by
  // default, which never fires for installed PWAs that just sit in the
  // background — this is the main fix for "users still on yesterday's bundle".
  setInterval(checkForUpdate, SW_UPDATE_POLL_MS);

  // Also check whenever the user comes back to the app.
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate();
    } else if (state.updateAvailable && updateServiceWorker) {
      // Tab/PWA went to background with an update waiting — safest moment to
      // apply, since nothing the user sees gets disrupted.
      void updateServiceWorker(true);
    }
  });

  // Reset the idle timer on any user input so we only auto-apply during true idle.
  const resetIdle = () => scheduleIdleAutoApply();
  document.addEventListener('pointerdown', resetIdle, { passive: true, capture: true });
  document.addEventListener('keydown', resetIdle, { capture: true });
  document.addEventListener('touchstart', resetIdle, { passive: true, capture: true });
  document.addEventListener('scroll', resetIdle, { passive: true, capture: true });
}

export const OFFLINE_ACTION_MESSAGE = 'الاتصال بالإنترنت مطلوب لإتمام هذه العملية.';
export const OFFLINE_LOGIN_MESSAGE = 'الاتصال بالإنترنت مطلوب لتسجيل الدخول.';

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isOfflineError(error: unknown): boolean {
  if (isBrowserOffline()) return true;

  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: string })?.message === 'string'
        ? (error as { message: string }).message
        : String(error ?? '');

  const normalized = message.toLowerCase();
  return [
    'failed to fetch',
    'networkerror',
    'network request failed',
    'load failed',
    'offline',
    'the internet connection appears to be offline',
  ].some((fragment) => normalized.includes(fragment));
}


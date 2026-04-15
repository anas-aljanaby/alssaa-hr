import { supabase } from '../supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] isPushSupported: VITE_VAPID_PUBLIC_KEY is not set — push disabled');
    return false;
  }
  // On iOS, Web Push only works when the PWA is installed to the home screen (standalone mode).
  // Warn in the console if running in the browser so the dev knows why push won't work there.
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  if (isIos && !isStandalone) {
    console.warn(
      '[push] isPushSupported: iOS detected but app is NOT in standalone mode. ' +
      'Install the app to the home screen for push notifications to work.'
    );
    // Still return true so the banner can show an install hint; pushManager.subscribe() will fail gracefully.
  }
  return true;
}

export function getPushPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Subscribe the current browser to push notifications and persist the
 * subscription in Supabase. Safe to call multiple times — upserts by endpoint.
 * Returns true when the subscription was successfully stored.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('[push] subscribeToPush: push not supported on this browser/device');
    return false;
  }
  if (getPushPermission() !== 'granted') {
    console.warn('[push] subscribeToPush: permission is', getPushPermission(), '— must be "granted"');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    console.log('[push] service worker ready, scope:', registration.scope);

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('[push] no existing subscription — creating new one');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });
      console.log('[push] new subscription created, endpoint:', subscription.endpoint);
    } else {
      console.log('[push] reusing existing subscription, endpoint:', subscription.endpoint);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[push] failed to fetch profile:', profileError.message);
      return false;
    }
    if (!profile?.org_id) {
      console.error('[push] profile has no org_id for userId:', userId);
      return false;
    }

    const sub = subscription.toJSON() as { endpoint: string; keys?: Record<string, string> };

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          org_id: profile.org_id,
          endpoint: sub.endpoint,
          subscription: sub,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('[push] failed to save subscription to DB:', error.message, error.details);
      return false;
    }

    console.log('[push] subscription saved successfully for user', userId);
    return true;
  } catch (err) {
    console.error('[push] subscribeToPush threw an error:', err);
    return false;
  }
}

/** Remove the current browser's push subscription locally and from Supabase. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = (subscription.toJSON() as { endpoint: string }).endpoint;
    await subscription.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch { /* ignore */ }
}

/**
 * Request notification permission and, if granted, subscribe to push.
 * Returns the resulting permission state.
 */
export async function requestAndSubscribe(userId: string): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await subscribeToPush(userId);
  return permission;
}

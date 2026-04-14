import { supabase } from '../supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  );
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
  if (!isPushSupported()) return false;
  if (getPushPermission() !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (!profile?.org_id) return false;

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

    return !error;
  } catch {
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

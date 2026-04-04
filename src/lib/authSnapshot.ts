import type { User } from '@/app/data/mockData';

const AUTH_SNAPSHOT_KEY = 'alssaa-hr.auth-snapshot';

type AuthSnapshot = {
  user: User;
  cachedAt: string;
};

export function saveAuthSnapshot(user: User) {
  if (typeof window === 'undefined') return;
  const snapshot: AuthSnapshot = {
    user,
    cachedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function getAuthSnapshot(expectedUserId?: string): User | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(AUTH_SNAPSHOT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSnapshot>;
    const user = parsed.user;
    if (!user || typeof user !== 'object') return null;
    if (expectedUserId && user.uid !== expectedUserId) return null;
    return user as User;
  } catch {
    return null;
  }
}

export function clearAuthSnapshot() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_SNAPSHOT_KEY);
}

